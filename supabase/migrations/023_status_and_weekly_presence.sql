begin;
-- Requires 022. Server-timed, non-overlapping estimates; no browsing or message history.
create table if not exists hub_member_status(user_id uuid primary key references profiles(id) on delete cascade,emoji text not null default '' check(length(emoji)<=32),message text not null default '' check(length(message)<=100),expires_at timestamptz,mode text not null default 'auto' check(mode in ('auto','away')));
create table if not exists hub_presence_clock(user_id uuid primary key references profiles(id) on delete cascade,organization_id uuid not null references organizations(id),accounted_at timestamptz not null);
create table if not exists hub_presence_daily(organization_id uuid not null references organizations(id),user_id uuid not null references profiles(id),day date not null,seconds numeric(14,3) not null default 0 check(seconds between 0 and 86400),primary key(organization_id,user_id,day));
create table if not exists hub_presence_reporting_start(singleton boolean primary key default true check(singleton),started_at timestamptz not null default now());
insert into hub_presence_reporting_start(singleton) values(true) on conflict do nothing;
-- Reinstallation after a presence-only rollback must not attribute an untracked gap.
update hub_presence_clock set accounted_at=now();
create table if not exists hub_presence_reports(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),recipient_id uuid not null references profiles(id),week_start date not null,status text not null default 'pending' check(status in ('pending','processing','sent','failed','cancelled')),attempts integer not null default 0,available_at timestamptz not null default now(),claimed_at timestamptz,first_attempt_at timestamptz,sent_at timestamptz,provider_id text,error text,payload jsonb,unique(organization_id,recipient_id,week_start));
do $$declare t text;begin foreach t in array array['hub_member_status','hub_presence_clock','hub_presence_daily','hub_presence_reporting_start','hub_presence_reports'] loop execute format('alter table %I enable row level security',t);execute format('revoke all on %I from anon,authenticated',t);execute format('grant all on %I to service_role',t);end loop;end $$;
create or replace function hub_presence_settle(who uuid,at_time timestamptz default now()) returns void language plpgsql security definer set search_path=public as $$
declare c hub_presence_clock;until_time timestamptz;cursor_time timestamptz;edge_time timestamptz;local_day date;begin
 select * into c from hub_presence_clock where user_id=who for update;if not found or at_time<=c.accounted_at then return;end if;
 -- Union of all live online leases: each instant is counted once, irrespective of device count.
 if not exists(select 1 from hub_member_status where user_id=who and mode='away') and exists(select 1 from profiles where id=who and active and role<>'shared' and organization_id=c.organization_id) then
 select least(at_time,max(touched_at+interval '90 seconds')) into until_time from hub_presence_sessions where user_id=who and organization_id=c.organization_id and state='online';
 cursor_time:=c.accounted_at;
 while cursor_time<until_time loop
 local_day:=(cursor_time at time zone 'Africa/Blantyre')::date;edge_time:=least(until_time,((local_day+1)::timestamp at time zone 'Africa/Blantyre'));
 insert into hub_presence_daily values(c.organization_id,who,local_day,extract(epoch from edge_time-cursor_time)) on conflict(organization_id,user_id,day) do update set seconds=least(86400,hub_presence_daily.seconds+excluded.seconds);
 cursor_time:=edge_time;end loop;end if;
 update hub_presence_clock set accounted_at=at_time where user_id=who;
end $$;
create or replace function hub_presence_heartbeat(sid uuid,availability text default 'online') returns jsonb language plpgsql security definer set search_path=public as $$
declare org uuid;result jsonb;begin
 select organization_id into org from profiles where id=auth.uid() and active and role<>'shared';
 if org is null or sid is null or availability is null or availability not in ('online','away','offline') then raise exception 'Active internal staff session required';end if;
 insert into hub_presence_clock values(auth.uid(),org,now()) on conflict do nothing;
 perform hub_presence_settle(auth.uid()); -- Serialises all tabs before their leases change.
 update hub_presence_clock set organization_id=org where user_id=auth.uid();
 delete from hub_presence_sessions where user_id=auth.uid() and touched_at<now()-interval '1 day';
 if availability='offline' then delete from hub_presence_sessions where user_id=auth.uid() and session_id=sid;
 else insert into hub_presence_sessions values(auth.uid(),sid,org,availability,now()) on conflict(user_id,session_id) do update set organization_id=excluded.organization_id,state=excluded.state,touched_at=now();end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'member_id',staff_member_id(p.id),'name',p.full_name,'status',case when l.status is null then 'offline' when s.mode='away' then 'away' else l.status end,'emoji',case when s.expires_at is null or s.expires_at>now() then coalesce(s.emoji,'') else '' end,'message',case when s.expires_at is null or s.expires_at>now() then coalesce(s.message,'') else '' end,'mode',coalesce(s.mode,'auto')) order by p.full_name),'[]') into result
 from profiles p left join hub_member_status s on s.user_id=p.id left join lateral(select case when bool_or(state='online') then 'online' else 'away' end status from hub_presence_sessions where user_id=p.id and organization_id=org and touched_at>now()-interval '90 seconds' having count(*)>0) l on true where p.organization_id=org and p.active and p.role<>'shared';return result;
