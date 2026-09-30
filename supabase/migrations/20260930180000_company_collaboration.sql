begin;
-- Copy installed access logic, preserving existing function identities and RLS dependencies.
-- Re-running this migration does not stack wrappers.
do $$ begin
 if to_regprocedure('public.collaboration_original_module_level(text)') is null then execute replace(pg_get_functiondef('public.module_level(text)'::regprocedure),'FUNCTION public.module_level(', 'FUNCTION public.collaboration_original_module_level(');end if;
 if to_regprocedure('public.collaboration_original_record_visible(text,jsonb,jsonb,uuid)') is null then execute replace(pg_get_functiondef('public.record_visible(text,jsonb,jsonb,uuid)'::regprocedure),'FUNCTION public.record_visible(', 'FUNCTION public.collaboration_original_record_visible(');end if;
 if to_regprocedure('public.collaboration_original_workspace()') is null then execute replace(pg_get_functiondef('public.get_my_workspace()'::regprocedure),'FUNCTION public.get_my_workspace(', 'FUNCTION public.collaboration_original_workspace(');end if;
end $$;
create or replace function public.module_level(m text) returns text language plpgsql stable security definer set search_path=public as $$
declare level text;
begin
 level:=collaboration_original_module_level(m);
 if m in ('projects','requests','crm','commercial') and level='none' and exists(select 1 from profiles where id=auth.uid() and active and role<>'shared') then return 'view';end if;
 return level;
end $$;
-- Explicitly selected colleagues gain work-record access. Company browsing below
-- is deliberately separate so it cannot expand write/delete or private chat scope.
create or replace function public.record_visible(k text,r jsonb,w jsonb,uid uuid default auth.uid()) returns boolean language plpgsql stable security definer set search_path=public as $$
declare mid text;project jsonb;entity jsonb;
begin
 if not exists(select 1 from profiles where id=uid and active and (auth.uid() is null or organization_id=current_organization_id())) then return false;end if;
 mid:=staff_member_id(uid);
 if k in ('projects','requests','tasks','deals','commercialRecords') and
 (r->>'createdBy' in (mid,uid::text) or coalesce(r->'team','[]') ? mid or coalesce(r->'team','[]') ? uid::text) then return true;end if;
 if k='messages' and not exists(select 1 from jsonb_array_elements(coalesce(w->'chatGroups','[]')) g where g->>'id'=r->>'thread') then
  select x into entity from jsonb_array_elements(coalesce(w->'requests','[]')) x where x->>'id'=r->>'thread';
  if entity is null and r->>'thread' like 'deal:%' then select x into entity from jsonb_array_elements(coalesce(w->'deals','[]')) x where x->>'id'=substring(r->>'thread' from 6);end if;
  select x into project from jsonb_array_elements(coalesce(w->'projects','[]')) x where x->>'id'=entity->>'project' or x->>'request'=entity->>'id' or 'project:'||(x->>'id')=r->>'thread' limit 1;
  if project is not null and (project->>'owner'=mid or project->>'createdBy'=mid or coalesce(project->'team','[]') ? mid) then return true;end if;
 end if;
 return collaboration_original_record_visible(k,r,w,uid);
end $$;
create or replace function public.get_my_workspace() returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;w jsonb;k text;ids jsonb;access_map jsonb='{}';threads jsonb='[]';r jsonb;tid text;
begin
 result:=collaboration_original_workspace();
 if result is null or not exists(select 1 from profiles where id=auth.uid() and active and role<>'shared') then return result;end if;
 select data into w from workspace_states where organization_id=current_organization_id();
 foreach k in array array['projects','requests','deals','commercialRecords'] loop
  select coalesce(jsonb_agg(x->>'id'),'[]') into ids from jsonb_array_elements(coalesce(w->k,'[]')) x where record_visible(k,x,w);
  access_map:=access_map||jsonb_build_object(k,ids);
  result:=jsonb_set(result,array['data',k],coalesce(w->k,'[]'),true);
  if module_level('chat')<>'none' then
   for r in select * from jsonb_array_elements(coalesce(w->k,'[]')) loop
    tid:=case k when 'projects' then 'project:' when 'requests' then '' when 'deals' then 'deal:' else 'commercial:' end||(r->>'id');
    if record_visible('messages',jsonb_build_object('thread',tid),w) then threads:=threads||jsonb_build_array(tid);end if;
   end loop;
  end if;
 end loop;
 return result||jsonb_build_object('collaboration',jsonb_build_object('workAccess',access_map,'chatThreads',threads));
