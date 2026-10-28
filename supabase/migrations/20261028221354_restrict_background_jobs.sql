-- Compatibility verified against the LIVE deployed Edge Function sources:
-- academy-admissions uses its service-role admin client for rate/submission/payment RPCs.
-- staff-email-dispatch uses its service-role db client for scoped workspace/enqueue/claim.
-- enrollment-email-dispatch uses its service-role db client for claim/prepare RPCs.
-- stem-intake uses its service-role admin client for ingest.
-- No browser file calls these RPCs; public forms call academy-admissions instead.
-- The original migrations 015/016/017/018 and setup/RUN_THIS_ONCE_DATABASE.sql
-- explicitly intend these RPCs for service_role. Restore that existing boundary.
-- All 11 currently retain service_role EXECUTE. No public Edge Function is disabled.
-- These RPCs are called only by authenticated server-side Edge Functions/cron.
-- Revoking PUBLIC alone does not remove explicit Supabase anon/authenticated grants.
DO $migration$
declare f regprocedure;
begin
 foreach f in array array[
  'public.claim_enrollment_email()'::regprocedure,
  'public.claim_staff_email()'::regprocedure,
  'public.enqueue_staff_email(uuid,uuid[],date,text,text,jsonb)'::regprocedure,
  'public.email_scoped_workspace(uuid)'::regprocedure,
  'public.claim_academy_payment_reminders()'::regprocedure,
  'public.prepare_academy_payment_reminder(uuid)'::regprocedure,
  'public.dispatch_personal_reminders()'::regprocedure,
  'public.academy_intake_rate(text,integer,integer)'::regprocedure,
  'public.submit_academy_application(jsonb,jsonb)'::regprocedure,
  'public.add_academy_payment(uuid,text,jsonb)'::regprocedure,
  'public.ingest_stem_response(uuid,text,text,timestamptz,text,jsonb)'::regprocedure
 ] loop
  if not has_function_privilege('service_role',f,'execute') then raise exception 'Server access missing for %',f;end if;
  execute format('revoke execute on function %s from public,anon,authenticated',f);
  execute format('grant execute on function %s to service_role',f);
 end loop;
end $migration$;
