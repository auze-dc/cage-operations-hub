begin;
alter table opportunity_matches drop constraint if exists opportunity_matches_opportunity_type_check;
alter table opportunity_matches add constraint opportunity_matches_opportunity_type_check check(opportunity_type in ('Grant','Tender / RFQ','Contract','Partnership'));
alter table opportunity_matches add column if not exists updated_at timestamptz not null default now();
create table if not exists opportunity_tracking(
 opportunity_id uuid primary key references opportunity_matches(id) on delete cascade,
 organization_id uuid not null references organizations(id),stage text not null default 'New' check(stage in ('New','Saved','Applying','Submitted','Awarded','Unsuccessful','Archived')),
 owner_id uuid references profiles(id),decision text not null default 'Undecided' check(decision in ('Undecided','Bid','No bid')),
 notes text not null default '',submission_reference text not null default '',submitted_on date,
 checklist jsonb not null default '[]',links jsonb not null default '{}',verified jsonb not null default '{}',
 version integer not null default 1,updated_by uuid references profiles(id),updated_at timestamptz not null default now());
create table if not exists opportunity_scan_settings(organization_id uuid primary key references organizations(id),frequency text not null default 'twice_daily' check(frequency in ('manual','daily','twice_daily')),reminders boolean not null default true,disabled_sources jsonb not null default '[]',updated_at timestamptz not null default now());
create table if not exists opportunity_scan_runs(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),started_at timestamptz not null default now(),finished_at timestamptz,status text not null default 'running',sources jsonb not null default '[]',added integer not null default 0,updated integer not null default 0,checked integer not null default 0,error text);
create index if not exists opportunity_runs_recent on opportunity_scan_runs(organization_id,started_at desc);
alter table opportunity_tracking enable row level security;
alter table opportunity_scan_settings enable row level security;
alter table opportunity_scan_runs enable row level security;
revoke all on opportunity_tracking,opportunity_scan_settings,opportunity_scan_runs from anon,authenticated;
grant all on opportunity_tracking,opportunity_scan_settings,opportunity_scan_runs to service_role;
revoke update,insert,delete on opportunity_matches from authenticated;
create or replace function opportunity_access(editing boolean default false) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and active and role<>'shared') and case when editing then module_level('commercial')='edit' else module_level('commercial') in ('view','edit') end
$$;
create or replace function opportunity_dashboard() returns jsonb language plpgsql security definer set search_path=public as $$
declare org uuid:=current_organization_id();result jsonb;
begin
 if not opportunity_access() then raise exception 'Opportunity access required';end if;
 select jsonb_build_object('matches',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('tracking',to_jsonb(t)) order by m.found_at desc) from opportunity_matches m left join opportunity_tracking t on t.opportunity_id=m.id where m.organization_id=org),'[]'::jsonb),
 'runs',coalesce((select jsonb_agg(to_jsonb(r) order by r.started_at desc) from (select * from opportunity_scan_runs where organization_id=org order by started_at desc limit 10) r),'[]'::jsonb),
 'settings',coalesce((select to_jsonb(s) from opportunity_scan_settings s where organization_id=org),jsonb_build_object('frequency','twice_daily','reminders',true,'disabled_sources','[]'::jsonb)),
 'staff',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',full_name)) from profiles where organization_id=org and active and role<>'shared'),'[]'::jsonb),
 'canScan',opportunity_access(true) and exists(select 1 from profiles where id=auth.uid() and role in ('admin','manager')),
 'canEdit',opportunity_access(true)) into result;
 return result;
