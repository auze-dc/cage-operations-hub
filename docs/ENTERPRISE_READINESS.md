# Enterprise readiness tracker

Canonical browser source is `dist/`. Existing root browser files are compatibility mirrors. Edit `dist/`, run `npm run build`, and commit the refreshed mirrors. The check rejects drift. Build does not replace production secrets with placeholders.

## Verified release work

- Project health includes the deadline of an incomplete project even when no tasks exist.
- Repeated historical references show the immutable record ID in the interface; issued numbers are preserved.
- Sign-out offers backup and an explicit choice to clear unsynced/recovery drafts or retain them on a trusted device. Other users' draft keys are never cleared.
- Replaced third-party serve with a localhost-only, read-only development server. Dependencies are pinned; the lockfile is audited in CI.
- Existing canonical frontend mirrored at root and guarded against future drift.

## Required before an enterprise sign-off

- Administrator MFA enrollment and server-side assurance enforcement, including Edge Functions and recovery.
- Password breach checks if supported by the Supabase plan.
- Trace residual auth, notification and background-job errors; validate resource/capacity changes using measurements.
- Approve a historical reference reconciliation mapping; do not renumber sent documents automatically.
- Independent staff/cross-organization tests, browser testing and financial/HR integration tests in isolation.
- Private database/storage backup plus a demonstrated restore in an isolated environment.
- Agreed availability/error/latency targets and an incident-response owner.

Do not describe a passing build or this tracker as proof that every item is complete. See the 29 October 2026 audit for evidence and scope.
