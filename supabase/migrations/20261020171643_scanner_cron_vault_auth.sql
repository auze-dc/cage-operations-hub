-- Scanner-only credential. Generated inside Postgres; never returned to a client.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name='cage_opportunity_scan_cron_secret') THEN
  PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),
    'cage_opportunity_scan_cron_secret','Authentication for CAGE opportunity scanner only');
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.verify_opportunity_cron_token(token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN token ~ '^[0-9a-f]{64}$' THEN EXISTS (
  SELECT 1 FROM vault.decrypted_secrets s
  WHERE s.name='cage_opportunity_scan_cron_secret'
  AND s.decrypted_secret=token
 ) ELSE false END;
$$;
REVOKE ALL ON FUNCTION public.verify_opportunity_cron_token(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_opportunity_cron_token(text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
