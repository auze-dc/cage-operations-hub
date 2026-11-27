-- Installing this job never enables delivery. The org has no enabled row and Vault has no values by default.
select cron.schedule('cage-payroll-email-dispatch','* * * * *',$payroll_cron$
  select net.http_post(
    url:=rtrim(endpoint.decrypted_secret,'/')||'/functions/v1/payroll-email-dispatch',
    headers:=jsonb_build_object('Content-Type','application/json','x-payroll-email-secret',key.decrypted_secret),
    body:='{"mode":"dispatch"}'::jsonb,timeout_milliseconds:=45000
  )
  from vault.decrypted_secrets endpoint
  cross join vault.decrypted_secrets key
  where endpoint.name='payroll_email_project_url' and key.name='payroll_email_cron_secret'
    and endpoint.decrypted_secret ~ '^https://[a-z0-9]+[.]supabase[.]co/?$'
    and length(key.decrypted_secret)>=32
    and exists (select 1 from public.payroll_email_deliveries d
      join public.payroll_email_settings s on s.organization_id=d.organization_id
      where s.enabled and d.status in ('queued','sending'));
$payroll_cron$);
