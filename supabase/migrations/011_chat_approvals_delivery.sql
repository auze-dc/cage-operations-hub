begin;
create or replace function public.can_self_approve() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and active and role='admin' and lower(email::text) in ('alexander@cagemw.com','ndapile@cagemw.com'));
$$;
revoke all on function public.can_self_approve() from public;
grant execute on function public.can_self_approve() to authenticated;
create or replace function validate_workflow_transitions() returns trigger language plpgsql security definer set search_path=public as $$
declare k text;r jsonb;prior jsonb;mid text;manager boolean;due date;repeat_days interval;next_task jsonb;
begin
 if auth.uid() is null then return new;end if;
 mid=staff_member_id(auth.uid());select role in ('admin','manager') into manager from profiles where id=auth.uid() and active;
 foreach k in array array['approvals','leaveRequests','expenses','quotes','requests','invoices','assets','tasks'] loop
 for r in select * from jsonb_array_elements(coalesce(new.data->k,'[]')) loop
 select x into prior from jsonb_array_elements(coalesce(old.data->k,'[]')) x where x->>'id'=r->>'id';
 if prior is not distinct from r then continue;end if;
 if prior is null then r=r||jsonb_build_object('createdBy',mid);new.data=jsonb_set(new.data,array[k],(select jsonb_agg(case when x->>'id'=r->>'id' then r else x end) from jsonb_array_elements(new.data->k) x));
 elsif prior ? 'createdBy' and r->>'createdBy' is distinct from prior->>'createdBy' then raise exception 'Submission ownership cannot be changed';end if;
 if prior is not null and ((k='approvals' and r->>'requester' is distinct from prior->>'requester') or (k='leaveRequests' and r->>'person' is distinct from prior->>'person')) then raise exception 'Submission ownership cannot be changed';end if;
 if k in ('approvals','leaveRequests','expenses','quotes') and coalesce(r->>'status','') in ('Approved','Rejected','Returned','Sent','Accepted') and (prior is null or r->>'status' is distinct from prior->>'status') then
 if k='quotes' and prior->>'status' in ('Approved','Sent','Accepted') then null;
 else
 if not coalesce(manager,false) then raise exception 'Only a manager or administrator can make this decision';end if;
 if not can_self_approve() and (r->>'createdBy' in (mid,auth.uid()::text) or coalesce(r->>'requester',r->>'person',r->>'owner') in (mid,auth.uid()::text)) then raise exception 'A different manager must approve your own submission';end if;
 end if;
 end if;
 if k='quotes' and prior->>'status' in ('Approved','Sent','Accepted') and (r-'status'-'recipient'-'sentAt'-'automaticFollowUp') is distinct from (prior-'status'-'recipient'-'sentAt'-'automaticFollowUp') and r->>'status'<>'Draft' then raise exception 'Return a changed quotation to Draft for fresh approval';end if;
 if k='expenses' and prior->>'status'='Approved' and (r-'status') is distinct from (prior-'status') and r->>'status'<>'Pending' then raise exception 'Return a changed expense to Pending for fresh approval';end if;
 if k='invoices' and exists(select 1 from invoice_payments where organization_id=new.organization_id and invoice_id=r->>'id' having sum(amount)>(r->>'amount')::numeric) then raise exception 'Invoice value cannot be lower than recorded payments';end if;
 if k='requests' and r->>'stage'='Approved to send' and prior->>'stage' is distinct from 'Approved to send' then
 if not coalesce(manager,false) or (not can_self_approve() and (r->>'createdBy'=mid or coalesce(r->>'submittedBy',r->>'owner')=mid)) then raise exception 'A different manager must approve this request';end if;end if;
 if k='invoices' and r->>'status'='Paid' and prior->>'status' is distinct from 'Paid' and not exists(select 1 from invoice_payments where organization_id=new.organization_id and invoice_id=r->>'id' having sum(amount)>=(r->>'amount')::numeric) then raise exception 'Record the payments before marking an invoice Paid';end if;
 if k='assets' and r->>'status'='Assigned' and prior->>'status' is distinct from 'Assigned' and exists(select 1 from equipment_reservations b where b.organization_id=new.organization_id and b.status='Booked' and (r->>'id')=any(b.asset_ids) and b.project_id is distinct from r->>'project' and b.ends_at>now() and b.starts_at<coalesce(nullif(r->>'returnDate','')::date+interval '1 day','infinity'::timestamptz)) then raise exception 'This equipment is reserved for another project during the handover period';end if;
 if k='assets' and not coalesce(manager,false) and r->>'custodian' is distinct from prior->>'custodian' and r->>'custodian'<>mid then raise exception 'Only a manager can hand equipment to another staff member';end if;
 if k='assets' and prior is not null and (r->>'status' is distinct from prior->>'status' or r->>'custodian' is distinct from prior->>'custodian' or r->>'project' is distinct from prior->>'project') and jsonb_array_length(coalesce(r->'history','[]'))<=jsonb_array_length(coalesce(prior->'history','[]')) then raise exception 'Use the equipment handover or service form so history is recorded';end if;
 if k='tasks' then
 if r->>'status'='Done' then
 if exists(select 1 from jsonb_array_elements(coalesce(r->'subtasks','[]')) x where not coalesce((x->>'done')::boolean,false)) then raise exception 'Complete the subtasks first';end if;
 if exists(select 1 from jsonb_array_elements_text(coalesce(r->'dependencies','[]')) dep where not exists(select 1 from jsonb_array_elements(coalesce(new.data->'tasks','[]')) t where t->>'id'=dep and t->>'status'='Done')) then raise exception 'Complete the prerequisite tasks first';end if;
 if coalesce((new.data->'settings'->>'requireTaskEvidence')::boolean,true) and coalesce(trim(r->>'evidence'),'')='' then raise exception 'Completion evidence is required';end if;
 if prior->>'status' is distinct from 'Done' and r->>'recurrence' in ('daily','weekly','monthly') and not exists(select 1 from jsonb_array_elements(new.data->'tasks') t where t->>'recurrenceSource'=r->>'id') then
 repeat_days=case r->>'recurrence' when 'daily' then interval '1 day' when 'weekly' then interval '7 days' else interval '1 month' end;
 next_task=(r-'evidence'-'blocker'-'evidencePath')||jsonb_build_object('id','t-'||gen_random_uuid(),'status','To Do','due',(greatest(current_date,(r->>'due')::date)+repeat_days)::date::text,'recurrenceSource',r->>'id','needsLeadHelp',false,'updated',current_date::text,'list',coalesce((select t->>'id' from jsonb_array_elements(coalesce(new.data->'boardLists','[]')) t where t->>'status'='To Do' limit 1),''),'subtasks',coalesce((select jsonb_agg(t||'{"done":false}'::jsonb) from jsonb_array_elements(coalesce(r->'subtasks','[]')) t),'[]'));
 new.data=jsonb_set(new.data,'{tasks}',new.data->'tasks'||jsonb_build_array(next_task));
 end if;end if;
 if r->>'status'='Blocked' and coalesce(trim(r->>'blocker'),'')='' then raise exception 'A blocker reason is required';end if;
 if r->>'id' in (select jsonb_array_elements_text(coalesce(r->'dependencies','[]'))) then raise exception 'A task cannot depend on itself';end if;
 end if;
 end loop;end loop;
 if exists(with recursive edges as(select t->>'id' as id,d.dep from jsonb_array_elements(coalesce(new.data->'tasks','[]')) t cross join lateral jsonb_array_elements_text(coalesce(t->'dependencies','[]')) d(dep)),walk as(select id,dep,array[id] path,false cycle from edges union all select w.id,e.dep,w.path||e.id,e.id=any(w.path) from walk w join edges e on e.id=w.dep where not w.cycle) select 1 from walk where cycle) then raise exception 'Task dependencies form a cycle';end if;
 return new;
