-- Delete quotes/invoices from active work; retain historical business records.
BEGIN;
SET LOCAL lock_timeout='5s';
LOCK TABLE public.workspace_states IN SHARE ROW EXCLUSIVE MODE;
ALTER TABLE public.record_deletion_log ADD COLUMN IF NOT EXISTS retained_finance boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS finance_deletion_lookup ON public.record_deletion_log(organization_id,kind,record_id) WHERE kind IN ('quotes','invoices');
-- Keep original entry points private; preserve existing role and visibility checks.
DO $install$
BEGIN
 IF to_regprocedure('public.finance_delete_original_workspace()') IS NULL THEN
  EXECUTE replace(pg_get_functiondef('public.get_my_workspace()'::regprocedure),'FUNCTION public.get_my_workspace(', 'FUNCTION public.finance_delete_original_workspace(');
 END IF;
 IF to_regprocedure('public.finance_delete_original_order_read(text)') IS NULL THEN
  EXECUTE replace(pg_get_functiondef('public.quote_order_read(text)'::regprocedure),'FUNCTION public.quote_order_read(', 'FUNCTION public.finance_delete_original_order_read(');
 END IF;
 IF to_regprocedure('public.finance_delete_original_delete(text,text,jsonb)') IS NULL THEN
  EXECUTE replace(pg_get_functiondef('public.delete_workspace_record(text,text,jsonb)'::regprocedure),'FUNCTION public.delete_workspace_record(', 'FUNCTION public.finance_delete_original_delete(');
 END IF;
