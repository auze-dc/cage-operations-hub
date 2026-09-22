begin;
-- Ephemeral leases only: no page, message or activity-history tracking.
create table if not exists public.hub_presence_sessions (
 user_id uuid not null references public.profiles(id) on delete cascade,
 session_id uuid not null,
 organization_id uuid not null references public.organizations(id),
 state text not null check(state in ('online','away')),
 touched_at timestamptz not null default now(),
 primary key(user_id,session_id)
);
create index if not exists hub_presence_org on public.hub_presence_sessions(organization_id,touched_at);
alter table public.hub_presence_sessions enable row level security;
revoke all on public.hub_presence_sessions from anon,authenticated;
grant all on public.hub_presence_sessions to service_role;
create or replace function public.hub_presence_heartbeat(sid uuid,availability text default 'online') returns jsonb
language plpgsql security definer set search_path=public as $$
declare org uuid;result jsonb;begin
 select organization_id into org from profiles where id=auth.uid() and active and role<>'shared';
 if org is null or sid is null or availability not in ('online','away','offline') then raise exception 'Active internal staff session required';end if;
 delete from hub_presence_sessions where organization_id=org and touched_at<now()-interval '1 day';
 if availability='offline' then delete from hub_presence_sessions where user_id=auth.uid() and session_id=sid;
 else insert into hub_presence_sessions(user_id,session_id,organization_id,state) values(auth.uid(),sid,org,availability)
 on conflict(user_id,session_id) do update set organization_id=excluded.organization_id,state=excluded.state,touched_at=now();end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'member_id',staff_member_id(p.id),'name',p.full_name,'status',coalesce(l.status,'offline')) order by p.full_name),'[]') into result
 from profiles p left join lateral (
 select case when bool_or(s.state='online') then 'online' else 'away' end as status
 from hub_presence_sessions s where s.user_id=p.id and s.organization_id=org and s.touched_at>now()-interval '90 seconds'
 having count(*)>0
 ) l on true where p.organization_id=org and p.active and p.role<>'shared';
 return result;
end $$;
revoke all on function public.hub_presence_heartbeat(uuid,text) from public,anon;
grant execute on function public.hub_presence_heartbeat(uuid,text) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
