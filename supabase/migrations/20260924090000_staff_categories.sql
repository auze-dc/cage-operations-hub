begin;
create table public.hub_work_categories (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 module text not null check(module in ('requests','crm','projects')),
 name text not null check(char_length(name) between 3 and 60),
 name_key text generated always as (lower(name)) stored,
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 unique(organization_id,module,name_key)
);
alter table public.hub_work_categories enable row level security;
revoke all on public.hub_work_categories from public,anon,authenticated;
create function public.hub_category_list(category_module text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare org uuid;result jsonb;begin
 select organization_id into org from public.profiles where id=auth.uid() and active and role<>'shared';
 if org is null then raise exception 'Active staff account required';end if;
 if category_module is null or category_module not in ('requests','crm','projects') then raise exception 'Unknown category module';end if;
 select coalesce(jsonb_agg(c.name order by lower(c.name)),'[]'::jsonb) into result
 from public.hub_work_categories c where c.organization_id=org and c.module=category_module;
 return result;
end $$;
create function public.hub_category_add(category_module text,category_name text) returns text
language plpgsql security definer set search_path='' as $$
declare org uuid;clean text;result text;created uuid;begin
 select organization_id into org from public.profiles where id=auth.uid() and active and role<>'shared';
 if org is null then raise exception 'Active staff account required';end if;
 if category_module is null or category_module not in ('requests','crm','projects') then raise exception 'Unknown category module';end if;
 clean=btrim(regexp_replace(coalesce(category_name,''),'[[:space:]]+',' ','g'));
 if char_length(clean) not between 3 and 60 or clean ~ '[[:cntrl:]]' then raise exception 'Use a category name of 3 to 60 characters';end if;
 insert into public.hub_work_categories(organization_id,module,name,created_by)
 values(org,category_module,clean,auth.uid()) on conflict(organization_id,module,name_key) do nothing returning id into created;
 select name into result from public.hub_work_categories where organization_id=org and module=category_module and name_key=lower(clean);
 if created is not null then
 insert into public.audit_log(organization_id,actor_id,action,entity_type,entity_id,new_data)
 values(org,auth.uid(),'create','work_category',created::text,jsonb_build_object('module',category_module,'name',result));
 end if;
 return result;
end $$;
revoke all on function public.hub_category_list(text),public.hub_category_add(text,text) from public,anon;
grant execute on function public.hub_category_list(text),public.hub_category_add(text,text) to authenticated;
notify pgrst,'reload schema';
commit;
