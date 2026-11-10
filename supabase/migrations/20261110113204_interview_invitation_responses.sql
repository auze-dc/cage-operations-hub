set local lock_timeout='5s';
create table recruitment_private.interview_invitations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 interview_id uuid not null references public.interviews(id) on delete cascade,
 response_hash text not null unique check(response_hash ~ '^[a-f0-9]{64}$'),
 tracking_hash text not null unique check(tracking_hash ~ '^[a-f0-9]{64}$'),
 recipient text not null, candidate_name text not null, vacancy_title text not null,
 scheduled_start timestamptz not null, scheduled_end timestamptz not null, format text not null, location_or_link text not null,
 expires_at timestamptz not null, delivery text not null default 'pending' check(delivery in ('pending','sent','failed')),
 provider_id text, sent_at timestamptz, opened_at timestamptz, viewed_at timestamptz,
 response text not null default 'pending' check(response in ('pending','accepted','declined')),
 reason text not null default '' check(length(reason)<=2000), responded_at timestamptz,
 created_at timestamptz not null default clock_timestamp()
);
create index interview_invitations_interview_idx on recruitment_private.interview_invitations(interview_id,created_at desc);
create index interview_invitations_org_idx on recruitment_private.interview_invitations(organization_id);
alter table recruitment_private.interview_invitations enable row level security;
revoke all on recruitment_private.interview_invitations from public,anon,authenticated;
alter table public.interviews
 add column invitation_id uuid references recruitment_private.interview_invitations(id) on delete set null,
 add column invitation_response text not null default 'Not requested' check(invitation_response in ('Not requested','Awaiting response','Accepted','Declined')),
 add column invitation_response_reason text,
 add column invitation_responded_at timestamptz,
 add column invitation_opened_at timestamptz,
 add column invitation_viewed_at timestamptz;
create index interviews_invitation_idx on public.interviews(invitation_id) where invitation_id is not null;

