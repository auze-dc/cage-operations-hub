-- Private, append-only interview notes and scorecards. Existing CV reviews are untouched.
set local lock_timeout='5s';
alter table public.interviews
 add column invitation_sent_at timestamptz,
 add column invitation_recipient text,
 add column invitation_location text;
-- Snapshot fields are written only by the invitation service, never by the browser.
create function recruitment_private.guard_invitation_snapshot() returns trigger
language plpgsql set search_path='' as $$
begin
 if current_user in ('anon','authenticated') and
   ((tg_op='INSERT' and (new.invitation_sent_at is not null or new.invitation_recipient is not null or new.invitation_location is not null)) or
    (tg_op='UPDATE' and (new.invitation_sent_at is distinct from old.invitation_sent_at or new.invitation_recipient is distinct from old.invitation_recipient or new.invitation_location is distinct from old.invitation_location)))
 then raise exception 'Invitation records are managed by the invitation service' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function recruitment_private.guard_invitation_snapshot() from public,anon,authenticated;
create trigger interview_invitation_snapshot_guard before insert or update on public.interviews for each row execute function recruitment_private.guard_invitation_snapshot();

create table recruitment_private.interview_entries (
 id bigint generated always as identity primary key,
 request_id uuid not null unique,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 interview_id uuid not null references public.interviews(id) on delete cascade,
 panelist_id uuid references public.profiles(id) on delete set null,
 panelist_name text not null,
 scores jsonb not null default '{}',
 notes text not null check(length(notes)<=5000),
 recommendation text check(recommendation is null or recommendation in ('Strong yes','Yes','Hold','No')),
 recorded_by uuid references public.profiles(id) on delete set null,
 recorder_name text not null,
 created_at timestamptz not null default clock_timestamp()
);
create index interview_entries_history_idx on recruitment_private.interview_entries(interview_id,id desc);
create index interview_entries_panelist_idx on recruitment_private.interview_entries(panelist_id) where panelist_id is not null;
create index interview_entries_recorder_idx on recruitment_private.interview_entries(recorded_by) where recorded_by is not null;
create index interview_entries_org_idx on recruitment_private.interview_entries(organization_id);
alter table recruitment_private.interview_entries enable row level security;
revoke all on recruitment_private.interview_entries from public,anon,authenticated;

create function recruitment_private.read_interview(p_interview uuid,p_before bigint default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare meeting public.interviews%rowtype; org uuid; history jsonb;
begin
 if auth.uid() is null or public.hub_mfa_satisfied() is not true or public.has_hr_access() is not true or coalesce(public.module_level('hr'),'none')='none' then
  raise exception 'Recruitment access and verified sign-in are required' using errcode='42501'; end if;
 org:=public.current_organization_id();
 select * into meeting from public.interviews where id=p_interview and organization_id=org;
 if not found then raise exception 'Interview is unavailable' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.id desc),'[]') into history from
  (select id,panelist_id,panelist_name,scores,notes,recommendation,recorded_by,recorder_name,created_at from recruitment_private.interview_entries
   where interview_id=p_interview and organization_id=org and (p_before is null or id<p_before) order by id desc limit 50)e;
 return jsonb_build_object('interview',to_jsonb(meeting),
  'candidate',(select full_name from public.job_applications where id=meeting.application_id and organization_id=org),
  'can_edit',public.module_level('hr')='edit' and meeting.status<>'Cancelled',
  'panelists',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',full_name) order by full_name,id),'[]') from public.profiles where organization_id=org and active and role<>'shared'),
  'latest_scores',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from
   (select distinct on(panelist_id) panelist_id,panelist_name,scores,notes,recommendation,recorded_by,recorder_name,created_at
    from recruitment_private.interview_entries where interview_id=p_interview and organization_id=org and scores<>'{}'::jsonb order by panelist_id,id desc)e),
  'history',history,'next_before',case when jsonb_array_length(history)=50 then (history->49->>'id')::bigint else null end);
