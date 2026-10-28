# Reliability audit — 28 October 2026

## Observed failures and repairs

Production logs in the preceding 24 hours contained 2,382 HTTP 500 responses for personal notifications and 688 for workspace loads. Database traces showed repeated workspace JSON permission scans. A notification SELECT took 3,182.829 ms; the repaired policy and own-user query took 303.309 ms in the measured administrator session. These are individual database measurements, not end-to-end latency guarantees.

Workspace permission filtering now evaluates each distinct message thread/ownership input once and preserves message order. In a rollback-only comparison, all seven active accounts received exactly the same complete workspace JSON before and after the change. Average execution fell from 3,694.90 ms to 787.84 ms. `validation/workspace-permissions.sql` independently compares the optimized messages with the original per-record visibility contract.

Browser background reads now avoid overlap even after resubscription, back off on failure, pause offline, and cache module permissions for one minute. Notification/reminder reads have explicit owner filters and 15-second deadlines. Old-session responses are ignored; a requested refresh is queued behind an existing personal-data read. Sign-out clears the personal notification cache. Temporary HTTP 500 access checks preserve the open session; 401/403 still close it. The obsolete “Install Hub 14” network error was removed.

Expected payroll and company-document revision conflicts use SQLSTATE PT409 (HTTP conflict) instead of reserved serialization failure 40001. Forms retain their conflict messages; stale writes remain rejected. Genuine database serialization handling is unchanged.

Eleven server-only background/admissions RPCs had explicit anon/authenticated grants despite original migrations intending service-role use. Live deployed Edge Function sources confirmed the service-role callers before revocation. Server access is retained, and the public admissions Edge Function remains the public gateway. Four pure helper functions now have fixed search paths.

## Verification

- Syntax, required assets, duplicate HTML IDs, production build and whitespace checks passed.
- Slow-request overlap, backoff, offline pause, recovery banners, old-session results, own-user queries, timeout signals, temporary access failure and revocation regression checks passed.
- Isolated SQL permission test verifies all 11 internal RPCs deny anonymous/staff calls and retain server execution; a separate public-token endpoint remains accessible.
- Payroll browser tests passed: editing, reviewed submission, payment payload/idempotency key, staff-only payslip view, printing, mobile layout and sign-out clearing.
- Production rollback-only payroll and company-document integration tests passed, including stale edits, overpayment rejection, payment retries, immutable approved amounts, audit history and cross-organization isolation. No test records persisted.
- Application directory/mobile form, private return link and email-link refresh recovery browser tests passed. Historical test selectors and fixed past-date inputs were updated to current UI behavior.
- Financial number allocation, amount validation, document DOM tests, email-dispatch mocks and opportunity access/auth/scope tests passed. No test emails were sent.
- Every pull request now runs the reliability regression workflow; deployment also gates on background reliability and runtime configuration tests. Payroll retains its separate browser CI workflow.

## Boundaries

This addresses reproduced query, concurrency, recovery and access-control faults. It is not a guarantee that every workflow is defect-free. Live navigation is checked after deployment; financial/HR write workflows are verified with rollback fixtures and mocked browser data. Third-party delivery, browser location permissions and infrastructure outages remain external dependencies. Review production error logs after normal staff usage and rerun the rollback SQL checks whenever permission or payroll functions change.
