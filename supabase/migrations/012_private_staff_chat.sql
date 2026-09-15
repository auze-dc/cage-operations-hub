begin;

-- Private conversations use the existing conflict-aware workspace store, but are
-- classified as chat and filtered by explicit membership.
create or replace function public.state_module(k text) returns text language sql immutable as $$
select case k when 'contacts' then 'crm' when 'deals' then 'crm' when 'events' then 'calendar' when 'invoices' then 'finance' when 'quotes' then 'finance' when 'expenses' then 'finance' when 'boardLists' then 'tasks' when 'leaveRequests' then 'leave' when 'messages' then 'chat' when 'chatGroups' then 'chat' when 'commercialRecords' then 'commercial' when 'opportunityMatches' then 'commercial' when 'opportunityMonitor' then 'commercial' when 'requestPurposes' then 'requests' else k end
$$;

-- Seed the collection so every staff account submits record-level changes rather
-- than a whole-workspace replacement when creating the first conversation.
update workspace_states
set data=jsonb_set(data,'{chatGroups}','[]'::jsonb,true),version=version+1
where not (data ? 'chatGroups');

create or replace function public.record_visible(k text,r jsonb,w jsonb,uid uuid default auth.uid()) returns boolean language plpgsql stable security definer set search_path=public as $$
declare role_name text;chosen text;mid text;owner_id text;project jsonb;department_name text;private_group jsonb;
begin
 select role into role_name from profiles where id=uid and active;
 if role_name is null then return false;end if;
 mid=staff_member_id(uid);
 -- Private chat membership applies even to administrators.
 if k='chatGroups' then return coalesce(r->'members','[]') ? mid or coalesce(r->'members','[]') ? uid::text;end if;
 if k='messages' then
   select x into private_group from jsonb_array_elements(coalesce(w->'chatGroups','[]')) x where x->>'id'=r->>'thread';
   if private_group is not null then return coalesce(private_group->'members','[]') ? mid or coalesce(private_group->'members','[]') ? uid::text;end if;
 end if;
 if role_name='admin' then return true;end if;
 select scope into chosen from record_access where user_id=uid and module=state_module(k);
 chosen=coalesce(chosen,case when role_name='manager' then 'all' else 'projects' end);
 if chosen='all' then return true;end if;
 if k in ('team','boardLists','requestPurposes','knowledge','compliance','opportunityMatches','opportunityMonitor') then return true;end if;
 owner_id=coalesce(r->>'owner',r->>'requester',r->>'person',r->>'custodian',r->>'sender',r->>'createdBy');
 if owner_id in (mid,uid::text) then return true;end if;
 if k='messages' then
   if r->>'thread'='team:general-enquiries' then return true;end if;
   return exists(select 1 from jsonb_array_elements(coalesce(w->'projects','[]')) x where x->>'id'=regexp_replace(r->>'thread','^project:','') and record_visible('projects',x,w,uid))
   or exists(select 1 from jsonb_array_elements(coalesce(w->'requests','[]')) x where x->>'id'=r->>'thread' and record_visible('requests',x,w,uid))
   or exists(select 1 from jsonb_array_elements(coalesce(w->'deals','[]')) x where x->>'id'=regexp_replace(r->>'thread','^deal:','') and record_visible('deals',x,w,uid))
   or exists(select 1 from jsonb_array_elements(coalesce(w->'commercialRecords','[]')) x where x->>'id'=regexp_replace(r->>'thread','^commercial:','') and record_visible('commercialRecords',x,w,uid));
 end if;
 if k='assets' and r->>'status'='Available' then return true;end if;
 if chosen='own' then return false;end if;
 if chosen='department' then
   select department into department_name from staff_work_settings where user_id=uid;
   if coalesce(department_name,'')<>'' and exists(select 1 from profiles p join staff_work_settings x on x.user_id=p.id where p.active and p.organization_id=(select organization_id from profiles where id=uid) and x.department=department_name and owner_id in (p.id::text,staff_member_id(p.id))) then return true;end if;
   return false;
 end if;
 if k='projects' then project=r;else select x into project from jsonb_array_elements(coalesce(w->'projects','[]')) x where x->>'id'=coalesce(r->>'project',r->>'thread');end if;
 if project is not null and (project->>'owner'=mid or project->>'lead'=mid or coalesce(project->'team','[]') ? mid) then return true;end if;
 if k='contacts' then return exists(select 1 from jsonb_array_elements(coalesce(w->'deals','[]')) d where d->>'owner'=mid and d->>'company'=coalesce(r->>'company',r->>'name'));end if;
 return false;
