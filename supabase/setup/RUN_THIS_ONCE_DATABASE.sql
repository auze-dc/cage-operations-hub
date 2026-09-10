-- CAGE direct upgrade to 15.0.0. Run the WHOLE file in Supabase SQL Editor.
-- Existing installation through migrations 001-003 required.
BEGIN;
SELECT pg_advisory_xact_lock(15000015);
DO $preflight$ BEGIN
 IF to_regclass('public.workspace_states') IS NULL OR to_regclass('public.employee_documents') IS NULL THEN RAISE EXCEPTION 'The existing CAGE baseline (001-003) is missing. Stop and share this error.'; END IF;
END $preflight$;

-- 004_training_academy.sql
DO $step4$ DECLARE present integer; total integer; BEGIN
SELECT count(*) FILTER (WHERE to_regclass(t) IS NOT NULL),count(*) INTO present,total FROM unnest(ARRAY['public.training_courses','public.training_cohorts','public.learners','public.training_sessions','public.learner_attendance','public.training_assessments','public.training_certificates']) t;
IF present>0 AND present<total THEN RAISE EXCEPTION 'Partial migration 004 detected. Stop and share this error; no changes have been committed.'; END IF;
IF present=0 THEN
EXECUTE $source4$
create or replace function public.has_training_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role not in ('viewer', 'shared') from public.profiles where id = auth.uid() and active), false)
$$;

create table if not exists public.training_courses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text not null check (category in ('RPL', 'RPL Refresher', 'STEM', 'Technical', 'Corporate', 'Other')),
  duration text not null,
  default_fee numeric(14,2) not null default 0 check (default_fee >= 0),
  certificate_type text not null,
  requirements text,
  outcome text not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.training_cohorts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  course_id uuid not null references public.training_courses(id) on delete restrict,
  name text not null,
  lead_instructor uuid references public.profiles(id),
  start_date date not null,
  end_date date not null,
  venue text not null,
  capacity integer not null check (capacity > 0),
  source_reference text,
  status text not null default 'Planned' check (status in ('Planned', 'Open', 'Active', 'Assessment', 'Completed', 'Cancelled')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  unique (organization_id, name)
);

create table if not exists public.learners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cohort_id uuid not null references public.training_cohorts(id) on delete restrict,
  full_name text not null,
  email citext,
  phone text not null,
  date_of_birth date,
  sponsor text,
  guardian_name text,
  rpl_number text,
  rpl_expiry date,
  stage text not null default 'Registered' check (stage in ('Enquiry', 'Registered', 'Documents pending', 'Training', 'Assessment', 'Certification', 'Completed', 'Withdrawn')),
  fee_status text not null default 'Not invoiced' check (fee_status in ('Not invoiced', 'Invoiced', 'Part-paid', 'Paid', 'Sponsored')),
  documents_complete boolean not null default false,
  attendance_percent numeric(5,2) not null default 0 check (attendance_percent between 0 and 100),
  assessment_status text not null default 'Not started',
  renewal_due date,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cohort_id uuid not null references public.training_cohorts(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  instructor_id uuid references public.profiles(id),
  venue text,
  session_type text not null default 'Class' check (session_type in ('Class', 'Practical', 'Assessment', 'Field exercise', 'Other')),
  created_by uuid not null references public.profiles(id),
  check (ends_at > starts_at)
);

create table if not exists public.learner_attendance (
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  status text not null check (status in ('Present', 'Absent', 'Late', 'Excused')),
  minutes_attended integer check (minutes_attended is null or minutes_attended >= 0),
  recorded_by uuid not null references public.profiles(id),
  recorded_at timestamptz not null default now(),
  primary key (session_id, learner_id)
);

create table if not exists public.training_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  assessment_type text not null,
  assessed_at timestamptz not null default now(),
  result text not null check (result in ('Not started', 'Competent', 'Not yet competent', 'Pass', 'Fail', 'Pending')),
  score numeric(5,2) check (score is null or score between 0 and 100),
  assessor_id uuid references public.profiles(id),
  notes text,
  evidence_path text,
  created_by uuid not null references public.profiles(id)
);

create table if not exists public.training_certificates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  certificate_number text not null,
  certificate_type text not null,
  issued_on date not null,
  expires_on date,
  file_path text,
  issued_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (organization_id, certificate_number)
);

create index if not exists training_courses_active_idx on public.training_courses (organization_id, active, category);
create index if not exists training_cohorts_dates_idx on public.training_cohorts (organization_id, status, start_date);
create index if not exists learners_stage_idx on public.learners (organization_id, cohort_id, stage);
create index if not exists learners_renewal_idx on public.learners (organization_id, renewal_due) where renewal_due is not null;
create index if not exists training_sessions_start_idx on public.training_sessions (organization_id, cohort_id, starts_at);

alter table public.training_courses enable row level security;
alter table public.training_cohorts enable row level security;
alter table public.learners enable row level security;
alter table public.training_sessions enable row level security;
alter table public.learner_attendance enable row level security;
alter table public.training_assessments enable row level security;
alter table public.training_certificates enable row level security;

create policy "training staff manage courses" on public.training_courses for all
using (organization_id = public.current_organization_id() and public.has_training_access())
with check (organization_id = public.current_organization_id() and public.has_training_access());
create policy "training staff manage cohorts" on public.training_cohorts for all
using (organization_id = public.current_organization_id() and public.has_training_access())
with check (organization_id = public.current_organization_id() and public.has_training_access());
create policy "training staff manage learners" on public.learners for all
using (organization_id = public.current_organization_id() and public.has_training_access())
with check (organization_id = public.current_organization_id() and public.has_training_access());
create policy "training staff manage sessions" on public.training_sessions for all
using (organization_id = public.current_organization_id() and public.has_training_access())
with check (organization_id = public.current_organization_id() and public.has_training_access());
create policy "training staff manage attendance" on public.learner_attendance for all
using (exists (select 1 from public.training_sessions s where s.id = session_id and s.organization_id = public.current_organization_id()) and public.has_training_access())
with check (exists (select 1 from public.training_sessions s where s.id = session_id and s.organization_id = public.current_organization_id()) and public.has_training_access());
create policy "training staff manage assessments" on public.training_assessments for all
using (organization_id = public.current_organization_id() and public.has_training_access())
with check (organization_id = public.current_organization_id() and public.has_training_access());
create policy "training staff manage certificates" on public.training_certificates for all
using (organization_id = public.current_organization_id() and public.has_training_access())
with check (organization_id = public.current_organization_id() and public.has_training_access());

insert into public.training_courses (organization_id, name, category, duration, default_fee, certificate_type, requirements, outcome)
values
('00000000-0000-4000-8000-000000000001', 'Remote Pilot Licence (RPL)', 'RPL', 'Full approved programme', 0, 'RPL / regulatory pathway', 'National ID/passport, aviation medical and regulatory application documents', 'Prepare eligible learners for theory, practical flight assessment and the RPL application pathway.'),
('00000000-0000-4000-8000-000000000001', 'RPL Refresher & Recurrent Training', 'RPL Refresher', '1–3 days', 0, 'CAGE certificate', 'Existing RPL number, expiry date and areas requiring remediation', 'Refresh flight safety, regulations, emergency procedures and practical competence.'),
('00000000-0000-4000-8000-000000000001', 'CAGE STEM Junior', 'STEM', '8 sessions', 220000, 'CAGE certificate', 'Age 5–9, parent/guardian details, consent and safeguarding record', 'Introduce computers, drones, coding, electronics and AI through safe hands-on activities.'),
('00000000-0000-4000-8000-000000000001', 'CAGE STEM Explorer', 'STEM', '8 sessions', 220000, 'CAGE certificate', 'Age 10–15, parent/guardian details, consent and safeguarding record', 'Build practical skills in drones, coding, sensors, AI and introductory mapping.'),
('00000000-0000-4000-8000-000000000001', 'Drone Mapping & Data Processing', 'Technical', '5 days', 0, 'CAGE certificate', 'Laptop; prior drone experience helpful but not mandatory', 'Plan mapping flights, process imagery, run QA and prepare usable geospatial deliverables.'),
('00000000-0000-4000-8000-000000000001', 'Custom Corporate Drone Training', 'Corporate', 'Configured per client', 0, 'Attendance certificate', 'Defined from the client scope and risk assessment', 'Deliver a tailored course for the client equipment, team and operational use case.')
on conflict (organization_id, name) do nothing;
$source4$;
RAISE NOTICE 'Applied 004';
ELSE RAISE NOTICE 'Already present: 004'; END IF;
END $step4$;

