-- Staff may run discovery without gaining edit or organisation scan-settings access.
ALTER TABLE public.opportunity_matches DROP CONSTRAINT IF EXISTS opportunity_matches_opportunity_type_check;
ALTER TABLE public.opportunity_matches ADD CONSTRAINT opportunity_matches_opportunity_type_check
 CHECK (opportunity_type IN ('Grant','Tender / RFQ','Contract','Partnership','Fellowship / Training','Award / Competition'));
ALTER TABLE public.opportunity_scan_runs ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES public.profiles(id);
DO $patch$
DECLARE ddl text; old_check text := $old$'canScan',opportunity_access(true) and exists(select 1 from profiles where id=auth.uid() and role in ('admin','manager')),$old$;
 new_check text := $new$'canScan',opportunity_access(),
 'canManageScan',opportunity_access(true) and exists(select 1 from profiles where id=auth.uid() and role in ('admin','manager')),$new$;
BEGIN
 SELECT pg_get_functiondef('public.opportunity_dashboard()'::regprocedure) INTO ddl;
 IF strpos(ddl,old_check)>0 THEN EXECUTE replace(ddl,old_check,new_check);
 ELSIF strpos(ddl,new_check)=0 THEN RAISE EXCEPTION 'Unexpected opportunity dashboard definition'; END IF;
END $patch$;
NOTIFY pgrst,'reload schema';