end $$;

-- Chat attachments follow the same private membership boundary.
create or replace function public.linked_file_visible(kind text,rid text) returns boolean language plpgsql stable security definer set search_path=public as $$
declare workspace jsonb;grp jsonb;mid text;
begin
 if kind='chat' then
   select data into workspace from workspace_states where organization_id=current_organization_id();
   select x into grp from jsonb_array_elements(coalesce(workspace->'chatGroups','[]')) x where x->>'id'=rid;
   if grp is not null then mid=staff_member_id(auth.uid());return coalesce(grp->'members','[]') ? mid or coalesce(grp->'members','[]') ? auth.uid()::text;end if;
 end if;
 if is_admin() then return true;end if;
 if kind in ('expense','expenses') then return can_work_record('expenses',rid);end if;
 if kind in ('payment','invoice') then return can_work_record('invoices',rid);end if;
 if kind='project' then return can_work_record('projects',rid);end if;
 if kind in ('task','evidence') then return can_work_record('tasks',rid);end if;
 if kind in ('hr','employees','recruitment') then return hr_scope_all() or rid=auth.uid()::text;end if;
 if kind='training' then return exists(select 1 from learners where id::text=rid and can_cohort(cohort_id));end if;
 if kind='chat' then
   if rid in ('team:general-enquiries','team-general-enquiries') then return module_level('chat')<>'none';end if;
   return can_work_record('projects',regexp_replace(rid,'^project[:-]','')) or can_work_record('requests',rid) or can_work_record('deals',regexp_replace(rid,'^deal[:-]','')) or can_work_record('commercialRecords',regexp_replace(rid,'^commercial[:-]',''));
 end if;
 return false;
end $$;

