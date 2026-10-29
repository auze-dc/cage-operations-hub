#!/usr/bin/env bash
# Disposable PostgreSQL fixture. The container has no network interfaces.
set -euo pipefail
task_root=$(mktemp -d /tmp/cage-recovery-test-XXXXXX)
task_container="cage-recovery-test-$(date +%s)-$$"
cleanup() {
  docker rm -f "$task_container" >/dev/null 2>&1 || true
  rm -rf "$task_root"
}
trap cleanup EXIT
mkdir "$task_root/socket" "$task_root/bin"
# The fixture server runs as its image's postgres user; only its socket directory
# is shared. No real records, keys or backup credentials are used in this test.
chmod 755 "$task_root"
chmod 777 "$task_root/socket"
docker run -d --name "$task_container" --network none \
  --mount "type=bind,source=$task_root,target=$task_root" \
  --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=disposable-fixture-only \
  postgres:17.6 -c "unix_socket_directories=$task_root/socket" \
  -c "listen_addresses=" >/dev/null
for attempt in $(seq 1 40); do
  if docker exec "$task_container" pg_isready -h "$task_root/socket" -U postgres >/dev/null 2>&1; then
    break
  fi
  if [ "$attempt" = 40 ]; then
    echo 'Disposable fixture did not start.' >&2
    exit 1
  fi
  sleep 1
done
export CAGE_PG_CONTAINER="$task_container" CAGE_TEST_UID="$(id -u)" CAGE_TEST_GID="$(id -g)"
for tool in pg_dump pg_dumpall pg_restore psql; do
  cat > "$task_root/bin/$tool" <<'SH'
#!/bin/sh
exec docker exec --user "$CAGE_TEST_UID:$CAGE_TEST_GID" \
  -e PGSERVICE -e PGSERVICEFILE -e PGPASSFILE -e PGOPTIONS -e PGCONNECT_TIMEOUT \
  "$CAGE_PG_CONTAINER" "${0##*/}" "$@"
SH
  chmod 700 "$task_root/bin/$tool"
done
docker exec "$task_container" createdb -h "$task_root/socket" -U postgres cage_recovery_source
docker exec "$task_container" createdb -h "$task_root/socket" -U postgres cage_recovery_restored
docker exec -i "$task_container" psql -h "$task_root/socket" -U postgres -d cage_recovery_source -v ON_ERROR_STOP=1 <<'SQL'
create role fixture_reader;
create table public.invoices(id int primary key, reference text unique, amount numeric(12,2));
create table public.notes(id int primary key, body text);
insert into public.invoices values(1,'FIXTURE-001',125000.50),(2,'FIXTURE-002',250.00);
insert into public.notes values(1,'Unicode recovery: \u00e9 / Malawi');
alter table public.invoices enable row level security;
create policy fixture_access on public.invoices to fixture_reader using(id=1);
grant select on public.invoices to fixture_reader;
create function public.fixture_total() returns numeric language sql as $$select sum(amount) from public.invoices$$;
SQL
cat > "$task_root/service.conf" <<EOF
[fixture]
host=$task_root/socket
user=postgres
dbname=cage_recovery_source
sslmode=verify-full
EOF
printf '%s\n' '*:*:*:postgres:disposable-fixture-only' > "$task_root/passwords"
chmod 600 "$task_root/service.conf" "$task_root/passwords"
python3 scripts/recovery.py database --service fixture \
  --service-file "$task_root/service.conf" --password-file "$task_root/passwords" \
  --binary-dir "$task_root/bin" --output "$task_root/backup"
docker exec "$task_container" pg_restore -h "$task_root/socket" -U postgres \
  --exit-on-error --dbname=cage_recovery_restored "$task_root/backup/database.dump"
docker exec -i "$task_container" psql -h "$task_root/socket" -U postgres -d cage_recovery_restored -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
 if (select count(*) from public.invoices) <> 2 then raise exception 'Missing invoices';end if;
 if public.fixture_total() <> 125250.50 then raise exception 'Financial total differs';end if;
 if (select body from public.notes where id=1) <> 'Unicode recovery: \u00e9 / Malawi' then raise exception 'Text differs';end if;
 if not exists(select 1 from pg_class where oid='public.invoices'::regclass and relrowsecurity) then raise exception 'RLS missing';end if;
 if not exists(select 1 from pg_policy where polrelid='public.invoices'::regclass and polname='fixture_access') then raise exception 'Policy missing';end if;
end $$;
set role fixture_reader;
do $$begin if (select count(*) from public.invoices) <> 1 then raise exception 'Row permission differs';end if;end $$;
reset role;
SQL
python3 - "$task_root/backup" <<'PY'
import hashlib,json,pathlib,sys
root=pathlib.Path(sys.argv[1])
manifest=json.loads((root/'manifest.json').read_text())
assert manifest['restore_tested'] is False, 'A fixture restore must never mark a production backup as restored'
for item in manifest['files']:
    raw=(root/item['name']).read_bytes()
    assert hashlib.sha256(raw).hexdigest()==item['sha256']
    assert len(raw)==item['size']
assert (root/'roles.sql').stat().st_size>0
PY
echo 'PASS: isolated PostgreSQL 17 fixture dump and restore; data, totals, text, functions, RLS and permissions retained; no network or production data.'