-- 006_personal_work_and_access.sql
DO $step6$ DECLARE present integer; total integer; BEGIN
SELECT count(*) FILTER (WHERE to_regclass(t) IS NOT NULL),count(*) INTO present,total FROM unnest(ARRAY['public.module_access','public.personal_reminders','public.personal_notifications']) t;
IF present>0 AND present<total THEN RAISE EXCEPTION 'Partial migration 006 detected. Stop and share this error; no changes have been committed.'; END IF;
IF present=0 THEN
EXECUTE $source6$
create table public.module_access (
 user_id uuid references public.profiles(id) on delete cascade,
 module text not null check (module in ('requests','projects','tasks','crm','calendar','missions','assets','compliance','chat','finance','approvals','commercial','leave','knowledge','team','evidence','reports','hr','training')),
 access text not null check(access in ('none','view','edit')),
 primary key(user_id,module)
);
alter table public.module_access enable row level security;
create policy "own access or admin" on public.module_access for select using(user_id=auth.uid() or (public.is_admin() and exists(select 1 from public.profiles p where p.id=user_id and p.organization_id=public.current_organization_id())));
create policy "admin changes module access" on public.module_access for all using(public.is_admin() and exists(select 1 from public.profiles p where p.id=user_id and p.organization_id=public.current_organization_id())) with check(public.is_admin() and exists(select 1 from public.profiles p where p.id=user_id and p.organization_id=public.current_organization_id()));
create or replace function public.module_level(m text) returns text language plpgsql stable security definer set search_path=public as $$
declare r text; a text;
begin
 select role into r from profiles where id=auth.uid() and active;
 if r is null then return 'none'; end if;
 if r='admin' then return 'edit'; end if;
 if m in ('settings','admin') then return 'none'; end if;
 select access into a from module_access where user_id=auth.uid() and module=m;
 if r='viewer' then return case when a='none' then 'none' else 'view' end; end if;
 if a is not null then return a; end if;
 if m='approvals' then return case when r='manager' then 'edit' else 'none' end; end if;
 if m='hr' then return case when r in ('manager','hr') then 'edit' else 'view' end; end if;
 return case when r='viewer' then 'view' else 'edit' end;
end $$;
create or replace function public.state_module(k text) returns text language sql immutable as $$
select case k when 'contacts' then 'crm' when 'deals' then 'crm' when 'events' then 'calendar' when 'invoices' then 'finance' when 'quotes' then 'finance' when 'expenses' then 'finance' when 'boardLists' then 'tasks' when 'leaveRequests' then 'leave' when 'messages' then 'chat' when 'commercialRecords' then 'commercial' when 'opportunityMatches' then 'commercial' when 'opportunityMonitor' then 'commercial' when 'requestPurposes' then 'requests' else k end
$$;
-- Legacy snapshots are no longer directly readable/writable by non-administrators.
create policy "workspace through access rpc" on public.workspace_states as restrictive for all to authenticated using(public.is_admin()) with check(public.is_admin());
create or replace function public.get_my_workspace() returns jsonb language plpgsql security definer set search_path=public as $$
declare w workspace_states%rowtype; result jsonb='{}'; k text; v jsonb;
begin
 select * into w from workspace_states where organization_id=current_organization_id();
 if w.organization_id is null then return null; end if;
 for k,v in select * from jsonb_each(w.data) loop
   if module_level(state_module(k))<>'none' then result=result||jsonb_build_object(k,v);
   else result=result||jsonb_build_object(k,case when jsonb_typeof(v)='array' then '[]'::jsonb else '{}'::jsonb end); end if;
 end loop;
 -- Operational defaults contain no confidential record data.
 if not is_admin() then result=jsonb_set(result,'{settings}',coalesce(w.data->'settings','{}') - 'bankAccount'); end if;
 return jsonb_build_object('data',result,'version',w.version);
end $$;
create or replace function public.save_my_workspace(snapshot jsonb, expected_version bigint) returns jsonb language plpgsql security definer set search_path=public as $$
declare w workspace_states%rowtype; k text; v jsonb; merged jsonb; m text; row_value jsonb; old_value jsonb; safe_values jsonb;
begin
 select * into w from workspace_states where organization_id=current_organization_id() for update;
 if w.organization_id is null then raise exception 'Workspace unavailable'; end if;
 if w.version<>expected_version then return null; end if;
 merged=w.data;
 for k,v in select * from jsonb_each(snapshot) loop
   m=state_module(k);
   -- Ignore unchanged/read-only fields; preserve modules omitted by the caller.
   if module_level(m)='edit' and (is_admin() or k in ('requests','projects','tasks','contacts','deals','events','invoices','quotes','expenses','boardLists','leaveRequests','knowledge','messages','missions','assets','compliance','approvals','commercialRecords','opportunityMatches','opportunityMonitor','requestPurposes','team')) then
     if k='approvals' and not exists(select 1 from profiles where id=auth.uid() and role in ('admin','manager')) then continue; end if;
     if jsonb_typeof(v) is distinct from jsonb_typeof(w.data->k) and w.data ? k then raise exception 'Invalid module data'; end if;
     if k in ('quotes','expenses') and not exists(select 1 from profiles where id=auth.uid() and role in ('admin','manager')) then
       safe_values='[]';
       for row_value in select * from jsonb_array_elements(v) loop
         select x into old_value from jsonb_array_elements(coalesce(w.data->k,'[]')) x where x->>'id'=row_value->>'id';
         if k='expenses' and row_value->>'status' in ('Approved','Rejected') and old_value->>'status' is distinct from row_value->>'status' then raise exception 'Only managers can approve expenses'; end if;
         if k='quotes' and row_value->>'status' in ('Approved','Sent','Accepted') and (old_value is null or (row_value-'recipient'-'sentAt'-'automaticFollowUp'-'status') is distinct from (old_value-'recipient'-'sentAt'-'automaticFollowUp'-'status') or old_value->>'status' not in ('Approved','Sent','Accepted')) then raise exception 'Only managers can approve quotations'; end if;
         safe_values=safe_values||jsonb_build_array(row_value);
       end loop;
       v=safe_values;
     end if;
     merged=jsonb_set(merged,array[k],v);
   end if;
 end loop;
 update workspace_states set data=merged,version=w.version+1,updated_by=auth.uid() where organization_id=w.organization_id;
 return jsonb_build_object('version',w.version+1);
end $$;
revoke all on function public.get_my_workspace(),public.save_my_workspace(jsonb,bigint) from public;
grant execute on function public.get_my_workspace(),public.save_my_workspace(jsonb,bigint) to authenticated;

create table public.personal_reminders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
 title text not null check(length(title) between 1 and 250), due_at timestamptz not null,
 lead_minutes integer not null default 15 check(lead_minutes between 0 and 10080),
 target_view text not null default 'mywork', target_id text not null default '', completed_at timestamptz,
 before_sent boolean not null default false, last_nudged_at timestamptz, created_at timestamptz not null default now()
);
create table public.personal_notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade,
 title text not null, body text not null, target_view text not null, target_id text not null default '',
 read_at timestamptz, created_at timestamptz not null default now(), event_key text unique
);
alter table public.personal_reminders enable row level security;
alter table public.personal_notifications enable row level security;
create policy "only my reminders" on public.personal_reminders for all using(user_id=auth.uid() and current_organization_id() is not null) with check(user_id=auth.uid() and current_organization_id() is not null);
create policy "only my notifications" on public.personal_notifications for select using(user_id=auth.uid() and current_organization_id() is not null and module_level(target_view) <> 'none');
create policy "read own notifications" on public.personal_notifications for update using(user_id=auth.uid() and current_organization_id() is not null) with check(user_id=auth.uid());
grant select,insert,update,delete on public.personal_reminders to authenticated;
grant select on public.personal_notifications to authenticated;
revoke update on public.personal_notifications from authenticated;
grant update(read_at) on public.personal_notifications to authenticated;
create index personal_notification_user_date on personal_notifications(user_id,created_at desc);
create or replace function public.dispatch_personal_reminders() returns void language plpgsql security definer set search_path=public as $$
declare r record; first_name text;
begin
 for r in select pr.*, p.full_name from personal_reminders pr join profiles p on p.id=pr.user_id where p.active and pr.completed_at is null and pr.due_at-make_interval(mins=>pr.lead_minutes)<=now() and (not pr.before_sent or (pr.due_at<=now() and coalesce(pr.last_nudged_at,'epoch')<now()-interval '24 hours')) for update of pr skip locked loop
 first_name=split_part(r.full_name,' ',1);
 insert into personal_notifications(user_id,title,body,target_view,target_id,event_key) values(r.user_id,case when r.due_at>now() then 'Coming up: ' else 'A gentle nudge: ' end||r.title,
 case when r.due_at>now() then first_name||', you planned to work on this soon. A small first step now can make it easier.' else first_name||', your plan is still here for you. Take one small step, or choose a more realistic time. You can do this.' end,
 'mywork',r.id,'reminder:'||r.id||':'||r.due_at::text||':'||case when r.due_at>now() then 'before' else current_date::text end) on conflict(event_key) do nothing;
 update personal_reminders set before_sent=true,last_nudged_at=case when r.due_at<=now() then now() else last_nudged_at end where id=r.id;
 end loop;