end $$;
create or replace function opportunity_save(target uuid,expected_version integer,details jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare org uuid:=current_organization_id();t opportunity_tracking;owner uuid;ln jsonb;w jsonb;v jsonb;
begin
 if not opportunity_access(true) then raise exception 'Commercial edit access required';end if;
 perform 1 from opportunity_matches where id=target and organization_id=org for update;if not found then raise exception 'Opportunity not found';end if;
 select * into t from opportunity_tracking where opportunity_id=target;
 if coalesce(t.version,0)<>expected_version then raise exception 'This opportunity changed. Reopen it before saving.';end if;
 owner:=nullif(details->>'owner_id','')::uuid;
 if owner is not null and not exists(select 1 from profiles where id=owner and organization_id=org and active and role<>'shared') then raise exception 'Choose an active staff member';end if;
 if length(coalesce(details->>'notes',''))>10000 or length(coalesce(details->>'submission_reference',''))>300 then raise exception 'Notes or reference too long';end if;
 if coalesce(details->>'stage','New')='Submitted' and (nullif(details->>'submitted_on','') is null or nullif(trim(details->>'submission_reference'),'') is null) then raise exception 'Record the submission date and reference';end if;
 if nullif(details->>'submitted_on','')::date>(now() at time zone 'Africa/Blantyre')::date then raise exception 'Submission date cannot be in the future';end if;
 if jsonb_typeof(coalesce(details->'checklist','[]'))<>'array' or jsonb_array_length(coalesce(details->'checklist','[]'))>30 then raise exception 'Checklist is invalid';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(details->'checklist','[]')) x where length(coalesce(x->>'label','')) not between 1 and 200 or jsonb_typeof(x->'done') is distinct from 'boolean') then raise exception 'Check each checklist item';end if;
 ln:=coalesce(details->'links','{}');select data into w from workspace_states where organization_id=org;
 if coalesce(ln->>'project','')<>'' and not exists(select 1 from jsonb_array_elements(coalesce(w->'projects','[]')) x where x->>'id'=ln->>'project' and record_visible('projects',x,w)) then raise exception 'Project access required';end if;
 if coalesce(ln->>'deal','')<>'' and not exists(select 1 from jsonb_array_elements(coalesce(w->'deals','[]')) x where x->>'id'=ln->>'deal' and record_visible('deals',x,w)) then raise exception 'CRM access required';end if;
 v:=coalesce(details->'verified','{}');
 if length(v::text)>6000 then raise exception 'Verified details are too long';end if;
 if coalesce(v->>'deadline','')<>'' then perform (v->>'deadline')::date;end if;
 if coalesce(v->>'eligibility','Needs review') not in ('Needs review','Direct applicant','Partner required','Not eligible') then raise exception 'Invalid eligibility';end if;
 if coalesce(v->>'confirmed','false')='true' then v:=v||jsonb_build_object('by',auth.uid(),'at',now());else v:='{}';end if;
 insert into opportunity_tracking(opportunity_id,organization_id,stage,owner_id,decision,notes,submission_reference,submitted_on,checklist,links,verified,version,updated_by)
 values(target,org,coalesce(details->>'stage','New'),owner,coalesce(details->>'decision','Undecided'),coalesce(details->>'notes',''),coalesce(details->>'submission_reference',''),nullif(details->>'submitted_on','')::date,coalesce(details->'checklist','[]'),ln,v,expected_version+1,auth.uid())
 on conflict(opportunity_id) do update set stage=excluded.stage,owner_id=excluded.owner_id,decision=excluded.decision,notes=excluded.notes,submission_reference=excluded.submission_reference,submitted_on=excluded.submitted_on,checklist=excluded.checklist,links=excluded.links,verified=excluded.verified,version=excluded.version,updated_by=excluded.updated_by,updated_at=now();
 insert into audit_log(organization_id,actor_id,action,entity_type,entity_id,new_data) values(org,auth.uid(),'Opportunity updated','opportunity',target::text,jsonb_build_object('stage',details->>'stage','version',expected_version+1));
 return opportunity_dashboard();
