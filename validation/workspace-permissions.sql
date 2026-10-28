-- Read-only comparison against the original row-by-row permission contract.
begin;
set local statement_timeout='60s';
do $test$
declare u uuid; w jsonb; expected jsonb; actual jsonb; checked integer:=0;
begin
 for u in select id from public.profiles where active loop
  perform set_config('request.jwt.claim.sub',u::text,true);
  select data into w from public.workspace_states where organization_id=public.current_organization_id();
  if w is null then continue;end if;
  if public.module_level(public.state_module('messages'))='none' then expected:='[]';
  else select coalesce(jsonb_agg(x order by ord),'[]') into expected
   from jsonb_array_elements(coalesce(w->'messages','[]')) with ordinality as m(x,ord)
   where public.record_visible('messages',x,w);
  end if;
  actual:=public.collaboration_original_workspace()->'data'->'messages';
  if actual is distinct from expected then raise exception 'Message visibility or order changed';end if;
  checked:=checked+1;
 end loop;
 if checked=0 then raise exception 'No active workspace accounts tested';end if;
end $test$;
do $test$
declare f regprocedure; source text;
begin
 foreach f in array array['payroll_private.write(text,uuid,integer,jsonb)'::regprocedure,'public.company_document_save(uuid,integer,jsonb,jsonb)'::regprocedure] loop
  source:=pg_get_functiondef(f);
  if position('errcode=''40001''' in source)>0 or position('errcode=''PT409''' in source)=0 then raise exception 'Incorrect stale-form conflict contract';end if;
 end loop;
end $test$;
rollback;
select 'PASS: original per-record chat visibility and order for every active workspace account; stale forms use HTTP conflict semantics; no records changed' as result;
