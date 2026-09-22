begin;
-- Additive upgrade: existing workspace events and Academy records remain untouched.
create table if not exists public.hub_notices(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),author_id uuid not null references profiles(id),
 title text not null check(length(title) between 1 and 200),body text not null check(length(body)<=30000),category text not null default 'General',
 priority text not null default 'Normal' check(priority in ('Normal','Important','Urgent')),status text not null default 'draft' check(status in ('draft','scheduled','published','archived')),
 audience text not null default 'everyone' check(audience in ('everyone','members','team','project','cohort')),audience_key text,target_users uuid[] not null default '{}',
 publish_at timestamptz not null default now(),expires_at timestamptz,pinned boolean not null default false,require_ack boolean not null default false,email_enabled boolean not null default false,
 links jsonb not null default '[]',version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(expires_at is null or expires_at>publish_at)
);
create table if not exists public.hub_notice_reads(notice_id uuid references hub_notices(id) on delete cascade,user_id uuid references profiles(id),read_at timestamptz not null default now(),ack_at timestamptz,primary key(notice_id,user_id));
create table if not exists public.hub_notice_files(id uuid primary key default gen_random_uuid(),notice_id uuid not null references hub_notices(id),path text not null unique,name text not null,created_at timestamptz not null default now());
create table if not exists public.hub_events(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),organizer_id uuid not null references profiles(id),
 title text not null check(length(title) between 1 and 200),description text not null default '' check(length(description)<=30000),location text not null default '',meeting_url text not null default '',category text not null default 'Meeting',
 starts_at timestamptz not null,ends_at timestamptz not null,all_day boolean not null default false,visibility text not null default 'private' check(visibility in ('private','organization')),
 recurrence text not null default 'none' check(recurrence in ('none','daily','weekly','monthly')),repeat_interval integer not null default 1 check(repeat_interval between 1 and 12),repeat_count integer check(repeat_count between 1 and 366),repeat_until date,
 reminder_minutes integer[] not null default '{30}',email_enabled boolean not null default false,status text not null default 'active' check(status in ('active','cancelled')),
 link_type text,link_id text,notice_id uuid references hub_notices(id),version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(ends_at>starts_at and ends_at<=starts_at+interval '31 days'),check(recurrence='none' or repeat_count is not null or repeat_until is not null),check(repeat_until is null or repeat_until between (starts_at at time zone 'Africa/Blantyre')::date and (starts_at at time zone 'Africa/Blantyre')::date+1095)
);
create table if not exists public.hub_event_guests(event_id uuid references hub_events(id) on delete cascade,user_id uuid references profiles(id),response text not null default 'Pending' check(response in ('Pending','Accepted','Tentative','Declined')),responded_at timestamptz,primary key(event_id,user_id));
create table if not exists public.hub_event_exceptions(event_id uuid references hub_events(id) on delete cascade,occurrence_at timestamptz,starts_at timestamptz not null,ends_at timestamptz not null,cancelled boolean not null default false,primary key(event_id,occurrence_at),check(ends_at>starts_at and ends_at<=starts_at+interval '31 days'));
create table if not exists public.hub_delivery_jobs(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),user_id uuid not null references profiles(id),notice_id uuid references hub_notices(id),event_id uuid references hub_events(id),
 event_version integer,occurrence_at timestamptz,kind text not null,dedupe text not null unique,due_at timestamptz not null default now(),email_enabled boolean not null default false,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed','cancelled')),attempts integer not null default 0,available_at timestamptz not null default now(),claimed_at timestamptz,first_attempt_at timestamptz,sent_at timestamptz,provider_id text,error text,payload jsonb
);
create index if not exists hub_jobs_due on hub_delivery_jobs(status,available_at);
create index if not exists hub_notices_org on hub_notices(organization_id,publish_at desc);
create index if not exists hub_events_org on hub_events(organization_id,starts_at);

create or replace function hub_access(uid uuid,org uuid,m text) returns text language sql stable security definer set search_path=public as $$
 select coalesce((select case when p.role='admin' then 'edit' when p.role='shared' then 'none' when a.access='none' then 'none' when p.role='viewer' then 'view' else coalesce(a.access,'edit') end from profiles p left join module_access a on a.user_id=p.id and a.module=m where p.id=uid and p.organization_id=org and p.active),'none')
