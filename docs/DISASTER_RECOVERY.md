# Recovery test procedure

This procedure describes acceptance requirements. It is not a completed recovery exercise. Keep inventory, object names/counts, storage sizes, backup timestamps, user details, credentials and test evidence in a private operational record, outside this public repository.

## Isolation before restore

Review the provider's current clone/restore behavior before choosing a target. A physical restore can include cron jobs and extensions that call external services. Supabase documents that binary-clone jobs start immediately and cannot be excluded before startup. A test must not trigger production messages, integrations or financial workflows.

Use a logical export/restore when jobs, outbound hooks or production secrets need to be excluded. Verify that the target has no active schedules, outgoing integration configuration, production credentials or public application traffic before import. Review external-call triggers/functions. Keep production schedules unchanged.

A real backup/restore requires a functioning execution environment and a securely configured database connection. Connected SQL checks and fixture tests do not establish recoverability of a full production backup.

## Acceptance

1. Create a consistent private export containing the required schema, roles, business data, Auth data, Storage metadata and migration history. Never commit backups or credentials to this public repository.
2. Export actual Storage file bytes separately. Preserve bucket/path, content type and metadata, and record counts, lengths and checksums in a private manifest.
3. Import into the isolated target with external activity disabled. Verify integrity and extensions, replay later migrations, and configure API grants, RLS, private buckets, MFA, password protection and target-specific Auth redirects.
4. Restore files to private test buckets and compare the manifest's counts, lengths and checksums.
5. Compare checkpoint and restored table counts, financial totals/references, payroll data, application attachments, workspace relations, permissions and migration state.
6. Verify anonymous, staff, administrator and cross-organization access. Record actual recovery duration, checkpoint age and any lost interval.
7. Agree recovery-point/recovery-time targets, backup retention, access controls and an incident owner. Review evidence before sign-off.
8. Retain private recovery evidence and arrange test-target cleanup. Obtain any required approval for costs or irreversible deletion.

## Provider references

- https://supabase.com/docs/guides/platform/clone-project
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

Review the target's current cost before creating it. This document does not authorize a paid resource or a production restore.
