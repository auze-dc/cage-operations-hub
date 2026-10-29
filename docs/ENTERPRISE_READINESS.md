# Enterprise readiness tracker

Canonical browser source is `dist/`. Existing root browser files are compatibility mirrors. Edit `dist/`, run `npm run build`, and commit the refreshed mirrors. The check rejects drift. Build does not replace production secrets with placeholders.

## Verified release work

- Project health includes the deadline of an incomplete project even when no tasks exist.
- Repeated historical references show the immutable record ID in the interface; issued numbers are preserved.
- Sign-out offers backup and an explicit choice to clear unsynced/recovery drafts or retain them on a trusted device. Other users' draft keys are never cleared.
- Replaced third-party serve with a localhost-only, read-only development server. Dependencies are pinned; the lockfile is audited in CI.
- Existing canonical frontend mirrored at root and guarded against future drift.

## Operational checks

The Live Hub health workflow checks the Hub, application and careers pages, secure sign-in asset, public careers/training APIs, authentication health and anonymous denial on the private bootstrap endpoint. It runs hourly and on relevant releases, retains status/timing evidence for 30 days and sends failures through normal GitHub Actions notification settings. It creates no applications, messages, payments or other business records. It is an availability smoke test, not a full staff workflow or an uptime guarantee.

For incident response, record the affected module, exact error, timestamp/time zone, affected users and GitHub deployment SHA. Review Cloudflare and Supabase status/logs, distinguish authentication from permission and service errors, preserve unsynced drafts, and validate recovery before closing the incident. Avoid destructive resets or repeated retries of financial writes. Establish a named on-call owner and agreed targets before enterprise sign-off.

The 09:00–12:25 UTC sample on 29 October contained 1,756 successful get_my_workspace reads and three presence heartbeat 401 responses, with no 500-class responses in that sample. Earlier outages remain relevant; one healthy sample does not establish sustained availability or prove their root cause is fixed.

See docs/DISASTER_RECOVERY.md for the recovery test procedure. Detailed operational inventories and restore evidence must remain private.

## Required before an enterprise sign-off

- Each administrator must complete authenticator enrollment on their own device, then verify repeat sign-in and lost-device recovery. A real account-holder enrollment and successful workspace opening have been verified. The MFA interface, Data API guard and restrictive database/storage policies and two service-privileged Edge guards were deployed on 29 October 2026. Isolated tests and rollback-only production role checks passed; these do not replace a real account-holder acceptance test.
- Breached-password protection is enabled and its security-advisor warning has cleared. This checks new or changed passwords; it does not change existing passwords.
- Trace residual auth, notification and background-job errors; validate resource/capacity changes using measurements.
- Approve a historical reference reconciliation mapping; do not renumber sent documents automatically.
- Independent staff/cross-organization tests, browser testing and financial/HR integration tests in isolation.
- Private database and Storage-file backups plus a demonstrated restore in an isolated environment. Validate the actual contents and recovery coverage; database backup metadata does not replace file-byte backups.
- Agreed availability/error/latency targets and an incident-response owner.

Do not describe a passing build or this tracker as proof that every item is complete. See the 29 October 2026 audit for evidence and scope.
