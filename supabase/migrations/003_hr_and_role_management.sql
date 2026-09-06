begin;

alter table public.allowed_accounts drop constraint if exists allowed_accounts_role_check;
alter table public.allowed_accounts add constraint allowed_accounts_role_check
  check (role in ('admin', 'manager', 'hr', 'finance', 'member', 'viewer', 'shared'));
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'manager', 'hr', 'finance', 'member', 'viewer', 'shared'));

drop policy if exists "members update workspace" on public.workspace_states;
create policy "non-viewers update workspace" on public.workspace_states for update
using (
  organization_id = public.current_organization_id()
  and exists (select 1 from public.profiles where id = auth.uid() and active and role <> 'viewer')
)
with check (
  organization_id = public.current_organization_id()
  and updated_by = auth.uid()
  and exists (select 1 from public.profiles where id = auth.uid() and active and role <> 'viewer')
);

create or replace function public.has_hr_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role in ('admin', 'manager', 'hr') from public.profiles where id = auth.uid() and active), false)
$$;

create table if not exists public.employee_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_number text,
  job_title text,
  department text,
  employment_type text check (employment_type is null or employment_type in ('Permanent', 'Fixed-term', 'Part-time', 'Intern', 'Consultant')),
  start_date date,
  phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  skills text[] not null default '{}',
  certifications text[] not null default '{}',
  profile_status text not null default 'Active' check (profile_status in ('Active', 'On leave', 'Inactive')),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null check (document_type in ('CV', 'Contract', 'Certificate', 'Licence', 'Medical', 'ID', 'Performance review', 'Other')),
  file_name text not null,
  storage_path text not null unique,
  expiry_date date,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.job_openings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  department text not null,
  location text not null default 'Malawi',
  employment_type text not null check (employment_type in ('Permanent', 'Fixed-term', 'Part-time', 'Intern', 'Consultant')),
  description text not null,
  requirements text not null,
  closing_date date not null,
  status text not null default 'Draft' check (status in ('Draft', 'Open', 'Paused', 'Closed')),
  hiring_manager uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_opening_id uuid not null references public.job_openings(id) on delete cascade,
  full_name text not null,
  email citext not null,
  phone text not null,
  location text,
  cover_note text,
  cv_file_name text not null,
  cv_storage_path text not null,
  stage text not null default 'New' check (stage in ('New', 'Screening', 'Shortlisted', 'Interview', 'Reference checks', 'Offer', 'Hired', 'Rejected', 'Withdrawn')),
  score integer check (score is null or score between 0 and 100),
  screening_notes text,
  source text not null default 'CAGE Careers',
  consent_at timestamptz not null,
  applied_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (job_opening_id, email)
);

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  application_id uuid not null references public.job_applications(id) on delete cascade,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  format text not null check (format in ('In person', 'Video', 'Telephone')),
  location_or_link text not null,
  panel_user_ids uuid[] not null default '{}',
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Completed', 'Cancelled', 'No show')),
  notes text,
  recommendation text check (recommendation is null or recommendation in ('Strong yes', 'Yes', 'Hold', 'No')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end > scheduled_start)
);

create table if not exists public.application_rate_limits (
  ip_hash text primary key,
  window_start timestamptz not null,
  attempts integer not null default 1
);

alter table public.application_rate_limits enable row level security;

