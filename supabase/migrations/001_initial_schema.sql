begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.allowed_accounts (
  email citext primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  initials text not null,
  role text not null check (role in ('admin', 'member', 'shared')),
  assignable boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email citext not null unique,
  full_name text not null,
  initials text not null,
  role text not null check (role in ('admin', 'member', 'shared')),
  assignable boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_states (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  record_type text not null,
  record_id text not null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sender_id uuid references public.profiles(id),
  document_type text not null check (document_type in ('quote', 'invoice', 'notification', 'opportunity')),
  document_id text,
  recipient citext not null,
  subject text not null,
  provider_message_id text,
  status text not null check (status in ('sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.opportunity_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  source_url text not null,
  source_type text not null default 'rss' check (source_type in ('rss', 'json', 'manual')),
  enabled boolean not null default true,
  last_scanned_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, source_url)
);

create table if not exists public.opportunity_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  external_key text not null,
  title text not null,
  organization text,
  opportunity_type text not null check (opportunity_type in ('Grant', 'Tender / RFQ')),
  source_name text,
  source_url text,
  deadline date,
  match_score integer not null check (match_score between 0 and 100),
  match_reason text not null,
  status text not null default 'New' check (status in ('New', 'Reviewed', 'Intake created', 'Dismissed')),
  raw_data jsonb not null default '{}'::jsonb,
  found_at timestamptz not null default now(),
  unique (organization_id, external_key)
);

create index if not exists audit_log_org_created_idx on public.audit_log (organization_id, created_at desc);
create index if not exists attachments_record_idx on public.attachments (organization_id, record_type, record_id);
create index if not exists opportunity_matches_org_found_idx on public.opportunity_matches (organization_id, found_at desc);

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select organization_id from public.profiles where id = auth.uid() and active = true $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select coalesce((select role = 'admin' from public.profiles where id = auth.uid() and active = true), false) $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare account public.allowed_accounts%rowtype;
begin
  select * into account from public.allowed_accounts where email = new.email::citext and active = true;
  if account.email is null then
    return new;
  end if;
  insert into public.profiles (id, organization_id, email, full_name, initials, role, assignable, active)
  values (new.id, account.organization_id, account.email, account.full_name, account.initials, account.role, account.assignable, true)
  on conflict (id) do update set
    organization_id = excluded.organization_id,
    email = excluded.email,
    full_name = excluded.full_name,
    initials = excluded.initials,
    role = excluded.role,
    assignable = excluded.assignable,
    active = true,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.touch_workspace_state()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  if new.version <= old.version then raise exception 'Workspace version must increase'; end if;
  return new;
end;
$$;

drop trigger if exists workspace_state_touch on public.workspace_states;
create trigger workspace_state_touch before update on public.workspace_states
for each row execute procedure public.touch_workspace_state();

create or replace function public.audit_workspace_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (organization_id, actor_id, action, entity_type, entity_id, old_data, new_data)
  values (new.organization_id, new.updated_by, 'update', 'workspace_state', new.organization_id::text,
    jsonb_build_object('version', old.version), jsonb_build_object('version', new.version));
  return new;
end;
$$;

drop trigger if exists workspace_state_audit on public.workspace_states;
create trigger workspace_state_audit after update on public.workspace_states
for each row execute procedure public.audit_workspace_state();

alter table public.organizations enable row level security;
alter table public.allowed_accounts enable row level security;
alter table public.profiles enable row level security;
alter table public.workspace_states enable row level security;
alter table public.audit_log enable row level security;
alter table public.attachments enable row level security;
alter table public.email_log enable row level security;
alter table public.opportunity_sources enable row level security;
alter table public.opportunity_matches enable row level security;

create policy "members read organization" on public.organizations for select
using (id = public.current_organization_id());
create policy "members read profiles" on public.profiles for select
using (organization_id = public.current_organization_id());
create policy "admins manage profiles" on public.profiles for all
using (organization_id = public.current_organization_id() and public.is_admin())
with check (organization_id = public.current_organization_id() and public.is_admin());
create policy "admins read allowed accounts" on public.allowed_accounts for select
using (organization_id = public.current_organization_id() and public.is_admin());
create policy "admins manage allowed accounts" on public.allowed_accounts for all
using (organization_id = public.current_organization_id() and public.is_admin())
with check (organization_id = public.current_organization_id() and public.is_admin());
create policy "members read workspace" on public.workspace_states for select
using (organization_id = public.current_organization_id());
create policy "members initialize workspace" on public.workspace_states for insert
with check (organization_id = public.current_organization_id() and public.is_admin());
create policy "members update workspace" on public.workspace_states for update
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id() and updated_by = auth.uid());
create policy "admins read audit" on public.audit_log for select
using (organization_id = public.current_organization_id() and public.is_admin());
create policy "members read attachments" on public.attachments for select
using (organization_id = public.current_organization_id());
create policy "members add attachments" on public.attachments for insert
with check (organization_id = public.current_organization_id() and uploaded_by = auth.uid());
create policy "uploader or admin removes attachments" on public.attachments for delete
using (organization_id = public.current_organization_id() and (uploaded_by = auth.uid() or public.is_admin()));
create policy "members read email log" on public.email_log for select
using (organization_id = public.current_organization_id());
create policy "admins manage sources" on public.opportunity_sources for all
using (organization_id = public.current_organization_id() and public.is_admin())
with check (organization_id = public.current_organization_id() and public.is_admin());
create policy "members read matches" on public.opportunity_matches for select
using (organization_id = public.current_organization_id());
create policy "members update matches" on public.opportunity_matches for update
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