create or replace function public.save_workspace_changes(changes jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare w workspace_states%rowtype;merged jsonb;c jsonb;cur jsonb;items jsonb;k text;rid text;conflicts jsonb='[]';
begin
 if jsonb_typeof(changes)<>'array' then raise exception 'Invalid changes';end if;
 select * into w from workspace_states where organization_id=current_organization_id() for update;if w.organization_id is null then raise exception 'Workspace unavailable';end if;merged=w.data;
 for c in select * from jsonb_array_elements(changes) loop
 k=c->>'key';rid=c->>'id';if k is null or k not in ('requests','projects','tasks','contacts','deals','events','invoices','quotes','expenses','boardLists','leaveRequests','knowledge','messages','chatGroups','missions','assets','compliance','approvals','commercialRecords','opportunityMatches','opportunityMonitor','requestPurposes','team','settings') then raise exception 'Unknown module';end if;
 if module_level(state_module(k))<>'edit' and not (k='approvals' and c->'before'='null'::jsonb and c->'after'->>'status'='Pending' and c->'after'->>'requester'=staff_member_id(auth.uid())) then raise exception 'Edit access required for %',k;end if;
 if rid is not null then
   select x into cur from jsonb_array_elements(coalesce(merged->k,'[]')) x where x->>'id'=rid;
   if cur is not null and not record_visible(k,cur,w.data) then raise exception 'This record is outside your access';end if;
   if c->'after'<>'null'::jsonb and (c->'after'->>'id' is distinct from rid or not record_visible(k,c->'after',merged)) then raise exception 'Assignment is outside your access';end if;
 else cur=merged->k;if not is_admin() then raise exception 'Administrator access required for workspace settings';end if;end if;
 if cur=c->'after' or (c->'before'='null'::jsonb and cur is not null and (cur-'createdBy')=((c->'after')-'createdBy')) then continue;end if;
 if coalesce(cur,'null') is distinct from c->'before' then conflicts=conflicts||jsonb_build_array(jsonb_build_object('key',k,'id',rid,'current',cur));continue;end if;
 if rid is null then merged=jsonb_set(merged,array[k],c->'after');
 else
   select coalesce(jsonb_agg(x),'[]') into items from jsonb_array_elements(coalesce(merged->k,'[]')) x where x->>'id'<>rid;
   if c->'after'<>'null'::jsonb then items=items||jsonb_build_array(c->'after');end if;merged=jsonb_set(merged,array[k],items);
 end if;
 end loop;
 if jsonb_array_length(conflicts)>0 then return jsonb_build_object('conflicts',conflicts);end if;
 update workspace_states set data=merged,version=version+1,updated_by=auth.uid() where organization_id=w.organization_id;
 return jsonb_build_object('ok',true);
end $$;

-- Validate membership and prevent users from altering or deleting other people's messages.
create or replace function public.validate_private_staff_chat() returns trigger language plpgsql security definer set search_path=public as $$
declare grp jsonb;prior jsonb;msg jsonb;old_msg jsonb;mid text;role_name text;member text;member_count int;sorted_members text[];
begin
 if auth.uid() is null then return new;end if;
 mid=staff_member_id(auth.uid());select role into role_name from profiles where id=auth.uid() and active;
 for grp in select * from jsonb_array_elements(coalesce(new.data->'chatGroups','[]')) loop
   select x into prior from jsonb_array_elements(coalesce(old.data->'chatGroups','[]')) x where x->>'id'=grp->>'id';
   if prior is not distinct from grp then continue;end if;
   if grp->>'type' not in ('direct','group') or jsonb_typeof(grp->'members')<>'array' then raise exception 'Invalid private conversation';end if;
   select count(distinct value),array_agg(distinct value order by value) into member_count,sorted_members from jsonb_array_elements_text(grp->'members');
   if member_count<2 or not (coalesce(grp->'members','[]') ? mid) then raise exception 'A conversation needs at least two members including you';end if;
   for member in select distinct value from jsonb_array_elements_text(grp->'members') loop
     if not exists(select 1 from profiles where organization_id=new.organization_id and active and staff_member_id(id)=member) then raise exception 'A selected chat member is not an active CAGE staff account';end if;
   end loop;
   if grp->>'type'='direct' and (member_count<>2 or grp->>'id' is distinct from 'direct:'||sorted_members[1]||':'||sorted_members[2]) then raise exception 'Invalid direct conversation';end if;
   if grp->>'type'='group' and (coalesce(trim(grp->>'name'),'')='' or grp->>'id' not like 'group:%') then raise exception 'A staff group needs a name';end if;
   if prior is null then
     if grp->>'createdBy' is distinct from mid then raise exception 'Conversation creator is invalid';end if;
   else
     if grp->>'createdBy' is distinct from prior->>'createdBy' or grp->>'type' is distinct from prior->>'type' then raise exception 'Conversation ownership cannot be changed';end if;
     if prior->>'type'='direct' and grp is distinct from prior then raise exception 'Direct conversation membership cannot be changed';end if;
     if prior->>'type'='group' and mid is distinct from prior->>'createdBy' then raise exception 'Only the group creator can change its membership';end if;
   end if;
 end loop;
 for grp in select * from jsonb_array_elements(coalesce(old.data->'chatGroups','[]')) loop
   if not exists(select 1 from jsonb_array_elements(coalesce(new.data->'chatGroups','[]')) x where x->>'id'=grp->>'id') and mid is distinct from grp->>'createdBy' then raise exception 'Only the group creator can delete a conversation';end if;
 end loop;
 for msg in select * from jsonb_array_elements(coalesce(new.data->'messages','[]')) loop
   select x into old_msg from jsonb_array_elements(coalesce(old.data->'messages','[]')) x where x->>'id'=msg->>'id';
   if not exists(select 1 from jsonb_array_elements(coalesce(new.data->'chatGroups','[]')) g where g->>'id'=msg->>'thread') then continue;end if;
   if old_msg is null then
     if msg->>'sender' is distinct from mid or not exists(select 1 from jsonb_array_elements(new.data->'chatGroups') g where g->>'id'=msg->>'thread' and coalesce(g->'members','[]') ? mid) then raise exception 'You cannot send to this private conversation';end if;
   elsif msg is distinct from old_msg then raise exception 'Private chat messages cannot be altered';end if;
 end loop;
 for old_msg in select * from jsonb_array_elements(coalesce(old.data->'messages','[]')) loop
   if exists(select 1 from jsonb_array_elements(coalesce(old.data->'chatGroups','[]')) g where g->>'id'=old_msg->>'thread') and not exists(select 1 from jsonb_array_elements(coalesce(new.data->'messages','[]')) x where x->>'id'=old_msg->>'id') then raise exception 'Private chat messages cannot be deleted';end if;
 end loop;
 return new;
end $$;
drop trigger if exists validate_private_staff_chat on workspace_states;
create trigger validate_private_staff_chat before update on workspace_states for each row execute function public.validate_private_staff_chat();

-- Expand @all against the selected private group as well as existing work chats.
create or replace function public.expand_chat_all_mentions() returns trigger language plpgsql security definer set search_path=public as $$
declare msg jsonb;req jsonb;proj jsonb;entity jsonb;grp jsonb;ids jsonb;mentions jsonb;person record;mid text;thread text;
begin
 for msg in select * from jsonb_array_elements(coalesce(new.data->'messages','[]')) loop
   if exists(select 1 from jsonb_array_elements(coalesce(old.data->'messages','[]')) x where x->>'id'=msg->>'id') then continue;end if;
   if coalesce(msg->>'text','') !~* '(^|[[:space:]])@all([[:space:][:punct:]]|$)' then continue;end if;
   thread=msg->>'thread';ids='[]';req=null;proj=null;entity=null;grp=null;
   select x into grp from jsonb_array_elements(coalesce(new.data->'chatGroups','[]')) x where x->>'id'=thread;
   if grp is not null then ids=grp->'members';
   elsif thread='team:general-enquiries' then select coalesce(jsonb_agg(staff_member_id(id)),'[]') into ids from profiles where organization_id=new.organization_id and active;
   else
     select x into req from jsonb_array_elements(coalesce(new.data->'requests','[]')) x where x->>'id'=thread;
     if req is not null then select x into proj from jsonb_array_elements(coalesce(new.data->'projects','[]')) x where x->>'id'=req->>'project' or x->>'request'=req->>'id' limit 1;entity=req;
     elsif thread like 'project:%' then select x into proj from jsonb_array_elements(coalesce(new.data->'projects','[]')) x where x->>'id'=substring(thread from 9);entity=proj;
     elsif thread like 'deal:%' then select x into entity from jsonb_array_elements(coalesce(new.data->'deals','[]')) x where x->>'id'=substring(thread from 6);select x into proj from jsonb_array_elements(coalesce(new.data->'projects','[]')) x where x->>'id'=entity->>'project';
     elsif thread like 'commercial:%' then select x into entity from jsonb_array_elements(coalesce(new.data->'commercialRecords','[]')) x where x->>'id'=substring(thread from 12);end if;
     if jsonb_array_length(coalesce(proj->'team','[]'))>0 then ids=proj->'team';else ids=jsonb_build_array(entity->>'owner');end if;
   end if;
   mentions=coalesce(msg->'mentions','[]');
   for person in select * from profiles where organization_id=new.organization_id and active and id is distinct from new.updated_by loop
     mid=staff_member_id(person.id);
     if (ids ? mid or ids ? person.id::text) and record_visible('messages',msg,new.data,person.id) and not exists(select 1 from module_access where user_id=person.id and module='chat' and access='none') and person.id::text is distinct from msg->>'sender' and mid is distinct from msg->>'sender' then if not mentions ? mid then mentions=mentions||jsonb_build_array(mid);end if;end if;
   end loop;
   msg=jsonb_set(msg,'{mentions}',mentions);new.data=jsonb_set(new.data,'{messages}',(select jsonb_agg(case when x->>'id'=msg->>'id' then msg else x end) from jsonb_array_elements(new.data->'messages') x));
 end loop;
 return new;
end $$;
drop trigger if exists expand_chat_all_mentions on workspace_states;
create trigger expand_chat_all_mentions before update on workspace_states for each row execute function public.expand_chat_all_mentions();

-- Every private message creates a personal notification; existing work chats still
-- notify only mentioned staff.
create or replace function public.notify_relevant_work() returns trigger language plpgsql security definer set search_path=public as $$
declare item jsonb;previous jsonb;person record;mid text;grp jsonb;is_member boolean;mentioned boolean;
begin
 for item in select * from jsonb_array_elements(coalesce(new.data->'messages','[]')) loop
   if exists(select 1 from jsonb_array_elements(coalesce(old.data->'messages','[]')) x where x->>'id'=item->>'id') then continue;end if;
   select x into grp from jsonb_array_elements(coalesce(new.data->'chatGroups','[]')) x where x->>'id'=item->>'thread';
   for person in select * from profiles where organization_id=new.organization_id and active and id is distinct from new.updated_by loop
     mid=staff_member_id(person.id);mentioned=coalesce(item->'mentions','[]') ? mid or coalesce(item->'mentions','[]') ? person.id::text;is_member=grp is not null and (coalesce(grp->'members','[]') ? mid or coalesce(grp->'members','[]') ? person.id::text);
     if (mentioned or is_member) and mid is distinct from item->>'sender' and person.id::text is distinct from item->>'sender' and record_visible('messages',item,new.data,person.id) and not exists(select 1 from module_access where user_id=person.id and module='chat' and access='none') then
       insert into personal_notifications(user_id,title,body,target_view,target_id,event_key) values(person.id,case when mentioned then 'You were mentioned' when grp->>'type'='direct' then 'New direct message' else 'New message in '||coalesce(grp->>'name','your group') end,split_part(person.full_name,' ',1)||', '||left(coalesce(item->>'text','A colleague sent you a message.'),240),'chat',item->>'thread',case when mentioned then 'mention:' else 'chat:' end||(item->>'id')||':'||person.id) on conflict do nothing;
     end if;
   end loop;
 end loop;
 for item in select * from jsonb_array_elements(coalesce(new.data->'tasks','[]')) loop
   select x into previous from jsonb_array_elements(coalesce(old.data->'tasks','[]')) x where x->>'id'=item->>'id';
   if previous->>'owner' is not distinct from item->>'owner' then continue;end if;
   for person in select * from profiles where organization_id=new.organization_id and active and id is distinct from new.updated_by loop
     mid=staff_member_id(person.id);if item->>'owner'=mid then insert into personal_notifications(user_id,title,body,target_view,target_id) values(person.id,'Task assigned to you',split_part(person.full_name,' ',1)||', '||coalesce(item->>'title','you have a new task'),'tasks',item->>'id');end if;
   end loop;
 end loop;
 return new;
end $$;

revoke all on function public.save_workspace_changes(jsonb) from public;
grant execute on function public.save_workspace_changes(jsonb) to authenticated;
revoke all on function public.record_visible(text,jsonb,jsonb,uuid) from public;
grant execute on function public.record_visible(text,jsonb,jsonb,uuid) to authenticated;

commit;
