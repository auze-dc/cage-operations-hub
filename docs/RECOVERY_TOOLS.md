# Private backup tools

`scripts/recovery.py` exports database archives and actual Storage file bytes. It has no production restore command. Outputs and credential files must be outside every Git working tree. Never commit a backup, password, API key, token, inventory or private recovery evidence to this public repository.

The Storage tests use a local fake service. The PostgreSQL test uses disposable records in a network-disabled PostgreSQL 17 container. Passing them does not mean a production backup has been exported or restored.

## Database export

Install PostgreSQL client tools matching or newer than the source server's major version: `psql`, `pg_dump`, `pg_dumpall` and `pg_restore`. Use a securely configured, authorized backup connection. Confirm network access before handling credentials. Prefer a temporary read-only backup login with access sufficient for a complete export; an account filtered by RLS must not be mistaken for a complete backup.

Create a private PostgreSQL service file and a separate password file, both mode 600 and outside the repository. Do not paste passwords into chat, command arguments or shared logs. A service must explicitly specify `host`, `user`, `dbname`, and `sslmode=verify-full`. Configure the trusted CA using the provider's current connection instructions. The tool controls connection options and enforces a read-only session.

```sh
python3 scripts/recovery.py database \
  --service cage_backup \
  --service-file /private/location/services.conf \
  --password-file /private/location/passwords \
  --output /private/location/new-database-backup
```

The export creates `database.dump`, `roles.sql` and a private checksum manifest. The archive uses PostgreSQL's consistent dump snapshot; role definitions are exported separately. Role passwords are deliberately omitted and must be re-established securely during a real recovery. The manifest records that archive parsing passed and that a real restore has **not** yet been tested. A failed export never receives a completed manifest.

Treat the archive as sensitive: it can contain private business records, Auth data and integration configuration. Do not execute it in a live target. Follow `DISASTER_RECOVERY.md` to review and isolate schedules, outbound extensions and secrets before a real restore. Preserve the original source's ownership and permission requirements.

## Storage export

Provide a mode-600 JSON configuration outside the repository. It needs the verified `project_ref`, its matching HTTPS `url`, and authorized `api_key` and `token` values. An optional `expected_counts` mapping of bucket IDs to object counts should come from an independent private inventory; it helps detect a credential that cannot list all required files. Obtain credentials through an approved secure setup; never place real values in this document or repository.

```sh
python3 scripts/recovery.py storage \
  --config /private/location/storage.recovery-secrets.json \
  --output /private/location/new-storage-backup

python3 scripts/recovery.py verify-storage /private/location/new-storage-backup
```

Only bucket/object listing and authenticated downloads are used. Listing POST requests are read-only operations; the tool performs no uploads, deletes or other remote writes. Credentials are never forwarded through redirects. Listing is recursive and paginated; each download is checked against its expected size. A second complete inventory must match the first before a manifest is sealed.

Original bucket/key identities and metadata are retained in the private manifest. Bytes use content-hash filenames, so object names cannot create local paths. Verification checks every referenced file's SHA-256 and size, plus object and total-byte counts. This detects corruption but is not a cryptographic signature of the manifest. Retain a protected copy and an independent receipt/checksum under the recovery policy.

Keep incomplete output separate; it is not a verified backup. Preserve successful backups before retrying because the tool refuses to overwrite an existing output directory.

## Tests

```sh
python3 validation/recovery_test.py
bash validation/recovery-postgres.sh
```

The database fixture test requires Docker. It exports and restores real PostgreSQL 17 fixture data and checks financial totals, text, functions, RLS and row permissions. Its container has no network, contains no production data and is removed afterward. No private backup is uploaded to CI.

After configuring production access, perform an actual private export, verify it, and complete the isolated recovery acceptance procedure. Do not mark the Hub enterprise ready based on these tooling tests alone.