create or replace function public.check_application_rate_limit(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare allowed boolean;
begin
  insert into public.application_rate_limits (ip_hash, window_start, attempts)
  values (p_ip_hash, now(), 1)
  on conflict (ip_hash) do update set
    attempts = case
      when public.application_rate_limits.window_start < now() - interval '1 hour' then 1
      else public.application_rate_limits.attempts + 1
    end,
    window_start = case
      when public.application_rate_limits.window_start < now() - interval '1 hour' then now()
      else public.application_rate_limits.window_start
    end
  returning attempts <= 10 into allowed;
  return allowed;
end;
$$;

revoke all on function public.check_application_rate_limit(text) from public, anon, authenticated;
grant execute on function public.check_application_rate_limit(text) to service_role;

create index if not exists employee_documents_user_idx on public.employee_documents (organization_id, user_id, created_at desc);
create index if not exists job_openings_status_idx on public.job_openings (organization_id, status, closing_date);
create index if not exists job_applications_stage_idx on public.job_applications (organization_id, stage, applied_at desc);
create index if not exists interviews_schedule_idx on public.interviews (organization_id, scheduled_start);

create or replace function public.create_employee_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role <> 'shared' then
    insert into public.employee_profiles (user_id, organization_id, updated_by)
    values (new.id, new.organization_id, new.id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists profile_create_employee_record on public.profiles;
create trigger profile_create_employee_record after insert on public.profiles
for each row execute procedure public.create_employee_profile();

alter table public.employee_profiles enable row level security;
alter table public.employee_documents enable row level security;
alter table public.job_openings enable row level security;
alter table public.job_applications enable row level security;
alter table public.interviews enable row level security;

create policy "employee or hr reads profile" on public.employee_profiles for select
using (organization_id = public.current_organization_id() and (user_id = auth.uid() or public.has_hr_access()));
create policy "employee updates own profile" on public.employee_profiles for update
using (organization_id = public.current_organization_id() and user_id = auth.uid())
with check (organization_id = public.current_organization_id() and user_id = auth.uid());
create policy "hr manages employee profiles" on public.employee_profiles for all
using (organization_id = public.current_organization_id() and public.has_hr_access())
with check (organization_id = public.current_organization_id() and public.has_hr_access());

create policy "employee or hr reads documents" on public.employee_documents for select
using (organization_id = public.current_organization_id() and (user_id = auth.uid() or public.has_hr_access()));
create policy "employee uploads own documents" on public.employee_documents for insert
with check (organization_id = public.current_organization_id() and user_id = auth.uid() and uploaded_by = auth.uid());
create policy "hr manages employee documents" on public.employee_documents for all
using (organization_id = public.current_organization_id() and public.has_hr_access())
with check (organization_id = public.current_organization_id() and public.has_hr_access());

create policy "members read open jobs" on public.job_openings for select
using (organization_id = public.current_organization_id());
create policy "hr manages jobs" on public.job_openings for all
using (organization_id = public.current_organization_id() and public.has_hr_access())
with check (organization_id = public.current_organization_id() and public.has_hr_access());
create policy "hr manages applications" on public.job_applications for all
using (organization_id = public.current_organization_id() and public.has_hr_access())
with check (organization_id = public.current_organization_id() and public.has_hr_access());
create policy "hr manages interviews" on public.interviews for all
using (organization_id = public.current_organization_id() and public.has_hr_access())
with check (organization_id = public.current_organization_id() and public.has_hr_access());

-- Replace the original organization-wide storage rules so confidential HR
-- folders are not made readable or writable by every authenticated member.
drop policy if exists "members read organization files" on storage.objects;
drop policy if exists "members upload organization files" on storage.objects;

create policy "members read non hr files" on storage.objects for select to authenticated
using (
  bucket_id = 'cage-files'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
  and coalesce((storage.foldername(name))[2], '') not in ('employees', 'recruitment')
);

create policy "members upload non hr files" on storage.objects for insert to authenticated
with check (
  bucket_id = 'cage-files'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
  and coalesce((storage.foldername(name))[2], '') not in ('employees', 'recruitment')
);

create policy "employee or hr reads hr files" on storage.objects for select to authenticated
using (
  bucket_id = 'cage-files'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
  and (
    public.has_hr_access()
    or ((storage.foldername(name))[2] = 'employees' and (storage.foldername(name))[3] = auth.uid()::text)
  )
);

create policy "employee uploads own hr files" on storage.objects for insert to authenticated
with check (
  bucket_id = 'cage-files'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
  and (storage.foldername(name))[2] = 'employees'
  and (storage.foldername(name))[3] = auth.uid()::text
);

insert into public.employee_profiles (user_id, organization_id, job_title, updated_by)
select id, organization_id,
  case email::text
    when 'alexander@cagemw.com' then 'Head of Operations / Chief Pilot'
    when 'ndapile@cagemw.com' then 'Managing Director / Accountable Manager'
    when 'comfort@cagemw.com' then 'Operations, Client Relations & STEM'
    when 'ian@cagemw.com' then 'Flight Operations & Technical'
    when 'mayamiko@cagemw.com' then 'Sales & Technical Support'
    when 'bonfancio@cagemw.com' then 'GIS & Digital Strategy Intern'
    else 'Shared company account'
  end,
  id
from public.profiles
on conflict (user_id) do nothing;

commit;