end $$;
revoke all on function public.dispatch_personal_reminders() from public;
grant execute on function public.dispatch_personal_reminders() to service_role;
-- Server creates notifications only for new mentions and changed task assignments.
create or replace function public.notify_relevant_work() returns trigger language plpgsql security definer set search_path=public as $$
declare item jsonb; previous jsonb; person record; mid text;
begin
 for item in select * from jsonb_array_elements(coalesce(new.data->'messages','[]')) loop
 if exists(select 1 from jsonb_array_elements(coalesce(old.data->'messages','[]')) x where x->>'id'=item->>'id') then continue; end if;
 for person in select * from profiles where organization_id=new.organization_id and active and id is distinct from new.updated_by loop
 mid=case when split_part(person.email::text,'@',1)='bonfancio' then 'bonifancio' else split_part(person.email::text,'@',1) end;
 if coalesce(item->'mentions','[]') ? mid then
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
create trigger relevant_work_notifications after update on workspace_states for each row execute function notify_relevant_work();
create policy "finance email history" on email_log as restrictive for select to authenticated using(module_level('finance') <> 'none');
-- Additive restrictions preserve existing organization and HR protections.
create policy "attachment module read" on attachments as restrictive for select to authenticated using(module_level(case record_type when 'chat' then 'chat' when 'expense' then 'finance' else 'evidence' end)<>'none');
create policy "attachment module upload" on attachments as restrictive for insert to authenticated with check(module_level(case record_type when 'chat' then 'chat' when 'expense' then 'finance' else 'evidence' end)='edit');
create policy "file module read" on storage.objects as restrictive for select to authenticated using(bucket_id<>'cage-files' or module_level(case (storage.foldername(name))[2] when 'chat' then 'chat' when 'expense' then 'finance' when 'hr' then 'hr' when 'employees' then 'hr' when 'recruitment' then 'hr' else 'evidence' end)<>'none');
create policy "file module upload" on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'cage-files' or module_level(case (storage.foldername(name))[2] when 'chat' then 'chat' when 'expense' then 'finance' when 'hr' then 'hr' when 'employees' then 'hr' when 'recruitment' then 'hr' else 'evidence' end)='edit');
do $$ declare t text; m text; begin
 foreach t in array array['training_courses','training_cohorts','learners','training_sessions','learner_attendance','training_assessments','training_certificates','job_openings','job_applications','interviews','employee_profiles','employee_documents','opportunity_matches'] loop
 m=case when t like 'training_%' or t in ('learners','learner_attendance') then 'training' when t='opportunity_matches' then 'commercial' else 'hr' end;
 execute format('create policy "module read restriction" on public.%I as restrictive for select to authenticated using(public.module_level(%L) <> ''none'')',t,m);
 execute format('create policy "module insert restriction" on public.%I as restrictive for insert to authenticated with check(public.module_level(%L) = ''edit'')',t,m);
 execute format('create policy "module update restriction" on public.%I as restrictive for update to authenticated using(public.module_level(%L) = ''edit'') with check(public.module_level(%L) = ''edit'')',t,m,m);
 execute format('create policy "module delete restriction" on public.%I as restrictive for delete to authenticated using(public.module_level(%L) = ''edit'')',t,m);
 end loop;
end $$;
grant select,insert,update,delete on public.module_access to authenticated;

-- Persist the exact financial record used for PDF delivery.
create or replace function public.prepare_document_delivery(doc_type text, doc_record jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare w workspace_states%rowtype; key text; existing jsonb; entries jsonb; total numeric; entry jsonb;
begin
 if module_level('finance')<>'edit' then raise exception 'Finance edit access is required'; end if;
 if doc_type not in ('quote','invoice') then raise exception 'Invalid document type'; end if;
 if coalesce(doc_record->>'id','')='' then raise exception 'Missing document ID'; end if;
 key=case when doc_type='quote' then 'quotes' else 'invoices' end;
 select * into w from workspace_states where organization_id=current_organization_id() for update;
 select x into existing from jsonb_array_elements(coalesce(w.data->key,'[]')) x where x->>'id'=doc_record->>'id';
 if doc_type='quote' and not exists(select 1 from profiles where id=auth.uid() and role in ('admin','manager') and active) then
   if existing is null or existing->>'status' not in ('Approved','Sent','Accepted') or (existing-'sentAt'-'recipient'-'automaticFollowUp'-'status') is distinct from (doc_record-'sentAt'-'recipient'-'automaticFollowUp'-'status') then raise exception 'A manager must approve this quotation before sending'; end if;
 end if;
 if doc_type='quote' and doc_record->>'status' not in ('Approved','Sent','Accepted') then raise exception 'Approve this quotation before sending'; end if;
 if jsonb_typeof(doc_record->'items')='array' then
 total=0;
 for entry in select * from jsonb_array_elements(doc_record->'items') loop
 if (entry->>'quantity')::numeric<=0 or (entry->>'unitPrice')::numeric<0 or coalesce(entry->>'description','')='' then raise exception 'Invalid line item'; end if;
 total=total+round((entry->>'quantity')::numeric*(entry->>'unitPrice')::numeric,2);
 end loop;
 if total<=0 then raise exception 'Document total must be positive'; end if;
 doc_record=jsonb_set(doc_record,'{amount}',to_jsonb(total));
 end if;
 select coalesce(jsonb_agg(x),'[]') into entries from jsonb_array_elements(coalesce(w.data->key,'[]')) x where x->>'id'<>doc_record->>'id';
 entries=entries||jsonb_build_array(doc_record);
 update workspace_states set data=jsonb_set(w.data,array[key],entries),version=w.version+1,updated_by=auth.uid() where organization_id=w.organization_id;
 return jsonb_build_object('version',w.version+1,'record',doc_record);
end $$;
revoke all on function public.prepare_document_delivery(text,jsonb) from public;
grant execute on function public.prepare_document_delivery(text,jsonb) to authenticated;

-- Run reminders every minute on the server, even when no browser is open.
create extension if not exists pg_cron;
select cron.schedule('cage-personal-reminders','* * * * *','select public.dispatch_personal_reminders();');
$source6$;
RAISE NOTICE 'Applied 006';
ELSE RAISE NOTICE 'Already present: 006'; END IF;
END $step6$;

-- 007_daily_planner.sql
DO $step7$ DECLARE present integer; total integer; BEGIN
SELECT count(*) FILTER (WHERE to_regclass(t) IS NOT NULL),count(*) INTO present,total FROM unnest(ARRAY['public.task_plans','public.planner_preferences']) t;
IF present>0 AND present<total THEN RAISE EXCEPTION 'Partial migration 007 detected. Stop and share this error; no changes have been committed.'; END IF;
IF present=0 THEN
EXECUTE $source7$
create table public.task_plans (
 user_id uuid not null references profiles(id) on delete cascade, task_id text not null,
 bucket text not null default 'backlog' check(bucket in ('backlog','day','week','later')),
 plan_date date, estimate_minutes integer not null default 60 check(estimate_minutes between 5 and 10080),
 start_at timestamptz, end_at timestamptz, time_zone text not null default 'Africa/Blantyre',
 primary key(user_id,task_id),
 check((start_at is null and end_at is null) or (start_at is not null and end_at is not null and end_at>start_at and end_at-start_at<=interval '24 hours')),
 check(bucket not in ('day','week') or plan_date is not null),
 check(start_at is null or (bucket='day' and plan_date is not null))
);
create table public.planner_preferences(user_id uuid primary key references profiles(id) on delete cascade,daily_minutes integer not null default 480 check(daily_minutes between 30 and 1440));
alter table task_plans enable row level security;
alter table planner_preferences enable row level security;
create policy "own or manager views plans" on task_plans for select to authenticated using(module_level('tasks')<>'none' and (user_id=auth.uid() or (exists(select 1 from profiles where id=auth.uid() and active and role in ('admin','manager')) and exists(select 1 from profiles p where p.id=user_id and p.organization_id=current_organization_id()))));
create policy "own plans insert" on task_plans for insert to authenticated with check(user_id=auth.uid() and module_level('tasks')='edit');
create policy "own plans update" on task_plans for update to authenticated using(user_id=auth.uid() and module_level('tasks')='edit') with check(user_id=auth.uid() and module_level('tasks')='edit');
create policy "own plans delete" on task_plans for delete to authenticated using(user_id=auth.uid() and module_level('tasks')='edit');
create policy "own planning capacity" on planner_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "manager planning capacity" on planner_preferences for select to authenticated using(exists(select 1 from profiles where id=auth.uid() and active and role in ('admin','manager')) and exists(select 1 from profiles p where p.id=user_id and p.organization_id=current_organization_id()));
grant select,insert,update,delete on task_plans,planner_preferences to authenticated;
create or replace function public.validate_task_plan() returns trigger language plpgsql security definer set search_path=public as $$
declare p profiles%rowtype; t jsonb; member_id text;
begin
 select * into p from profiles where id=new.user_id and active;
 if p.id is null then raise exception 'Staff account unavailable'; end if;
 -- Serialize per-person changes so two tabs cannot double-book the same time.
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
 member_id=case when split_part(p.email::text,'@',1)='bonfancio' then 'bonifancio' else split_part(p.email::text,'@',1) end;
 select x into t from workspace_states w, lateral jsonb_array_elements(coalesce(w.data->'tasks','[]')) x where w.organization_id=p.organization_id and x->>'id'=new.task_id;
 if t is null or t->>'owner' is distinct from member_id then raise exception 'This task is no longer assigned to you. Refresh your plan.'; end if;
 if new.start_at is not null then
 if not exists(select 1 from pg_timezone_names where name=new.time_zone) then raise exception 'Invalid time zone'; end if;
 if (new.start_at at time zone new.time_zone)::date<>new.plan_date or (new.end_at at time zone new.time_zone)::date<>new.plan_date then raise exception 'Keep a time block within the planned day'; end if;
 if exists(select 1 from task_plans tp where user_id=new.user_id and task_id<>new.task_id and start_at<new.end_at and end_at>new.start_at and exists(select 1 from workspace_states w, lateral jsonb_array_elements(coalesce(w.data->'tasks','[]')) x where w.organization_id=p.organization_id and x->>'id'=tp.task_id and x->>'owner'=member_id)) then raise exception 'This time overlaps another planned task. Choose another time.'; end if;
 end if;
 return new;
end $$;
create trigger validate_daily_task_plan before insert or update on task_plans for each row execute function validate_task_plan();
-- Patch one task atomically, without overwriting another colleague's workspace changes.
create or replace function public.update_planned_task(task_key text,next_status text,next_priority text,blocker_note text,completion_evidence text) returns void language plpgsql security definer set search_path=public as $$
declare w workspace_states%rowtype; t jsonb; p profiles%rowtype; member_id text; ordinal bigint;
begin
 if module_level('tasks')<>'edit' then raise exception 'Task edit access is required'; end if;
 select * into p from profiles where id=auth.uid() and active;
 member_id=case when split_part(p.email::text,'@',1)='bonfancio' then 'bonifancio' else split_part(p.email::text,'@',1) end;
 select * into w from workspace_states where organization_id=p.organization_id for update;
 select x,ord-1 into t,ordinal from jsonb_array_elements(w.data->'tasks') with ordinality a(x,ord) where x->>'id'=task_key;
 if t is null then raise exception 'Task no longer exists'; end if;
 if t->>'owner' is distinct from member_id then raise exception 'Only your assigned tasks can be changed here'; end if;
 if next_status is null or next_priority is null or next_status not in ('To Do','In Progress','Blocked','Done') or next_priority not in ('Low','Medium','High','Urgent') then raise exception 'Invalid status or priority'; end if;
 if next_status='Blocked' and length(trim(coalesce(blocker_note,'')))=0 then raise exception 'Describe what is blocking this task'; end if;
 if next_status='Done' and coalesce((w.data->'settings'->>'requireTaskEvidence')::boolean,true) and length(trim(coalesce(completion_evidence,'')))=0 then raise exception 'Add completion evidence before marking this task done'; end if;
 t=t||jsonb_build_object('status',next_status,'priority',next_priority,'blocker',case when next_status='Blocked' then blocker_note else '' end,'evidence',completion_evidence,'updated',current_date::text);
 t=t||jsonb_build_object('list',coalesce((select x->>'id' from jsonb_array_elements(coalesce(w.data->'boardLists','[]')) x where x->>'status'=next_status limit 1),t->>'list'));
 update workspace_states set data=jsonb_set(w.data,array['tasks',ordinal::text],t),version=w.version+1,updated_by=auth.uid() where organization_id=w.organization_id;
end $$;
revoke all on function update_planned_task(text,text,text,text,text) from public;
grant execute on function update_planned_task(text,text,text,text,text) to authenticated;
$source7$;
RAISE NOTICE 'Applied 007';
ELSE RAISE NOTICE 'Already present: 007'; END IF;
END $step7$;

-- 008_staff_email_notifications.sql
DO $step8$ DECLARE present integer; total integer; BEGIN
SELECT count(*) FILTER (WHERE to_regclass(t) IS NOT NULL),count(*) INTO present,total FROM unnest(ARRAY['public.staff_email_preferences','public.staff_email_routing','public.staff_email_events','public.staff_email_outbox']) t;
IF present>0 AND present<total THEN RAISE EXCEPTION 'Partial migration 008 detected. Stop and share this error; no changes have been committed.'; END IF;
IF present=0 THEN
EXECUTE $source8$
create table staff_email_preferences(
 user_id uuid primary key references profiles(id) on delete cascade,
 delivery text not null default 'immediate' check(delivery in ('immediate','digest','inapp')),
 daily_digest boolean not null default true, reminder_email boolean not null default false,
 time_zone text not null default 'Africa/Blantyre', workdays integer[] not null default array[1,2,3,4,5],
 check(cardinality(workdays)>0 and workdays <@ array[0,1,2,3,4,5,6])
);
create table staff_email_routing(organization_id uuid primary key references organizations(id),approval_users uuid[] not null default '{}',opportunity_users uuid[] not null default '{}');
create table staff_email_events(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),user_id uuid not null references profiles(id) on delete cascade,event_key text not null unique,kind text not null,items jsonb not null,notification_id uuid references personal_notifications(id) on delete set null,available_at timestamptz not null default now(),created_at timestamptz not null default now(),batched_at timestamptz);
create table staff_email_outbox(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles(id),organization_id uuid not null references organizations(id),digest_date date,recipient text not null,subject text not null,html text not null,context jsonb not null default '[]',event_ids uuid[] not null default '{}',status text not null default 'pending' check(status in ('pending','processing','sent','failed','cancelled')),attempts integer not null default 0,available_at timestamptz not null default now(),created_at timestamptz not null default now(),sent_at timestamptz,provider_id text,error text,unique(user_id,digest_date));
create function set_staff_email_event_org() returns trigger language plpgsql security definer set search_path=public as $$ begin
 select organization_id into new.organization_id from profiles where id=new.user_id;
 return new;
