begin;
create table if not exists chat_receipts(
 organization_id uuid not null references organizations(id),message_id text not null,thread_id text not null,
 sender_id uuid references profiles(id),recipient_id uuid not null references profiles(id),
 recipient_name text not null,delivered_at timestamptz,read_at timestamptz,created_at timestamptz not null default now(),
 primary key(organization_id,message_id,recipient_id),check(read_at is null or delivered_at is not null)
);
create index if not exists receipts_recipient on chat_receipts(recipient_id,read_at);
alter table chat_receipts enable row level security;
create or replace function can_read_receipt(org uuid,msgid text,sender uuid,recipient uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select (auth.uid()=sender or auth.uid()=recipient) and org=current_organization_id() and module_level('chat')<>'none'
 and exists(select 1 from workspace_states w,jsonb_array_elements(coalesce(w.data->'messages','[]')) m where w.organization_id=org and m->>'id'=msgid and record_visible('messages',m,w.data,auth.uid()))
$$;
revoke all on function can_read_receipt(uuid,text,uuid,uuid) from public;grant execute on function can_read_receipt(uuid,text,uuid,uuid) to authenticated;
drop policy if exists receipts_read on chat_receipts;
create policy receipts_read on chat_receipts for select to authenticated using(can_read_receipt(organization_id,message_id,sender_id,recipient_id));
grant select on chat_receipts to authenticated;
-- A message's audience is captured when it is sent, not inferred from today's membership.
create or replace function capture_chat_receipts() returns trigger language plpgsql security definer set search_path=public as $$
declare m jsonb;grp jsonb;req jsonb;proj jsonb;entity jsonb;ids jsonb;thread text;person record;sender uuid;mid text;begin
 for m in select * from jsonb_array_elements(coalesce(new.data->'messages','[]')) loop
 if exists(select 1 from jsonb_array_elements(coalesce(old.data->'messages','[]')) x where x->>'id'=m->>'id') or m->>'type'='System' then continue;end if;
 thread:=m->>'thread';ids:='[]';grp:=null;req:=null;proj:=null;entity:=null;
 select id into sender from profiles where organization_id=new.organization_id and (id::text=m->>'sender' or staff_member_id(id)=m->>'sender') limit 1;
 if sender is null then continue;end if;
 select x into grp from jsonb_array_elements(coalesce(new.data->'chatGroups','[]')) x where x->>'id'=thread;
 if grp is not null then ids:=grp->'members';
 elsif thread='team:general-enquiries' then select coalesce(jsonb_agg(staff_member_id(id)),'[]') into ids from profiles where organization_id=new.organization_id and active;
 else
 select x into req from jsonb_array_elements(coalesce(new.data->'requests','[]')) x where x->>'id'=thread;
 if req is not null then select x into proj from jsonb_array_elements(coalesce(new.data->'projects','[]')) x where x->>'id'=req->>'project' or x->>'request'=req->>'id' limit 1;entity:=req;
 elsif thread like 'project:%' then select x into proj from jsonb_array_elements(coalesce(new.data->'projects','[]')) x where x->>'id'=substring(thread from 9);entity:=proj;
 elsif thread like 'deal:%' then select x into entity from jsonb_array_elements(coalesce(new.data->'deals','[]')) x where x->>'id'=substring(thread from 6);select x into proj from jsonb_array_elements(coalesce(new.data->'projects','[]')) x where x->>'id'=entity->>'project';
 elsif thread like 'commercial:%' then select x into entity from jsonb_array_elements(coalesce(new.data->'commercialRecords','[]')) x where x->>'id'=substring(thread from 12);end if;
 if jsonb_array_length(coalesce(proj->'team','[]'))>0 then ids:=proj->'team';else ids:=jsonb_build_array(entity->>'owner');end if;
 end if;
 for person in select * from profiles where organization_id=new.organization_id and active and id<>sender loop
 mid:=staff_member_id(person.id);
 if (ids ? mid or ids ? person.id::text) and record_visible('messages',m,new.data,person.id) and not exists(select 1 from module_access where user_id=person.id and module='chat' and access='none') then
 insert into chat_receipts(organization_id,message_id,thread_id,sender_id,recipient_id,recipient_name) values(new.organization_id,m->>'id',thread,sender,person.id,person.full_name) on conflict do nothing;
 -- Reuse existing notifications for private chats/mentions; add ordinary work-group messages.
 if not exists(select 1 from personal_notifications where user_id=person.id and event_key in ('mention:'||(m->>'id')||':'||person.id,'chat:'||(m->>'id')||':'||person.id)) then
 insert into personal_notifications(user_id,title,body,target_view,target_id,event_key) values(person.id,'New chat message',left(coalesce(m->>'text','Shared a file'),240),'chat',thread,'chat:'||(m->>'id')||':'||person.id) on conflict do nothing;
 end if;
 end if;
 end loop;
 end loop;return new;end $$;
-- Sort after the existing notification trigger so mention notifications retain priority.
drop trigger if exists zz_capture_chat_receipts on workspace_states;
create trigger zz_capture_chat_receipts after update on workspace_states for each row execute function capture_chat_receipts();
create or replace function acknowledge_chat_messages(message_keys text[],mark_read boolean default false) returns integer
language plpgsql security definer set search_path=public as $$declare n integer;begin
 if auth.uid() is null or module_level('chat')='none' then raise exception 'Chat access required';end if;
 if cardinality(message_keys)>500 then raise exception 'Too many messages in one acknowledgement';end if;
 update chat_receipts r set delivered_at=coalesce(r.delivered_at,now()),read_at=case when mark_read then coalesce(r.read_at,now()) else r.read_at end
 where r.recipient_id=auth.uid() and r.message_id=any(message_keys) and r.organization_id=current_organization_id()
 and can_read_receipt(r.organization_id,r.message_id,r.sender_id,r.recipient_id);
 get diagnostics n=row_count;
 if mark_read then update personal_notifications set read_at=coalesce(read_at,now()) where user_id=auth.uid() and target_view='chat' and exists(select 1 from unnest(message_keys) id where event_key in ('mention:'||id||':'||auth.uid(),'chat:'||id||':'||auth.uid()));end if;
 return n;end $$;
revoke all on function acknowledge_chat_messages(text[],boolean) from public;grant execute on function acknowledge_chat_messages(text[],boolean) to authenticated;

create table if not exists app_notification_preferences(
 user_id uuid primary key references profiles(id) on delete cascade,
 banners boolean not null default true,sound boolean not null default true,desktop boolean not null default false,
 chat boolean not null default true,mentions boolean not null default true,tasks boolean not null default true,
 reminders boolean not null default true,approvals boolean not null default true,other boolean not null default true,
 muted_threads text[] not null default '{}',updated_at timestamptz not null default now()
);
alter table app_notification_preferences enable row level security;
drop policy if exists own_notification_preferences on app_notification_preferences;
create policy own_notification_preferences on app_notification_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update on app_notification_preferences to authenticated;

create table if not exists stem_connections(
 organization_id uuid primary key references organizations(id),form_id text not null,form_title text not null,
 public_url text not null check(public_url like 'https://docs.google.com/forms/%'),
 questions jsonb not null default '[]',accepting_responses boolean not null default true,connected_at timestamptz not null default now(),last_received_at timestamptz
);
create table if not exists stem_applications(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),
 form_id text not null,response_id text not null,submitted_at timestamptz not null,respondent_email text,
 answers jsonb not null check(jsonb_typeof(answers)='array'),status text not null default 'New' check(status in ('New','Under review','Accepted','Waitlisted','Declined','Enrolled')),
 notes text,cohort_id uuid references training_cohorts(id),learner_id uuid references learners(id),reviewed_by uuid references profiles(id),updated_at timestamptz not null default now(),
 unique(organization_id,form_id,response_id)
);
create index if not exists stem_applications_dates on stem_applications(organization_id,submitted_at desc);
create or replace function can_manage_stem() returns boolean language sql stable security definer set search_path=public as $$
 select has_training_access() and exists(select 1 from profiles where id=auth.uid() and active and role in ('admin','manager'))
