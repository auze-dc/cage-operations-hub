-- Shared reference allocation. Does not renumber or delete historical records.
-- Run the entire file before publishing the frontend. All changes are transactional.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE IF NOT EXISTS public.workspace_number_counters (
 organization_id uuid NOT NULL REFERENCES public.organizations(id), kind text NOT NULL,
 last_value bigint NOT NULL, PRIMARY KEY(organization_id,kind)
);
CREATE TABLE IF NOT EXISTS public.workspace_number_reservations (
 organization_id uuid NOT NULL REFERENCES public.organizations(id), kind text NOT NULL,
 record_id text NOT NULL, number text NOT NULL, PRIMARY KEY(organization_id,kind,record_id),
 UNIQUE(organization_id,kind,number)
);
ALTER TABLE public.workspace_number_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_number_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_number_counters,public.workspace_number_reservations FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.allocate_workspace_number(org uuid,k text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE data jsonb; floor_value bigint; n bigint; pattern text; year_text text;
BEGIN
 IF k NOT IN ('quotes','invoices','requests') OR k IS NULL THEN RAISE EXCEPTION 'Invalid reference kind';END IF;
 -- Same lock order as save_workspace_changes and server-side document creation.
 SELECT w.data INTO data FROM public.workspace_states w WHERE organization_id=org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workspace unavailable';END IF;
 year_text=to_char(now() AT TIME ZONE 'Africa/Blantyre','YYYY');
 pattern=CASE k WHEN 'quotes' THEN '^Q-([0-9]{1,15})$' WHEN 'invoices' THEN '^INV-([0-9]{1,15})$' ELSE '^REQ-'||year_text||'-([0-9]{1,15})$' END;
 SELECT greatest(CASE WHEN k='requests' THEN 0 ELSE 26000 END,coalesce(max(substring(x->>'number' from pattern)::bigint),0))
 INTO floor_value FROM jsonb_array_elements(coalesce(data->k,'[]'::jsonb)) x;
 INSERT INTO public.workspace_number_counters AS c(organization_id,kind,last_value)
 VALUES(org,CASE WHEN k='requests' THEN k||':'||year_text ELSE k END,floor_value+1)
 ON CONFLICT(organization_id,kind) DO UPDATE SET last_value=greatest(c.last_value,floor_value)+1
 RETURNING last_value INTO n;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.allocate_workspace_number(uuid,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.reserve_workspace_number(kind text,record_id text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; result text; n bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active AND role<>'shared') THEN RAISE EXCEPTION 'Active staff required' USING errcode='42501';END IF;
 IF kind IS NULL OR kind NOT IN ('quotes','invoices','requests') OR record_id IS NULL OR length(record_id) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid reference request';END IF;
 IF public.module_level(CASE WHEN kind='requests' THEN 'requests' ELSE 'finance' END) IS DISTINCT FROM 'edit' THEN RAISE EXCEPTION 'Edit access required' USING errcode='42501';END IF;
 org=public.current_organization_id();
 PERFORM 1 FROM public.workspace_states WHERE organization_id=org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workspace unavailable';END IF;
 SELECT r.number INTO result FROM public.workspace_number_reservations r WHERE r.organization_id=org AND r.kind=reserve_workspace_number.kind AND r.record_id=reserve_workspace_number.record_id;
 IF FOUND THEN RETURN result;END IF;
 n=public.allocate_workspace_number(org,kind);
 result=CASE kind WHEN 'quotes' THEN 'Q-'||n WHEN 'invoices' THEN 'INV-'||n ELSE 'REQ-'||to_char(now() AT TIME ZONE 'Africa/Blantyre','YYYY')||'-'||CASE WHEN n<10000 THEN lpad(n::text,4,'0') ELSE n::text END END;
 INSERT INTO public.workspace_number_reservations VALUES(org,kind,record_id,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.reserve_workspace_number(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reserve_workspace_number(text,text) TO authenticated;

-- Keep historical duplicates editable, but prohibit adding another or renumbering.
CREATE OR REPLACE FUNCTION public.guard_workspace_numbers() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE k text;r jsonb;prior jsonb;
BEGIN
 FOREACH k IN ARRAY ARRAY['quotes','invoices','requests'] LOOP
 IF NEW.data->k IS NOT DISTINCT FROM OLD.data->k THEN CONTINUE;END IF;
 FOR r IN SELECT x FROM jsonb_array_elements(coalesce(NEW.data->k,'[]'::jsonb)) x LOOP
  SELECT x INTO prior FROM jsonb_array_elements(coalesce(OLD.data->k,'[]'::jsonb)) x WHERE x->>'id'=r->>'id';
  IF prior IS NOT NULL THEN
   IF prior->>'number' IS DISTINCT FROM r->>'number' THEN RAISE EXCEPTION 'Existing references cannot be changed; create a revision instead';END IF;
   CONTINUE;
  END IF;
  IF coalesce(trim(r->>'number'),'')='' THEN RAISE EXCEPTION 'A reference is required';END IF;
  IF EXISTS(SELECT 1 FROM public.workspace_number_reservations nr WHERE nr.organization_id=NEW.organization_id AND nr.kind=k AND nr.number=r->>'number' AND nr.record_id IS DISTINCT FROM r->>'id') THEN
   RAISE EXCEPTION 'Reference is reserved by another draft. Reload and create a new draft.' USING errcode='23505';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(NEW.data->k,'[]'::jsonb)) x WHERE x->>'number'=r->>'number' AND x->>'id' IS DISTINCT FROM r->>'id') THEN
   RAISE EXCEPTION 'Reference % is already in use. Reload and create a new draft; your existing draft is preserved.',r->>'number' USING errcode='23505';
  END IF;
 END LOOP;END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_guard_workspace_numbers ON public.workspace_states;
CREATE TRIGGER zz_guard_workspace_numbers BEFORE UPDATE OF data ON public.workspace_states FOR EACH ROW EXECUTE FUNCTION public.guard_workspace_numbers();
REVOKE ALL ON FUNCTION public.guard_workspace_numbers() FROM PUBLIC,anon,authenticated;

-- Existing server-side creators must use the same allocator. Abort if versions differ.
CREATE TABLE IF NOT EXISTS public.audit_numbering_function_backup(signature text PRIMARY KEY,definition text NOT NULL,patched text NOT NULL);
ALTER TABLE public.audit_numbering_function_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_numbering_function_backup FROM PUBLIC,anon,authenticated;
DO $patch$
DECLARE target_signature text;ddl text;needle text;replacement text;saved text;
BEGIN
 FOREACH target_signature IN ARRAY ARRAY['public.staff_edit_finance_document(text,jsonb,jsonb)','public.quote_order_action(text,text,jsonb,jsonb,integer)'] LOOP
  IF to_regprocedure(target_signature) IS NULL THEN RAISE EXCEPTION 'Required function missing: %',target_signature;END IF;
  ddl=pg_get_functiondef(to_regprocedure(target_signature));
  SELECT b.patched INTO saved FROM public.audit_numbering_function_backup b WHERE b.signature=target_signature;
  IF FOUND THEN
   IF ddl IS DISTINCT FROM saved THEN RAISE EXCEPTION 'Function changed since numbering update: %',target_signature;END IF;
   CONTINUE;
  END IF;
  IF target_signature LIKE '%staff_edit%' THEN
   needle=$s$select greatest(26000,coalesce(max(substring(x->>'number' from '^Q-([0-9]+)$')::bigint),0))+1 into new_number from jsonb_array_elements(coalesce(w.data->'quotes','[]')) x;$s$;
   replacement=$s$new_number=public.allocate_workspace_number(w.organization_id,'quotes');$s$;
  ELSE
   needle=$s$select greatest(26000,coalesce(max(substring(x->>'number' from '^INV-([0-9]+)$')::bigint),0))+1 into n from jsonb_array_elements(coalesce(w.data->'invoices','[]')) x;$s$;
   replacement=$s$n=public.allocate_workspace_number(w.organization_id,'invoices');$s$;
  END IF;
  IF strpos(ddl,needle)=0 THEN RAISE EXCEPTION 'Unrecognised numbering code: %. Transaction cancelled.',target_signature;END IF;
  INSERT INTO public.audit_numbering_function_backup VALUES(target_signature,ddl,replace(ddl,needle,replacement));
  EXECUTE replace(ddl,needle,replacement);
 END LOOP;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