end $$;
create trigger staff_email_event_org before insert on staff_email_events for each row execute function set_staff_email_event_org();
create index staff_email_event_pending on staff_email_events(user_id,available_at) where batched_at is null;
alter table staff_email_preferences enable row level security;
alter table staff_email_routing enable row level security;
alter table staff_email_events enable row level security;
alter table staff_email_outbox enable row level security;
create policy "own email preferences" on staff_email_preferences for all to authenticated using(user_id=auth.uid() and current_organization_id() is not null) with check(user_id=auth.uid() and current_organization_id() is not null);
create policy "admin email routing" on staff_email_routing for all to authenticated using(organization_id=current_organization_id() and is_admin()) with check(organization_id=current_organization_id() and is_admin());
create policy "admin email delivery history" on staff_email_outbox for select to authenticated using(organization_id=current_organization_id() and is_admin());
grant select,insert,update on staff_email_preferences,staff_email_routing to authenticated;
grant select on staff_email_outbox to authenticated;
grant all on staff_email_preferences,staff_email_routing,staff_email_events,staff_email_outbox to service_role;
create function validate_staff_email_preferences() returns trigger language plpgsql set search_path=public as $$ begin if not exists(select 1 from pg_timezone_names where name=new.time_zone) then raise exception 'Choose a valid time zone'; end if;return new;end $$;
create trigger validate_email_zone before insert or update on staff_email_preferences for each row execute function validate_staff_email_preferences();
create function queue_staff_email_from_notification() returns trigger language plpgsql security definer set search_path=public as $$
declare k text; delay interval='0 seconds'; ekey text;
begin
 if new.event_key like 'email-event:%' then return new;end if;
 k=case when new.event_key like 'mention:%' then 'mention' when new.event_key like 'reminder:%' then 'reminder' when new.title='Task assigned to you' then 'assignment' else null end;
 if k is null then return new; end if;
 delay=case when k='mention' then interval '15 minutes' when k='assignment' then interval '2 minutes' else interval '0 seconds' end;
 ekey=case when k='assignment' then 'assign:'||new.user_id||':'||date_trunc('minute',now())::text else new.id::text end;
 insert into staff_email_events(user_id,event_key,kind,items,notification_id,available_at) values(new.user_id,ekey,k,jsonb_build_array(jsonb_build_object('title',new.title,'body',new.body,'view',new.target_view,'target',new.target_id,'dueAt',(select due_at from personal_reminders where id::text=new.target_id and user_id=new.user_id))),case when k='assignment' then null else new.id end,now()+delay)
 on conflict(event_key) do update set items=staff_email_events.items||excluded.items;
 return new;
end $$;
create trigger queue_personal_email after insert on personal_notifications for each row execute function queue_staff_email_from_notification();
create function queue_staff_state_email() returns trigger language plpgsql security definer set search_path=public as $$
declare key text; x jsonb; previous jsonb; p record; member_id text; target_member text; k text; v text; route uuid[]; project jsonb;
begin
 select approval_users into route from staff_email_routing where organization_id=new.organization_id;
 foreach key in array array['approvals','requests','leaveRequests','tasks'] loop
 for x in select * from jsonb_array_elements(coalesce(new.data->key,'[]')) loop
 select a into previous from jsonb_array_elements(coalesce(old.data->key,'[]')) a where a->>'id'=x->>'id';
 k=null;target_member=null;v=key;
 if key='approvals' and x->>'status'='Pending' and (previous is null or previous->>'status' is distinct from 'Pending') then k='approval';v='approvals';
 elsif key='approvals' and previous is not null and x->>'status' is distinct from previous->>'status' and x->>'status'<>'Pending' then k='decision';target_member=x->>'requester';v=case when x->>'linkedType'='request' then 'requests' else 'mywork' end;
 elsif key='requests' and previous is not null and x->>'stage' is distinct from previous->>'stage' and x->>'stage' in ('Approved to send','Returned','Rejected','Needs information','Lost / Declined') then k='decision';target_member=coalesce(x->>'submittedBy',x->>'owner');v='requests';
 elsif key='leaveRequests' and previous is not null and x->>'status' is distinct from previous->>'status' and x->>'status'<>'Pending' then k='decision';target_member=x->>'person';v='leave';
 elsif key='tasks' and x->>'status'='Blocked' and coalesce((x->>'needsLeadHelp')::boolean,false) and (previous->>'blocker' is distinct from x->>'blocker' or previous->>'needsLeadHelp' is distinct from 'true') then
 select a into project from jsonb_array_elements(coalesce(new.data->'projects','[]')) a where a->>'id'=x->>'project';k='blocker';target_member=coalesce(project->>'lead',project->>'owner');v='projects';
 end if;
 if k is null then continue;end if;
 for p in select * from profiles where organization_id=new.organization_id and active loop
 member_id=case when split_part(p.email::text,'@',1)='bonfancio' then 'bonifancio' else split_part(p.email::text,'@',1) end;
 if (k='approval' and p.role in ('admin','manager') and (coalesce(cardinality(route),0)=0 or p.id=any(route))) or (k<>'approval' and target_member in (member_id,p.id::text)) then
 insert into staff_email_events(user_id,event_key,kind,items) values(p.id,'state:'||new.version||':'||key||':'||(x->>'id')||':'||p.id,k,jsonb_build_array(jsonb_build_object('title',coalesce(x->>'title',x->>'type','Work update'),'body',coalesce(x->>'status',x->>'stage','')||'. '||coalesce(x->>'decisionNote',x->>'decisionReason',x->>'reason',x->>'blocker',x->>'nextAction',x->>'summary','Open the record for the next step.'),'view',v,'source',key,'sourceId',x->>'id','task',case when k='blocker' then x->>'id' end,'target',case when k='blocker' then x->>'project' when key='approvals' and k='decision' then coalesce(x->>'linkedId',x->>'id') else x->>'id' end))) on conflict do nothing;
 end if;
 end loop;
 end loop;
 end loop;
 return new;