insert into storage.buckets (id, name, public, file_size_limit)
values ('cage-files', 'cage-files', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

create policy "members read organization files" on storage.objects for select to authenticated
using (bucket_id = 'cage-files' and (storage.foldername(name))[1] = public.current_organization_id()::text);
create policy "members upload organization files" on storage.objects for insert to authenticated
with check (bucket_id = 'cage-files' and (storage.foldername(name))[1] = public.current_organization_id()::text);
create policy "uploader or admin changes files" on storage.objects for update to authenticated
using (bucket_id = 'cage-files' and (storage.foldername(name))[1] = public.current_organization_id()::text and (owner_id = auth.uid()::text or public.is_admin()));
create policy "uploader or admin deletes files" on storage.objects for delete to authenticated
using (bucket_id = 'cage-files' and (storage.foldername(name))[1] = public.current_organization_id()::text and (owner_id = auth.uid()::text or public.is_admin()));

insert into public.organizations (id, name, slug)
values ('00000000-0000-4000-8000-000000000001', 'CAGE', 'cage')
on conflict (id) do update set name = excluded.name, slug = excluded.slug;

insert into public.allowed_accounts (email, organization_id, full_name, initials, role, assignable) values
  ('alexander@cagemw.com', '00000000-0000-4000-8000-000000000001', 'Alexander DC Mtambo', 'AM', 'admin', true),
  ('ndapile@cagemw.com', '00000000-0000-4000-8000-000000000001', 'Ndapile Mkuwu', 'NM', 'admin', true),
  ('comfort@cagemw.com', '00000000-0000-4000-8000-000000000001', 'Comfort Claire Mwenje', 'CM', 'member', true),
  ('ian@cagemw.com', '00000000-0000-4000-8000-000000000001', 'Ian Mtika', 'IM', 'member', true),
  ('mayamiko@cagemw.com', '00000000-0000-4000-8000-000000000001', 'Mayamiko C. Ndala', 'MN', 'member', true),
  ('bonfancio@cagemw.com', '00000000-0000-4000-8000-000000000001', 'Bonifancio Nguluwe', 'BN', 'member', true),
  ('info@cagemw.com', '00000000-0000-4000-8000-000000000001', 'CAGE Team', 'CT', 'shared', false)
on conflict (email) do update set
  organization_id = excluded.organization_id,
  full_name = excluded.full_name,
  initials = excluded.initials,
  role = excluded.role,
  assignable = excluded.assignable,
  active = true;

do $$
begin
  alter publication supabase_realtime add table public.workspace_states;
exception when duplicate_object then null;
end $$;

commit;
