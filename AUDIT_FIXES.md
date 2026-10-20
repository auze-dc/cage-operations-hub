# CAGE audit fixes — 20 October 2026

Prepared against GitHub main commit 1ef31936f2c15aa19aba979125e8300acc68719f.
Local regression tests passed. On 20 October 2026 the shared numbering migration was applied to production and opportunity-scan version 19 was deployed. Frontend publication follows this PR merge.

## Changes
- New quote, invoice and request references are reserved in the database and reused on retry. Server-side invoice conversion and quote revision share the allocator. Existing references remain unchanged. Historical duplicates remain editable; new duplicates are rejected.
- Quote/invoice unit prices accept 1,100,000 and 1100000.50, validate grouping, and calculate numeric totals.
- Completed projects are excluded from active My Work responsibilities.
- Requests no longer display the obsolete approval requirement. This is a wording correction; no authorization rules are disabled.
- Invoice, expense and mission project selectors have the correct project prompt.
- Opportunity scanning resolves generic link titles from the notice page and flags historical notices. Discover hides generic/historical unverified notices; All retains the records. Older records are rechecked, with tracked applications prioritized.
- The workspace shows a warning when the latest scan is over 36 hours old, or scanning is paused.

## Deployment order
1. In the repository, install this package using its install.py (below), then run npm run check. Review git diff and git status.
2. In the correct Supabase project's SQL Editor, run the ENTIRE file supabase/migrations/20261020190000_audit_numbering.sql. It is transactional and version-checked. If it reports any error, stop: do not publish the frontend. Share the exact error. Do not delete the version checks.
3. Deploy the scanner from the repository terminal:
   npx supabase functions deploy opportunity-scan --use-api --no-verify-jwt
   The existing function still checks the signed-in user or the cron secret internally.
4. Commit the changed application files, SQL, scripts/check.mjs, validation/audit-reliability.mjs and this note on a feature branch; push, review and merge into main. Wait for Cloudflare Pages production deployment to succeed. The SQL or Edge deploy alone does not publish the frontend.
5. Reload the Hub. Create a draft quote and invoice, check comma-formatted amounts and unique references, edit the draft, refresh, and verify persistence. Use test records only; do not send emails for testing. Check My Work and opportunity scan warnings.

## Outstanding live investigation
The last scan observed during the audit was 7 October. Live inspection confirmed that cron job 1 still contained YOUR_PROJECT_REF and YOUR_CRON_SECRET placeholders. The destination URL has been corrected. The secret placeholder remains and must be replaced with the configured opportunity scanner CRON_SECRET through the normal Supabase secret-management flow. Automatic approval review blocked Vault secret inventory; no secret was read or changed. Run supabase/setup/AUDIT_SCAN_DIAGNOSTICS.sql and compare with opportunity-scan Edge Function invocation logs. A cron success can mean only that an HTTP request was queued. Do not publish cron commands or secrets. Source HTTP 403s still require an alternative supported feed or manual review; the patch does not bypass them.

## Validation performed
npm run check passed. PostgreSQL-compatible PGlite tests passed for applying the migration twice, reservation retries, multiple distinct reservations, shared server allocation, historical duplicate edits, new duplicate rejection, reservation theft rejection, reference immutability, request sequence overflow and inactive staff rejection. Tests use stubs for existing helpers, so they do not replace verification against production policies/triggers. jsdom tested quote and invoice total calculation, malformed grouping rejection, and formatting. Scanner unit tests cover generic titles and historical notices. No production emails were sent by these tests.

To reproduce optional regression tests:
  npm install --prefix /tmp/cage-audit-tests --no-audit --no-fund @electric-sql/pglite jsdom
  CAGE_TEST_MODULES=/tmp/cage-audit-tests/node_modules node validation/audit-reliability.mjs

## Package installation
Download CAGE_Audit_Reliability_Fixes.zip and upload it to the Codespace repository folder first. Then:
  unzip CAGE_Audit_Reliability_Fixes.zip
  python3 cage-audit-fixes/install.py
  npm run check

The installer checks every destination against the source version before changing any file. If a destination differs, it stops rather than overwriting newer work. Backups are written outside the repository. It never modifies runtime-config.js, secrets, or existing business records. Installation does not commit, run SQL, deploy or send messages.