end $$;
create trigger queue_work_email after update on workspace_states for each row execute function queue_staff_state_email();
create function queue_delivery_failure_email() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if new.status='failed' and new.document_type in ('quote','invoice') and new.sender_id is not null then
 insert into staff_email_events(user_id,event_key,kind,items) values(new.sender_id,'delivery:'||new.id,'delivery_failure',jsonb_build_array(jsonb_build_object('title','Client document delivery failed','body',new.subject||'. Open the document and retry delivery.','view','finance','target',new.document_id))) on conflict do nothing;
 end if;return new;
end $$;
create trigger queue_failed_client_email after insert on email_log for each row execute function queue_delivery_failure_email();
create function enqueue_staff_email(recipient_id uuid,event_keys uuid[],digest_day date,mail_subject text,mail_html text,mail_context jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare org uuid; address text; result uuid; actual_count integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(recipient_id::text,8));
 select organization_id,email::text into org,address from profiles where id=recipient_id and active;if org is null then return null;end if;
 select count(*) into actual_count from staff_email_events where id=any(event_keys) and user_id=recipient_id and batched_at is null;
 if actual_count<>cardinality(event_keys) then return null;end if;
 if digest_day is null and actual_count=0 then return null;end if;
 insert into staff_email_outbox(user_id,organization_id,digest_date,recipient,subject,html,event_ids,context) values(recipient_id,org,digest_day,address,mail_subject,mail_html,event_keys,mail_context) on conflict(user_id,digest_date) do nothing returning id into result;
 if result is not null then update staff_email_events set batched_at=now() where id=any(event_keys) and user_id=recipient_id;end if;
 return result;
end $$;
create function claim_staff_email() returns setof staff_email_outbox language sql security definer set search_path=public as $$
 update staff_email_outbox set status='processing',attempts=attempts+1,available_at=now()+interval '5 minutes'
 where id in(select id from staff_email_outbox where status in ('pending','processing') and available_at<=now() and attempts<5 and created_at>now()-interval '23 hours' order by created_at limit 20 for update skip locked) returning *;
$$;
revoke all on function enqueue_staff_email(uuid,uuid[],date,text,text,jsonb),claim_staff_email() from public;
grant execute on function enqueue_staff_email(uuid,uuid[],date,text,text,jsonb),claim_staff_email() to service_role;

create function validate_staff_email_routing() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if exists(select 1 from unnest(new.approval_users) u where not exists(select 1 from profiles p where p.id=u and p.organization_id=new.organization_id and p.active and p.role in ('admin','manager'))) then raise exception 'Approvers must be active managers or administrators in your workspace';end if;
 if exists(select 1 from unnest(new.opportunity_users) u where not exists(select 1 from profiles p where p.id=u and p.organization_id=new.organization_id and p.active)) then raise exception 'Choose active staff in your workspace';end if;
 return new;
end $$;
create trigger validate_email_routes before insert or update on staff_email_routing for each row execute function validate_staff_email_routing();
create function request_task_help(task_key text) returns void language plpgsql security definer set search_path=public as $$
declare w workspace_states%rowtype;p profiles%rowtype;t jsonb;ordinal bigint;member_id text;
begin
 if module_level('tasks')<>'edit' then raise exception 'Task edit access required';end if;
 select * into p from profiles where id=auth.uid() and active;
 member_id=case when split_part(p.email::text,'@',1)='bonfancio' then 'bonifancio' else split_part(p.email::text,'@',1) end;
 select * into w from workspace_states where organization_id=p.organization_id for update;
 select x,ord-1 into t,ordinal from jsonb_array_elements(w.data->'tasks') with ordinality a(x,ord) where x->>'id'=task_key;
 if t is null or t->>'owner' is distinct from member_id or t->>'status' is distinct from 'Blocked' then raise exception 'Choose one of your blocked tasks';end if;
 if not exists(select 1 from jsonb_array_elements(coalesce(w.data->'projects','[]')) x join profiles lead on lead.organization_id=p.organization_id and lead.active and (lead.id::text=coalesce(x->>'lead',x->>'owner') or split_part(lead.email::text,'@',1)=coalesce(x->>'lead',x->>'owner')) where x->>'id'=t->>'project') then raise exception 'Assign an active project lead before requesting help';end if;
 t=t||jsonb_build_object('needsLeadHelp',true);
 update workspace_states set data=jsonb_set(w.data,array['tasks',ordinal::text],t),version=w.version+1,updated_by=auth.uid() where organization_id=w.organization_id;
end $$;
revoke all on function request_task_help(text) from public;
grant execute on function request_task_help(text) to authenticated;
create function queue_opportunity_staff_email() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid;
begin
 if new.match_score<80 or new.status<>'New' or (tg_op='UPDATE' and old.match_score>=80) then return new;end if;
 for recipient in select p.id from staff_email_routing r join profiles p on p.id=any(r.opportunity_users) and p.active and p.organization_id=r.organization_id where r.organization_id=new.organization_id loop
 insert into staff_email_events(user_id,event_key,kind,items) values(recipient,'opportunity:'||new.id||':'||recipient,'opportunity',jsonb_build_array(jsonb_build_object('title',new.title,'body',new.match_reason,'view','commercial','target',coalesce(new.raw_data->>'id',new.id::text)))) on conflict do nothing;
 end loop;return new;
end $$;
create trigger queue_opportunity_digest after insert or update on opportunity_matches for each row execute function queue_opportunity_staff_email();
create function mirror_staff_email_notification() returns trigger language plpgsql security definer set search_path=public as $$
declare item jsonb;
begin
 if new.kind in ('approval','decision','blocker','delivery_failure','opportunity') then
 item=new.items->0;
 insert into personal_notifications(user_id,title,body,target_view,target_id,event_key) values(new.user_id,item->>'title',item->>'body',item->>'view',item->>'target','email-event:'||new.id) on conflict do nothing;
 end if;return new;
end $$;
create trigger mirror_staff_email_to_inbox after insert on staff_email_events for each row execute function mirror_staff_email_notification();
create or replace function public.update_planned_task(task_key text,next_status text,next_priority text,blocker_note text,completion_evidence text) returns void language plpgsql security definer set search_path=public as $$
declare w workspace_states%rowtype; t jsonb; p profiles%rowtype; member_id text; ordinal bigint;
begin
 if module_level('tasks')<>'edit' then raise exception 'Task edit access is required'; end if;
 select * into p from profiles where id=auth.uid() and active;
 member_id=case when split_part(p.email::text,'@',1)='bonfancio' then 'bonifancio' else split_part(p.email::text,'@',1) end;
 select * into w from workspace_states where organization_id=p.organization_id for update;
 select x,ord-1 into t,ordinal from jsonb_array_elements(w.data->'tasks') with ordinality a(x,ord) where x->>'id'=task_key;
 if t is null then raise exception 'Task no longer exists'; end if;
 if t->>'owner' is distinct from member_id then raise exception 'Only your assigned tasks can be changed here'; end if;
 if next_status is null or next_priority is null or next_status not in ('To Do','In Progress','Blocked','Done') or next_priority not in ('Low','Medium','High','Urgent') then raise exception 'Invalid status or priority'; end if;
 if next_status='Blocked' and length(trim(coalesce(blocker_note,'')))=0 then raise exception 'Describe what is blocking this task'; end if;
 if next_status='Done' and coalesce((w.data->'settings'->>'requireTaskEvidence')::boolean,true) and length(trim(coalesce(completion_evidence,'')))=0 then raise exception 'Add completion evidence before marking this task done'; end if;
 t=t||jsonb_build_object('needsLeadHelp',case when next_status='Blocked' then coalesce((t->>'needsLeadHelp')::boolean,false) else false end,'status',next_status,'priority',next_priority,'blocker',case when next_status='Blocked' then blocker_note else '' end,'evidence',completion_evidence,'updated',current_date::text);
 t=t||jsonb_build_object('list',coalesce((select x->>'id' from jsonb_array_elements(coalesce(w.data->'boardLists','[]')) x where x->>'status'=next_status limit 1),t->>'list'));
 update workspace_states set data=jsonb_set(w.data,array['tasks',ordinal::text],t),version=w.version+1,updated_by=auth.uid() where organization_id=w.organization_id;
