begin;
-- Per-device subscriptions are private; only narrow, authenticated RPCs can write them.
create table if not exists public.hub_push_devices(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 endpoint text not null unique,subscription jsonb not null,created_at timestamptz not null default now()
);
alter table public.hub_push_devices enable row level security;
revoke all on public.hub_push_devices from anon,authenticated;
create table if not exists public.hub_push_options(
 user_id uuid primary key references public.profiles(id) on delete cascade,push_enabled boolean not null default false,
 quiet_start time,quiet_end time,timezone text not null default 'Africa/Blantyre',
 check((quiet_start is null and quiet_end is null) or (quiet_start is not null and quiet_end is not null and quiet_start<>quiet_end))
);
alter table public.hub_push_options enable row level security;
revoke all on public.hub_push_options from anon,authenticated;
create table if not exists public.hub_push_queue(
 id uuid primary key default gen_random_uuid(),notice_id uuid not null references public.personal_notifications(id) on delete cascade,
 device_id uuid not null references public.hub_push_devices(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','sending','sent','skipped','failed')),
 attempts int not null default 0,available_at timestamptz not null default now(),claimed_at timestamptz,error text,
 created_at timestamptz not null default now(),unique(notice_id,device_id)
);
alter table public.hub_push_queue enable row level security;
revoke all on public.hub_push_queue from anon,authenticated;
grant all on public.hub_push_devices,public.hub_push_options,public.hub_push_queue to service_role;
create index if not exists hub_push_pending on public.hub_push_queue(status,available_at);
create or replace function public.hub_push_settings() returns jsonb language sql security definer set search_path=public as $$
 select coalesce((select to_jsonb(o)-'user_id' from hub_push_options o where user_id=auth.uid()),'{"push_enabled":false,"timezone":"Africa/Blantyre"}'::jsonb)
$$;
create or replace function public.hub_push_save(subscription jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from profiles where id=auth.uid() and active and role<>'shared') then raise exception 'Active staff access required';end if;
 if length(subscription::text)>4096 or not (subscription->>'endpoint' ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/')
 or coalesce(subscription#>>'{keys,p256dh}','') !~ '^[A-Za-z0-9_-]{87}=?$' or coalesce(subscription#>>'{keys,auth}','') !~ '^[A-Za-z0-9_-]{22}=?=?$' then raise exception 'Invalid or unsupported push subscription';end if;
 -- One browser subscription belongs to the current signed-in person, never two accounts.
 insert into hub_push_devices(user_id,endpoint,subscription) values(auth.uid(),subscription->>'endpoint',subscription)
 on conflict(endpoint) do update set user_id=excluded.user_id,subscription=excluded.subscription;
 insert into hub_push_options(user_id,push_enabled) values(auth.uid(),true) on conflict(user_id) do update set push_enabled=true;
end $$;
create or replace function public.hub_push_remove(endpoint_value text) returns void language sql security definer set search_path=public as $$
 delete from hub_push_devices where user_id=auth.uid() and endpoint=endpoint_value
$$;
create or replace function public.hub_push_preferences(start_value time,end_value time,zone_value text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from profiles where id=auth.uid() and active and role<>'shared') then raise exception 'Active staff access required';end if;
 if not exists(select 1 from pg_timezone_names where name=zone_value) then raise exception 'Unknown time zone';end if;
 insert into hub_push_options(user_id,quiet_start,quiet_end,timezone) values(auth.uid(),start_value,end_value,zone_value)
 on conflict(user_id) do update set quiet_start=start_value,quiet_end=end_value,timezone=zone_value;
end $$;
-- Invoker rights retain the existing notification/record visibility policies.
create or replace function public.hub_push_read(notice_id uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
declare n jsonb;begin
 select to_jsonb(p) into n from personal_notifications p where id=notice_id and user_id=auth.uid();
 if n is not null then update personal_notifications set read_at=coalesce(read_at,now()) where id=notice_id and user_id=auth.uid();end if;return n;
end $$;
create or replace function public.hub_push_enqueue() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into hub_push_queue(notice_id,device_id) select new.id,d.id from hub_push_devices d join hub_push_options o using(user_id) where d.user_id=new.user_id and o.push_enabled and new.read_at is null;return new;
end $$;
drop trigger if exists hub_push_enqueue on public.personal_notifications;
create trigger hub_push_enqueue after insert on public.personal_notifications for each row execute function public.hub_push_enqueue();
create or replace function public.hub_push_claim() returns setof public.hub_push_queue language plpgsql security definer set search_path=public as $$
begin
 update hub_push_queue set status='failed',error='Delivery retry window exhausted' where attempts>=5 and (status='pending' or status='sending' and claimed_at<now()-interval '5 minutes');
 return query update hub_push_queue q set status='sending',claimed_at=now(),attempts=q.attempts+1 where q.id in (
 select id from hub_push_queue where (status='pending' and available_at<=now() or status='sending' and claimed_at<now()-interval '5 minutes') and attempts<5 order by created_at for update skip locked limit 30
 ) returning q.*;
end $$;
revoke all on function public.hub_push_claim(),public.hub_push_enqueue() from public,anon,authenticated;
grant execute on function public.hub_push_claim() to service_role;
revoke all on function public.hub_push_settings(),public.hub_push_save(jsonb),public.hub_push_remove(text),public.hub_push_preferences(time,time,text),public.hub_push_read(uuid) from public,anon;
grant execute on function public.hub_push_settings(),public.hub_push_save(jsonb),public.hub_push_remove(text),public.hub_push_preferences(time,time,text),public.hub_push_read(uuid) to authenticated;
-- Preserve visible-message semantics while reconciling pre-existing receipt and notification disagreement.
create or replace function public.acknowledge_chat_messages(message_keys text[],mark_read boolean default false) returns integer
language plpgsql security definer set search_path=public as $$declare n integer;visible_ids text[];begin
 if auth.uid() is null or module_level('chat')='none' then raise exception 'Chat access required';end if;
 if cardinality(message_keys)>500 then raise exception 'Too many messages in one acknowledgement';end if;
 select array_agg(m->>'id') into visible_ids from workspace_states w,jsonb_array_elements(coalesce(w.data->'messages','[]')) m
 where w.organization_id=current_organization_id() and m->>'id'=any(message_keys) and record_visible('messages',m,w.data,auth.uid());
 update chat_receipts r set delivered_at=coalesce(r.delivered_at,now()),read_at=case when mark_read then coalesce(r.read_at,now()) else r.read_at end
 where r.recipient_id=auth.uid() and r.message_id=any(visible_ids) and r.organization_id=current_organization_id();get diagnostics n=row_count;
 if mark_read then update personal_notifications set read_at=coalesce(read_at,now()) where user_id=auth.uid() and target_view='chat'
 and exists(select 1 from unnest(visible_ids) id where event_key in ('mention:'||id||':'||auth.uid(),'chat:'||id||':'||auth.uid()));end if;return n;
end $$;
-- Partner intake is a distinct RPL registration route. No application/payment status is fabricated.
alter table public.learners add column if not exists entry_source text;
create table if not exists public.hub_partner_intakes(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),cohort_id uuid not null references public.training_cohorts(id),
 source text not null default 'SH Aviation' check(source='SH Aviation'),full_name text not null,email text,phone text,date_of_birth date,
 reference text,notes text,token_hash text unique,expires_at timestamptz,status text not null default 'Invited' check(status in ('Invited','Submitted','Enrolled','Revoked')),
 submitted_at timestamptz,consented_at timestamptz,learner_id uuid references public.learners(id),created_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
alter table public.hub_partner_intakes enable row level security;
revoke all on public.hub_partner_intakes from anon,authenticated;
create table if not exists public.hub_partner_audit(id uuid primary key default gen_random_uuid(),intake_id uuid not null references public.hub_partner_intakes(id),actor uuid references public.profiles(id),action text not null,created_at timestamptz not null default now());
alter table public.hub_partner_audit enable row level security;
revoke all on public.hub_partner_audit from anon,authenticated;
create or replace function public.hub_partner_list() returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not has_training_access() or module_level('training')<>'edit' then raise exception 'Academy edit access required';end if;
 return coalesce((select jsonb_agg(to_jsonb(p)-'token_hash' order by p.created_at desc) from hub_partner_intakes p where organization_id=current_organization_id()),'[]'::jsonb);
end $$;
create or replace function public.hub_partner_create(cohort_key uuid,details jsonb) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare token text;row_id uuid;begin
 if not has_training_access() or module_level('training')<>'edit' then raise exception 'Academy edit access required';end if;
 if not exists(select 1 from training_cohorts c join training_courses t on t.id=c.course_id where c.id=cohort_key and c.organization_id=current_organization_id() and t.category='RPL' and c.status not in ('Completed','Cancelled')) then raise exception 'Choose an active RPL cohort';end if;
 if length(trim(coalesce(details->>'full_name','')))<2 or length(details::text)>10000 then raise exception 'Enter the learner name';end if;
 if exists(select 1 from hub_partner_intakes where cohort_id=cohort_key and status<>'Revoked' and (lower(trim(full_name))=lower(trim(details->>'full_name')) or nullif(trim(details->>'email'),'') is not null and lower(email)=lower(trim(details->>'email')))) then raise exception 'This person is already in the partner register for this cohort';end if;
 token:=encode(gen_random_bytes(32),'hex');
 insert into hub_partner_intakes(organization_id,cohort_id,full_name,email,phone,reference,notes,token_hash,expires_at,created_by)
 values(current_organization_id(),cohort_key,trim(details->>'full_name'),nullif(trim(details->>'email'),''),nullif(trim(details->>'phone'),''),left(details->>'reference',300),left(details->>'notes',3000),encode(digest(token,'sha256'),'hex'),now()+interval '14 days',auth.uid()) returning id into row_id;
 insert into hub_partner_audit(intake_id,actor,action) values(row_id,auth.uid(),'Created partner registration');
 return jsonb_build_object('id',row_id,'token',token,'expires_at',now()+interval '14 days');
end $$;
-- Possession of a high-entropy, expiring token permits a single submission, never roster access.
create or replace function public.hub_partner_submit(token_value text,details jsonb) returns void language plpgsql security definer set search_path=public,extensions as $$
declare p hub_partner_intakes;begin
 if length(token_value)<>64 or length(details::text)>10000 then raise exception 'Invalid registration';end if;
 select * into p from hub_partner_intakes where token_hash=encode(digest(token_value,'sha256'),'hex') and status='Invited' and expires_at>now() for update;
 if p.id is null then raise exception 'This link has expired, was used, or was revoked. Contact CAGE.';end if;
 if length(trim(coalesce(details->>'full_name','')))<2 or length(trim(coalesce(details->>'phone','')))<6 or coalesce(details->>'consent','')<>'true' then raise exception 'Complete your name, phone and consent';end if;
 if coalesce(details->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address';end if;
 if nullif(details->>'date_of_birth','')::date>current_date then raise exception 'Date of birth cannot be in the future';end if;
 update hub_partner_intakes set full_name=trim(details->>'full_name'),email=trim(details->>'email'),phone=trim(details->>'phone'),date_of_birth=nullif(details->>'date_of_birth','')::date,status='Submitted',submitted_at=now(),consented_at=now(),token_hash=null where id=p.id;
 insert into hub_partner_audit(intake_id,action) values(p.id,'Learner submitted details and consent');
end $$;
create or replace function public.hub_partner_revoke(intake_key uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not has_training_access() or module_level('training')<>'edit' then raise exception 'Academy edit access required';end if;
 update hub_partner_intakes set token_hash=null,status='Revoked' where id=intake_key and organization_id=current_organization_id() and learner_id is null;
 if found then insert into hub_partner_audit(intake_id,actor,action) values(intake_key,auth.uid(),'Revoked registration');end if;
end $$;
create or replace function public.hub_partner_enrol(intake_key uuid,details jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare p hub_partner_intakes;c training_cohorts;lid uuid;begin
 if not has_training_access() or module_level('training')<>'edit' then raise exception 'Academy edit access required';end if;
 select * into p from hub_partner_intakes where id=intake_key and organization_id=current_organization_id() for update;
 if p.id is null or p.status='Revoked' then raise exception 'Registration unavailable';end if;
 if p.learner_id is not null then return p.learner_id;end if;
 select * into c from training_cohorts where id=p.cohort_id for update;
 if c.status in ('Completed','Cancelled') or not exists(select 1 from training_courses where id=c.course_id and category='RPL') then raise exception 'An active RPL cohort is required';end if;
 if (select count(*) from learners where cohort_id=c.id and stage<>'Withdrawn')>=c.capacity then raise exception 'This cohort is full';end if;
 if coalesce(details->>'confirmed','')<>'true' then raise exception 'Confirm the partner registration and learner details';end if;
 if length(trim(coalesce(details->>'full_name','')))<2 or length(trim(coalesce(details->>'phone','')))<6 then raise exception 'Learner name and phone are required';end if;
 if exists(select 1 from learners where cohort_id=c.id and (lower(trim(full_name))=lower(trim(details->>'full_name')) or nullif(details->>'email','') is not null and lower(email::text)=lower(details->>'email'))) then raise exception 'A matching learner already exists in this cohort';end if;
 insert into learners(organization_id,cohort_id,full_name,email,phone,date_of_birth,sponsor,notes,created_by,entry_source,documents_complete,fee_status)
 values(p.organization_id,p.cohort_id,trim(details->>'full_name'),nullif(details->>'email',''),trim(details->>'phone'),nullif(details->>'date_of_birth','')::date,'SH Aviation',concat('Partner reference: ',p.reference,E'\n',p.notes),auth.uid(),'SH Aviation',false,'Not invoiced') returning id into lid;
 update hub_partner_intakes set learner_id=lid,status='Enrolled',token_hash=null,full_name=trim(details->>'full_name'),email=nullif(details->>'email',''),phone=trim(details->>'phone') where id=p.id;
 insert into hub_partner_audit(intake_id,actor,action) values(p.id,auth.uid(),'Enrolled following staff verification');return lid;
end $$;
revoke all on function public.hub_partner_list(),public.hub_partner_create(uuid,jsonb),public.hub_partner_revoke(uuid),public.hub_partner_enrol(uuid,jsonb),public.hub_partner_submit(text,jsonb) from public,anon,authenticated;
grant execute on function public.hub_partner_list(),public.hub_partner_create(uuid,jsonb),public.hub_partner_revoke(uuid),public.hub_partner_enrol(uuid,jsonb) to authenticated;
grant execute on function public.hub_partner_submit(text,jsonb) to anon,authenticated;
-- Mark the CAGE route only where an application-to-learner relationship is recorded.
update learners l set entry_source='CAGE application' where l.entry_source is null and exists(select 1 from academy_applications a where a.learner_id=l.id);
create or replace function public.hub_application_source() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.learner_id is not null then update learners set entry_source='CAGE application' where id=new.learner_id and entry_source is null;end if;return new;
end $$;
revoke all on function public.hub_application_source() from public,anon,authenticated;
drop trigger if exists hub_application_source on public.academy_applications;
create trigger hub_application_source after insert or update of learner_id on public.academy_applications for each row execute function public.hub_application_source();
create or replace function public.hub_push_allowed(notice_key uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare n personal_notifications;p profiles;w workspace_states;begin
 select * into n from personal_notifications where id=notice_key;
 select * into p from profiles where id=n.user_id;
 if p.id is null or not p.active or p.role='shared' or hub_access(p.id,p.organization_id,n.target_view)='none' then return false;end if;
 if n.target_view='chat' then
  select * into w from workspace_states where organization_id=p.organization_id;
  return exists(select 1 from jsonb_array_elements(coalesce(w.data->'messages','[]')) m where n.event_key in ('chat:'||(m->>'id')||':'||p.id,'mention:'||(m->>'id')||':'||p.id) and record_visible('messages',m,w.data,p.id));
 elsif n.target_view in ('tasks','projects','requests') then
  select * into w from workspace_states where organization_id=p.organization_id;
  return exists(select 1 from jsonb_array_elements(coalesce(w.data->n.target_view,'[]')) r where r->>'id'=n.target_id and record_visible(n.target_view,r,w.data,p.id));
 elsif n.target_view='calendar' and n.target_id<>'' then return hub_event_read(n.target_id::uuid,p.id);
 elsif n.target_view='notices' and n.target_id<>'' then return hub_notice_read(n.target_id::uuid,p.id);
 end if;return true;
exception when invalid_text_representation then return false;
end $$;
revoke all on function public.hub_push_allowed(uuid) from public,anon,authenticated;
grant execute on function public.hub_push_allowed(uuid) to service_role;
create or replace function public.hub_member_notifications() returns trigger language plpgsql security definer set search_path=public as $$
declare k text;r jsonb;prior jsonb;p profiles;mid text;begin
 foreach k in array array['projects','requests','tasks'] loop
  for r in select * from jsonb_array_elements(coalesce(new.data->k,'[]')) loop
   select x into prior from jsonb_array_elements(coalesce(old.data->k,'[]')) x where x->>'id'=r->>'id';
   if coalesce(r->'team','[]')=coalesce(prior->'team','[]') then continue;end if;
   for p in select * from profiles where organization_id=new.organization_id and active and role<>'shared' and id is distinct from auth.uid() loop
    mid:=staff_member_id(p.id);
    if ((coalesce(r->'team','[]') ? mid) or (coalesce(r->'team','[]') ? p.id::text)) and not ((coalesce(prior->'team','[]') ? mid) or (coalesce(prior->'team','[]') ? p.id::text)) and record_visible(k,r,new.data,p.id) then
     insert into personal_notifications(user_id,title,body,target_view,target_id,event_key) values(p.id,'Added to '||case k when 'tasks' then 'a task' when 'projects' then 'a project' else 'a request' end,'Open CAGE to view your work.',k,r->>'id','member-added:'||k||':'||(r->>'id')||':'||p.id||':'||new.version) on conflict do nothing;
    end if;
   end loop;
  end loop;
 end loop;return new;
end $$;
revoke all on function public.hub_member_notifications() from public,anon,authenticated;
drop trigger if exists hub_member_notifications on public.workspace_states;
create trigger hub_member_notifications after update on public.workspace_states for each row execute function public.hub_member_notifications();
create or replace function public.hub_push_tick() returns void language plpgsql security definer set search_path=public as $$
declare w workspace_states;t jsonb;p profiles;mid text;today text:=(now() at time zone 'Africa/Blantyre')::date::text;tomorrow text:=((now() at time zone 'Africa/Blantyre')::date+1)::text;begin
 -- Generate existing calendar reminders even when all Hub tabs are closed.
 perform hub_tick();
 for w in select * from workspace_states loop
  for t in select * from jsonb_array_elements(coalesce(w.data->'tasks','[]')) where value->>'due' in (today,tomorrow) and coalesce(value->>'status','') not in ('Done','Cancelled','Archived') loop
   for p in select * from profiles where organization_id=w.organization_id and active and role<>'shared' loop
    mid:=staff_member_id(p.id);
    if (t->>'owner' in (mid,p.id::text) or coalesce(t->'team','[]') ? mid or coalesce(t->'team','[]') ? p.id::text) and record_visible('tasks',t,w.data,p.id) then
     insert into personal_notifications(user_id,title,body,target_view,target_id,event_key) values(p.id,'Task due '||case when t->>'due'=today then 'today' else 'tomorrow' end,'Open CAGE to review the deadline.','tasks',t->>'id','task-due:'||(t->>'id')||':'||(t->>'due')||':'||p.id) on conflict do nothing;
    end if;
   end loop;
  end loop;
 end loop;
end $$;
revoke all on function public.hub_push_tick() from public,anon,authenticated;
grant execute on function public.hub_push_tick() to service_role;

notify pgrst,'reload schema';
commit;