end $$;
create or replace function opportunity_settings_save(details jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not opportunity_access(true) or not exists(select 1 from profiles where id=auth.uid() and role in ('admin','manager')) then raise exception 'Manager access required';end if;
 if jsonb_typeof(coalesce(details->'disabled_sources','[]'))<>'array' or length(details::text)>3000 then raise exception 'Invalid settings';end if;
 insert into opportunity_scan_settings(organization_id,frequency,reminders,disabled_sources) values(current_organization_id(),details->>'frequency',coalesce((details->>'reminders')::boolean,true),coalesce(details->'disabled_sources','[]')) on conflict(organization_id) do update set frequency=excluded.frequency,reminders=excluded.reminders,disabled_sources=excluded.disabled_sources,updated_at=now();
 return opportunity_dashboard();
end $$;
create or replace function opportunity_add(details jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare org uuid:=current_organization_id();url text:=trim(details->>'url');target uuid;
begin
 if not opportunity_access(true) then raise exception 'Commercial edit access required';end if;
 if length(coalesce(details->>'title','')) not between 5 and 500 or length(url)>2000 or url !~ '^https://[a-zA-Z0-9.-]+(/|$)' then raise exception 'Enter a title and valid HTTPS source URL';end if;
 perform pg_advisory_xact_lock(hashtext(org::text||url));
 select id into target from opportunity_matches where organization_id=org and source_url=url limit 1;
 if target is null then
 insert into opportunity_matches(organization_id,external_key,title,organization,opportunity_type,source_name,source_url,match_score,match_reason,raw_data) values(org,'manual-'||md5(url),details->>'title',left(coalesce(details->>'organization','Not stated'),300),details->>'type','Added by staff',url,50,'Added by staff; verify eligibility and requirements.',jsonb_build_object('verification','Staff-added — verification required','geography','Not stated','deadlineLabel','Not stated','estimatedValue','Not stated')) returning id into target;
 insert into audit_log(organization_id,actor_id,action,entity_type,entity_id) values(org,auth.uid(),'Opportunity added','opportunity',target::text);
 end if;
 return jsonb_build_object('id',target,'dashboard',opportunity_dashboard());
end $$;
revoke all on function opportunity_add(jsonb) from public,anon;
grant execute on function opportunity_add(jsonb) to authenticated;
-- Preserve older results that existed only in the shared JSON workspace.
do $$declare w record;x jsonb;target uuid;d date;u text;begin
 for w in select organization_id,data from workspace_states loop
 for x in select value from jsonb_array_elements(coalesce(w.data->'opportunityMatches','[]')) loop
 u:=x->>'url';if coalesce(u,'') !~ '^https://' or coalesce(x->>'title','')='' then continue;end if;
 select id into target from opportunity_matches where organization_id=w.organization_id and source_url=u limit 1;
 if target is null then
 begin d:=nullif(nullif(x->>'deadline','Rolling'),'')::date;exception when others then d:=null;end;
 insert into opportunity_matches(organization_id,external_key,title,organization,opportunity_type,source_name,source_url,deadline,match_score,match_reason,raw_data)
 values(w.organization_id,'legacy-'||md5(u),x->>'title',x->>'organisation',case when x->>'type' in ('Grant','Tender / RFQ','Contract','Partnership') then x->>'type' else 'Tender / RFQ' end,x->>'platform',u,d,greatest(0,least(100,coalesce(nullif(x->>'match','')::numeric,50)::int)),coalesce(x->>'reason','Legacy result; review the source'),x||jsonb_build_object('verification','Legacy result — staff verification required','deadlineLabel',coalesce(x->>'deadline','Not stated'))) returning id into target;
 end if;
 insert into opportunity_tracking(opportunity_id,organization_id,stage,links) values(target,w.organization_id,case when x->>'status'='Dismissed' then 'Archived' when coalesce(x->>'request','')<>'' then 'Applying' when x->>'status'='Reviewed' then 'Saved' else 'New' end,jsonb_build_object('request',x->>'request')) on conflict do nothing;
 end loop;end loop;
end $$;
-- A server-side lease prevents overlapping manual and scheduled scans.
create or replace function opportunity_scan_begin(org uuid,manual boolean default false) returns uuid language plpgsql security definer set search_path=public as $$
declare r uuid;frequency text;last_run timestamptz;
begin
 perform pg_advisory_xact_lock(hashtext('opportunity:'||org));
 update opportunity_scan_runs set status='interrupted',finished_at=now(),error='Scan did not finish; existing results retained.' where organization_id=org and status='running' and started_at<now()-interval '5 minutes';
 if exists(select 1 from opportunity_scan_runs where organization_id=org and status='running') then return null;end if;
 select s.frequency into frequency from opportunity_scan_settings s where organization_id=org;
 select max(started_at) into last_run from opportunity_scan_runs where organization_id=org;
 if manual and last_run>now()-interval '2 minutes' then return null;end if;
 if not manual and frequency='daily' and extract(hour from now() at time zone 'Africa/Blantyre')>=12 then return null;end if;
 if not manual and (frequency='manual' or last_run>now()-case when frequency='daily' then interval '23 hours' else interval '11 hours' end) then return null;end if;
 insert into opportunity_scan_runs(organization_id) values(org) returning id into r;return r;
end $$;
revoke all on function opportunity_scan_begin(uuid,boolean) from public,anon,authenticated;
grant execute on function opportunity_scan_begin(uuid,boolean) to service_role;
revoke all on function opportunity_dashboard(),opportunity_save(uuid,integer,jsonb),opportunity_settings_save(jsonb),opportunity_access(boolean) from public,anon;
grant execute on function opportunity_dashboard(),opportunity_save(uuid,integer,jsonb),opportunity_settings_save(jsonb),opportunity_access(boolean) to authenticated;
-- Discovery must not silently trigger the legacy opportunity email broadcaster.
drop trigger if exists queue_opportunity_digest on opportunity_matches;
-- New evidence follows commercial permissions and is scoped to its organization.
do $$declare p record;expr text;chk text;begin
 for p in select * from pg_policies where (schemaname='public' and tablename='attachments' and policyname in ('attachment module read','attachment module upload')) or (schemaname='storage' and tablename='objects' and policyname in ('file module read','file module upload')) loop
 expr:=replace(p.qual,'''quote_order''::text THEN ''finance''::text','''opportunity''::text THEN ''commercial''::text WHEN ''quote_order''::text THEN ''finance''::text');
 chk:=replace(p.with_check,'''quote_order''::text THEN ''finance''::text','''opportunity''::text THEN ''commercial''::text WHEN ''quote_order''::text THEN ''finance''::text');
 if expr is not null then execute format('alter policy %I on %I.%I using (%s)',p.policyname,p.schemaname,p.tablename,expr);end if;
 if chk is not null then execute format('alter policy %I on %I.%I with check (%s)',p.policyname,p.schemaname,p.tablename,chk);end if;
 end loop;
end $$;
create or replace function opportunity_file_access(rid text,editing boolean default false) returns boolean language sql stable security definer set search_path=public as $$select opportunity_access(editing) and exists(select 1 from opportunity_matches where id::text=rid and organization_id=current_organization_id())$$;
drop policy if exists opportunity_attachment_scope on attachments;
create policy opportunity_attachment_scope on attachments as restrictive for all to authenticated using(record_type<>'opportunity' or opportunity_file_access(record_id)) with check(record_type<>'opportunity' or (opportunity_file_access(record_id,true) and uploaded_by=auth.uid() and starts_with(storage_path,current_organization_id()::text||'/opportunity/'||record_id||'/')));
drop policy if exists opportunity_storage_scope on storage.objects;
create policy opportunity_storage_scope on storage.objects as restrictive for all to authenticated using(split_part(name,'/',2)<>'opportunity' or (bucket_id='cage-files' and split_part(name,'/',1)=current_organization_id()::text and opportunity_file_access(split_part(name,'/',3)))) with check(split_part(name,'/',2)<>'opportunity' or (bucket_id='cage-files' and split_part(name,'/',1)=current_organization_id()::text and opportunity_file_access(split_part(name,'/',3),true)));
do $$declare src text;begin
 select pg_get_functiondef('public.linked_file_visible(text,text)'::regprocedure) into src;
 if position('opportunity_file_access(rid)' in src)=0 then src:=replace(src,'if is_admin() then', 'if kind=''opportunity'' then return opportunity_file_access(rid);end if; if is_admin() then');
 execute src;end if;
end $$;
revoke all on function opportunity_file_access(text,boolean) from public,anon;
grant execute on function opportunity_file_access(text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
