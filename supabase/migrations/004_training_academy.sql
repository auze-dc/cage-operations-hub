begin;

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

commit;