end $$;
-- Expand @all using chat membership, never a browser-supplied organisation-wide list.
create or replace function expand_chat_all_mentions() returns trigger language plpgsql security definer set search_path=public as $$
declare msg jsonb;req jsonb;proj jsonb;entity jsonb;ids jsonb;mentions jsonb;person record;mid text;thread text;
begin
 for msg in select * from jsonb_array_elements(coalesce(new.data->'messages','[]')) loop
 if exists(select 1 from jsonb_array_elements(coalesce(old.data->'messages','[]')) x where x->>'id'=msg->>'id') then continue;end if;
 if coalesce(msg->>'text','') !~* '(^|[[:space:]])@all([[:space:][:punct:]]|$)' then continue;end if;
 thread=msg->>'thread';ids='[]';req=null;proj=null;entity=null;
 if thread='team:general-enquiries' then
 select coalesce(jsonb_agg(staff_member_id(id)),'[]') into ids from profiles where organization_id=new.organization_id and active;
 else
 select x into req from jsonb_array_elements(coalesce(new.data->'requests','[]')) x where x->>'id'=thread;
 if req is not null then
 select x into proj from jsonb_array_elements(coalesce(new.data->'projects','[]')) x where x->>'id'=req->>'project' or x->>'request'=req->>'id' limit 1;entity=req;
 elsif thread like 'project:%' then
 select x into proj from jsonb_array_elements(coalesce(new.data->'projects','[]')) x where x->>'id'=substring(thread from 9);entity=proj;
 elsif thread like 'deal:%' then
 select x into entity from jsonb_array_elements(coalesce(new.data->'deals','[]')) x where x->>'id'=substring(thread from 6);
 select x into proj from jsonb_array_elements(coalesce(new.data->'projects','[]')) x where x->>'id'=entity->>'project';
 elsif thread like 'commercial:%' then
 select x into entity from jsonb_array_elements(coalesce(new.data->'commercialRecords','[]')) x where x->>'id'=substring(thread from 12);
 end if;
 if jsonb_array_length(coalesce(proj->'team','[]'))>0 then ids=proj->'team';else ids=jsonb_build_array(entity->>'owner');end if;
 end if;
 mentions=coalesce(msg->'mentions','[]');
 for person in select * from profiles where organization_id=new.organization_id and active and id is distinct from new.updated_by loop
 mid=staff_member_id(person.id);
 if (ids ? mid or ids ? person.id::text) and record_visible('messages',msg,new.data,person.id)
 and not exists(select 1 from module_access where user_id=person.id and module='chat' and access='none')
 and person.id::text is distinct from msg->>'sender' and mid is distinct from msg->>'sender' then
 if not mentions ? mid then mentions=mentions||jsonb_build_array(mid);end if;
 end if;
 end loop;
 msg=jsonb_set(msg,'{mentions}',mentions);
 new.data=jsonb_set(new.data,'{messages}',(select jsonb_agg(case when x->>'id'=msg->>'id' then msg else x end) from jsonb_array_elements(new.data->'messages') x));
 end loop;
 return new;