$$;
create or replace function hub_notice_edit(nid uuid,uid uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce((select hub_access(uid,n.organization_id,'notices')='edit' and (n.author_id=uid or exists(select 1 from profiles where id=uid and role='admin')) from hub_notices n where n.id=nid),false)
$$;
create or replace function hub_notice_read(nid uuid,uid uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce((select hub_access(uid,n.organization_id,'notices')<>'none' and (hub_notice_edit(n.id,uid) or (n.status in ('published','archived') and n.publish_at<=now() and (n.audience='everyone' or uid=any(n.target_users)))) from hub_notices n where n.id=nid),false)
$$;
create or replace function hub_event_edit(eid uuid,uid uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce((select hub_access(uid,e.organization_id,'calendar')='edit' and (e.organizer_id=uid or exists(select 1 from profiles where id=uid and role='admin')) from hub_events e where e.id=eid),false)
$$;
create or replace function hub_event_read(eid uuid,uid uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce((select hub_access(uid,e.organization_id,'calendar')<>'none' and (hub_event_edit(e.id,uid) or e.visibility='organization' or e.organizer_id=uid or exists(select 1 from hub_event_guests g where g.event_id=e.id and g.user_id=uid)) and (e.notice_id is null or hub_notice_read(e.notice_id,uid)) from hub_events e where e.id=eid),false)
$$;
create or replace function hub_audit() returns trigger language plpgsql security definer set search_path=public as $$
 declare org uuid;entity text;r jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;begin
 if tg_table_name in ('hub_notices','hub_events') then org:=(r->>'organization_id')::uuid;entity:=r->>'id';
 elsif tg_table_name in ('hub_notice_reads','hub_notice_files') then select organization_id into org from hub_notices where id=(r->>'notice_id')::uuid;entity:=r->>'notice_id';
 else select organization_id into org from hub_events where id=(r->>'event_id')::uuid;entity:=r->>'event_id';end if;
 insert into audit_log(organization_id,actor_id,action,entity_type,entity_id,old_data,new_data) values(org,auth.uid(),lower(tg_op),tg_table_name,entity,case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);
 if tg_op='DELETE' then return old;else return new;end if;end $$;
do $$declare t text;begin foreach t in array array['hub_notices','hub_events','hub_notice_reads','hub_notice_files','hub_event_guests','hub_event_exceptions'] loop
 execute format('alter table public.%I enable row level security',t);execute format('drop trigger if exists hub_audit on public.%I',t);execute format('create trigger hub_audit after insert or update or delete on public.%I for each row execute function hub_audit()',t);
 end loop;end $$;
alter table hub_delivery_jobs enable row level security;
drop policy if exists hub_notices_read on hub_notices;create policy hub_notices_read on hub_notices for select to authenticated using(hub_notice_read(id));
drop policy if exists hub_reads_read on hub_notice_reads;create policy hub_reads_read on hub_notice_reads for select to authenticated using(hub_notice_read(notice_id) and (user_id=auth.uid() or hub_notice_edit(notice_id)));
drop policy if exists hub_files_read on hub_notice_files;create policy hub_files_read on hub_notice_files for select to authenticated using(hub_notice_read(notice_id));
drop policy if exists hub_events_read on hub_events;create policy hub_events_read on hub_events for select to authenticated using(hub_event_read(id));
drop policy if exists hub_guests_read on hub_event_guests;create policy hub_guests_read on hub_event_guests for select to authenticated using(hub_event_read(event_id));
drop policy if exists hub_exceptions_read on hub_event_exceptions;create policy hub_exceptions_read on hub_event_exceptions for select to authenticated using(hub_event_read(event_id));
grant select on hub_notices,hub_notice_reads,hub_notice_files,hub_events,hub_event_guests,hub_event_exceptions to authenticated;
-- All mutations use checked RPCs. No authenticated table writes.
revoke insert,update,delete on hub_notices,hub_notice_reads,hub_notice_files,hub_events,hub_event_guests,hub_event_exceptions,hub_delivery_jobs from authenticated,anon;
grant all on hub_notices,hub_notice_reads,hub_notice_files,hub_events,hub_event_guests,hub_event_exceptions,hub_delivery_jobs to service_role;

create or replace function hub_resolve_audience(kind text,ref text,ids uuid[]) returns uuid[] language plpgsql stable security definer set search_path=public as $$
 declare org uuid:=current_organization_id();result uuid[];w jsonb;r jsonb;begin
 if hub_access(auth.uid(),org,'notices')<>'edit' then raise exception 'Notice publishing access required';end if;
 if kind='everyone' then return '{}';end if;
 if kind='members' then result:=coalesce(ids,'{}');
 elsif kind='team' then select array_agg(p.id) into result from profiles p join staff_work_settings s on s.user_id=p.id where p.organization_id=org and p.active and s.department=ref;
 elsif kind='project' then
 select data into w from workspace_states where organization_id=org;select x into r from jsonb_array_elements(coalesce(w->'projects','[]')) x where x->>'id'=ref and record_visible('projects',x,w,auth.uid());
 if r is null or module_level('projects')='none' then raise exception 'Project unavailable';end if;
 select array_agg(p.id) into result from profiles p where p.organization_id=org and p.active and (r->>'owner' in (p.id::text,staff_member_id(p.id)) or coalesce(r->'team','[]') ? p.id::text or coalesce(r->'team','[]') ? staff_member_id(p.id));
 elsif kind='cohort' then
 if module_level('training')='none' or not exists(select 1 from training_cohorts where id=ref::uuid and organization_id=org) then raise exception 'Cohort unavailable';end if;
 select array_agg(distinct p.id) into result from profiles p where p.organization_id=org and p.active and (p.id in (select lead_instructor from training_cohorts where id=ref::uuid) or p.id in (select instructor_id from training_sessions where cohort_id=ref::uuid));
 else raise exception 'Choose a valid audience';end if;
 if coalesce(cardinality(result),0)=0 then raise exception 'This audience has no active staff. Select members instead.';end if;
 if exists(select 1 from unnest(result) u where not exists(select 1 from profiles p where p.id=u and p.organization_id=org and p.active and p.role<>'shared')) then raise exception 'Audience must contain active internal members from this organisation';end if;
 return result;end $$;
create or replace function hub_notice_save(payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
 declare n hub_notices;key uuid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());org uuid:=current_organization_id();targets uuid[];st text;pub timestamptz;links jsonb;begin
 if hub_access(auth.uid(),org,'notices')<>'edit' then raise exception 'Notice publishing access required';end if;
 select * into n from hub_notices where id=key for update;
 if found then if not hub_notice_edit(key) then raise exception 'Only the author or an administrator may change this notice';end if;if n.version<>coalesce((payload->>'version')::int,0) then raise exception 'This notice changed. Refresh before saving.';end if;end if;
 targets:=hub_resolve_audience(payload->>'audience',payload->>'audience_key',array(select jsonb_array_elements_text(coalesce(payload->'target_users','[]'))::uuid));
 st:=payload->>'status';pub:=coalesce(nullif(payload->>'publish_at','')::timestamptz,now());if st='published' and pub>now() then st:='scheduled';end if;
 links:=coalesce(payload->'links','[]');if jsonb_typeof(links)<>'array' or jsonb_array_length(links)>20 or exists(select 1 from jsonb_array_elements_text(links) x where x!~'^https?://[^[:space:]]+$') then raise exception 'Use valid http or https links';end if;
 insert into hub_notices(id,organization_id,author_id,title,body,category,priority,status,audience,audience_key,target_users,publish_at,expires_at,pinned,require_ack,email_enabled,links)
 values(key,org,auth.uid(),trim(payload->>'title'),coalesce(payload->>'body',''),coalesce(payload->>'category','General'),coalesce(payload->>'priority','Normal'),st,payload->>'audience',payload->>'audience_key',targets,pub,nullif(payload->>'expires_at','')::timestamptz,coalesce((payload->>'pinned')::boolean,false),coalesce((payload->>'require_ack')::boolean,false),coalesce((payload->>'email_enabled')::boolean,false),links)
 on conflict(id) do update set title=excluded.title,body=excluded.body,category=excluded.category,priority=excluded.priority,status=excluded.status,audience=excluded.audience,audience_key=excluded.audience_key,target_users=excluded.target_users,publish_at=excluded.publish_at,expires_at=excluded.expires_at,pinned=excluded.pinned,require_ack=excluded.require_ack,email_enabled=excluded.email_enabled,links=excluded.links,version=hub_notices.version+1,updated_at=now();
 -- Suppress obsolete queued work on audience/status changes. Sent messages cannot be recalled.
 update hub_delivery_jobs j set status='cancelled' where j.notice_id=key and j.status in ('pending','processing') and (st<>'published' or not hub_notice_read(key,j.user_id));return key;end $$;
create or replace function hub_notice_mark(nid uuid,ack boolean default false) returns void language plpgsql security definer set search_path=public as $$begin
 if not hub_notice_read(nid) then raise exception 'Notice unavailable';end if;
 if ack and not exists(select 1 from hub_notices where id=nid and status='published' and require_ack and (expires_at is null or expires_at>now())) then raise exception 'This notice is not accepting acknowledgements';end if;
 insert into hub_notice_reads(notice_id,user_id,ack_at) values(nid,auth.uid(),case when ack then now() end) on conflict(notice_id,user_id) do update set ack_at=coalesce(hub_notice_reads.ack_at,excluded.ack_at) where hub_notice_reads.ack_at is null and excluded.ack_at is not null;end $$;

-- Private attachment bucket, including downloads, follows the notice audience.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('hub-notices','hub-notices',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp','text/plain']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function hub_file_notice(p text) returns uuid language plpgsql immutable as $$begin return split_part(p,'/',1)::uuid;exception when invalid_text_representation then return null;end $$;
drop policy if exists hub_notice_download on storage.objects;create policy hub_notice_download on storage.objects for select to authenticated using(bucket_id='hub-notices' and hub_notice_read(hub_file_notice(name)));
drop policy if exists hub_notice_upload on storage.objects;create policy hub_notice_upload on storage.objects for insert to authenticated with check(bucket_id='hub-notices' and hub_notice_edit(hub_file_notice(name)));
-- Restrictive guards keep audience checks effective alongside other bucket policies.
drop policy if exists hub_notice_read_guard on storage.objects;create policy hub_notice_read_guard on storage.objects as restrictive for select to authenticated using(bucket_id<>'hub-notices' or hub_notice_read(hub_file_notice(name)));
drop policy if exists hub_notice_insert_guard on storage.objects;create policy hub_notice_insert_guard on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'hub-notices' or hub_notice_edit(hub_file_notice(name)));
drop policy if exists hub_notice_update_guard on storage.objects;create policy hub_notice_update_guard on storage.objects as restrictive for update to authenticated using(bucket_id<>'hub-notices' or hub_notice_edit(hub_file_notice(name))) with check(bucket_id<>'hub-notices' or hub_notice_edit(hub_file_notice(name)));
drop policy if exists hub_notice_delete_guard on storage.objects;create policy hub_notice_delete_guard on storage.objects as restrictive for delete to authenticated using(bucket_id<>'hub-notices' or hub_notice_edit(hub_file_notice(name)));
drop policy if exists hub_notice_anon_guard on storage.objects;create policy hub_notice_anon_guard on storage.objects as restrictive for all to anon using(bucket_id<>'hub-notices') with check(bucket_id<>'hub-notices');
create or replace function hub_notice_file(nid uuid,file_path text,file_name text) returns void language plpgsql security definer set search_path=public as $$begin
 if not hub_notice_edit(nid) or hub_file_notice(file_path)<>nid then raise exception 'Notice edit access required';end if;
 if length(file_name) not between 1 and 250 or not exists(select 1 from storage.objects where bucket_id='hub-notices' and name=file_path) then raise exception 'Upload the attachment first';end if;
 insert into hub_notice_files(notice_id,path,name) values(nid,file_path,file_name) on conflict(path) do nothing;end $$;
create or replace function hub_occurrences(eid uuid,lo timestamptz,hi timestamptz) returns table(occurrence_at timestamptz,starts_at timestamptz,ends_at timestamptz,cancelled boolean) language sql stable security definer set search_path=public as $$
 with series as(select e.*,g.n,((e.starts_at at time zone 'Africa/Blantyre')+case e.recurrence when 'daily' then make_interval(days=>g.n*e.repeat_interval) when 'weekly' then make_interval(days=>g.n*7*e.repeat_interval) when 'monthly' then make_interval(months=>g.n*e.repeat_interval) else interval '0' end) at time zone 'Africa/Blantyre' as occurrence from hub_events e cross join lateral generate_series(0,case when e.recurrence='none' then 0 else 1095 end) g(n) where e.id=eid),
 valid as(select s.*,row_number() over(order by occurrence) as ordinal from series s where occurrence<=s.starts_at+interval '3 years' and (s.recurrence<>'monthly' or extract(day from s.occurrence at time zone 'Africa/Blantyre')=extract(day from s.starts_at at time zone 'Africa/Blantyre'))),
 expanded as(select s.occurrence,coalesce(x.starts_at,s.occurrence) as start_time,coalesce(x.ends_at,s.occurrence+(s.ends_at-s.starts_at)) as end_time,coalesce(x.cancelled,false) or s.status='cancelled' as gone from valid s left join hub_event_exceptions x on x.event_id=s.id and x.occurrence_at=s.occurrence where (s.repeat_count is null or s.ordinal<=s.repeat_count) and (s.repeat_until is null or (s.occurrence at time zone 'Africa/Blantyre')::date<=s.repeat_until))
 select occurrence,start_time,end_time,gone from expanded where start_time<hi and end_time>lo
$$;
create or replace function hub_calendar_list(lo timestamptz,hi timestamptz) returns jsonb language plpgsql stable security definer set search_path=public as $$declare result jsonb;begin
 if hi<=lo or hi-lo>interval '100 days' then raise exception 'Choose a calendar range of 100 days or fewer';end if;
 select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('occurrence_at',o.occurrence_at,'occurrence_start',o.starts_at,'occurrence_end',o.ends_at,'occurrence_cancelled',o.cancelled,'can_edit',hub_event_edit(e.id),'guests',coalesce((select jsonb_agg(to_jsonb(g)) from hub_event_guests g where g.event_id=e.id),'[]'))),'[]') into result from hub_events e cross join lateral hub_occurrences(e.id,lo,hi) o where hub_event_read(e.id) and e.status='active' and not o.cancelled;return result;end $$;
create or replace function hub_event_save(payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
 declare key uuid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());oldrow hub_events;org uuid:=current_organization_id();guests uuid[];reminders integer[];v integer;u uuid;st text;w jsonb;r jsonb;k text;begin
 if hub_access(auth.uid(),org,'calendar')<>'edit' then raise exception 'Calendar edit access required';end if;
 select * into oldrow from hub_events where id=key for update;
 if found then if not hub_event_edit(key) then raise exception 'Only the organiser or an administrator may edit this event';end if;if oldrow.version<>coalesce((payload->>'version')::int,0) then raise exception 'This event changed. Refresh before saving.';end if;end if;
 guests:=array(select distinct jsonb_array_elements_text(coalesce(payload->'guests','[]'))::uuid);
 if cardinality(guests)>300 or exists(select 1 from unnest(guests) guest_uid where hub_access(guest_uid,org,'calendar')='none') then raise exception 'Invite active staff with calendar access from this organisation';end if;
 reminders:=array(select distinct jsonb_array_elements_text(coalesce(payload->'reminder_minutes','[30]'))::integer);
 if cardinality(reminders)>5 or exists(select 1 from unnest(reminders) x where x not in (0,10,30,60,1440,10080)) then raise exception 'Invalid reminder interval';end if;
 if coalesce(payload->>'meeting_url','')<>'' and payload->>'meeting_url'!~'^https?://[^[:space:]]+$' then raise exception 'Meeting link must start with https:// or http://';end if;
 if nullif(payload->>'notice_id','') is not null and not hub_notice_read((payload->>'notice_id')::uuid) then raise exception 'Linked notice unavailable';end if;
 if coalesce(payload->>'link_type','')<>'' then
 k:=case payload->>'link_type' when 'project' then 'projects' when 'task' then 'tasks' when 'mission' then 'missions' when 'cohort' then 'training' else null end;
 if k is null or module_level(k)='none' then raise exception 'Linked module unavailable';end if;
 if k='training' then if not exists(select 1 from training_cohorts where id=(payload->>'link_id')::uuid and organization_id=org) then raise exception 'Linked cohort unavailable';end if;
 else select data into w from workspace_states where organization_id=org;select x into r from jsonb_array_elements(coalesce(w->k,'[]')) x where x->>'id'=payload->>'link_id' and record_visible(k,x,w);if r is null then raise exception 'Linked record unavailable';end if;end if;
 end if;
 if coalesce(payload->>'recurrence','none')<>'none' and nullif(payload->>'repeat_count','') is not null and
 (payload->>'starts_at')::timestamptz+((payload->>'repeat_count')::int-1)*coalesce((payload->>'repeat_interval')::int,1)*(case payload->>'recurrence' when 'daily' then interval '1 day' when 'weekly' then interval '7 days' else interval '1 month' end)>(payload->>'starts_at')::timestamptz+interval '3 years' then raise exception 'Limit the repeat pattern to three years';end if;
 if coalesce((payload->>'all_day')::boolean,false) and (((payload->>'starts_at')::timestamptz at time zone 'Africa/Blantyre')::time<>'00:00:00'::time or ((payload->>'ends_at')::timestamptz at time zone 'Africa/Blantyre')::time<>'00:00:00'::time) then raise exception 'All-day events must use midnight CAT with an exclusive end date';end if;
 if payload->>'recurrence'='monthly' and nullif(payload->>'repeat_count','') is not null and nullif(payload->>'repeat_until','') is null and (payload->>'repeat_count')::int>(select count(*) from generate_series(0,36) n where ((payload->>'starts_at')::timestamptz at time zone 'Africa/Blantyre')+make_interval(months=>n*coalesce((payload->>'repeat_interval')::int,1))<=((payload->>'starts_at')::timestamptz at time zone 'Africa/Blantyre')+interval '3 years' and extract(day from ((payload->>'starts_at')::timestamptz at time zone 'Africa/Blantyre')+make_interval(months=>n*coalesce((payload->>'repeat_interval')::int,1)))=extract(day from (payload->>'starts_at')::timestamptz at time zone 'Africa/Blantyre')) then raise exception 'That many monthly occurrences do not fit within three years. Reduce the count or choose an end date.';end if;
 st:=coalesce(payload->>'status','active');
 insert into hub_events(id,organization_id,organizer_id,title,description,location,meeting_url,category,starts_at,ends_at,all_day,visibility,recurrence,repeat_interval,repeat_count,repeat_until,reminder_minutes,email_enabled,status,link_type,link_id,notice_id)
 values(key,org,auth.uid(),trim(payload->>'title'),coalesce(payload->>'description',''),coalesce(payload->>'location',''),coalesce(payload->>'meeting_url',''),coalesce(payload->>'category','Meeting'),(payload->>'starts_at')::timestamptz,(payload->>'ends_at')::timestamptz,coalesce((payload->>'all_day')::boolean,false),coalesce(payload->>'visibility','private'),coalesce(payload->>'recurrence','none'),coalesce((payload->>'repeat_interval')::int,1),nullif(payload->>'repeat_count','')::int,nullif(payload->>'repeat_until','')::date,reminders,coalesce((payload->>'email_enabled')::boolean,false),st,nullif(payload->>'link_type',''),nullif(payload->>'link_id',''),nullif(payload->>'notice_id','')::uuid)
 on conflict(id) do update set title=excluded.title,description=excluded.description,location=excluded.location,meeting_url=excluded.meeting_url,category=excluded.category,starts_at=excluded.starts_at,ends_at=excluded.ends_at,all_day=excluded.all_day,visibility=excluded.visibility,recurrence=excluded.recurrence,repeat_interval=excluded.repeat_interval,repeat_count=excluded.repeat_count,repeat_until=excluded.repeat_until,reminder_minutes=excluded.reminder_minutes,email_enabled=excluded.email_enabled,status=excluded.status,link_type=excluded.link_type,link_id=excluded.link_id,notice_id=excluded.notice_id,version=hub_events.version+1,updated_at=now() returning version into v;
 -- Series timing changes deliberately clear old exceptions; the UI explains this.
 if oldrow.id is not null and (oldrow.starts_at,oldrow.recurrence,oldrow.repeat_interval,oldrow.repeat_count,oldrow.repeat_until) is distinct from ((payload->>'starts_at')::timestamptz,coalesce(payload->>'recurrence','none'),coalesce((payload->>'repeat_interval')::int,1),nullif(payload->>'repeat_count','')::int,nullif(payload->>'repeat_until','')::date) then delete from hub_event_exceptions where event_id=key;end if;
 -- Removed invitees get a content-free cancellation notification before access is removed.
 insert into personal_notifications(user_id,title,body,target_view,target_id,event_key) select user_id,'Calendar invitation withdrawn','An organiser removed you from an event.','calendar','', 'hub-removed:'||key||':'||v||':'||user_id from hub_event_guests where event_id=key and not(user_id=any(guests)) on conflict do nothing;
 delete from hub_event_guests where event_id=key and not(user_id=any(guests));
 foreach u in array guests loop insert into hub_event_guests(event_id,user_id) values(key,u) on conflict do nothing;end loop;
 update hub_delivery_jobs set status='cancelled' where event_id=key and status in ('pending','processing');
 for u in select user_id from hub_event_guests where event_id=key union select organizer_id from hub_events where id=key loop
 insert into hub_delivery_jobs(organization_id,user_id,event_id,event_version,kind,dedupe,email_enabled) values(org,u,key,v,case when st='cancelled' then 'cancelled' when oldrow.id is null then 'invitation' else 'updated' end,'event-change:'||key||':'||v||':'||u,coalesce((payload->>'email_enabled')::boolean,false)) on conflict do nothing;
 end loop;return key;end $$;
create or replace function hub_event_exception(eid uuid,original_at timestamptz,new_start timestamptz,new_end timestamptz,cancel boolean,expected_version integer) returns void language plpgsql security definer set search_path=public as $$declare e hub_events;u uuid;begin
 select * into e from hub_events where id=eid for update;if not hub_event_edit(eid) then raise exception 'Event edit access required';end if;if e.version<>expected_version then raise exception 'This event changed. Refresh before saving.';end if;
 -- Test original identity against the series, even if it has already moved.
 if not exists(select 1 from hub_occurrences(eid,e.starts_at-interval '32 days',e.starts_at+interval '40 years') o where o.occurrence_at=original_at) then raise exception 'Occurrence unavailable';end if;
 insert into hub_event_exceptions values(eid,original_at,new_start,new_end,cancel) on conflict(event_id,occurrence_at) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at,cancelled=excluded.cancelled;
 update hub_events set version=version+1,updated_at=now() where id=eid;
 update hub_delivery_jobs set status='cancelled' where event_id=eid and status in ('pending','processing');
 for u in select user_id from hub_event_guests where event_id=eid union select e.organizer_id loop
 insert into hub_delivery_jobs(organization_id,user_id,event_id,event_version,occurrence_at,kind,dedupe,email_enabled) values(e.organization_id,u,eid,e.version+1,original_at,case when cancel then 'occurrence_cancelled' else 'occurrence_updated' end,'event-exception:'||eid||':'||(e.version+1)||':'||u,e.email_enabled) on conflict do nothing;end loop;end $$;
create or replace function hub_event_reply(eid uuid,answer text) returns void language plpgsql security definer set search_path=public as $$declare org uuid;owner uuid;begin
 if answer not in ('Accepted','Tentative','Declined') or not hub_event_read(eid) or not exists(select 1 from hub_events where id=eid and status='active') then raise exception 'Invitation unavailable';end if;
 update hub_event_guests set response=answer,responded_at=now() where event_id=eid and user_id=auth.uid();if not found then raise exception 'You are not invited to this event';end if;
 select organization_id,organizer_id into org,owner from hub_events where id=eid;
 insert into personal_notifications(user_id,title,body,target_view,target_id,event_key) values(owner,'Calendar response','An invited member updated their response.','calendar',eid::text,'event-reply:'||eid||':'||auth.uid()||':'||answer) on conflict do nothing;
 if answer='Declined' then update hub_delivery_jobs set status='cancelled' where event_id=eid and user_id=auth.uid() and kind='reminder' and status in ('pending','processing');end if;end $$;
create or replace function hub_event_conflicts(eid uuid,lo timestamptz,hi timestamptz,people uuid[]) returns jsonb language plpgsql stable security definer set search_path=public as $$declare org uuid:=current_organization_id();result jsonb;begin
 if hub_access(auth.uid(),org,'calendar')<>'edit' or hi<=lo or hi-lo>interval '31 days' or cardinality(people)>300 or exists(select 1 from unnest(people) u where hub_access(u,org,'calendar')='none') then raise exception 'Invalid conflict check';end if;
 select coalesce(jsonb_agg(distinct jsonb_build_object('user_id',p,'starts_at',o.starts_at,'ends_at',o.ends_at)),'[]') into result from unnest(people) p join hub_events e on e.organization_id=org and e.status='active' and e.id is distinct from eid and (e.organizer_id=p or exists(select 1 from hub_event_guests g where g.event_id=e.id and g.user_id=p and g.response<>'Declined')) cross join lateral hub_occurrences(e.id,lo,hi) o where not o.cancelled;return result;end $$;

create or replace function hub_job_valid(j hub_delivery_jobs) returns boolean language sql stable security definer set search_path=public as $$
 select case when j.notice_id is not null then hub_notice_read(j.notice_id,j.user_id) and exists(select 1 from hub_notices where id=j.notice_id and status='published' and (expires_at is null or expires_at>now()))
 else hub_event_read(j.event_id,j.user_id) and exists(select 1 from hub_events e where e.id=j.event_id and e.version=j.event_version and (j.kind in ('cancelled','occurrence_cancelled') or e.status='active') and (e.organizer_id=j.user_id or exists(select 1 from hub_event_guests g where g.event_id=e.id and g.user_id=j.user_id and (j.kind<>'reminder' or g.response<>'Declined')))) and (j.kind<>'reminder' or exists(select 1 from hub_occurrences(j.event_id,now()-interval '1 day',now()+interval '8 days') o where o.occurrence_at=j.occurrence_at and not o.cancelled and o.ends_at>now())) end
$$;
create or replace function hub_tick() returns void language plpgsql security definer set search_path=public as $$declare n hub_notices;e hub_events;o record;u uuid;m integer;j hub_delivery_jobs;begin
 -- Serialise tick across overlapping cron requests; no duplicate publication or jobs.
 perform pg_advisory_xact_lock(210922);
 update hub_notices set status='published',version=version+1,updated_at=now() where status='scheduled' and publish_at<=now();
 for n in select * from hub_notices where status='published' and publish_at<=now() and (expires_at is null or expires_at>now()) loop
 for u in select id from profiles where organization_id=n.organization_id and active and (n.audience='everyone' or id=any(n.target_users)) and hub_notice_read(n.id,id) loop
 insert into hub_delivery_jobs(organization_id,user_id,notice_id,kind,dedupe,email_enabled) values(n.organization_id,u,n.id,'notice','notice:'||n.id||':'||u,n.email_enabled) on conflict do nothing;end loop;end loop;
 for e in select * from hub_events where status='active' loop
 for o in select * from hub_occurrences(e.id,now()-interval '1 day',now()+interval '8 days') where not cancelled and ends_at>now() loop
 foreach m in array e.reminder_minutes loop
 if o.starts_at-m*interval '1 minute'>now() or o.starts_at-m*interval '1 minute'<now()-interval '1 day' then continue;end if;
 for u in select user_id from hub_event_guests where event_id=e.id and response<>'Declined' union select e.organizer_id loop
 insert into hub_delivery_jobs(organization_id,user_id,event_id,event_version,occurrence_at,kind,dedupe,due_at,email_enabled)
 values(e.organization_id,u,e.id,e.version,o.occurrence_at,'reminder','reminder:'||e.id||':'||o.occurrence_at||':'||o.starts_at||':'||m||':'||u,o.starts_at-m*interval '1 minute',e.email_enabled)
 on conflict(dedupe) do update set event_version=excluded.event_version,status='pending',available_at=now() where hub_delivery_jobs.status='cancelled' and hub_delivery_jobs.sent_at is null and hub_delivery_jobs.attempts<5 and (hub_delivery_jobs.first_attempt_at is null or hub_delivery_jobs.first_attempt_at>now()-interval '20 hours');
 end loop;end loop;end loop;end loop;
 update hub_delivery_jobs dj set status='cancelled' where status in ('pending','processing') and not hub_job_valid(dj);
 for j in select * from hub_delivery_jobs where status='pending' and due_at<=now() loop
 insert into personal_notifications(user_id,title,body,target_view,target_id,event_key) values(j.user_id,case j.kind when 'notice' then 'New company notice' when 'invitation' then 'Calendar invitation' when 'reminder' then 'Calendar reminder' when 'cancelled' then 'Calendar event cancelled' when 'occurrence_cancelled' then 'Calendar occurrence cancelled' else 'Calendar event updated' end,'Open the Hub to view the details.',case when j.notice_id is not null then 'notices' else 'calendar' end,coalesce(j.notice_id,j.event_id)::text,'hub:'||j.dedupe) on conflict do nothing;
 if not j.email_enabled then update hub_delivery_jobs set status='sent',sent_at=now() where id=j.id;end if;
 end loop;end $$;
create or replace function claim_hub_deliveries() returns setof hub_delivery_jobs language plpgsql security definer set search_path=public as $$begin
 perform hub_tick();
 update hub_delivery_jobs set status='pending' where status='processing' and claimed_at<now()-interval '2 minutes';
 update hub_delivery_jobs set status='failed',error=coalesce(error,'Retry window exhausted') where status='pending' and (attempts>=5 or first_attempt_at<now()-interval '20 hours');
 return query with picked as(select id from hub_delivery_jobs where status='pending' and email_enabled and due_at<=now() and available_at<=now() order by due_at for update skip locked limit 20)
 update hub_delivery_jobs j set status='processing',attempts=attempts+1,claimed_at=now(),first_attempt_at=coalesce(first_attempt_at,now()) from picked where j.id=picked.id returning j.*;end $$;
create or replace function prepare_hub_delivery(jid uuid) returns jsonb language plpgsql security definer set search_path=public as $$declare j hub_delivery_jobs;recipient text;begin
 select * into j from hub_delivery_jobs where id=jid for update;if j.status<>'processing' then return null;end if;
 if not hub_job_valid(j) then update hub_delivery_jobs set status='cancelled' where id=jid;return null;end if;
 select email into recipient from profiles where id=j.user_id and active;return to_jsonb(j)||jsonb_build_object('recipient',recipient);end $$;
-- Extend the existing module whitelist without removing its other allowed values.
do $$declare c record;begin for c in select conname,pg_get_expr(conbin,conrelid) expr from pg_constraint where conrelid='public.module_access'::regclass and contype='c' and conkey=array[(select attnum from pg_attribute where attrelid='public.module_access'::regclass and attname='module')]::smallint[] loop
 if position('notices' in c.expr)=0 then execute format('alter table module_access drop constraint %I',c.conname);execute format('alter table module_access add constraint %I check ((%s) or module=''notices'')',c.conname,c.expr);end if;
 end loop;end $$;
-- Keep any existing restrictive notification predicate; add only the new checked targets.
do $$declare predicate text;begin
 select pg_get_expr(polqual,polrelid) into predicate from pg_policy where polrelid='public.personal_notifications'::regclass and polname='scoped_notifications';
 if predicate is not null and position('hub_notice_read' in predicate)=0 then execute 'alter policy scoped_notifications on personal_notifications using (('||predicate||') or (target_view=''notices'' and hub_notice_read(hub_file_notice(target_id))) or (target_view=''calendar'' and hub_event_read(hub_file_notice(target_id))) or (event_key like ''hub-removed:%'' and user_id=auth.uid()))';end if;
 end $$;
create or replace function hub_delivery_status(nid uuid default null,eid uuid default null) returns jsonb language plpgsql stable security definer set search_path=public as $$declare result jsonb;begin
 if not (coalesce(hub_notice_edit(nid),false) or coalesce(hub_event_edit(eid),false)) then raise exception 'Author or organiser access required';end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (select user_id,kind,status,attempts,error,sent_at,email_enabled from hub_delivery_jobs where (notice_id=nid and hub_notice_edit(nid)) or (event_id=eid and hub_event_edit(eid)) order by due_at desc limit 100) x;return result;end $$;
-- Restrict all helper and worker functions; grant only the explicit browser RPCs/policy helpers.
do $$declare f record;begin for f in select oid::regprocedure as sig from pg_proc where pronamespace='public'::regnamespace and (proname like 'hub\_%' escape '\' or proname in ('claim_hub_deliveries','prepare_hub_delivery')) loop execute format('revoke all on function %s from public,anon,authenticated',f.sig);execute format('grant execute on function %s to service_role',f.sig);end loop;end $$;
grant execute on function hub_delivery_status(uuid,uuid),hub_notice_read(uuid,uuid),hub_notice_edit(uuid,uuid),hub_event_read(uuid,uuid),hub_file_notice(text),hub_notice_save(jsonb),hub_notice_mark(uuid,boolean),hub_notice_file(uuid,text,text),hub_calendar_list(timestamptz,timestamptz),hub_event_save(jsonb),hub_event_exception(uuid,timestamptz,timestamptz,timestamptz,boolean,integer),hub_event_reply(uuid,text),hub_event_conflicts(uuid,timestamptz,timestamptz,uuid[]) to authenticated;
notify pgrst,'reload schema';
commit;