END $install$;
REVOKE ALL ON FUNCTION public.finance_delete_original_workspace(),public.finance_delete_original_order_read(text),public.finance_delete_original_delete(text,text,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_my_workspace() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE result jsonb;k text;items jsonb;org uuid;floor_value numeric;floors jsonb='{}';
BEGIN
 result=public.finance_delete_original_workspace();org=public.current_organization_id();
 FOREACH k IN ARRAY ARRAY['quotes','invoices'] LOOP
  IF jsonb_typeof(result->'data'->k)='array' THEN
   SELECT greatest(26000,coalesce(max(nullif(regexp_replace(x->>'number','[^0-9]','','g'),'')::numeric),26000)) INTO floor_value FROM jsonb_array_elements(result->'data'->k) x;
   floors=jsonb_set(floors,ARRAY[k],to_jsonb(floor_value));
   SELECT coalesce(jsonb_agg(x ORDER BY n),'[]'::jsonb) INTO items
   FROM jsonb_array_elements(result->'data'->k) WITH ORDINALITY a(x,n)
   WHERE NOT EXISTS(SELECT 1 FROM public.record_deletion_log d WHERE d.organization_id=org AND d.kind=k AND d.record_id=x->>'id');
   result=jsonb_set(result,ARRAY['data',k],items);
  END IF;
 END LOOP;
 RETURN result||jsonb_build_object('financeNumberFloor',floors);
END $fn$;
REVOKE ALL ON FUNCTION public.get_my_workspace() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_workspace() TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_workspace_record(kind text,rid text,expected jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE w public.workspace_states;item jsonb;receipt uuid;
BEGIN
 IF kind NOT IN ('quotes','invoices') OR kind IS NULL THEN
  RETURN public.finance_delete_original_delete(kind,rid,expected);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active AND role<>'shared') OR public.module_level('finance') IS DISTINCT FROM 'edit' THEN
  RAISE EXCEPTION 'An active staff account with finance edit access is required' USING errcode='42501';
 END IF;
 SELECT * INTO w FROM public.workspace_states WHERE organization_id=public.current_organization_id() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workspace unavailable';END IF;
 SELECT x INTO item FROM jsonb_array_elements(coalesce(w.data->kind,'[]')) x WHERE x->>'id'=rid;
 IF item IS NULL OR NOT public.record_visible(kind,item,w.data) THEN RAISE EXCEPTION 'Record is outside your access' USING errcode='42501';END IF;
 SELECT id INTO receipt FROM public.record_deletion_log d WHERE d.organization_id=w.organization_id AND d.kind=delete_workspace_record.kind AND d.record_id=rid AND d.retained_finance LIMIT 1;
 IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 IF item IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Record changed. Refresh and review it before deleting.';END IF;
 receipt=gen_random_uuid();
 INSERT INTO public.record_deletion_log(id,organization_id,actor_id,kind,record_id,snapshot,retained_finance)
 VALUES(receipt,w.organization_id,auth.uid(),kind,rid,item,true);
 -- No document or dependent rows are removed. Version change refreshes other staff.
 UPDATE public.workspace_states SET version=version+1,updated_by=auth.uid() WHERE organization_id=w.organization_id;
 INSERT INTO public.audit_log(organization_id,actor_id,action,entity_type,entity_id,old_data,new_data)
 VALUES(w.organization_id,auth.uid(),'document.deleted',kind,rid,item,jsonb_build_object('receipt',receipt,'historyRetained',true));
 RETURN receipt;
END $fn$;
REVOKE ALL ON FUNCTION public.delete_workspace_record(text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_workspace_record(text,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.quote_order_read(qid text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE result jsonb;org uuid;
BEGIN
 result=public.finance_delete_original_order_read(qid);org=public.current_organization_id();
 RETURN result||jsonb_build_object('quoteDeleted',EXISTS(SELECT 1 FROM public.record_deletion_log WHERE organization_id=org AND kind='quotes' AND record_id=qid),
 'invoiceDeleted',EXISTS(SELECT 1 FROM public.record_deletion_log WHERE organization_id=org AND kind='invoices' AND record_id=result->'invoice'->>'id'));
END $fn$;
REVOKE ALL ON FUNCTION public.quote_order_read(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quote_order_read(text) TO authenticated;

-- A stale tab cannot overwrite or physically remove retained history.
CREATE OR REPLACE FUNCTION public.protect_deleted_finance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE d record;prior jsonb;next_record jsonb;
BEGIN
 FOR d IN SELECT kind,record_id FROM public.record_deletion_log WHERE organization_id=new.organization_id AND retained_finance LOOP
  IF new.data->d.kind IS NOT DISTINCT FROM old.data->d.kind THEN CONTINUE;END IF;
  SELECT x INTO prior FROM jsonb_array_elements(coalesce(old.data->d.kind,'[]')) x WHERE x->>'id'=d.record_id;
  SELECT x INTO next_record FROM jsonb_array_elements(coalesce(new.data->d.kind,'[]')) x WHERE x->>'id'=d.record_id;
  IF (prior-ARRAY['status','sentAt','recipient']) IS DISTINCT FROM (next_record-ARRAY['status','sentAt','recipient']) THEN
   RAISE EXCEPTION 'This document was deleted. Refresh to see the current list.';
  END IF;
 END LOOP;
 RETURN new;
END $fn$;
REVOKE ALL ON FUNCTION public.protect_deleted_finance() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS ab_protect_deleted_finance ON public.workspace_states;
CREATE TRIGGER ab_protect_deleted_finance BEFORE UPDATE OF data ON public.workspace_states FOR EACH ROW EXECUTE FUNCTION public.protect_deleted_finance();

CREATE TABLE IF NOT EXISTS public.cage_finance_delete_backup_20261008(signature text PRIMARY KEY,original_definition text NOT NULL);
ALTER TABLE public.cage_finance_delete_backup_20261008 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cage_finance_delete_backup_20261008 FROM PUBLIC,anon,authenticated;
DO $patch$
DECLARE e record;src text;ddl text;patched text;
BEGIN
 FOR e IN SELECT key,value FROM jsonb_each_text($guards${"public.prepare_staff_invoice_send(jsonb)": "PERFORM 1 FROM public.workspace_states WHERE organization_id=public.current_organization_id() FOR UPDATE; IF EXISTS(SELECT 1 FROM public.record_deletion_log WHERE organization_id=public.current_organization_id() AND kind='invoices' AND record_id=doc_record->>'id') THEN RAISE EXCEPTION 'This document was deleted. Refresh to see the current list.';END IF;", "public.prepare_staff_quote_send(jsonb)": "PERFORM 1 FROM public.workspace_states WHERE organization_id=public.current_organization_id() FOR UPDATE; IF EXISTS(SELECT 1 FROM public.record_deletion_log WHERE organization_id=public.current_organization_id() AND kind='quotes' AND record_id=doc_record->>'id') THEN RAISE EXCEPTION 'This document was deleted. Refresh to see the current list.';END IF;", "public.register_document_send_v2(jsonb)": "PERFORM 1 FROM public.workspace_states WHERE organization_id=(entry->>'organization_id')::uuid FOR UPDATE; IF EXISTS(SELECT 1 FROM public.record_deletion_log WHERE organization_id=(entry->>'organization_id')::uuid AND kind=CASE WHEN entry->>'document_type'='quote' THEN 'quotes' ELSE 'invoices' END AND record_id=entry->>'document_id') THEN RAISE EXCEPTION 'This document was deleted and cannot be sent.';END IF;", "public.quote_response_v2(text,text,text,text)": "PERFORM 1 FROM public.workspace_states WHERE organization_id=(SELECT organization_id FROM public.document_sends_v2 WHERE token_hash=link_hash) FOR UPDATE; IF EXISTS(SELECT 1 FROM public.document_sends_v2 delivery_row JOIN public.record_deletion_log deletion_row ON deletion_row.organization_id=delivery_row.organization_id AND deletion_row.record_id=delivery_row.document_id AND deletion_row.kind='quotes' WHERE delivery_row.token_hash=link_hash) THEN RAISE EXCEPTION 'This quotation is no longer available. Please contact CAGE.';END IF;", "public.edit_finance_document(text,jsonb,jsonb)": "PERFORM 1 FROM public.workspace_states WHERE organization_id=public.current_organization_id() FOR UPDATE; IF EXISTS(SELECT 1 FROM public.record_deletion_log WHERE organization_id=public.current_organization_id() AND kind=CASE WHEN doc_type='quote' THEN 'quotes' ELSE 'invoices' END AND record_id=expected_record->>'id') THEN RAISE EXCEPTION 'This document was deleted. Refresh to see the current list.';END IF;", "public.staff_edit_finance_document(text,jsonb,jsonb)": "PERFORM 1 FROM public.workspace_states WHERE organization_id=public.current_organization_id() FOR UPDATE; IF EXISTS(SELECT 1 FROM public.record_deletion_log WHERE organization_id=public.current_organization_id() AND kind=CASE WHEN doc_type='quote' THEN 'quotes' ELSE 'invoices' END AND record_id=expected_record->>'id') THEN RAISE EXCEPTION 'This document was deleted. Refresh to see the current list.';END IF;", "public.quote_order_action(text,text,jsonb,jsonb,integer)": "PERFORM 1 FROM public.workspace_states WHERE organization_id=public.current_organization_id() FOR UPDATE; IF EXISTS(SELECT 1 FROM public.record_deletion_log WHERE organization_id=public.current_organization_id() AND kind='quotes' AND record_id=qid) THEN RAISE EXCEPTION 'This quotation was deleted. Its order remains in history.';END IF;", "public.record_payment(text,numeric,date,text,text)": "PERFORM 1 FROM public.workspace_states WHERE organization_id=public.current_organization_id() FOR UPDATE; IF EXISTS(SELECT 1 FROM public.record_deletion_log WHERE organization_id=public.current_organization_id() AND kind='invoices' AND record_id=invoice_key) THEN RAISE EXCEPTION 'This invoice was deleted. Existing payments and receipts remain available.';END IF;"}$guards$::jsonb) LOOP
  SELECT prosrc,pg_get_functiondef(oid) INTO src,ddl FROM pg_proc WHERE oid=to_regprocedure(e.key);
  IF NOT FOUND THEN IF e.key='public.prepare_staff_quote_send(jsonb)' THEN CONTINUE;END IF;RAISE EXCEPTION 'Required function missing: %',e.key;END IF;
  IF strpos(src,'-- cage-finance-deletion-20261008')>0 THEN CONTINUE;END IF;
  INSERT INTO public.cage_finance_delete_backup_20261008 VALUES(e.key,ddl) ON CONFLICT DO NOTHING;
  patched=regexp_replace(src,'\mbegin\M','begin'||chr(10)||'-- cage-finance-deletion-20261008'||chr(10)||e.value||chr(10),'i');
  IF patched=src THEN RAISE EXCEPTION 'Unexpected function format: %',e.key;END IF;
  EXECUTE replace(ddl,src,patched);
 END LOOP;
END $patch$;
-- Include the send-status correction; supports installation before or after the hotfix.
DO $sendfix$
DECLARE src text;ddl text;new_check text := '(e.new_record - ARRAY[''status'',''sentAt'',''recipient'']) = (i - ARRAY[''status'',''sentAt'',''recipient''])';
BEGIN
 SELECT prosrc,pg_get_functiondef(oid) INTO src,ddl FROM pg_proc WHERE oid='public.protect_quote_order()'::regprocedure;
 IF strpos(src,'e.new_record=i')>0 THEN
  INSERT INTO public.cage_finance_delete_backup_20261008 VALUES('public.protect_quote_order()',ddl) ON CONFLICT DO NOTHING;
  EXECUTE replace(ddl,'e.new_record=i',new_check);
 ELSIF strpos(src,new_check)=0 THEN RAISE EXCEPTION 'Install the staff workflow update first.';END IF;
END $sendfix$;
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT 'Quote and invoice deletion installed; linked history retained' AS result;
