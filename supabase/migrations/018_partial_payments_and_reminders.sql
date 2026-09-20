-- 018: partial-payment enrollment and transactional reminder queue.
-- Apply after the installed 017 migration. Does not reset records or resend welcome emails.
begin;
alter table public.academy_applications add column if not exists balance_due_on date;
alter table public.academy_applications add column if not exists balance_plan_version integer not null default 1;
grant select(balance_due_on,balance_plan_version) on public.academy_applications to authenticated;

create or replace function public.academy_payment_summary(app uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a academy_applications%rowtype;paid numeric;fee numeric;
begin
 select * into a from academy_applications where id=app;
 if not found or not (coalesce(auth.role()='service_role',false) or (a.organization_id=current_organization_id() and can_manage_stem())) then raise exception 'Application access denied';end if;
 select coalesce(sum(amount),0) into paid from academy_application_files where application_id=app and kind='payment' and review_status='Verified';
 fee=coalesce((a.form_snapshot->>'fee')::numeric,0);
 return jsonb_build_object('fee',fee,'verified_paid',paid,'balance',greatest(fee-paid,0),'currency',a.form_snapshot->>'currency','due_on',a.balance_due_on,'version',a.balance_plan_version);
end $$;
revoke all on function academy_payment_summary(uuid) from public;
grant execute on function academy_payment_summary(uuid) to authenticated,service_role;

-- Public applicants may propose a date before enrollment, using their private access token.
create or replace function public.set_academy_balance_date(app uuid,token_hash text,due_on date) returns void
language plpgsql security definer set search_path=public as $$
declare a academy_applications%rowtype;
begin
 select * into a from academy_applications where id=app and access_hash=token_hash for update;
 if not found then raise exception 'Application access denied';end if;
 if a.status='Enrolled' then raise exception 'Contact CAGE to change an agreed payment date after enrollment';end if;
 if due_on is null or due_on<(now() at time zone 'Africa/Blantyre')::date then raise exception 'Choose today or a future payment date';end if;
 update academy_applications set balance_due_on=due_on,balance_plan_version=balance_plan_version+case when balance_due_on is distinct from due_on then 1 else 0 end where id=app;
end $$;
revoke all on function set_academy_balance_date(uuid,text,date) from public;
grant execute on function set_academy_balance_date(uuid,text,date) to service_role;

create or replace function enrol_academy_application(app uuid,cohort_key uuid,details jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare a academy_applications%rowtype;ch training_cohorts%rowtype;cat text;learner_key uuid;paid numeric;fee numeric;due date;begin
 if not can_manage_stem() or not can_cohort(cohort_key) then raise exception 'Manager and cohort access required';end if;
 select * into a from academy_applications where id=app and organization_id=current_organization_id() for update;
 if not found then raise exception 'Application unavailable';end if;if a.learner_id is not null then return a.learner_id;end if;
 if a.status<>'Accepted' then raise exception 'Accept the application before enrolling';end if;
 fee=coalesce((a.form_snapshot->>'fee')::numeric,0);
 select coalesce(sum(amount),0) into paid from academy_application_files where application_id=app and kind='payment' and review_status='Verified';
 if fee>0 and paid<=0 then raise exception 'Verify a payment before enrolling in a paid course';end if;
 if paid<fee then
   due=coalesce(nullif(details->>'balance_due_on','')::date,a.balance_due_on);
   if due is null or due<(now() at time zone 'Africa/Blantyre')::date then raise exception 'Enter the agreed balance payment date (today or later)';end if;
 end if;

 select * into ch from training_cohorts where id=cohort_key and organization_id=a.organization_id for update;
 if not found or ch.status in ('Completed','Cancelled') then raise exception 'Choose an active cohort';end if;
 select category into cat from training_courses where id=ch.course_id;
 if cat<>a.category and not (a.category='Industry Specific' and cat in ('Technical','Corporate','Other')) then raise exception 'Choose a cohort for the same programme';end if;
 if coalesce(trim(details->>'full_name'),'')='' or coalesce(trim(details->>'phone'),'')='' then raise exception 'Learner name and contact phone are required';end if;
 if a.category='STEM' and (coalesce(trim(details->>'guardian_name'),'')='' or coalesce(trim(details->>'guardian_phone'),'')='' or not coalesce((details->>'guardian_consent')::boolean,false)) then raise exception 'Confirm guardian contact and consent';end if;
 insert into learners(organization_id,cohort_id,full_name,email,phone,date_of_birth,guardian_name,guardian_phone,guardian_consent,stage,documents_complete,created_by,notes)
 values(a.organization_id,ch.id,details->>'full_name',nullif(details->>'email',''),details->>'phone',nullif(details->>'date_of_birth','')::date,details->>'guardian_name',details->>'guardian_phone',coalesce((details->>'guardian_consent')::boolean,false),'Documents pending',false,auth.uid(),'Application reference: '||a.id::text) returning id into learner_key;
 update academy_applications set balance_due_on=due,balance_plan_version=balance_plan_version+case when balance_due_on is distinct from due then 1 else 0 end,status='Enrolled',learner_id=learner_key,cohort_id=ch.id,reviewed_by=auth.uid(),updated_at=now() where id=a.id;return learner_key;end $$;

create table if not exists public.academy_payment_reminders(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),
 application_id uuid not null references academy_applications(id),plan_version integer not null,
 kind text not null check(kind in ('3-days','1-day','due-today','manual')),
 due_on date not null,request_key uuid unique,
 note text not null default '',created_by uuid references profiles(id),
 status text not null default 'pending' check(status in ('pending','processing','sent','failed','cancelled')),
 attempts integer not null default 0,created_at timestamptz not null default now(),available_at timestamptz not null default now(),
 first_attempt_at timestamptz,sent_at timestamptz,provider_id text,error text,payload jsonb,
 recipient text,learner_name text,course_name text,currency text,balance_amount numeric
);
create unique index if not exists academy_auto_reminder_once on academy_payment_reminders(application_id,plan_version,kind) where kind<>'manual';
create index if not exists academy_reminder_ready on academy_payment_reminders(status,available_at);
alter table academy_payment_reminders enable row level security;
create policy academy_reminders_review on academy_payment_reminders for select to authenticated using(organization_id=current_organization_id() and can_manage_stem());
grant select on academy_payment_reminders to authenticated;
grant all on academy_payment_reminders to service_role;

create or replace function public.queue_academy_payment_reminder(app uuid,due_on date,note text,request_key uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare a academy_applications%rowtype;s jsonb;result uuid;v integer;
begin
 if not can_manage_stem() then raise exception 'Training manager access required';end if;
 select * into a from academy_applications where id=app and organization_id=current_organization_id() for update;
 if not found or a.status<>'Enrolled' then raise exception 'Choose an enrolled application';end if;
 if request_key is null then raise exception 'Reminder reference required';end if;
 select id into result from academy_payment_reminders m where m.request_key=queue_academy_payment_reminder.request_key and m.application_id=app;
 if result is not null then return result;end if;
 s=academy_payment_summary(app);
 if (s->>'balance')::numeric<=0 then raise exception 'There is no outstanding balance';end if;
 if due_on is null or due_on<(now() at time zone 'Africa/Blantyre')::date then raise exception 'Choose today or a future balance payment date';end if;
 if length(coalesce(note,''))>2000 then raise exception 'Reminder message is too long';end if;
 update academy_applications set balance_due_on=due_on,balance_plan_version=balance_plan_version+case when balance_due_on is distinct from due_on then 1 else 0 end where id=app returning balance_plan_version into v;
 insert into academy_payment_reminders(organization_id,application_id,plan_version,kind,due_on,request_key,note,created_by)
 values(a.organization_id,app,v,'manual',due_on,request_key,coalesce(note,''),auth.uid()) returning id into result;
 return result;
end $$;
revoke all on function queue_academy_payment_reminder(uuid,date,text,uuid) from public;
grant execute on function queue_academy_payment_reminder(uuid,date,text,uuid) to authenticated;

create or replace function public.claim_academy_payment_reminders() returns setof academy_payment_reminders
language plpgsql security definer set search_path=public as $$
declare today date=(now() at time zone 'Africa/Blantyre')::date;
begin
 -- Only enrolled applicants with a remaining verified-proof balance receive reminders.
 insert into academy_payment_reminders(organization_id,application_id,plan_version,kind,due_on)
 select a.organization_id,a.id,a.balance_plan_version,
 case a.balance_due_on-today when 3 then '3-days' when 1 then '1-day' else 'due-today' end,a.balance_due_on
 from academy_applications a
 where a.status='Enrolled' and a.balance_due_on-today in (3,1,0)
 and coalesce((a.form_snapshot->>'fee')::numeric,0)>(select coalesce(sum(f.amount),0) from academy_application_files f where f.application_id=a.id and f.kind='payment' and f.review_status='Verified')
 and not exists(select 1 from academy_payment_reminders m where m.application_id=a.id and m.kind='manual' and m.plan_version=a.balance_plan_version and (m.created_at at time zone 'Africa/Blantyre')::date=today)
 on conflict do nothing;
 update academy_payment_reminders m set status='cancelled',error='Balance settled, application closed, payment date changed, or reminder date passed.'
 from academy_applications a where a.id=m.application_id and m.status in ('pending','processing') and (
 a.status<>'Enrolled' or a.balance_plan_version<>m.plan_version or a.balance_due_on is distinct from m.due_on
 or (m.kind<>'manual' and today>m.due_on-case m.kind when '3-days' then 3 when '1-day' then 1 else 0 end)
 or coalesce((a.form_snapshot->>'fee')::numeric,0)<=(select coalesce(sum(f.amount),0) from academy_application_files f where f.application_id=a.id and f.kind='payment' and f.review_status='Verified'));
 update academy_payment_reminders set status='failed',error='Retry limit reached or delivery uncertain. Check provider logs before another reminder.' where status in ('pending','processing') and (attempts>=8 or first_attempt_at<now()-interval '23 hours');
 return query update academy_payment_reminders m set status='processing',attempts=m.attempts+1,first_attempt_at=coalesce(m.first_attempt_at,now()),available_at=now()+interval '5 minutes'
 where m.id in(select id from academy_payment_reminders where status in ('pending','processing') and available_at<=now() order by created_at for update skip locked limit 5) returning m.*;
end $$;
revoke all on function claim_academy_payment_reminders() from public;
grant execute on function claim_academy_payment_reminders() to service_role;

-- Recheck eligibility immediately before the worker sends; never reuse a stale balance payload.
create or replace function public.prepare_academy_payment_reminder(reminder uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare m academy_payment_reminders%rowtype;a academy_applications%rowtype;s jsonb;l learners%rowtype;c training_cohorts%rowtype;address text;
begin
 select * into m from academy_payment_reminders where id=reminder for update;
 if not found or m.status<>'processing' then return null;end if;
 select * into a from academy_applications where id=m.application_id;
 s=academy_payment_summary(a.id);
 if a.status<>'Enrolled' or a.balance_plan_version<>m.plan_version or a.balance_due_on is distinct from m.due_on or (s->>'balance')::numeric<=0 or (m.payload is not null and m.balance_amount is distinct from (s->>'balance')::numeric) then
 update academy_payment_reminders set status='cancelled',error='Balance or payment plan changed before delivery.' where id=m.id;return null;end if;
 select * into l from learners where id=a.learner_id;select * into c from training_cohorts where id=a.cohort_id;
 address=coalesce(nullif(l.email::text,''),a.email::text);
 if address is null or address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then update academy_payment_reminders set status='failed',error='No valid learner email.' where id=m.id;return null;end if;
 update academy_payment_reminders set recipient=address,learner_name=l.full_name,course_name=c.name,currency=s->>'currency',balance_amount=(s->>'balance')::numeric where id=m.id returning * into m;
 return to_jsonb(m);
end $$;
revoke all on function prepare_academy_payment_reminder(uuid) from public;
grant execute on function prepare_academy_payment_reminder(uuid) to service_role;
notify pgrst,'reload schema';
commit;