$$;
revoke all on function can_manage_stem() from public;grant execute on function can_manage_stem() to authenticated;
alter table stem_connections enable row level security;alter table stem_applications enable row level security;
drop policy if exists stem_connections_read on stem_connections;
create policy stem_connections_read on stem_connections for select to authenticated using(organization_id=current_organization_id() and can_manage_stem());
drop policy if exists stem_applications_read on stem_applications;
create policy stem_applications_read on stem_applications for select to authenticated using(organization_id=current_organization_id() and can_manage_stem());
drop policy if exists stem_applications_update on stem_applications;
create policy stem_applications_update on stem_applications for update to authenticated using(organization_id=current_organization_id() and can_manage_stem()) with check(organization_id=current_organization_id() and can_manage_stem());
grant select on stem_connections,stem_applications to authenticated;
grant update(status,notes,cohort_id,learner_id,reviewed_by,updated_at) on stem_applications to authenticated;
-- Re-imports update source answers while preserving human review status and notes.
create or replace function ingest_stem_response(org uuid,form_key text,response_key text,submitted timestamptz,email text,items jsonb) returns uuid
language plpgsql security definer set search_path=public as $$declare result uuid;begin
 insert into stem_applications(organization_id,form_id,response_id,submitted_at,respondent_email,answers) values(org,form_key,response_key,submitted,email,items)
 on conflict(organization_id,form_id,response_id) do update set submitted_at=excluded.submitted_at,respondent_email=excluded.respondent_email,answers=excluded.answers,updated_at=now() returning id into result;
 update stem_connections set last_received_at=now() where organization_id=org;
 return result;end $$;
