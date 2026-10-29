-- Apply only after the MFA-capable frontend is deployed.
-- No business rows, account roles, existing factors, or scheduled jobs are changed.
create or replace function public.hub_mfa_satisfied()
returns boolean language sql stable security definer set search_path = ''
as $$
 select case
  when coalesce(auth.jwt()->>'role','') = 'service_role' then true
  when auth.uid() is null then coalesce(auth.jwt()->>'role','') <> 'authenticated'
  when coalesce(auth.jwt()->>'aal','') = 'aal2' then true
  else not exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role='admin')
   and not exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.status='verified')
 end
$$;
revoke all on function public.hub_mfa_satisfied() from public;
grant execute on function public.hub_mfa_satisfied() to anon,authenticated,service_role;

create or replace function public.hub_assert_mfa()
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
 if coalesce(auth.jwt()->>'role','')='service_role' then return; end if;
 if auth.uid() is null then raise sqlstate 'PT401' using message='Sign in required.'; end if;
 if not public.hub_mfa_satisfied() then
  raise sqlstate 'PT403' using message='Two-step verification required. Reload CAGE and verify your authenticator.';
 end if;
end $$;
revoke all on function public.hub_assert_mfa() from public,anon;
grant execute on function public.hub_assert_mfa() to authenticated,service_role;

create or replace function public.hub_security_status()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare p public.profiles; enrolled boolean;
begin
 if auth.uid() is null then raise sqlstate 'PT401' using message='Sign in required.'; end if;
 select * into p from public.profiles where id=auth.uid() and active;
 if p.id is null then raise sqlstate 'PT403' using message='An active staff account is required.'; end if;
 select exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.status='verified') into enrolled;
 return jsonb_build_object('required',p.role='admin' or enrolled,'enrolled',enrolled,'satisfied',public.hub_mfa_satisfied());
end $$;
revoke all on function public.hub_security_status() from public,anon;
grant execute on function public.hub_security_status() to authenticated,service_role;

create or replace function public.hub_check_request()
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
 -- This exact, read-only bootstrap endpoint returns only the caller's MFA state.
 if ltrim(coalesce(current_setting('request.path',true),''),'/')='rpc/hub_security_status' then return; end if;
 if coalesce(auth.jwt()->>'role','')='authenticated' or auth.uid() is not null then perform public.hub_assert_mfa(); end if;
end $$;
revoke all on function public.hub_check_request() from public;
grant execute on function public.hub_check_request() to anon,authenticated,service_role;

-- PostgREST guard also covers SECURITY DEFINER RPCs which bypass table RLS.
do $$
declare configured text; t record;
begin
 select substring(v from length('pgrst.db_pre_request=')+1) into configured
 from pg_roles r cross join lateral unnest(r.rolconfig) v
 where r.rolname='authenticator' and v like 'pgrst.db_pre_request=%';
 if coalesce(configured,'') not in ('','public.hub_check_request') then
  raise exception 'Existing Data API pre-request guard requires review; refusing to replace it.';
 end if;
 -- Restrictive policies intersect existing permissions; they never grant new rows.
 -- They cover Storage and Realtime, where the Data API hook does not run.
 for t in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind='r' and c.relrowsecurity
   and (n.nspname='public' or (n.nspname='storage' and c.relname='objects'))
 loop
  execute format('drop policy if exists hub_mfa_required on %I.%I',t.nspname,t.relname);
  execute format('create policy hub_mfa_required on %I.%I as restrictive for all to authenticated using ((select public.hub_mfa_satisfied())) with check ((select public.hub_mfa_satisfied()))',t.nspname,t.relname);
 end loop;
end $$;
alter role authenticator set pgrst.db_pre_request='public.hub_check_request';
notify pgrst,'reload config';
notify pgrst,'reload schema';
