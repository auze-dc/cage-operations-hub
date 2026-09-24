begin;
-- Bind to the existing verified Auth account, not editable profile names/emails.
create table public.hub_location_reader (
 singleton boolean primary key default true check(singleton),
 user_id uuid not null references auth.users(id),
 organization_id uuid not null references public.organizations(id)
);
do $$ declare n integer; begin
 select count(*) into n from auth.users u join public.profiles p on p.id=u.id
 where lower(u.email)='alexander@cagemw.com' and u.email_confirmed_at is not null and p.active and p.role<>'shared';
 if n<>1 then raise exception 'Expected exactly one active verified Alexander account. No changes installed.'; end if;
 insert into public.hub_location_reader(user_id,organization_id)
 select u.id,p.organization_id from auth.users u join public.profiles p on p.id=u.id
 where lower(u.email)='alexander@cagemw.com' and u.email_confirmed_at is not null and p.active and p.role<>'shared';
end $$;
create table public.hub_device_locations (
 user_id uuid not null references public.profiles(id),
 session_id uuid not null,
 organization_id uuid not null references public.organizations(id),
 latitude double precision,
 longitude double precision,
 accuracy_m double precision,
 observed_at timestamptz,
 touched_at timestamptz not null default now(),
 expires_at timestamptz not null default now(),
 revoked boolean not null default false,
 primary key(user_id,session_id)
);
alter table public.hub_location_reader enable row level security;
alter table public.hub_device_locations enable row level security;
revoke all on public.hub_location_reader,public.hub_device_locations from public,anon,authenticated;
-- No client table policies or Realtime publication: access is through checked RPCs only.
create function public.hub_location_can_read() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hub_location_reader r
 join auth.users u on u.id=r.user_id join public.profiles p on p.id=u.id
 where r.user_id=auth.uid() and lower(u.email)='alexander@cagemw.com'
 and u.email_confirmed_at is not null and p.active and p.role<>'shared'
 and p.organization_id=r.organization_id)
$$;
create function public.hub_location_publish(sid uuid,lat double precision,lng double precision,accuracy double precision,captured_at timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare org uuid; begin
 select organization_id into org from public.profiles where id=auth.uid() and active and role<>'shared';
 if org is null or sid is null then raise exception 'Active staff account required';end if;
 if lat is null or not(lat between -90 and 90) or lng is null or not(lng between -180 and 180)
 or accuracy is null or not(accuracy between 0 and 10000000)
 or captured_at is null or captured_at<now()-interval '60 seconds' or captured_at>now()+interval '10 seconds'
 then raise exception 'A fresh valid device location is required';end if;
 if not exists(select 1 from public.hub_presence_sessions s where s.user_id=auth.uid() and s.organization_id=org and s.state='online' and s.touched_at>now()-interval '90 seconds') then
 raise exception 'An active Hub session is required';end if;
 -- Only this feature's expired coordinates are cleared. Existing Hub records are untouched.
 update public.hub_device_locations set latitude=null,longitude=null,accuracy_m=null,observed_at=null where expires_at<=now() and latitude is not null;
 insert into public.hub_device_locations(user_id,session_id,organization_id,latitude,longitude,accuracy_m,observed_at,expires_at)
 values(auth.uid(),sid,org,lat,lng,accuracy,captured_at,least(now()+interval '90 seconds',captured_at+interval '90 seconds'))
 on conflict(user_id,session_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy_m=excluded.accuracy_m,
 observed_at=excluded.observed_at,touched_at=now(),expires_at=excluded.expires_at
 where not hub_device_locations.revoked and (hub_device_locations.observed_at is null or excluded.observed_at>=hub_device_locations.observed_at);
end $$;
create function public.hub_location_stop(sid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare org uuid;begin
 select organization_id into org from public.profiles where id=auth.uid();
 if org is null or sid is null then raise exception 'Staff account required';end if;
 -- A permanent session tombstone prevents an in-flight upload reviving sharing.
 insert into public.hub_device_locations(user_id,session_id,organization_id,revoked)
 values(auth.uid(),sid,org,true) on conflict(user_id,session_id) do update
 set revoked=true,latitude=null,longitude=null,accuracy_m=null,observed_at=null,expires_at=now(),touched_at=now();
end $$;
create function public.hub_location_list() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 if not public.hub_location_can_read() then raise exception 'Only Alexander may view device locations' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('name',p.full_name,'session_id',l.session_id,
 'latitude',l.latitude,'longitude',l.longitude,'accuracy_m',l.accuracy_m,'observed_at',l.observed_at,'expires_at',l.expires_at)
 order by p.full_name,l.observed_at desc),'[]'::jsonb) into result
 from public.hub_device_locations l join public.profiles p on p.id=l.user_id
 join public.hub_location_reader r on r.organization_id=l.organization_id
 where p.active and p.role<>'shared' and p.organization_id=l.organization_id
 and not l.revoked and l.latitude is not null and l.expires_at>now()
 and exists(select 1 from public.hub_presence_sessions s where s.user_id=l.user_id and s.organization_id=l.organization_id and s.state='online' and s.touched_at>now()-interval '90 seconds');
 return result;
end $$;
revoke all on function public.hub_location_can_read(),public.hub_location_publish(uuid,double precision,double precision,double precision,timestamptz),public.hub_location_stop(uuid),public.hub_location_list() from public,anon;
grant execute on function public.hub_location_can_read(),public.hub_location_publish(uuid,double precision,double precision,double precision,timestamptz),public.hub_location_stop(uuid),public.hub_location_list() to authenticated;
notify pgrst,'reload schema';
commit;
