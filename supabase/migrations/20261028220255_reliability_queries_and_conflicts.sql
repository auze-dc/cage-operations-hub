-- Reduce duplicate permission work without changing record visibility.
CREATE OR REPLACE FUNCTION public.collaboration_original_workspace()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare w workspace_states%rowtype;result jsonb='{}';k text;v jsonb;filtered jsonb;
begin
 select * into w from workspace_states where organization_id=current_organization_id();if w.organization_id is null then return null;end if;
 for k,v in select * from jsonb_each(w.data) loop
 if module_level(state_module(k))='none' then filtered=case when jsonb_typeof(v)='array' then '[]'::jsonb else '{}'::jsonb end;
 elsif k='messages' and jsonb_typeof(v)='array' then
 -- Message visibility depends on the thread and effective owner. Evaluate each
 -- distinct permission input once, retaining the original rows and their order.
 with messages as materialized (
   select x, ord, jsonb_build_object(
     'thread',x->'thread','owner',x->'owner','requester',x->'requester',
     'person',x->'person','custodian',x->'custodian',
     'sender',x->'sender','createdBy',x->'createdBy') as permission_input
   from jsonb_array_elements(v) with ordinality as m(x,ord)
 ), inputs as materialized (select distinct permission_input from messages),
 decisions as materialized (
   select permission_input, record_visible('messages',permission_input,w.data) as allowed from inputs
 )
 select coalesce(jsonb_agg(m.x order by m.ord),'[]'::jsonb) into filtered
 from messages m join decisions d using(permission_input) where d.allowed;
 elsif jsonb_typeof(v)='array' then select coalesce(jsonb_agg(x),'[]') into filtered from jsonb_array_elements(v) x where record_visible(k,x,w.data);
 else filtered=v;end if;
 result=result||jsonb_build_object(k,filtered);
 end loop;
 if not is_admin() then result=jsonb_set(result,'{settings}',coalesce(result->'settings','{}')-'opportunityApiKey'-'emailApiKey');end if;
 -- Reset metadata is shared with all authorised workspace readers.
 result=jsonb_set(result,'{_resetEpoch}',coalesce(w.data->'_resetEpoch','null'::jsonb));
 return jsonb_build_object('version',w.version,'data',result);
end $function$;

-- Optimistic form conflicts are HTTP 409, not database serialization failures.
-- SQLSTATE 40001 can cause automatic transaction retries in the API layer.
DO $migration$
declare f regprocedure; source text;
begin
 foreach f in array array['payroll_private.write(text,uuid,integer,jsonb)'::regprocedure,'public.company_document_save(uuid,integer,jsonb,jsonb)'::regprocedure] loop
  source:=pg_get_functiondef(f);
  if position('errcode=''40001''' in source)=0 then raise exception 'Expected conflict guard missing in %',f;end if;
  execute replace(source,'errcode=''40001''','errcode=''PT409''');
 end loop;
end $migration$;

-- Reject other users' rows before running expensive linked-record checks.
DO $migration$
declare prior text;
begin
 select qual into prior from pg_policies where schemaname='public' and tablename='personal_notifications' and policyname='scoped_notifications';
 if prior is null then raise exception 'Notification scope policy missing';end if;
 execute format('alter policy scoped_notifications on public.personal_notifications using (case when user_id=(select auth.uid()) then (%s) else false end)',prior);
end $migration$;

ALTER FUNCTION public.state_module(text) SET search_path='';
ALTER FUNCTION public.academy_intake_revision() SET search_path='';
ALTER FUNCTION public.hub_file_notice(text) SET search_path='';
ALTER FUNCTION public.manageable_record_tables() SET search_path='';