-- Only the authenticated service may mint links or write delivery/response signals.
create function recruitment_private.prepare_invitation(p_interview uuid,p_response_hash text,p_tracking_hash text,p_recipient text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m public.interviews%rowtype; applicant public.job_applications%rowtype; title text; invitation uuid;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Invitation service access required' using errcode='42501'; end if;
 select * into m from public.interviews where id=p_interview for update;
 if not found or m.status='Cancelled' then raise exception 'Interview is unavailable'; end if;
 select * into applicant from public.job_applications where id=m.application_id and organization_id=m.organization_id;
 if not found or lower(applicant.email::text) is distinct from lower(p_recipient) then raise exception 'Invitation recipient does not match the applicant'; end if;
 select j.title into title from public.job_openings j where j.id=applicant.job_opening_id and j.organization_id=m.organization_id;
 insert into recruitment_private.interview_invitations(organization_id,interview_id,response_hash,tracking_hash,recipient,candidate_name,vacancy_title,scheduled_start,scheduled_end,format,location_or_link,expires_at)
 values(m.organization_id,m.id,p_response_hash,p_tracking_hash,p_recipient,applicant.full_name,coalesce(title,'CAGE opportunity'),m.scheduled_start,m.scheduled_end,m.format,m.location_or_link,
  least(greatest(m.scheduled_end+interval '7 days',clock_timestamp()+interval '1 day'),clock_timestamp()+interval '90 days')) returning id into invitation;
 return jsonb_build_object('id',invitation,'scheduled_start',m.scheduled_start,'scheduled_end',m.scheduled_end,'format',m.format,'location_or_link',m.location_or_link,'candidate_name',applicant.full_name,'vacancy_title',coalesce(title,'CAGE opportunity'));
end $$;

create function recruitment_private.invitation_delivery(p_id uuid,p_status text,p_provider_id text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i recruitment_private.interview_invitations%rowtype;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Invitation service access required' using errcode='42501'; end if;
 if p_status not in ('sent','failed') or p_status is null then raise exception 'Invalid delivery status'; end if;
 select * into i from recruitment_private.interview_invitations where id=p_id for update;
 if not found then raise exception 'Invitation unavailable'; end if;
 if i.delivery='sent' then return jsonb_build_object('ok',true); end if;
 update recruitment_private.interview_invitations set delivery=p_status,provider_id=p_provider_id,sent_at=case when p_status='sent' then clock_timestamp() else null end where id=p_id returning * into i;
 if p_status='sent' then
  update public.interviews set invitation_id=i.id,invitation_sent_at=i.sent_at,invitation_recipient=i.recipient,invitation_location=i.location_or_link,
   invitation_response='Awaiting response',invitation_response_reason=null,invitation_responded_at=null,invitation_opened_at=i.opened_at,invitation_viewed_at=null where id=i.interview_id;
 end if;
 return jsonb_build_object('ok',true);
end $$;

create function recruitment_private.respond_invitation(p_hash text,p_mode text,p_response text default null,p_reason text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i recruitment_private.interview_invitations%rowtype; m public.interviews%rowtype;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Invitation service access required' using errcode='42501'; end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_mode is null or p_mode not in ('view','respond','open') then raise exception 'This invitation link is invalid or unavailable'; end if;
 select * into i from recruitment_private.interview_invitations where
  (p_mode='open' and tracking_hash=p_hash) or (p_mode<>'open' and response_hash=p_hash) for update;
 if not found or i.expires_at<clock_timestamp() or i.delivery='failed' then raise exception 'This invitation link is expired or unavailable'; end if;
 if p_mode='open' then
  update recruitment_private.interview_invitations set opened_at=coalesce(opened_at,clock_timestamp()) where id=i.id returning * into i;
  update public.interviews set invitation_opened_at=i.opened_at where id=i.interview_id and invitation_id=i.id;
  return jsonb_build_object('ok',true);
 end if;
 select * into m from public.interviews where id=i.interview_id for update;
 if i.delivery<>'sent' or m.invitation_id is distinct from i.id or m.status='Cancelled' or
  m.scheduled_start is distinct from i.scheduled_start or m.scheduled_end is distinct from i.scheduled_end or m.location_or_link is distinct from i.location_or_link then
  raise exception 'This interview invitation has changed. Contact CAGE for an updated invitation'; end if;
 if p_mode='respond' then
  p_reason:=btrim(coalesce(p_reason,''));
  if p_response is null or p_response not in ('accepted','declined') or length(p_reason)>2000 or (p_response='declined' and length(p_reason)=0) then raise exception 'Choose accept or decline and include a reason when declining (up to 2,000 characters)'; end if;
  if i.response<>'pending' then
   if i.response<>p_response or i.reason<>p_reason then raise exception 'Your response is already recorded. Contact CAGE if you need to change it'; end if;
  else
   update recruitment_private.interview_invitations set response=p_response,reason=p_reason,responded_at=clock_timestamp() where id=i.id returning * into i;
   update public.interviews set invitation_response=case when p_response='accepted' then 'Accepted' else 'Declined' end,
    invitation_response_reason=p_reason,invitation_responded_at=i.responded_at where id=i.interview_id and invitation_id=i.id;
  end if;
 end if;
 update recruitment_private.interview_invitations set viewed_at=coalesce(viewed_at,clock_timestamp()) where id=i.id returning * into i;
 update public.interviews set invitation_viewed_at=i.viewed_at where id=i.interview_id and invitation_id=i.id;
 return jsonb_build_object('candidate_name',i.candidate_name,'vacancy_title',i.vacancy_title,'scheduled_start',i.scheduled_start,'scheduled_end',i.scheduled_end,
  'format',i.format,'location_or_link',i.location_or_link,'response',i.response,'reason',i.reason,'responded_at',i.responded_at);
end $$;

revoke all on function recruitment_private.prepare_invitation(uuid,text,text,text),recruitment_private.invitation_delivery(uuid,text,text),recruitment_private.respond_invitation(text,text,text,text) from public,anon,authenticated;
grant usage on schema recruitment_private to service_role;
grant execute on function recruitment_private.prepare_invitation(uuid,text,text,text),recruitment_private.invitation_delivery(uuid,text,text),recruitment_private.respond_invitation(text,text,text,text) to service_role;
create function public.interview_invitation_prepare(p_interview uuid,p_response_hash text,p_tracking_hash text,p_recipient text) returns jsonb language sql security invoker set search_path='' as $$select recruitment_private.prepare_invitation(p_interview,p_response_hash,p_tracking_hash,p_recipient)$$;
create function public.interview_invitation_delivery(p_id uuid,p_status text,p_provider_id text default null) returns jsonb language sql security invoker set search_path='' as $$select recruitment_private.invitation_delivery(p_id,p_status,p_provider_id)$$;
create function public.interview_invitation_response(p_hash text,p_mode text,p_response text default null,p_reason text default null) returns jsonb language sql security invoker set search_path='' as $$select recruitment_private.respond_invitation(p_hash,p_mode,p_response,p_reason)$$;
revoke all on function public.interview_invitation_prepare(uuid,text,text,text),public.interview_invitation_delivery(uuid,text,text),public.interview_invitation_response(text,text,text,text) from public,anon,authenticated;
grant execute on function public.interview_invitation_prepare(uuid,text,text,text),public.interview_invitation_delivery(uuid,text,text),public.interview_invitation_response(text,text,text,text) to service_role;

create or replace function recruitment_private.guard_invitation_snapshot() returns trigger language plpgsql set search_path='' as $$
declare new_snapshot jsonb;old_snapshot jsonb;
begin
 if current_user not in ('anon','authenticated') then return new; end if;
 new_snapshot:=jsonb_build_array(new.invitation_sent_at,new.invitation_recipient,new.invitation_location,new.invitation_id,new.invitation_response,new.invitation_response_reason,new.invitation_responded_at,new.invitation_opened_at,new.invitation_viewed_at);
 if tg_op='INSERT' then old_snapshot:=jsonb_build_array(null,null,null,null,'Not requested',null,null,null,null);
 else old_snapshot:=jsonb_build_array(old.invitation_sent_at,old.invitation_recipient,old.invitation_location,old.invitation_id,old.invitation_response,old.invitation_response_reason,old.invitation_responded_at,old.invitation_opened_at,old.invitation_viewed_at); end if;
 if new_snapshot is distinct from old_snapshot then raise exception 'Invitation records are managed by the invitation service' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function recruitment_private.guard_invitation_snapshot() from public,anon,authenticated;
