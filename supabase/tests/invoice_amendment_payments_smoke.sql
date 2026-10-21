-- Run against the existing internal QA invoice, rolling back every test write.
BEGIN;
DO $regression$
DECLARE
  w public.workspace_states%rowtype;
  invoice jsonb;
  actor uuid;
  first_payment uuid;
  duplicate_payment uuid;
  final_payment uuid;
  position integer;
  rejected boolean;
BEGIN
  SELECT s.* INTO w FROM public.workspace_states s WHERE EXISTS(
    SELECT 1 FROM jsonb_array_elements(s.data->'invoices') x
    WHERE x->>'number'='INV-26012' AND x->>'client'='DC Workflow Test — Internal QA');
  SELECT x INTO invoice FROM jsonb_array_elements(w.data->'invoices') x WHERE x->>'number'='INV-26012';
  IF invoice IS NULL OR (invoice->>'amount')::numeric<>1000
    OR EXISTS(SELECT 1 FROM public.invoice_payments WHERE organization_id=w.organization_id AND invoice_id=invoice->>'id')
  THEN RAISE EXCEPTION 'Expected unpaid internal QA invoice'; END IF;
  SELECT id INTO actor FROM public.profiles
    WHERE organization_id=w.organization_id AND email='alexander@cagemw.com' AND active;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  first_payment=public.record_payment_with_receipt(invoice->>'id',400,
    (now() at time zone 'Africa/Blantyre')::date,'TEST-ROLLBACK-AMENDED-PARTIAL','Other',null);
  duplicate_payment=public.record_payment_with_receipt(invoice->>'id',400,
    (now() at time zone 'Africa/Blantyre')::date,'TEST-ROLLBACK-AMENDED-PARTIAL','Other',null);
  IF duplicate_payment IS DISTINCT FROM first_payment THEN RAISE EXCEPTION 'Duplicate payment was not idempotent'; END IF;
  SELECT x INTO invoice FROM public.workspace_states s CROSS JOIN LATERAL jsonb_array_elements(s.data->'invoices') x
    WHERE s.organization_id=w.organization_id AND x->>'number'='INV-26012';
  IF invoice->>'status'<>'Sent' OR (invoice->>'paidAmount')::numeric<>400 THEN RAISE EXCEPTION 'Partial payment state incorrect'; END IF;
  final_payment=public.record_payment_with_receipt(invoice->>'id',600,
    (now() at time zone 'Africa/Blantyre')::date,'TEST-ROLLBACK-AMENDED-FINAL','Other',null);
  IF (public.get_payment_receipt(final_payment)->>'balance')::numeric<>0 THEN RAISE EXCEPTION 'Receipt balance incorrect'; END IF;
  SELECT x, ord-1 INTO invoice, position FROM public.workspace_states s
    CROSS JOIN LATERAL jsonb_array_elements(s.data->'invoices') WITH ORDINALITY a(x,ord)
    WHERE s.organization_id=w.organization_id AND x->>'number'='INV-26012';
  IF invoice->>'status'<>'Paid' OR (invoice->>'paidAmount')::numeric<>1000 THEN RAISE EXCEPTION 'Full payment state incorrect'; END IF;
  rejected=false;
  BEGIN
    PERFORM public.record_payment_with_receipt(invoice->>'id',1,
      (now() at time zone 'Africa/Blantyre')::date,'TEST-ROLLBACK-OVERPAY','Other',null);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Payment exceeds the outstanding balance%' THEN RAISE; END IF;
    rejected=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Overpayment was accepted'; END IF;
  rejected=false;
  BEGIN
    UPDATE public.workspace_states SET data=jsonb_set(data,array['invoices',position::text],
      invoice||'{"description":"Untracked scope change"}'::jsonb) WHERE organization_id=w.organization_id;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Use Edit to save a tracked invoice amendment%' THEN RAISE; END IF;
    rejected=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Untracked commercial change was accepted'; END IF;
  rejected=false;
  BEGIN
    UPDATE public.workspace_states SET data=jsonb_set(data,array['invoices',position::text],
      invoice||'{"paidAmount":999}'::jsonb) WHERE organization_id=w.organization_id;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Use Edit to save a tracked invoice amendment%' THEN RAISE; END IF;
    rejected=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Payment total unrelated to ledger was accepted'; END IF;
END $regression$;
ROLLBACK;
SELECT 'PASS: partial payment, idempotency, settlement, receipt, overpayment rejection, commercial lock and ledger validation; all test writes rolled back' AS result;