revoke all on function ingest_stem_response(uuid,text,text,timestamptz,text,jsonb) from public,authenticated;
grant execute on function ingest_stem_response(uuid,text,text,timestamptz,text,jsonb) to service_role;
grant select,insert,update on stem_connections,stem_applications to service_role;
create or replace function enrol_stem_application(application_key uuid,cohort_key uuid,details jsonb) returns uuid
language plpgsql security invoker set search_path=public as $$
declare a stem_applications%rowtype;learner_key uuid;begin
 if not can_manage_stem() or not can_cohort(cohort_key) then raise exception 'STEM management and cohort access required';end if;
 select * into a from stem_applications where id=application_key and organization_id=current_organization_id() for update;
 if not found then raise exception 'Application not available';end if;
 if a.learner_id is not null then return a.learner_id;end if;
 if not exists(select 1 from training_cohorts ch join training_courses c on c.id=ch.course_id where ch.id=cohort_key and c.category='STEM' and ch.status not in ('Completed','Cancelled')) then raise exception 'Choose an active STEM cohort';end if;
 if coalesce(trim(details->>'full_name'),'')='' or coalesce(trim(details->>'guardian_name'),'')='' or coalesce(trim(details->>'guardian_phone'),'')='' then raise exception 'Learner name and guardian contact are required';end if;
 insert into learners(organization_id,cohort_id,full_name,phone,email,date_of_birth,guardian_name,guardian_phone,guardian_consent,stage,documents_complete,created_by,notes)
 values(a.organization_id,cohort_key,details->>'full_name',details->>'guardian_phone',nullif(details->>'email',''),nullif(details->>'date_of_birth','')::date,details->>'guardian_name',details->>'guardian_phone',coalesce((details->>'guardian_consent')::boolean,false),'Documents pending',false,auth.uid(),'From STEM application '||a.response_id) returning id into learner_key;
 update stem_applications set status='Enrolled',cohort_id=cohort_key,learner_id=learner_key,reviewed_by=auth.uid(),updated_at=now() where id=a.id;
 return learner_key;
end $$;
revoke all on function enrol_stem_application(uuid,uuid,jsonb) from public;grant execute on function enrol_stem_application(uuid,uuid,jsonb) to authenticated;
commit;
