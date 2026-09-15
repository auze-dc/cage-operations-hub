-- Requires migrations 011 and 012. Preserves message contents and membership protection.
begin;
create or replace function public.save_workspace_changes(changes jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare w workspace_states%rowtype;merged jsonb;c jsonb;cur jsonb;items jsonb;k text;rid text;conflicts jsonb='[]';
begin
 if jsonb_typeof(changes)<>'array' then raise exception 'Invalid changes';end if;
 select * into w from workspace_states where organization_id=current_organization_id() for update;if w.organization_id is null then raise exception 'Workspace unavailable';end if;merged=w.data;
 for c in select * from jsonb_array_elements(changes) loop
 k=c->>'key';rid=c->>'id';if k is null or k not in ('requests','projects','tasks','contacts','deals','events','invoices','quotes','expenses','boardLists','leaveRequests','knowledge','messages','chatGroups','missions','assets','compliance','approvals','commercialRecords','opportunityMatches','opportunityMonitor','requestPurposes','team','settings') then raise exception 'Unknown module';end if;
 if module_level(state_module(k))<>'edit' and not (k='approvals' and c->'before'='null'::jsonb and c->'after'->>'status'='Pending' and c->'after'->>'requester'=staff_member_id(auth.uid())) then raise exception 'Edit access required for %',k;end if;
 if rid is not null then
   select x into cur from jsonb_array_elements(coalesce(merged->k,'[]')) x where x->>'id'=rid;
   if cur is not null and not record_visible(k,cur,w.data) then raise exception 'This record is outside your access';end if;
   if c->'after'<>'null'::jsonb and (c->'after'->>'id' is distinct from rid or not record_visible(k,c->'after',merged)) then raise exception 'Assignment is outside your access';end if;
 else cur=merged->k;if not is_admin() then raise exception 'Administrator access required for workspace settings';end if;end if;
 -- Ignore obsolete read-state-only writes from older browser sessions.
 if k='messages' and rid is not null and cur is not null and jsonb_typeof(c->'after')='object' and (cur-'unread')=((c->'after')-'unread') then continue;end if;
 if cur=c->'after' or (c->'before'='null'::jsonb and cur is not null and (cur-'createdBy')=((c->'after')-'createdBy')) then continue;end if;
 if coalesce(cur,'null') is distinct from c->'before' then conflicts=conflicts||jsonb_build_array(jsonb_build_object('key',k,'id',rid,'current',cur));continue;end if;
 if rid is null then merged=jsonb_set(merged,array[k],c->'after');
 else
   select coalesce(jsonb_agg(x),'[]') into items from jsonb_array_elements(coalesce(merged->k,'[]')) x where x->>'id'<>rid;
   if c->'after'<>'null'::jsonb then items=items||jsonb_build_array(c->'after');end if;merged=jsonb_set(merged,array[k],items);
 end if;
 end loop;
 if jsonb_array_length(conflicts)>0 then return jsonb_build_object('conflicts',conflicts);end if;
 update workspace_states set data=merged,version=version+1,updated_by=auth.uid() where organization_id=w.organization_id;
 return jsonb_build_object('ok',true);
end $$;
create or replace function public.preserve_message_read_state() returns trigger language plpgsql security definer set search_path=public as $$
declare msg jsonb;prior jsonb;canonical jsonb='[]';
begin
 if jsonb_typeof(new.data->'messages') is distinct from 'array' then return new;end if;
 for msg in select * from jsonb_array_elements(new.data->'messages') loop
   select x into prior from jsonb_array_elements(coalesce(old.data->'messages','[]')) x where x->>'id'=msg->>'id';
   if prior is not null and (prior-'unread')=(msg-'unread') then msg=prior;end if;
   canonical=canonical||jsonb_build_array(msg);
 end loop;
 new.data=jsonb_set(new.data,'{messages}',canonical);return new;
end $$;
drop trigger if exists aa_preserve_message_read_state on public.workspace_states;
create trigger aa_preserve_message_read_state before update on public.workspace_states for each row execute function public.preserve_message_read_state();

commit;