end $$;
revoke all on function recruitment_private.read_interview(uuid,bigint) from public,anon;
grant execute on function recruitment_private.read_interview(uuid,bigint) to authenticated;
create function public.interview_panel_read(p_interview uuid,p_before bigint default null) returns jsonb
language sql security invoker set search_path='' as $$select recruitment_private.read_interview(p_interview,p_before)$$;
revoke all on function public.interview_panel_read(uuid,bigint) from public,anon;
grant execute on function public.interview_panel_read(uuid,bigint) to authenticated;

create function recruitment_private.write_interview(p_interview uuid,p_panelist uuid,p_scores jsonb,p_notes text,p_recommendation text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare org uuid; meeting public.interviews%rowtype; panel_name text; actor_name text; previous recruitment_private.interview_entries%rowtype; saved_id bigint;
begin
 if auth.uid() is null or public.hub_mfa_satisfied() is not true or public.has_hr_access() is not true or public.module_level('hr') is distinct from 'edit' then
  raise exception 'Recruitment edit access and verified sign-in are required' using errcode='42501'; end if;
 org:=public.current_organization_id();
 select * into meeting from public.interviews where id=p_interview and organization_id=org for update;
 if not found then raise exception 'Interview is unavailable' using errcode='42501'; end if;
 p_notes:=btrim(coalesce(p_notes,''));p_recommendation:=nullif(btrim(p_recommendation),'');
 if p_request_id is null then raise exception 'A save request reference is required'; end if;
 select * into previous from recruitment_private.interview_entries where request_id=p_request_id;
 if found then
  if previous.interview_id<>p_interview or previous.recorded_by is distinct from auth.uid() or previous.panelist_id is distinct from p_panelist or previous.scores is distinct from p_scores or previous.notes<>p_notes or previous.recommendation is distinct from p_recommendation then raise exception 'Save request reference was already used'; end if;
  return jsonb_build_object('id',previous.id,'replayed',true);
 end if;
 if meeting.status='Cancelled' then raise exception 'Cancelled interviews cannot receive new records'; end if;
 select full_name into panel_name from public.profiles where id=p_panelist and organization_id=org and active and role<>'shared';
 if not found then raise exception 'Select an active panelist in this organisation'; end if;
 if jsonb_typeof(p_scores) is distinct from 'object' then raise exception 'Complete all four scores from 1 to 5, or choose Note only'; end if;
 if p_scores<>'{}'::jsonb and ((select count(*) from jsonb_object_keys(p_scores))<>4 or not(p_scores ?& array['role_skills','relevant_experience','communication','problem_solving']) or exists(select 1 from jsonb_each(p_scores)e where jsonb_typeof(e.value)<>'number' or e.value::text !~ '^[1-5]$')) then raise exception 'Complete all four scores from 1 to 5'; end if;
 if length(p_notes)>5000 or length(p_notes)=0 then raise exception 'Record interview evidence or notes, up to 5,000 characters'; end if;
 if p_recommendation is not null and p_recommendation not in ('Strong yes','Yes','Hold','No') then raise exception 'Choose a valid recommendation'; end if;
 select full_name into actor_name from public.profiles where id=auth.uid() and organization_id=org and active;
 if not found then raise exception 'An active staff account is required' using errcode='42501'; end if;
 insert into recruitment_private.interview_entries(request_id,organization_id,interview_id,panelist_id,panelist_name,scores,notes,recommendation,recorded_by,recorder_name)
 values(p_request_id,org,p_interview,p_panelist,panel_name,p_scores,p_notes,p_recommendation,auth.uid(),actor_name) returning id into saved_id;
 return jsonb_build_object('id',saved_id,'replayed',false);
end $$;
revoke all on function recruitment_private.write_interview(uuid,uuid,jsonb,text,text,uuid) from public,anon;
grant execute on function recruitment_private.write_interview(uuid,uuid,jsonb,text,text,uuid) to authenticated;
create function public.interview_panel_write(p_interview uuid,p_panelist uuid,p_scores jsonb,p_notes text,p_recommendation text,p_request_id uuid) returns jsonb
language sql security invoker set search_path='' as $$select recruitment_private.write_interview(p_interview,p_panelist,p_scores,p_notes,p_recommendation,p_request_id)$$;
revoke all on function public.interview_panel_write(uuid,uuid,jsonb,text,text,uuid) from public,anon;
grant execute on function public.interview_panel_write(uuid,uuid,jsonb,text,text,uuid) to authenticated;
