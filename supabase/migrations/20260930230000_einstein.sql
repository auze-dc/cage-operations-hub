begin;
create table if not exists public.einstein_usage (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 day date not null,
 requests integer not null default 0,
 minute_at timestamptz not null default date_trunc('minute',now()),
 minute_requests integer not null default 0,
 primary key(organization_id,user_id,day)
);
alter table public.einstein_usage enable row level security;
revoke all on public.einstein_usage from anon,authenticated;
create or replace function public.einstein_reserve() returns jsonb language plpgsql security definer set search_path=public as $$
declare org uuid;used integer;all_used integer;recent integer;m timestamptz;today date:=(now() at time zone 'Africa/Blantyre')::date;
begin
 select organization_id into org from profiles where id=auth.uid() and active and role<>'shared';
 if org is null then raise exception 'Active staff account required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtext('einstein:'||org::text));
 select requests,minute_at,minute_requests into used,m,recent from einstein_usage where organization_id=org and user_id=auth.uid() and day=today;
 select coalesce(sum(requests),0) into all_used from einstein_usage where organization_id=org and day=today;
 if coalesce(used,0)>=40 or all_used>=400 then raise exception 'Daily Einstein limit reached. Built-in guides remain available.';end if;
 if m=date_trunc('minute',now()) and recent>=6 then raise exception 'Please wait a minute before asking Einstein again.';end if;
 insert into einstein_usage(organization_id,user_id,day,requests,minute_at,minute_requests) values(org,auth.uid(),today,1,date_trunc('minute',now()),1)
 on conflict(organization_id,user_id,day) do update set requests=einstein_usage.requests+1,minute_requests=case when einstein_usage.minute_at=excluded.minute_at then einstein_usage.minute_requests+1 else 1 end,minute_at=excluded.minute_at;
 return jsonb_build_object('remaining',39-coalesce(used,0));
end $$;
revoke all on function public.einstein_reserve() from public,anon;
grant execute on function public.einstein_reserve() to authenticated;
notify pgrst,'reload schema';
commit;