end $$;
create or replace function public.collaboration_validate_members(member_ids jsonb,org uuid) returns void language plpgsql security definer set search_path=public as $$
declare person text;
begin
 if jsonb_typeof(member_ids) is distinct from 'array' or jsonb_array_length(member_ids)>500 then raise exception 'Invalid member list';end if;
 for person in select * from jsonb_array_elements_text(member_ids) loop
  if not exists(select 1 from profiles p where p.organization_id=org and p.active and p.role<>'shared' and staff_member_id(p.id)=person) then raise exception 'Select active staff from your company';end if;
 end loop;
end $$;
create or replace function public.collaboration_create_project(details jsonb,source_deal text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare w workspace_states;mid text;r jsonb;d jsonb;members jsonb;
begin
 if not exists(select 1 from profiles where id=auth.uid() and active and role<>'shared') then raise exception 'Active staff account required' using errcode='42501';end if;
 mid:=staff_member_id(auth.uid());
 select * into w from workspace_states where organization_id=current_organization_id() for update;if not found then raise exception 'Workspace unavailable';end if;
 if jsonb_typeof(details) is distinct from 'object' or length(details::text)>15000 then raise exception 'Invalid project';end if;
 if coalesce(details->>'id','') !~ '^p-[a-zA-Z0-9-]+$' then raise exception 'Invalid project ID';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(w.data->'projects','[]')) x where x->>'id'=details->>'id') then raise exception 'Project already exists. Refresh before retrying.';end if;
 if length(trim(coalesce(details->>'name',''))) not between 1 and 300 or length(trim(coalesce(details->>'client',''))) not between 1 and 300 or length(trim(coalesce(details->>'outcome',''))) not between 1 and 10000 or length(trim(coalesce(details->>'category',''))) not between 1 and 200 then raise exception 'Add a project name, client, category and required outcome';end if;
 if coalesce(details->>'deadline','')='' then raise exception 'Add a deadline';end if;perform (details->>'deadline')::date;
 perform collaboration_validate_members(jsonb_build_array(details->>'owner'),w.organization_id);
 perform collaboration_validate_members(coalesce(details->'team','[]'),w.organization_id);
 select jsonb_agg(distinct x) into members from jsonb_array_elements(coalesce(details->'team','[]')||jsonb_build_array(mid,details->>'owner')) x;
 r:=jsonb_build_object('id',details->>'id','name',trim(details->>'name'),'client',trim(details->>'client'),'owner',details->>'owner','team',members,'deadline',details->>'deadline','category',details->>'category','outcome',details->>'outcome','createdBy',mid);
 if nullif(source_deal,'') is not null then
  select x into d from jsonb_array_elements(coalesce(w.data->'deals','[]')) x where x->>'id'=source_deal;
  if d is null or module_level('crm')<>'edit' or not record_visible('deals',d,w.data) then raise exception 'CRM edit access required to link this opportunity';end if;
  if coalesce(d->>'project','')<>'' then raise exception 'This opportunity already has a project';end if;
  d:=d||jsonb_build_object('project',r->>'id','stage','Won','probability',100,'nextStep','Deliver the linked project and prepare billing');
  w.data:=jsonb_set(w.data,'{deals}',(select jsonb_agg(case when x->>'id'=source_deal then d else x end) from jsonb_array_elements(w.data->'deals') x));
 end if;
 w.data:=jsonb_set(w.data,'{projects}',coalesce(w.data->'projects','[]')||jsonb_build_array(r));
 update workspace_states set data=w.data,version=version+1,updated_by=auth.uid() where organization_id=w.organization_id;
 insert into audit_log(organization_id,actor_id,action,entity_type,entity_id,new_data) values(w.organization_id,auth.uid(),'Project created','projects',r->>'id',r);
 return r;