end $$;
$source8$;
RAISE NOTICE 'Applied 008';
ELSE RAISE NOTICE 'Already present: 008'; END IF;
END $step8$;

-- 009_reliable_workflows.sql
DO $step9$ DECLARE present integer; total integer; BEGIN
SELECT count(*) FILTER (WHERE to_regclass(t) IS NOT NULL),count(*) INTO present,total FROM unnest(ARRAY['public.staff_work_settings','public.record_access']) t;
IF present>0 AND present<total THEN RAISE EXCEPTION 'Partial migration 009 detected. Stop and share this error; no changes have been committed.'; END IF;
IF present=0 THEN
EXECUTE $source9$
create table staff_work_settings(user_id uuid primary key references profiles(id) on delete cascade,department text not null default '',annual_leave_days numeric not null default 20 check(annual_leave_days between 0 and 366));
create table record_access(user_id uuid references profiles(id) on delete cascade,module text not null,scope text not null check(scope in ('own','projects','department','all')),primary key(user_id,module));
alter table staff_work_settings enable row level security;alter table record_access enable row level security;
create policy work_settings_read on staff_work_settings for select to authenticated using(user_id=auth.uid() or (is_admin() and exists(select 1 from profiles where id=user_id and organization_id=current_organization_id())));
create policy work_settings_admin on staff_work_settings for all to authenticated using(is_admin() and exists(select 1 from profiles where id=user_id and organization_id=current_organization_id())) with check(is_admin() and exists(select 1 from profiles where id=user_id and organization_id=current_organization_id()));
create policy record_access_read on record_access for select to authenticated using(user_id=auth.uid() or (is_admin() and exists(select 1 from profiles where id=user_id and organization_id=current_organization_id())));
create policy record_access_admin on record_access for all to authenticated using(is_admin() and exists(select 1 from profiles where id=user_id and organization_id=current_organization_id())) with check(is_admin() and exists(select 1 from profiles where id=user_id and organization_id=current_organization_id()));
grant select,insert,update,delete on staff_work_settings,record_access to authenticated;
create function staff_member_id(uid uuid) returns text language sql stable security definer set search_path=public as $$select case when split_part(email::text,'@',1)='bonfancio' then 'bonifancio' else split_part(email::text,'@',1) end from profiles where id=uid and active$$;
create function record_visible(k text,r jsonb,w jsonb,uid uuid default auth.uid()) returns boolean language plpgsql stable security definer set search_path=public as $$
declare role_name text;chosen text;mid text;owner_id text;project jsonb;department_name text;
begin
 select role into role_name from profiles where id=uid and active;
 if role_name is null then return false;end if;if role_name='admin' then return true;end if;
 mid=staff_member_id(uid);select scope into chosen from record_access where user_id=uid and module=state_module(k);
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
create or replace function get_my_workspace() returns jsonb language plpgsql security definer set search_path=public as $$
declare w workspace_states%rowtype;result jsonb='{}';k text;v jsonb;filtered jsonb;
begin
 select * into w from workspace_states where organization_id=current_organization_id();if w.organization_id is null then return null;end if;
 for k,v in select * from jsonb_each(w.data) loop
 if module_level(state_module(k))='none' then filtered=case when jsonb_typeof(v)='array' then '[]'::jsonb else '{}'::jsonb end;
 elsif jsonb_typeof(v)='array' then select coalesce(jsonb_agg(x),'[]') into filtered from jsonb_array_elements(v) x where record_visible(k,x,w.data);
 else filtered=v;end if;
 result=result||jsonb_build_object(k,filtered);
 end loop;
 if not is_admin() then result=jsonb_set(result,'{settings}',coalesce(result->'settings','{}')-'opportunityApiKey'-'emailApiKey');end if;
 return jsonb_build_object('version',w.version,'data',result);
end $$;
-- Only changed records are submitted. Unrelated colleague edits survive.
create function save_workspace_changes(changes jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare w workspace_states%rowtype;merged jsonb;c jsonb;cur jsonb;items jsonb;k text;rid text;conflicts jsonb='[]';
begin
 if jsonb_typeof(changes)<>'array' then raise exception 'Invalid changes';end if;
 select * into w from workspace_states where organization_id=current_organization_id() for update;if w.organization_id is null then raise exception 'Workspace unavailable';end if;merged=w.data;
 for c in select * from jsonb_array_elements(changes) loop
 k=c->>'key';rid=c->>'id';if k is null or k not in ('requests','projects','tasks','contacts','deals','events','invoices','quotes','expenses','boardLists','leaveRequests','knowledge','messages','missions','assets','compliance','approvals','commercialRecords','opportunityMatches','opportunityMonitor','requestPurposes','team','settings') then raise exception 'Unknown module';end if;
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
create or replace function save_my_workspace(snapshot jsonb,expected_version bigint) returns jsonb language plpgsql security definer set search_path=public as $$begin raise exception 'Please refresh CAGE to use the safer saving update';end$$;
-- Central validation also protects direct admin saves and alternative update paths.
create function validate_workflow_transitions() returns trigger language plpgsql security definer set search_path=public as $$
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
 if r->>'createdBy' in (mid,auth.uid()::text) or coalesce(r->>'requester',r->>'person',r->>'owner') in (mid,auth.uid()::text) then raise exception 'A different manager must approve your own submission';end if;
 end if;
 end if;
 if k='quotes' and prior->>'status' in ('Approved','Sent','Accepted') and (r-'status'-'recipient'-'sentAt'-'automaticFollowUp') is distinct from (prior-'status'-'recipient'-'sentAt'-'automaticFollowUp') and r->>'status'<>'Draft' then raise exception 'Return a changed quotation to Draft for fresh approval';end if;
 if k='expenses' and prior->>'status'='Approved' and (r-'status') is distinct from (prior-'status') and r->>'status'<>'Pending' then raise exception 'Return a changed expense to Pending for fresh approval';end if;
 if k='invoices' and exists(select 1 from invoice_payments where organization_id=new.organization_id and invoice_id=r->>'id' having sum(amount)>(r->>'amount')::numeric) then raise exception 'Invoice value cannot be lower than recorded payments';end if;
 if k='requests' and r->>'stage'='Approved to send' and prior->>'stage' is distinct from 'Approved to send' then
 if not coalesce(manager,false) or r->>'createdBy'=mid or coalesce(r->>'submittedBy',r->>'owner')=mid then raise exception 'A different manager must approve this request';end if;end if;
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
create trigger validate_workflow_before_save before update on workspace_states for each row execute function validate_workflow_transitions();
revoke all on function save_workspace_changes(jsonb) from public;grant execute on function save_workspace_changes(jsonb) to authenticated;
$source9$;
RAISE NOTICE 'Applied 009';
ELSE RAISE NOTICE 'Already present: 009'; END IF;
END $step9$;

-- 010_delivery_tools.sql
DO $step10$ DECLARE present integer; total integer; BEGIN
SELECT count(*) FILTER (WHERE to_regclass(t) IS NOT NULL),count(*) INTO present,total FROM unnest(ARRAY['public.equipment_reservations','public.invoice_payments','public.daily_priorities','public.cohort_messages','public.equipment_kits','public.cohort_deliveries']) t;
IF present>0 AND present<total THEN RAISE EXCEPTION 'Partial migration 010 detected. Stop and share this error; no changes have been committed.'; END IF;
IF present=0 THEN
EXECUTE $source10$
create function can_work_record(k text,rid text) returns boolean language sql stable security definer set search_path=public as $$select module_level(state_module(k))<>'none' and exists(select 1 from workspace_states w,jsonb_array_elements(coalesce(w.data->k,'[]')) r where w.organization_id=current_organization_id() and r->>'id'=rid and record_visible(k,r,w.data))$$;
create table equipment_reservations(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),project_id text not null,user_id uuid not null references profiles(id),asset_ids text[] not null,starts_at timestamptz not null,ends_at timestamptz not null,status text not null default 'Booked' check(status in ('Booked','Cancelled','Returned')),notes text,created_at timestamptz default now(),check(ends_at>starts_at and cardinality(asset_ids)>0));
alter table equipment_reservations enable row level security;
create policy reservation_read on equipment_reservations for select to authenticated using(organization_id=current_organization_id() and module_level('assets')<>'none' and (user_id=auth.uid() or can_work_record('projects',project_id)));
grant select on equipment_reservations to authenticated;
create function reserve_equipment(project_key text,assets text[],starts timestamptz,ends timestamptz,note text) returns uuid language plpgsql security definer set search_path=public as $$
declare w jsonb;asset text;a jsonb;result uuid;
begin
 if module_level('assets')<>'edit' or not can_work_record('projects',project_key) then raise exception 'Project and equipment access required';end if;
 if starts<now() or ends<=starts or cardinality(assets)=0 or assets is null then raise exception 'Choose equipment and a future time range';end if;
 perform pg_advisory_xact_lock(hashtextextended(current_organization_id()::text,15));
 select data into w from workspace_states where organization_id=current_organization_id();
 foreach asset in array assets loop
 select x into a from jsonb_array_elements(w->'assets') x where x->>'id'=asset;
 if a is null or a->>'status'='Maintenance' or a->>'condition' in ('Damaged','Needs inspection') then raise exception 'Equipment is unavailable or needs maintenance';end if;
 if a->>'status'='Assigned' and (coalesce(a->>'returnDate','')='' or (a->>'returnDate')::date>=starts::date) then raise exception 'Equipment is already checked out during these dates';end if;
 if exists(select 1 from equipment_reservations where organization_id=current_organization_id() and status='Booked' and asset=any(asset_ids) and starts_at<ends and ends_at>starts) then raise exception 'Equipment is already reserved for part of this period';end if;
 end loop;
 insert into equipment_reservations(organization_id,project_id,user_id,asset_ids,starts_at,ends_at,notes) values(current_organization_id(),project_key,auth.uid(),assets,starts,ends,note) returning id into result;return result;
