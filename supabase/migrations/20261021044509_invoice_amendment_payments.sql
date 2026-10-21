-- Allow ledger-backed payment totals on invoices with tracked amendments.
-- All commercial content, identity and order linkage remain compared in full.
DO $payment_fix$
DECLARE
  ddl text;
  old_check text := '(e.new_record - ARRAY[''status'',''sentAt'',''recipient'']) = (i - ARRAY[''status'',''sentAt'',''recipient''])';
  new_check text := $check$(
    (e.new_record - ARRAY['status','sentAt','recipient','paidAmount'])
      = (i - ARRAY['status','sentAt','recipient','paidAmount'])
    AND (
      i->'paidAmount' IS NOT DISTINCT FROM e.new_record->'paidAmount'
      OR i->'paidAmount' = to_jsonb((
        SELECT coalesce(sum(p.amount),0)
        FROM public.invoice_payments p
        WHERE p.organization_id = new.organization_id
          AND p.invoice_id = i->>'id'
      ))
    )
  )$check$;
BEGIN
  SELECT pg_get_functiondef('public.protect_quote_order()'::regprocedure) INTO ddl;
  IF strpos(ddl, old_check) > 0 THEN
    EXECUTE replace(ddl, old_check, new_check);
  ELSIF strpos(ddl, new_check) = 0 THEN
    RAISE EXCEPTION 'Unexpected invoice guard definition; payment fix was not applied';
  END IF;
END $payment_fix$;