end $$;
create or replace function public.collaboration_add_members(collection text,record_id text,member_ids jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare w workspace_states;r jsonb;prior jsonb;mid text;field_name text;members jsonb;role_name text;
begin
 select role into role_name from profiles where id=auth.uid() and active and role<>'shared';if role_name is null then raise exception 'Active staff account required';end if;
 if collection not in ('chatGroups','projects','requests','deals','commercialRecords') then raise exception 'Invalid group';end if;
 select * into w from workspace_states where organization_id=current_organization_id() for update;mid:=staff_member_id(auth.uid());
 select x into r from jsonb_array_elements(coalesce(w.data->collection,'[]')) x where x->>'id'=record_id;
 if r is null or not record_visible(collection,r,w.data) then raise exception 'Group unavailable';end if;
 if role_name<>'admin' and mid is distinct from r->>'createdBy' and (collection='chatGroups' or mid is distinct from r->>'owner') then raise exception 'Only the group administrator may add members';end if;
 if collection='chatGroups' and (r->>'type'<>'group' or not coalesce(r->'members','[]') ? mid) then raise exception 'Only members of a staff group may manage it';end if;
 perform collaboration_validate_members(member_ids,w.organization_id);prior:=r;
 field_name:=case when collection='chatGroups' then 'members' else 'team' end;
 select coalesce(jsonb_agg(distinct x),'[]') into members from jsonb_array_elements(coalesce(r->field_name,'[]')||member_ids) x;
 r:=jsonb_set(r,array[field_name],members);
 update workspace_states set data=jsonb_set(w.data,array[collection],(select jsonb_agg(case when x->>'id'=record_id then r else x end) from jsonb_array_elements(w.data->collection) x)),version=version+1,updated_by=auth.uid() where organization_id=w.organization_id;
 insert into audit_log(organization_id,actor_id,action,entity_type,entity_id,old_data,new_data) values(w.organization_id,auth.uid(),'Members added',collection,record_id,prior,r);
 return r;
end $$;
create or replace function public.collaboration_thread(thread_id text,w jsonb) returns text language plpgsql immutable set search_path=public as $$
declare p jsonb;e jsonb;
begin
 if thread_id not like 'project:%' then return thread_id;end if;
 select x into p from jsonb_array_elements(coalesce(w->'projects','[]')) x where 'project:'||(x->>'id')=thread_id;
 if p is null then return thread_id;end if;
 select x into e from jsonb_array_elements(coalesce(w->'requests','[]')) x where x->>'id'=p->>'request' or x->>'project'=p->>'id' limit 1;
 if e is not null then return e->>'id';end if;
 select x into e from jsonb_array_elements(coalesce(w->'deals','[]')) x where x->>'project'=p->>'id' limit 1;
 if e is not null then return 'deal:'||(e->>'id');end if;
 return thread_id;
end $$;
revoke all on function public.collaboration_thread(text,jsonb) from public,anon,authenticated;
-- Validate new member selections and message reply targets at the write boundary.
create or replace function public.collaboration_validate_workspace() returns trigger language plpgsql security definer set search_path=public as $$
declare k text;r jsonb;prior jsonb;mid text;
begin
 if auth.uid() is null then return new;end if;mid:=staff_member_id(auth.uid());
 foreach k in array array['projects','requests','deals','tasks','commercialRecords'] loop
  for r in select * from jsonb_array_elements(coalesce(new.data->k,'[]')) loop
   select x into prior from jsonb_array_elements(coalesce(old.data->k,'[]')) x where x->>'id'=r->>'id';
   if r is not distinct from prior then continue;end if;
   if r->'team' is distinct from prior->'team' and r?'team' then
    perform collaboration_validate_members(r->'team',new.organization_id);
    if prior is not null and not is_admin() and mid is distinct from prior->>'owner' and mid is distinct from prior->>'createdBy' then raise exception 'Only the owner or creator can manage record members';end if;
   end if;
   if prior is null and r?'createdBy' and r->>'createdBy' is distinct from mid then raise exception 'Record creator is invalid';end if;
   if prior?'createdBy' and prior->>'createdBy' is distinct from r->>'createdBy' then raise exception 'Record creator cannot be changed';end if;
  end loop;
 end loop;
 for r in select * from jsonb_array_elements(coalesce(new.data->'messages','[]')) loop
  if coalesce(r->>'replyTo','')='' or exists(select 1 from jsonb_array_elements(coalesce(old.data->'messages','[]')) x where x->>'id'=r->>'id') then continue;end if;
  select x into prior from jsonb_array_elements(coalesce(new.data->'messages','[]')) x where x->>'id'=r->>'replyTo';
  if prior is null or prior->>'id'=r->>'id' or collaboration_thread(coalesce(prior->>'thread','project:'||(prior->>'project')),new.data) is distinct from collaboration_thread(r->>'thread',new.data) or not record_visible('messages',prior,new.data) then raise exception 'Reply must reference a visible message in this conversation';end if;
 end loop;
 return new;
end $$;
drop trigger if exists collaboration_validate_workspace on workspace_states;
create trigger collaboration_validate_workspace before update on workspace_states for each row execute function collaboration_validate_workspace();
-- Permit a company administrator already in a group to add members. Direct chats stay immutable.
do $$ declare def text;old_guard text:=$g$if prior->>'type'='group' and mid is distinct from prior->>'createdBy' then$g$;
begin
 def:=pg_get_functiondef('public.validate_private_staff_chat()'::regprocedure);
 if position(old_guard in def)>0 then execute replace(def,old_guard,$g$if prior->>'type'='group' and mid is distinct from prior->>'createdBy' and role_name<>'admin' then$g$);
 elsif position($g$and role_name<>'admin' then$g$ in def)=0 then raise exception 'Private chat validator differs. Review before installing.';end if;
end $$;
revoke all on function public.collaboration_original_module_level(text),public.collaboration_original_record_visible(text,jsonb,jsonb,uuid),public.collaboration_original_workspace(),public.collaboration_validate_members(jsonb,uuid),public.collaboration_validate_workspace() from public,anon,authenticated;
revoke all on function public.module_level(text),public.record_visible(text,jsonb,jsonb,uuid),public.get_my_workspace(),public.collaboration_create_project(jsonb,text),public.collaboration_add_members(text,text,jsonb) from public,anon;
grant execute on function public.module_level(text),public.record_visible(text,jsonb,jsonb,uuid),public.get_my_workspace(),public.collaboration_create_project(jsonb,text),public.collaboration_add_members(text,text,jsonb) to authenticated;

alter table opportunity_tracking add column if not exists members jsonb not null default '[]';
create or replace function public.collaboration_validate_opportunity_members(member_ids jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
 if jsonb_typeof(member_ids) is distinct from 'array' or jsonb_array_length(member_ids)>500 then raise exception 'Invalid opportunity members';end if;
 if exists(select 1 from jsonb_array_elements_text(member_ids) x where not exists(select 1 from profiles p where p.id::text=x and p.organization_id=current_organization_id() and p.active and p.role<>'shared')) then raise exception 'Select active staff from your company';end if;
end $$;
create or replace function opportunity_save(target uuid,expected_version integer,details jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare org uuid:=current_organization_id();t opportunity_tracking;owner uuid;ln jsonb;w jsonb;v jsonb;
begin
 if not opportunity_access(true) then raise exception 'Commercial edit access required';end if;
 perform 1 from opportunity_matches where id=target and organization_id=org for update;if not found then raise exception 'Opportunity not found';end if;
 select * into t from opportunity_tracking where opportunity_id=target;
 if coalesce(t.version,0)<>expected_version then raise exception 'This opportunity changed. Reopen it before saving.';end if;
 perform collaboration_validate_opportunity_members(coalesce(details->'members',t.members,'[]'));
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
 insert into opportunity_tracking(opportunity_id,organization_id,stage,owner_id,decision,notes,submission_reference,submitted_on,checklist,links,verified,version,updated_by,members)
 values(target,org,coalesce(details->>'stage','New'),owner,coalesce(details->>'decision','Undecided'),coalesce(details->>'notes',''),coalesce(details->>'submission_reference',''),nullif(details->>'submitted_on','')::date,coalesce(details->'checklist','[]'),ln,v,expected_version+1,auth.uid(),coalesce(details->'members',t.members,'[]'))
 on conflict(opportunity_id) do update set stage=excluded.stage,owner_id=excluded.owner_id,decision=excluded.decision,notes=excluded.notes,submission_reference=excluded.submission_reference,submitted_on=excluded.submitted_on,checklist=excluded.checklist,links=excluded.links,verified=excluded.verified,version=excluded.version,updated_by=excluded.updated_by,updated_at=now(),members=excluded.members;
 insert into audit_log(organization_id,actor_id,action,entity_type,entity_id,new_data) values(org,auth.uid(),'Opportunity updated','opportunity',target::text,jsonb_build_object('stage',details->>'stage','version',expected_version+1));
 return opportunity_dashboard();
end $$;
do $$ begin
 if to_regprocedure('public.collaboration_original_opportunity_add(jsonb)') is null then execute replace(pg_get_functiondef('public.opportunity_add(jsonb)'::regprocedure),'FUNCTION public.opportunity_add(', 'FUNCTION public.collaboration_original_opportunity_add(');end if;
end $$;
create or replace function public.opportunity_add(details jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;target uuid;selected jsonb;
begin
 if not opportunity_access(true) then raise exception 'Commercial edit access required';end if;
 selected:=coalesce(details->'members','[]');perform collaboration_validate_opportunity_members(selected);
 result:=collaboration_original_opportunity_add(details);target:=(result->>'id')::uuid;
 insert into opportunity_tracking(opportunity_id,organization_id,owner_id,members,updated_by) values(target,current_organization_id(),auth.uid(),selected,auth.uid())
 on conflict(opportunity_id) do nothing;
 return jsonb_build_object('id',target,'dashboard',opportunity_dashboard());
end $$;
-- Restrict newly chosen online rooms, while leaving existing event URLs intact.
create or replace function public.collaboration_meeting_link() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='UPDATE' and new.meeting_url is not distinct from old.meeting_url then return new;end if;
 if coalesce(new.meeting_url,'') not in ('','https://meet.google.com/tai-aetz-gqe','https://meet.google.com/ise-jvne-hci','https://meet.google.com/twx-mknz-ntd') then raise exception 'Choose meeting Link 1, Link 2 or Link 3';end if;
 return new;
end $$;
drop trigger if exists collaboration_meeting_link on hub_events;
create trigger collaboration_meeting_link before insert or update on hub_events for each row execute function collaboration_meeting_link();
revoke all on function public.collaboration_validate_opportunity_members(jsonb),public.collaboration_original_opportunity_add(jsonb),public.collaboration_meeting_link() from public,anon,authenticated;
revoke all on function public.opportunity_add(jsonb),public.opportunity_save(uuid,integer,jsonb) from public,anon;
grant execute on function public.opportunity_add(jsonb),public.opportunity_save(uuid,integer,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