end $$;
create function cancel_reservation(reservation_id uuid) returns void language plpgsql security definer set search_path=public as $$begin update equipment_reservations set status='Cancelled' where id=reservation_id and organization_id=current_organization_id() and (user_id=auth.uid() or is_admin()) and status='Booked';if not found then raise exception 'Reservation is not available for cancellation';end if;end$$;
create table invoice_payments(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),invoice_id text not null,amount numeric(14,2) not null check(amount>0),currency text not null,paid_on date not null,reference text not null,receipt_path text,recorded_by uuid not null references profiles(id),created_at timestamptz default now(),unique(organization_id,invoice_id,reference));
alter table invoice_payments enable row level security;create policy payment_read on invoice_payments for select to authenticated using(organization_id=current_organization_id() and can_work_record('invoices',invoice_id));grant select on invoice_payments to authenticated;
create function record_payment(invoice_key text,value numeric,paid_date date,payment_ref text,receipt text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare w workspace_states%rowtype;i jsonb;remaining numeric;result uuid;ordinal bigint;
begin
 if module_level('finance')<>'edit' or not can_work_record('invoices',invoice_key) then raise exception 'Finance access required';end if;
 if value is distinct from round(value,2) then raise exception 'Use at most two decimal places';end if;
 if value<=0 or value is null or paid_date>current_date or paid_date is null or coalesce(trim(payment_ref),'')='' then raise exception 'Enter a positive amount, payment date and unique reference';end if;
 select * into w from workspace_states where organization_id=current_organization_id() for update;
 select x,ord-1 into i,ordinal from jsonb_array_elements(w.data->'invoices') with ordinality a(x,ord) where x->>'id'=invoice_key;
 select (i->>'amount')::numeric-coalesce(sum(amount),0) into remaining from invoice_payments where organization_id=w.organization_id and invoice_id=invoice_key;
 if value>remaining then raise exception 'Payment exceeds the outstanding balance';end if;
 if receipt is not null and split_part(receipt,'/',1)<>w.organization_id::text then raise exception 'Invalid receipt';end if;
 insert into invoice_payments(organization_id,invoice_id,amount,currency,paid_on,reference,receipt_path,recorded_by) values(w.organization_id,invoice_key,value,coalesce(i->>'currency','MWK'),paid_date,trim(payment_ref),receipt,auth.uid()) returning id into result;
 i=i||jsonb_build_object('status',case when value=remaining then 'Paid' else coalesce(i->>'status','Sent') end,'paidAmount',(i->>'amount')::numeric-remaining+value);
 update workspace_states set data=jsonb_set(w.data,array['invoices',ordinal::text],i),version=version+1,updated_by=auth.uid() where organization_id=w.organization_id;return result;
end $$;
create table daily_priorities(user_id uuid references profiles(id),day date,task_ids text[] not null check(cardinality(task_ids)<=3),primary key(user_id,day));alter table daily_priorities enable row level security;create policy priorities_own on daily_priorities for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());grant select,insert,update on daily_priorities to authenticated;
-- Training tables already exist; replace permissive write policies with action-specific access.
create or replace function has_training_access() returns boolean language sql stable security definer set search_path=public as $$select module_level('training')='edit'$$;
create function can_cohort(cid uuid) returns boolean language plpgsql stable security definer set search_path=public as $$
declare c training_cohorts%rowtype;scope_name text;r text;
begin
 if module_level('training')='none' then return false;end if;
 select * into c from training_cohorts where id=cid and organization_id=current_organization_id();if c.id is null then return false;end if;
 select role into r from profiles where id=auth.uid() and active;select scope into scope_name from record_access where user_id=auth.uid() and module='training';
 if r='admin' or coalesce(scope_name,case when r='manager' then 'all' else 'own' end)='all' then return true;end if;
 if c.lead_instructor=auth.uid() or c.created_by=auth.uid() then return true;end if;
 if scope_name='department' then return exists(select 1 from staff_work_settings a join staff_work_settings b on b.department=a.department and b.department<>'' where a.user_id=auth.uid() and b.user_id=c.lead_instructor);end if;return false;
end $$;
-- Policies can call can_cohort without recursion because it runs as the table owner.
do $$declare t text;p record;begin
 foreach t in array array['training_courses','training_cohorts','learners','training_sessions','learner_attendance','training_assessments','training_certificates'] loop
 for p in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on %I',p.policyname,t);end loop;
 end loop;
end $$;
create policy courses_read on training_courses for select to authenticated using(organization_id=current_organization_id() and module_level('training')<>'none');
create policy courses_edit on training_courses for all to authenticated using(organization_id=current_organization_id() and has_training_access()) with check(organization_id=current_organization_id() and has_training_access());
create policy cohorts_read on training_cohorts for select to authenticated using(can_cohort(id));
create policy cohorts_insert on training_cohorts for insert to authenticated with check(organization_id=current_organization_id() and has_training_access() and created_by=auth.uid());
create policy cohorts_edit on training_cohorts for update to authenticated using(can_cohort(id) and has_training_access()) with check(organization_id=current_organization_id() and can_cohort(id) and has_training_access());
create policy learners_read on learners for select to authenticated using(can_cohort(cohort_id));
create policy learners_write on learners for all to authenticated using(can_cohort(cohort_id) and has_training_access()) with check(organization_id=current_organization_id() and can_cohort(cohort_id) and has_training_access());
create policy sessions_read on training_sessions for select to authenticated using(can_cohort(cohort_id));
create policy sessions_write on training_sessions for all to authenticated using(can_cohort(cohort_id) and has_training_access()) with check(organization_id=current_organization_id() and can_cohort(cohort_id) and has_training_access());
create policy attendance_read on learner_attendance for select to authenticated using(exists(select 1 from training_sessions s where s.id=session_id and can_cohort(s.cohort_id)));
create policy attendance_write on learner_attendance for all to authenticated using(has_training_access() and exists(select 1 from training_sessions s where s.id=session_id and can_cohort(s.cohort_id))) with check(has_training_access() and exists(select 1 from training_sessions s join learners l on l.cohort_id=s.cohort_id where s.id=session_id and l.id=learner_id and can_cohort(s.cohort_id)));
create policy assessments_read on training_assessments for select to authenticated using(exists(select 1 from learners l where l.id=learner_id and can_cohort(l.cohort_id)));
create policy assessments_write on training_assessments for all to authenticated using(has_training_access() and exists(select 1 from learners l where l.id=learner_id and can_cohort(l.cohort_id))) with check(organization_id=current_organization_id() and has_training_access() and exists(select 1 from learners l where l.id=learner_id and can_cohort(l.cohort_id)));
create policy certificates_read on training_certificates for select to authenticated using(exists(select 1 from learners l where l.id=learner_id and can_cohort(l.cohort_id)));
create policy certificates_write on training_certificates for all to authenticated using(has_training_access() and exists(select 1 from learners l where l.id=learner_id and can_cohort(l.cohort_id))) with check(organization_id=current_organization_id() and has_training_access() and exists(select 1 from learners l where l.id=learner_id and can_cohort(l.cohort_id)));
create function training_progress() returns trigger language plpgsql security definer set search_path=public as $$begin
 if tg_table_name='learner_attendance' then update learners set attendance_percent=(select round(100.0*count(*) filter(where status in ('Present','Late'))/nullif(count(*),0),2) from learner_attendance where learner_id=new.learner_id) where id=new.learner_id;
 else update learners set assessment_status=new.result where id=new.learner_id;end if;return new;end$$;
create trigger attendance_progress after insert or update on learner_attendance for each row execute function training_progress();
create trigger assessment_progress after insert on training_assessments for each row execute function training_progress();
create table cohort_messages(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),cohort_id uuid not null references training_cohorts(id),sender_id uuid not null references profiles(id),body text not null check(length(trim(body))>0),created_at timestamptz default now());alter table cohort_messages enable row level security;
create policy cohort_messages_read on cohort_messages for select to authenticated using(can_cohort(cohort_id));create policy cohort_messages_insert on cohort_messages for insert to authenticated with check(can_cohort(cohort_id) and has_training_access() and organization_id=current_organization_id() and sender_id=auth.uid());grant select,insert on cohort_messages to authenticated;
revoke all on function reserve_equipment(text,text[],timestamptz,timestamptz,text),cancel_reservation(uuid),record_payment(text,numeric,date,text,text) from public;
grant execute on function reserve_equipment(text,text[],timestamptz,timestamptz,text),cancel_reservation(uuid),record_payment(text,numeric,date,text,text) to authenticated;

