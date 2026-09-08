-- Keep the existing authenticated opportunity-scan job, but run it only on weekdays.
-- 05:00 UTC is 07:00 in Malawi (CAT, UTC+2).
create extension if not exists pg_cron;

update cron.job
set schedule = '0 5 * * 1-5'
where jobname = 'cage-daily-opportunity-scan';

comment on extension pg_cron is
  'CAGE opportunity discovery runs at 07:00 CAT every Monday through Friday.';
