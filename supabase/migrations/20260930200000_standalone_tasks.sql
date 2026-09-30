begin;
create or replace function public.save_standalone_task(details jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare w workspace_states;mid text;r jsonb;prior jsonb;members jsonb;
begin
 if not exists(select 1 from profiles where id=auth.uid() and active and role<>'shared') then raise exception 'Active staff account required' using errcode='42501';end if;
 mid:=staff_member_id(auth.uid());
 select * into w from workspace_states where organization_id=current_organization_id() for update;
 if not found then raise exception 'Workspace unavailable';end if;
 if jsonb_typeof(details) is distinct from 'object' or length(details::text)>20000 or coalesce(details->>'id','') !~ '^t-[a-zA-Z0-9-]+$' then raise exception 'Invalid task';end if;
 select x into prior from jsonb_array_elements(coalesce(w.data->'tasks','[]')) x where x->>'id'=details->>'id';
 if prior is not null and (coalesce(prior->>'project','')<>'' or prior->>'owner' is distinct from mid) then raise exception 'Only your own standalone tasks can be changed here' using errcode='42501';end if;
 if length(trim(coalesce(details->>'title',''))) not between 1 and 300 or length(trim(coalesce(details->>'output',''))) not between 1 and 10000 then raise exception 'Enter a title and required output';end if;
 if coalesce(details->>'due','')='' then raise exception 'Choose a due date';end if;perform (details->>'due')::date;
 if coalesce(details->>'status','') not in ('To Do','Doing','Blocked','Done') or coalesce(details->>'priority','') not in ('Low','Medium','High','Critical') then raise exception 'Invalid status or priority';end if;
 if details->>'status'='Blocked' and trim(coalesce(details->>'blocker',''))='' then raise exception 'Add a blocker reason';end if;
 if details->>'status'='Done' and trim(coalesce(details->>'evidence',''))='' then raise exception 'Add completion evidence';end if;
 if jsonb_typeof(coalesce(details->'subtasks','[]'))<>'array' or jsonb_array_length(coalesce(details->'subtasks','[]'))>100 then raise exception 'Invalid checklist';end if;
 if coalesce(details->>'recurrence','') not in ('','none','daily','weekly','monthly') then raise exception 'Invalid recurrence';end if;
 if exists(select 1 from jsonb_array_elements_text(coalesce(details->'dependencies','[]')) d where not exists(select 1 from jsonb_array_elements(coalesce(w.data->'tasks','[]')) t where t->>'id'=d and t->>'owner'=mid and coalesce(t->>'project','')='' and d<>details->>'id')) then raise exception 'Choose your own standalone dependencies';end if;
 perform collaboration_validate_members(coalesce(details->'team','[]'),w.organization_id);
 select jsonb_agg(distinct x) into members from jsonb_array_elements(coalesce(details->'team','[]')||jsonb_build_array(mid)) x;
 r:=coalesce(prior,'{}')||jsonb_build_object('id',details->>'id','project','','owner',mid,'createdBy',coalesce(prior->>'createdBy',mid),'team',members,'title',trim(details->>'title'),'output',trim(details->>'output'),'due',details->>'due','status',details->>'status','priority',details->>'priority','blocker',coalesce(details->>'blocker',''),'evidence',coalesce(details->>'evidence',''),'updated',current_date::text,'subtasks',coalesce(details->'subtasks','[]'),'dependencies',coalesce(details->'dependencies','[]'),'recurrence',coalesce(details->>'recurrence','')); 
 if prior is null then w.data:=jsonb_set(w.data,'{tasks}',coalesce(w.data->'tasks','[]')||jsonb_build_array(r));
 else w.data:=jsonb_set(w.data,'{tasks}',(select jsonb_agg(case when x->>'id'=r->>'id' then r else x end) from jsonb_array_elements(w.data->'tasks') x));end if;
 update workspace_states set data=w.data,version=version+1,updated_by=auth.uid() where organization_id=w.organization_id;
 insert into audit_log(organization_id,actor_id,action,entity_type,entity_id,new_data) values(w.organization_id,auth.uid(),'Standalone task saved','tasks',r->>'id',r);
 return r;
end $$;
-- Keep own standalone tasks visible in My Work even with view-only task permissions.
do $$ begin
 if to_regprocedure('public.standalone_original_workspace()') is null then execute replace(pg_get_functiondef('public.get_my_workspace()'::regprocedure),'FUNCTION public.get_my_workspace(', 'FUNCTION public.standalone_original_workspace(');end if;
end $$;
create or replace function public.get_my_workspace() returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;items jsonb;r jsonb;mid text;
begin
 result:=standalone_original_workspace();
 if result is null or not exists(select 1 from profiles where id=auth.uid() and active and role<>'shared') then return result;end if;
 mid:=staff_member_id(auth.uid());items:=coalesce(result#>'{data,tasks}','[]');
 for r in select x from workspace_states w cross join lateral jsonb_array_elements(coalesce(w.data->'tasks','[]')) x where w.organization_id=current_organization_id() and coalesce(x->>'project','')='' and x->>'owner'=mid loop
  if not exists(select 1 from jsonb_array_elements(items) x where x->>'id'=r->>'id') then items:=items||jsonb_build_array(r);end if;
 end loop;
 return jsonb_set(result,'{data,tasks}',items);
end $$;
revoke all on function public.standalone_original_workspace() from public,anon,authenticated;
revoke all on function public.save_standalone_task(jsonb),public.get_my_workspace() from public,anon;
grant execute on function public.save_standalone_task(jsonb),public.get_my_workspace() to authenticated;
notify pgrst,'reload schema';
commit;