create table equipment_kits(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),name text not null,asset_ids text[] not null check(cardinality(asset_ids)>0));alter table equipment_kits enable row level security;
create policy kits_read on equipment_kits for select to authenticated using(organization_id=current_organization_id() and module_level('assets')<>'none');
create policy kits_write on equipment_kits for all to authenticated using(organization_id=current_organization_id() and module_level('assets')='edit') with check(organization_id=current_organization_id() and module_level('assets')='edit');grant select,insert,update on equipment_kits to authenticated;
create function equipment_busy() returns jsonb language sql stable security definer set search_path=public as $$select coalesce(jsonb_agg(jsonb_build_object('asset_ids',asset_ids,'starts_at',starts_at,'ends_at',ends_at)),'[]') from equipment_reservations where organization_id=current_organization_id() and module_level('assets')<>'none' and status='Booked' and ends_at>now()$$;
revoke all on function equipment_busy() from public;grant execute on function equipment_busy() to authenticated;
create function email_scoped_workspace(recipient uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare w jsonb;k text;v jsonb;out_data jsonb='{}';begin
 select data into w from workspace_states where organization_id=(select organization_id from profiles where id=recipient and active);
 for k,v in select * from jsonb_each(coalesce(w,'{}')) loop if jsonb_typeof(v)='array' then select coalesce(jsonb_agg(x),'[]') into v from jsonb_array_elements(v) x where record_visible(k,x,w,recipient);end if;out_data=out_data||jsonb_build_object(k,v);end loop;return jsonb_build_object('data',out_data);
end $$;
revoke all on function email_scoped_workspace(uuid) from public;grant execute on function email_scoped_workspace(uuid) to service_role;

create table cohort_deliveries(delivery_key text primary key,organization_id uuid not null references organizations(id),cohort_id uuid not null references training_cohorts(id),learner_id uuid not null references learners(id),sender_id uuid not null references profiles(id),status text not null,created_at timestamptz not null default now());alter table cohort_deliveries enable row level security;
create policy cohort_delivery_read on cohort_deliveries for select to authenticated using(can_cohort(cohort_id));grant select on cohort_deliveries to authenticated;grant all on cohort_deliveries to service_role;
$source10$;
RAISE NOTICE 'Applied 010';
ELSE RAISE NOTICE 'Already present: 010'; END IF;
END $step10$;

-- 011_linked_record_protection.sql
DO $step11$ DECLARE present integer; total integer; BEGIN
IF to_regprocedure('public.linked_file_visible(text,text)') IS NULL THEN
EXECUTE $source11$
create function hr_scope_all() returns boolean language sql stable security definer set search_path=public as $$select coalesce((select role in ('admin','manager','hr') from profiles where id=auth.uid() and active),false) and module_level('hr')<>'none'$$;
-- Extend the same record visibility to attached files, not just the page listing.
create function linked_file_visible(kind text,rid text) returns boolean language plpgsql stable security definer set search_path=public as $$
begin
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
create policy attachment_record_read on attachments as restrictive for select to authenticated using(uploaded_by=auth.uid() or linked_file_visible(record_type,record_id));
create policy stored_record_read on storage.objects as restrictive for select to authenticated using(bucket_id<>'cage-files' or owner_id=auth.uid()::text or linked_file_visible(split_part(name,'/',2),split_part(name,'/',3)) or exists(select 1 from attachments a where a.storage_path=name and (a.uploaded_by=auth.uid() or linked_file_visible(a.record_type,a.record_id))));
-- Raw HR records are confined to their owner or authorised management.

-- Keep staff notification reads aligned to record scope after access changes.
create policy scoped_notifications on personal_notifications as restrictive for select to authenticated using(target_view='mywork' or (target_view='chat' and linked_file_visible('chat',target_id)) or target_view in ('notifications','commercial') or can_work_record(case target_view when 'leave' then 'leaveRequests' when 'finance' then 'invoices' else target_view end,target_id) or (target_view='finance' and can_work_record('quotes',target_id)));
create function validate_training_stage() returns trigger language plpgsql security definer set search_path=public as $$
declare capacity integer;enrolled integer;
begin
 if tg_op='INSERT' or new.cohort_id is distinct from old.cohort_id then
 select c.capacity into capacity from training_cohorts c where c.id=new.cohort_id for update;
 select count(*) into enrolled from learners where cohort_id=new.cohort_id and stage<>'Withdrawn' and id<>new.id;
 if enrolled>=capacity then raise exception 'This cohort is full';end if;
 end if;
 if new.stage in ('Training','Assessment','Certification','Completed') and not new.documents_complete then raise exception 'Complete learner document checks first';end if;
 if new.stage in ('Certification','Completed') and (tg_op='INSERT' or old.stage is distinct from new.stage) and not exists(select 1 from training_assessments where learner_id=new.id and result in ('Competent','Pass')) then raise exception 'Record a successful assessment before certification or completion';end if;
 return new;
end $$;
create trigger training_stage_rules before insert or update on learners for each row execute function validate_training_stage();
create function validate_priority_tasks() returns trigger language plpgsql security definer set search_path=public as $$begin
 if exists(select 1 from unnest(new.task_ids) id where not exists(select 1 from workspace_states w,jsonb_array_elements(coalesce(w.data->'tasks','[]')) t where w.organization_id=current_organization_id() and t->>'id'=id and t->>'owner'=staff_member_id(new.user_id))) then raise exception 'Choose only your own assigned tasks';end if;return new;
end$$;
create trigger own_priority_tasks before insert or update on daily_priorities for each row execute function validate_priority_tasks();
create or replace function public.prepare_document_delivery(doc_type text, doc_record jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare w workspace_states%rowtype; key text; existing jsonb; entries jsonb; total numeric; entry jsonb;
begin
 if module_level('finance')<>'edit' then raise exception 'Finance edit access is required'; end if;
 if doc_type not in ('quote','invoice') then raise exception 'Invalid document type'; end if;
 if coalesce(doc_record->>'id','')='' then raise exception 'Missing document ID'; end if;
 key=case when doc_type='quote' then 'quotes' else 'invoices' end;
 select * into w from workspace_states where organization_id=current_organization_id() for update;
 select x into existing from jsonb_array_elements(coalesce(w.data->key,'[]')) x where x->>'id'=doc_record->>'id';
 if existing is not null and not record_visible(key,existing,w.data) then raise exception 'Document is outside your access';end if;
 if existing is null and not record_visible(key,doc_record,w.data) then raise exception 'Document is outside your access';end if;
 if existing is not null and (existing-'sentAt'-'recipient'-'automaticFollowUp'-'status') is distinct from (doc_record-'sentAt'-'recipient'-'automaticFollowUp'-'status') then raise exception 'A colleague changed this document. Refresh before sending.';end if;
 if doc_type='quote' and not exists(select 1 from profiles where id=auth.uid() and role in ('admin','manager') and active) then
   if existing is null or existing->>'status' not in ('Approved','Sent','Accepted') or (existing-'sentAt'-'recipient'-'automaticFollowUp'-'status') is distinct from (doc_record-'sentAt'-'recipient'-'automaticFollowUp'-'status') then raise exception 'A manager must approve this quotation before sending'; end if;
 end if;
 if doc_type='quote' and doc_record->>'status' not in ('Approved','Sent','Accepted') then raise exception 'Approve this quotation before sending'; end if;
 if jsonb_typeof(doc_record->'items')='array' then
 total=0;
 for entry in select * from jsonb_array_elements(doc_record->'items') loop
 if (entry->>'quantity')::numeric<=0 or (entry->>'unitPrice')::numeric<0 or coalesce(entry->>'description','')='' then raise exception 'Invalid line item'; end if;
 total=total+round((entry->>'quantity')::numeric*(entry->>'unitPrice')::numeric,2);
 end loop;
 if total<=0 then raise exception 'Document total must be positive'; end if;
 doc_record=jsonb_set(doc_record,'{amount}',to_jsonb(total));
 end if;
 select coalesce(jsonb_agg(x),'[]') into entries from jsonb_array_elements(coalesce(w.data->key,'[]')) x where x->>'id'<>doc_record->>'id';
 entries=entries||jsonb_build_array(doc_record);
 update workspace_states set data=jsonb_set(w.data,array[key],entries),version=w.version+1,updated_by=auth.uid() where organization_id=w.organization_id;
 return jsonb_build_object('version',w.version+1,'record',doc_record);
end $$;

create function refresh_record_permissions() returns trigger language plpgsql security definer set search_path=public as $$begin
 update workspace_states set version=version+1 where organization_id=(select organization_id from profiles where id=coalesce(new.user_id,old.user_id));return coalesce(new,old);
end$$;
create trigger refresh_scope_permissions after insert or update or delete on record_access for each row execute function refresh_record_permissions();
create trigger refresh_department_permissions after insert or update or delete on staff_work_settings for each row execute function refresh_record_permissions();
$source11$;
RAISE NOTICE 'Applied 011';
ELSE RAISE NOTICE 'Already present: 011'; END IF;
END $step11$;
COMMIT;
SELECT 'CAGE database upgrade to 15.0.0 completed' AS result;
