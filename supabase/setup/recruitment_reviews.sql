-- Additive recruitment review workflow. Existing applications and submissions remain valid.
set local lock_timeout='5s';
create schema recruitment_private;
revoke all on schema recruitment_private from public, anon;
grant usage on schema recruitment_private to authenticated;
alter table public.job_applications
  add column assigned_reviewer uuid references public.profiles(id) on delete set null,
  add column review_version integer not null default 0;
create index job_applications_reviewer_idx on public.job_applications(assigned_reviewer) where assigned_reviewer is not null;

create table recruitment_private.review_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  application_id uuid references public.job_applications(id) on delete set null,
  application_reference uuid not null,
  kind text not null check(kind in ('note','assessment','stage','assignment')),
  notes text not null default '' check(length(notes)<=5000),
  scores jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles(id) on delete set null, actor_name text not null,
  from_stage text, to_stage text, from_reviewer_name text, to_reviewer_name text,
  created_at timestamptz not null default clock_timestamp()
);
create index review_events_application_idx on recruitment_private.review_events(application_id,id desc);
alter table recruitment_private.review_events enable row level security;
revoke all on recruitment_private.review_events from public, anon, authenticated;
create table recruitment_private.review_receipts (
  request_id uuid primary key, application_id uuid not null references public.job_applications(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade, fingerprint text not null, result_version integer not null,
  created_at timestamptz not null default now()
);
alter table recruitment_private.review_receipts enable row level security;
revoke all on recruitment_private.review_receipts from public, anon, authenticated;

-- Trigger also captures stage/assignment changes made by existing interview workflows.
-- Client-supplied updated_by and version values are never trusted for audit attribution.
create function recruitment_private.audit_application_update() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_label text; old_name text; new_name text;
begin
  new.review_version:=old.review_version+1;
  select p.full_name into actor_label from public.profiles p where p.id=actor and p.organization_id=old.organization_id;
  actor_label:=coalesce(actor_label,'System workflow');
  if new.assigned_reviewer is not null and not exists(select 1 from public.profiles p where p.id=new.assigned_reviewer and p.organization_id=new.organization_id and p.active and p.role in ('admin','manager','hr')) then
    if new.assigned_reviewer is distinct from old.assigned_reviewer then raise exception 'Choose an active recruitment reviewer in this organisation'; end if;
  end if;
  if new.stage is distinct from old.stage then
    insert into recruitment_private.review_events(organization_id,application_id,application_reference,kind,notes,actor_id,actor_name,from_stage,to_stage)
    values(old.organization_id,old.id,old.id,'stage',coalesce(nullif(current_setting('cage.recruitment_reason',true),''),'Reason not recorded by the existing workflow.'),actor,actor_label,old.stage,new.stage);
  end if;
  if new.assigned_reviewer is distinct from old.assigned_reviewer then
    select p.full_name into old_name from public.profiles p where p.id=old.assigned_reviewer and p.organization_id=old.organization_id;
    select p.full_name into new_name from public.profiles p where p.id=new.assigned_reviewer and p.organization_id=new.organization_id;
    insert into recruitment_private.review_events(organization_id,application_id,application_reference,kind,notes,actor_id,actor_name,from_reviewer_name,to_reviewer_name)
    values(old.organization_id,old.id,old.id,'assignment',coalesce(nullif(current_setting('cage.recruitment_reason',true),''),'Reviewer assignment updated.'),actor,actor_label,old_name,new_name);
  end if;
  return new;
end $$;
revoke all on function recruitment_private.audit_application_update() from public, anon, authenticated;
create trigger audit_recruitment_application_update before update on public.job_applications for each row execute function recruitment_private.audit_application_update();

create function recruitment_private.read_review(p_application uuid,p_before bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare applicant public.job_applications%rowtype; result jsonb; staff_org uuid; history jsonb;
begin
  if auth.uid() is null or public.hub_mfa_satisfied() is not true or public.has_hr_access() is not true or coalesce(public.module_level('hr'),'none')='none' then raise exception 'Recruitment access and verified sign-in are required' using errcode='42501'; end if;
  staff_org:=public.current_organization_id();
  select * into applicant from public.job_applications a where a.id=p_application and a.organization_id=staff_org;
  if not found then raise exception 'Application is unavailable' using errcode='42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(e) order by e.id desc),'[]') into history from
    (select id,kind,notes,scores,actor_id,actor_name,from_stage,to_stage,from_reviewer_name,to_reviewer_name,created_at
     from recruitment_private.review_events where application_id=p_application and organization_id=staff_org and (p_before is null or id<p_before) order by id desc limit 50) e;
  result:=jsonb_build_object('application',jsonb_build_object('id',applicant.id,'full_name',applicant.full_name,'stage',applicant.stage,'review_version',applicant.review_version,'assigned_reviewer',applicant.assigned_reviewer,'legacy_score',applicant.score,'legacy_notes',applicant.screening_notes),
   'vacancy',(select title from public.job_openings where id=applicant.job_opening_id and organization_id=staff_org),
   'assigned_reviewer_name',(select full_name from public.profiles where id=applicant.assigned_reviewer and organization_id=staff_org),
   'can_edit',public.module_level('hr')='edit',
   'reviewers',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',full_name) order by full_name),'[]') from public.profiles where organization_id=staff_org and active and role in ('admin','manager','hr')),
   'assessments',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from (select distinct on(actor_id) actor_id,actor_name,scores,notes,created_at from recruitment_private.review_events where application_id=p_application and organization_id=staff_org and kind='assessment' order by actor_id,id desc) e),
   'history',history,'next_before',case when jsonb_array_length(history)=50 then (history->49->>'id')::bigint else null end);
  return result;
end $$;
revoke all on function recruitment_private.read_review(uuid,bigint) from public, anon;
grant execute on function recruitment_private.read_review(uuid,bigint) to authenticated;
create function public.application_review_read(p_application uuid,p_before bigint default null) returns jsonb language sql security invoker set search_path='' as $$select recruitment_private.read_review(p_application,p_before)$$;
revoke all on function public.application_review_read(uuid,bigint) from public, anon;
grant execute on function public.application_review_read(uuid,bigint) to authenticated;

create function recruitment_private.write_review(p_application uuid,p_expected_version integer,p_action text,p_notes text,p_scores jsonb,p_stage text,p_reviewer uuid,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare applicant public.job_applications%rowtype; actor uuid:=auth.uid(); actor_label text; staff_org uuid; fingerprint text; receipt recruitment_private.review_receipts%rowtype; result_version integer;
begin
  if actor is null or public.hub_mfa_satisfied() is not true or public.has_hr_access() is not true or public.module_level('hr') is distinct from 'edit' then raise exception 'Recruitment edit access and verified sign-in are required' using errcode='42501'; end if;
  staff_org:=public.current_organization_id();
  select * into applicant from public.job_applications a where a.id=p_application and a.organization_id=staff_org for update;
  if not found then raise exception 'Application is unavailable' using errcode='42501'; end if;
  if p_request_id is null then raise exception 'A save request reference is required'; end if;
  fingerprint:=md5(jsonb_build_object('action',p_action,'notes',p_notes,'scores',p_scores,'stage',p_stage,'reviewer',p_reviewer)::text);
  select * into receipt from recruitment_private.review_receipts where request_id=p_request_id;
  if found then
    if receipt.application_id<>p_application or receipt.actor_id<>actor or receipt.fingerprint<>fingerprint then raise exception 'Save request reference was already used'; end if;
    return jsonb_build_object('version',receipt.result_version,'replayed',true);
  end if;
  if p_expected_version is null or applicant.review_version<>p_expected_version then raise exception 'This application changed. Reload the review before saving; keep your text to reapply it.' using errcode='40001'; end if;
  if p_action is null or p_action not in ('note','assessment','stage','assignment') then raise exception 'Choose a valid review action'; end if;
  p_notes:=btrim(coalesce(p_notes,''));
  if length(p_notes)>5000 or (p_action in ('note','assessment','stage') and length(p_notes)=0) then raise exception 'Provide a reason or note, up to 5,000 characters'; end if;
  if p_action='assessment' then
    if jsonb_typeof(p_scores) is distinct from 'object' then raise exception 'Complete all four scores from 1 to 5'; end if;
    if (select count(*) from jsonb_object_keys(p_scores))<>4 or not(p_scores ?& array['role_skills','relevant_experience','communication','problem_solving']) or exists(select 1 from jsonb_each(p_scores) e where jsonb_typeof(e.value)<>'number' or e.value::text !~ '^[1-5]$') then raise exception 'Complete all four scores from 1 to 5'; end if;
  end if;
  if p_action='stage' and (p_stage is null or p_stage not in ('New','Screening','Shortlisted','Interview','Reference checks','Offer','Hired','Rejected','Withdrawn') or p_stage=applicant.stage) then raise exception 'Choose a different valid application stage'; end if;
  if p_action='assignment' then
    if p_reviewer is not distinct from applicant.assigned_reviewer then raise exception 'Choose a different reviewer'; end if;
    if p_reviewer is not null and not exists(select 1 from public.profiles p where p.id=p_reviewer and p.organization_id=staff_org and p.active and p.role in ('admin','manager','hr')) then raise exception 'Choose an active recruitment reviewer in this organisation'; end if;
  end if;
  select full_name into actor_label from public.profiles where id=actor and organization_id=staff_org and active;
  perform set_config('cage.recruitment_reason',p_notes,true);
  update public.job_applications set stage=case when p_action='stage' then p_stage else stage end,
    assigned_reviewer=case when p_action='assignment' then p_reviewer else assigned_reviewer end,
    updated_by=actor,updated_at=clock_timestamp() where id=p_application returning review_version into result_version;
  perform set_config('cage.recruitment_reason','',true);
  if p_action in ('note','assessment') then
    insert into recruitment_private.review_events(organization_id,application_id,application_reference,kind,notes,scores,actor_id,actor_name)
    values(staff_org,p_application,p_application,p_action,p_notes,case when p_action='assessment' then p_scores else '{}'::jsonb end,actor,actor_label);
  end if;
  insert into recruitment_private.review_receipts(request_id,application_id,actor_id,fingerprint,result_version) values(p_request_id,p_application,actor,fingerprint,result_version);
  return jsonb_build_object('version',result_version,'replayed',false);
end $$;
revoke all on function recruitment_private.write_review(uuid,integer,text,text,jsonb,text,uuid,uuid) from public, anon;
grant execute on function recruitment_private.write_review(uuid,integer,text,text,jsonb,text,uuid,uuid) to authenticated;
create function public.application_review_write(p_application uuid,p_expected_version integer,p_action text,p_notes text,p_scores jsonb default '{}'::jsonb,p_stage text default null,p_reviewer uuid default null,p_request_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select recruitment_private.write_review(p_application,p_expected_version,p_action,p_notes,p_scores,p_stage,p_reviewer,p_request_id)$$;
revoke all on function public.application_review_write(uuid,integer,text,text,jsonb,text,uuid,uuid) from public, anon;
grant execute on function public.application_review_write(uuid,integer,text,text,jsonb,text,uuid,uuid) to authenticated;

-- Explicit default-deny policies; guarded owner-executed helpers remain the only access path.
create policy internal_helpers_only on recruitment_private.review_events for all to public using (false) with check (false);
create policy internal_helpers_only on recruitment_private.review_receipts for all to public using (false) with check (false);