end $$;
create or replace function hub_presence_status(emoji_value text,message_value text,clear_after text default 'today',availability_mode text default 'auto') returns void language plpgsql security definer set search_path=public as $$
declare org uuid;expiry timestamptz;begin
 select organization_id into org from profiles where id=auth.uid() and active and role<>'shared';if org is null then raise exception 'Active internal member required';end if;
 if clear_after is null or clear_after not in ('30m','1h','4h','today','week','never') or availability_mode is null or availability_mode not in ('auto','away') then raise exception 'Choose a valid expiry and availability';end if;
 expiry:=case clear_after when '30m' then now()+interval '30 minutes' when '1h' then now()+interval '1 hour' when '4h' then now()+interval '4 hours' when 'today' then (((now() at time zone 'Africa/Blantyre')::date+1)::timestamp at time zone 'Africa/Blantyre') when 'week' then (date_trunc('week',now() at time zone 'Africa/Blantyre')+interval '7 days') at time zone 'Africa/Blantyre' else null end;
 insert into hub_presence_clock values(auth.uid(),org,now()) on conflict do nothing;perform hub_presence_settle(auth.uid());
 insert into hub_member_status values(auth.uid(),coalesce(emoji_value,''),trim(coalesce(message_value,'')),expiry,availability_mode) on conflict(user_id) do update set emoji=excluded.emoji,message=excluded.message,expires_at=excluded.expires_at,mode=excluded.mode;
end $$;
create or replace function hub_presence_week_data(org uuid,week_of date) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('week_start',week_of,'week_end',week_of+6,'timezone','Africa/Blantyre','tracking_started_at',(select started_at from hub_presence_reporting_start),'members',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'days',(select jsonb_agg(jsonb_build_object('day',week_of+i,'seconds',coalesce(d.seconds,0)) order by i) from generate_series(0,6) i left join hub_presence_daily d on d.organization_id=org and d.user_id=p.id and d.day=week_of+i),'total_seconds',(select coalesce(sum(seconds),0) from hub_presence_daily d where d.organization_id=org and d.user_id=p.id and d.day between week_of and week_of+6)) order by p.full_name) from profiles p where p.organization_id=org and ((p.active and p.role<>'shared') or exists(select 1 from hub_presence_daily d where d.organization_id=org and d.user_id=p.id and d.day between week_of and week_of+6))),'[]'))
$$;
create or replace function hub_presence_week(week_of date) returns jsonb language plpgsql security definer set search_path=public as $$declare org uuid;u uuid;begin
 select organization_id into org from profiles where id=auth.uid() and active and role='admin';if org is null then raise exception 'Administrator access required';end if;
 if week_of is null or extract(isodow from week_of)<>1 then raise exception 'Choose the Monday starting the week';end if;
 for u in select user_id from hub_presence_clock where organization_id=org order by user_id loop perform hub_presence_settle(u);end loop;
 return hub_presence_week_data(org,week_of);end $$;
create or replace function claim_presence_reports() returns setof hub_presence_reports language plpgsql security definer set search_path=public as $$declare u uuid;week_of date:=(date_trunc('week',now() at time zone 'Africa/Blantyre')::date-7);begin
 perform pg_advisory_xact_lock(230923);
 for u in select user_id from hub_presence_clock where accounted_at<now()-interval '10 seconds' order by user_id loop perform hub_presence_settle(u);end loop;
 -- Complete Monday-Sunday week; first dispatch after Monday 00:05 CAT. No fabricated backfill.
 if now()>=((week_of+7)::timestamp at time zone 'Africa/Blantyre')+interval '5 minutes' and (select started_at from hub_presence_reporting_start)<((week_of+7)::timestamp at time zone 'Africa/Blantyre') then
 insert into hub_presence_reports(organization_id,recipient_id,week_start) select organization_id,id,week_of from profiles where active and role='admin' on conflict do nothing;end if;
 update hub_presence_reports r set status='cancelled' where status in ('pending','processing') and not exists(select 1 from profiles p where p.id=r.recipient_id and p.organization_id=r.organization_id and p.active and p.role='admin');
 update hub_presence_reports set status='pending' where status='processing' and claimed_at<now()-interval '2 minutes';
 update hub_presence_reports set status='failed',error=coalesce(error,'Retry window exhausted') where status='pending' and (attempts>=5 or first_attempt_at<now()-interval '20 hours');
 return query with picked as(select id from hub_presence_reports where status='pending' and available_at<=now() order by week_start,id for update skip locked limit 20) update hub_presence_reports r set status='processing',attempts=attempts+1,claimed_at=now(),first_attempt_at=coalesce(first_attempt_at,now()) from picked where r.id=picked.id returning r.*;
end $$;
create or replace function prepare_presence_report(jid uuid) returns jsonb language plpgsql security definer set search_path=public as $$declare r hub_presence_reports;email text;begin
 select * into r from hub_presence_reports where id=jid for update;if not found or r.status<>'processing' then return null;end if;
 select p.email into email from profiles p where p.id=r.recipient_id and p.active and p.role='admin' and p.organization_id=r.organization_id;
 if email is null or (r.payload is not null and r.payload->'to'->>0 is distinct from email) then update hub_presence_reports set status='cancelled' where id=jid;return null;end if;
 return to_jsonb(r)||jsonb_build_object('recipient',email,'report',hub_presence_week_data(r.organization_id,r.week_start));end $$;
-- Tables and internal functions never expose time totals to ordinary members.
do $$declare f record;begin for f in select oid::regprocedure sig from pg_proc where pronamespace='public'::regnamespace and proname in ('hub_presence_settle','hub_presence_heartbeat','hub_presence_status','hub_presence_week_data','hub_presence_week','claim_presence_reports','prepare_presence_report') loop execute format('revoke all on function %s from public,anon,authenticated',f.sig);execute format('grant execute on function %s to service_role',f.sig);end loop;end $$;
grant execute on function hub_presence_heartbeat(uuid,text),hub_presence_status(text,text,text,text),hub_presence_week(date) to authenticated;
notify pgrst,'reload schema';
commit;