end $$;
drop trigger if exists expand_chat_all_mentions on workspace_states;
create trigger expand_chat_all_mentions before update on workspace_states for each row execute function expand_chat_all_mentions();
-- Frozen provider payload gives retries the identical PDF and email body.
create table if not exists document_delivery_attempts (
 id uuid primary key, organization_id uuid not null references organizations(id),
 sender_id uuid not null references profiles(id), document_id text not null,
 request_hash text not null, payload jsonb not null, provider_id text,
 created_at timestamptz not null default now()
);
alter table document_delivery_attempts enable row level security;
revoke all on document_delivery_attempts from anon,authenticated;
grant select,insert,update on document_delivery_attempts to service_role;
create or replace function public.notify_relevant_work() returns trigger language plpgsql security definer set search_path=public as $$
declare item jsonb; previous jsonb; person record; mid text;
begin
 for item in select * from jsonb_array_elements(coalesce(new.data->'messages','[]')) loop
 if exists(select 1 from jsonb_array_elements(coalesce(old.data->'messages','[]')) x where x->>'id'=item->>'id') then continue; end if;
 for person in select * from profiles where organization_id=new.organization_id and active and id is distinct from new.updated_by loop
 mid=case when split_part(person.email::text,'@',1)='bonfancio' then 'bonifancio' else split_part(person.email::text,'@',1) end;
 if (coalesce(item->'mentions','[]') ? mid or coalesce(item->'mentions','[]') ? person.id::text) and record_visible('messages',item,new.data,person.id) and not exists(select 1 from module_access where user_id=person.id and module='chat' and access='none') then
 insert into personal_notifications(user_id,title,body,target_view,target_id,event_key) values(person.id,'You were mentioned',split_part(person.full_name,' ',1)||', '||left(coalesce(item->>'text','A colleague mentioned you in chat.'),240),'chat',item->>'thread','mention:'||(item->>'id')||':'||person.id) on conflict do nothing;
 end if;
 end loop;
 end loop;
 for item in select * from jsonb_array_elements(coalesce(new.data->'tasks','[]')) loop
 select x into previous from jsonb_array_elements(coalesce(old.data->'tasks','[]')) x where x->>'id'=item->>'id';
 if previous->>'owner' is not distinct from item->>'owner' then continue; end if;
 for person in select * from profiles where organization_id=new.organization_id and active and id is distinct from new.updated_by loop
 mid=case when split_part(person.email::text,'@',1)='bonfancio' then 'bonifancio' else split_part(person.email::text,'@',1) end;
 if item->>'owner'=mid then
 insert into personal_notifications(user_id,title,body,target_view,target_id) values(person.id,'Task assigned to you',split_part(person.full_name,' ',1)||', '||coalesce(item->>'title','you have a new task'),'tasks',item->>'id');
 end if;
 end loop;
 end loop;
 return new;
end $$;
commit;
