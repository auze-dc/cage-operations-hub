-- Project the staff directory from current accounts instead of a stale JSON roster.
-- No workspace business records or existing member identifiers are rewritten.
set local lock_timeout='5s';
create function recruitment_private.with_staff_directory(payload jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare org uuid; roster jsonb; previous jsonb;
begin
 if auth.uid() is null or public.hub_mfa_satisfied() is not true then raise exception 'Verified sign-in is required' using errcode='42501'; end if;
 org:=public.current_organization_id();
 if org is null or not exists(select 1 from public.profiles where id=auth.uid() and organization_id=org and active) then raise exception 'Active staff access is required' using errcode='42501'; end if;
 if payload is null or jsonb_typeof(payload->'data') is distinct from 'object' then return payload; end if;
 previous:=case when jsonb_typeof(payload#>'{data,team}')='array' then payload#>'{data,team}' else '[]'::jsonb end;
 with people as (
  select p.*,case when split_part(lower(p.email::text),'@',1)='bonfancio' then 'bonifancio' else split_part(lower(p.email::text),'@',1) end as member_id
  from public.profiles p where p.organization_id=org
 ), directory as (
  select coalesce(old.value,'{}'::jsonb)||jsonb_build_object(
   'id',coalesce(old.value->>'id',p.member_id),'userId',p.id,'name',p.full_name,'email',p.email,'initials',p.initials,
   'role',coalesce(nullif(old.value->>'role',''),case p.role when 'admin' then 'Administrator' when 'member' then 'Team member' else initcap(p.role) end),
   'access',case when p.role='admin' then 'Administrator' else 'Standard user' end,
   'active',p.active,'assignable',p.active and coalesce(p.assignable,true) and p.role<>'shared') as value
  from people p left join lateral (
   select x.value from jsonb_array_elements(previous)x(value)
   where x.value->>'id'=p.member_id or lower(x.value->>'email')=lower(p.email::text)
   order by case when x.value->>'id'=p.member_id then 0 else 1 end limit 1
  ) old on true
  union all
  -- Keep former names available on historical records without offering them as recipients.
  select x.value||jsonb_build_object('active',false,'assignable',false)
  from jsonb_array_elements(previous)x(value)
  where not exists(select 1 from people p where p.member_id=x.value->>'id' or lower(p.email::text)=lower(x.value->>'email'))
 ) select coalesce(jsonb_agg(value order by lower(value->>'name'),value->>'id'),'[]'::jsonb) into roster from directory;
 return jsonb_set(payload,'{data,team}',roster);
end $$;
revoke all on function recruitment_private.with_staff_directory(jsonb) from public,anon,authenticated;

-- Preserve the existing financial deletion filters and numbering floors.
create or replace function public.get_my_workspace() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; k text; items jsonb; org uuid; floor_value numeric; floors jsonb='{}';
begin
 result=public.finance_delete_original_workspace();org=public.current_organization_id();
 foreach k in array array['quotes','invoices'] loop
  if jsonb_typeof(result->'data'->k)='array' then
   select greatest(26000,coalesce(max(nullif(regexp_replace(x->>'number','[^0-9]','','g'),'')::numeric),26000)) into floor_value from jsonb_array_elements(result->'data'->k)x;
   floors=jsonb_set(floors,array[k],to_jsonb(floor_value));
   select coalesce(jsonb_agg(x order by n),'[]'::jsonb) into items
    from jsonb_array_elements(result->'data'->k) with ordinality a(x,n)
    where not exists(select 1 from public.record_deletion_log d where d.organization_id=org and d.kind=k and d.record_id=x->>'id');
   result=jsonb_set(result,array['data',k],items);
  end if;
 end loop;
 return recruitment_private.with_staff_directory(result||jsonb_build_object('financeNumberFloor',floors));
end $$;
revoke all on function public.get_my_workspace() from public,anon;
grant execute on function public.get_my_workspace() to authenticated;
