#!/usr/bin/env python3
"""Private, read-only database and Storage exports. No production restore command."""
import argparse
import configparser
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request


class RecoveryError(Exception):
    pass


def outside_repository(path):
    path = Path(path).expanduser().absolute()
    resolved = path.resolve()
    for parent in (resolved, *resolved.parents):
        if (parent / '.git').exists():
            raise RecoveryError('Use a private location outside every Git working tree.')
    return resolved


def private_file(path):
    raw = Path(path).expanduser().absolute()
    if raw.is_symlink():
        raise RecoveryError('Secret configuration must not be a symbolic link.')
    path = outside_repository(raw)
    if not path.is_file() or stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise RecoveryError('Secret configuration must be a private file (mode 600).')
    return path


def destination(path):
    path = outside_repository(path)
    if path.exists():
        raise RecoveryError('Choose a new output directory; existing backups are never overwritten.')
    path.mkdir(parents=True, mode=0o700)
    os.chmod(path, 0o700)
    return path


def write_json(path, value):
    with open(path, 'x', encoding='utf-8') as stream:
        os.chmod(path, 0o600)
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write('\n')


def digest(path):
    hasher, size = hashlib.sha256(), 0
    with open(path, 'rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            hasher.update(chunk)
            size += len(chunk)
    return hasher.hexdigest(), size


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        raise RecoveryError('Redirect rejected; backup credentials were not forwarded.')


class Storage:
    def __init__(self, config, *, allow_test_http=False):
        parsed = urllib.parse.urlsplit(config.get('url', ''))
        local_test = allow_test_http and parsed.scheme == 'http' and parsed.hostname == '127.0.0.1'
        if (not local_test and parsed.scheme != 'https') or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('', '/'):
            raise RecoveryError('Use an HTTPS Storage origin without credentials, a path or query.')
        if not parsed.hostname:
            raise RecoveryError('Storage origin is missing.')
        if not local_test:
            project = config.get('project_ref', '')
            if not isinstance(project, str) or not re.fullmatch('[a-z0-9]{20}', project) or parsed.netloc != project + '.supabase.co':
                raise RecoveryError('Storage origin must match the selected Supabase project reference.')
        key, token = config.get('api_key'), config.get('token')
        if not isinstance(key, str) or not key or not isinstance(token, str) or not token:
            raise RecoveryError('The private config needs api_key and token values.')
        if any(c in key + token for c in '\r\n'):
            raise RecoveryError('Invalid credential format.')
        self.base = config['url'].rstrip('/') + '/storage/v1'
        self.headers = {'apikey': key, 'Authorization': 'Bearer ' + token}
        self.opener = urllib.request.build_opener(NoRedirect())

    def request(self, method, path, payload=None):
        data = json.dumps(payload).encode() if payload is not None else None
        headers = {**self.headers, **({'Content-Type': 'application/json'} if data else {})}
        for attempt in range(3):
            try:
                return self.opener.open(urllib.request.Request(self.base + path, data=data, headers=headers, method=method), timeout=30)
            except urllib.error.HTTPError as error:
                status = error.code
                error.close()
                if status not in (408, 429, 500, 502, 503, 504) or attempt == 2:
                    raise RecoveryError('Storage request failed (HTTP %s); no response body or credentials were logged.' % status) from None
            except (urllib.error.URLError, TimeoutError, OSError):
                if attempt == 2:
                    raise RecoveryError('Storage connection failed; incomplete output was not sealed.') from None
            time.sleep(attempt + 1)

    def json(self, method, path, payload=None):
        with self.request(method, path, payload) as response:
            try:
                return json.load(response)
            except (ValueError, TypeError):
                raise RecoveryError('Storage returned an invalid response.') from None

    def inventory(self):
        buckets = self.json('GET', '/bucket')
        if not isinstance(buckets, list):
            raise RecoveryError('Bucket listing failed.')
        objects, bucket_metadata, seen = [], [], set()
        for bucket in sorted(buckets, key=lambda b: b['id']):
            bid = bucket['id']
            if not isinstance(bid, str) or not bid or bid in seen:
                raise RecoveryError('Invalid or duplicate bucket.')
            seen.add(bid)
            bucket_metadata.append(bucket)
            queue, visited = [''], set()
            while queue:
                prefix = queue.pop()
                if prefix in visited:
                    raise RecoveryError('Repeated Storage folder; listing is not complete.')
                visited.add(prefix)
                offset = 0
                while True:
                    entries = self.json('POST', '/object/list/' + urllib.parse.quote(bid, safe=''), {'prefix': prefix, 'limit': 100, 'offset': offset, 'sortBy': {'column': 'name', 'order': 'asc'}})
                    if not isinstance(entries, list):
                        raise RecoveryError('Object listing failed.')
                    for entry in entries:
                        name = entry.get('name')
                        if not isinstance(name, str) or not name or name in ('.', '..') or '/' in name or '\\' in name or '\x00' in name:
                            raise RecoveryError('Unsafe or invalid object name; export stopped.')
                        key = prefix + name
                        if len(key) > 4096:
                            raise RecoveryError('Storage path exceeds the export safety limit.')
                        if entry.get('id') is None:
                            queue.append(key + '/')
                        else:
                            size = (entry.get('metadata') or {}).get('size')
                            if type(size) is not int or size < 0:
                                raise RecoveryError('Object size is unavailable; completeness cannot be verified.')
                            objects.append({'bucket': bid, 'key': key, 'id': entry['id'], 'size': size, 'updated_at': entry.get('updated_at'), 'metadata': entry.get('metadata')})
                    if len(entries) < 100:
                        break
                    offset += len(entries)
        objects.sort(key=lambda item: (item['bucket'], item['key']))
        if len({(item['bucket'], item['key']) for item in objects}) != len(objects):
            raise RecoveryError('Duplicate object listing; export stopped.')
        return {'buckets': bucket_metadata, 'objects': objects}


def backup_storage(config, output, *, allow_test_http=False):
    storage, out = Storage(config, allow_test_http=allow_test_http), destination(output)
    initial = storage.inventory()
    expected = config.get('expected_counts')
    if expected is not None:
        actual = {bucket['id']: sum(o['bucket'] == bucket['id'] for o in initial['objects']) for bucket in initial['buckets']}
        if expected != actual:
            raise RecoveryError('Storage inventory differs from the independently verified expected counts.')
    blobs = out / 'blobs'
    blobs.mkdir(mode=0o700)
    files = []
    for item in initial['objects']:
        endpoint = '/object/authenticated/' + urllib.parse.quote(item['bucket'], safe='') + '/' + urllib.parse.quote(item['key'], safe='/')
        descriptor, temporary = tempfile.mkstemp(prefix='download-', dir=blobs)
        hasher, size = hashlib.sha256(), 0
        try:
            with os.fdopen(descriptor, 'wb') as target, storage.request('GET', endpoint) as response:
                while chunk := response.read(1024 * 1024):
                    size += len(chunk)
                    if size > item['size']:
                        raise RecoveryError('Object changed size during export; output was not sealed.')
                    target.write(chunk)
                    hasher.update(chunk)
            if size != item['size']:
                raise RecoveryError('Object download was incomplete; output was not sealed.')
            sha = hasher.hexdigest()
            final = blobs / (sha + '.bin')
            if final.exists():
                os.unlink(temporary)
            else:
                os.rename(temporary, final)
            files.append({**item, 'sha256': sha})
        except Exception:
            if os.path.exists(temporary):
                os.unlink(temporary)
            raise
    if initial != storage.inventory():
        raise RecoveryError('Storage changed during export; output was not sealed. Retry in a new directory.')
    manifest = {'format': 'cage-storage-backup', 'version': 1, 'complete': True, 'created_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'buckets': initial['buckets'], 'files': files, 'object_count': len(files), 'total_bytes': sum(f['size'] for f in files)}
    write_json(out / 'manifest.json', manifest)
    return verify_storage(out)


def verify_storage(output):
    out = Path(output).resolve()
    if (out / 'manifest.json').is_symlink() or (out / 'blobs').is_symlink():
        raise RecoveryError('Symbolic links are not accepted in backups.')
    try:
        manifest = json.loads((out / 'manifest.json').read_text())
    except (OSError, ValueError):
        raise RecoveryError('No valid completed manifest was found.') from None
    if manifest.get('format') != 'cage-storage-backup' or manifest.get('version') != 1 or manifest.get('complete') is not True:
        raise RecoveryError('Unsupported or incomplete backup.')
    files = manifest.get('files')
    if not isinstance(files, list) or len(files) != manifest.get('object_count'):
        raise RecoveryError('Object count does not match the manifest.')
    total, seen = 0, set()
    for item in files:
        sha = item.get('sha256', '')
        if not isinstance(sha, str) or not re.fullmatch('[a-f0-9]{64}', sha):
            raise RecoveryError('Invalid content hash.')
        identity = (item.get('bucket'), item.get('key'))
        if not all(isinstance(value, str) and value for value in identity) or identity in seen:
            raise RecoveryError('Invalid or duplicate object identity.')
        seen.add(identity)
        path = out / 'blobs' / (sha + '.bin')
        if path.is_symlink() or not path.is_file():
            raise RecoveryError('Backup object is missing or is a symbolic link.')
        actual_sha, actual_size = digest(path)
        if sha != actual_sha or actual_size != item.get('size'):
            raise RecoveryError('Backup object failed checksum or size verification.')
        total += actual_size
    if total != manifest.get('total_bytes'):
        raise RecoveryError('Total byte count does not match the manifest.')
    return {'verified': True, 'objects': len(files), 'bytes': total}


def pg_environment(service, service_file, password_file):
    service_file, password_file = private_file(service_file), private_file(password_file)
    parser = configparser.ConfigParser(interpolation=None)
    parser.read(service_file)
    if not parser.has_section(service):
        raise RecoveryError('The selected private PostgreSQL service is not configured.')
    if parser[service].get('sslmode') != 'verify-full':
        raise RecoveryError('The source connection must use sslmode=verify-full.')
    if any(key in parser[service] for key in ('password', 'passfile', 'options', 'service')):
        raise RecoveryError('Use the separate private password file and keep connection options controlled by this tool.')
    if any(not parser[service].get(key) for key in ('host', 'user', 'dbname')):
        raise RecoveryError('The selected service must explicitly identify its host, user and database.')
    env = {key: value for key, value in os.environ.items() if not key.startswith('PG')}
    env.update(PGSERVICE=service, PGSERVICEFILE=str(service_file), PGPASSFILE=str(password_file), PGCONNECT_TIMEOUT='15', PGOPTIONS='-c statement_timeout=0 -c default_transaction_read_only=on')
    return env


def pg_run(command, env, **kwargs):
    result = subprocess.run(command, env=env, stderr=subprocess.PIPE, **kwargs)
    if result.returncode:
        raise RecoveryError('PostgreSQL backup command failed; sensitive provider diagnostics were not logged.')
    return result


def backup_database(service, service_file, password_file, output, *, binary_dir=None):
    env = pg_environment(service, service_file, password_file)
    binaries = {name: str(Path(binary_dir) / name) if binary_dir else shutil.which(name) for name in ('pg_dump', 'pg_dumpall', 'pg_restore', 'psql')}
    if not all(path and Path(path).is_file() for path in binaries.values()):
        raise RecoveryError('Install PostgreSQL client tools matching or newer than the source major version.')
    out = destination(output)
    preflight = pg_run([binaries['psql'], '-X', '--no-password', '-At', '--command=' + "select json_build_object('database',current_database(),'server_version',current_setting('server_version'),'read_only',current_setting('transaction_read_only'))"], env, stdout=subprocess.PIPE)
    source = json.loads(preflight.stdout)
    if source.get('read_only') != 'on':
        raise RecoveryError('The source connection is not read-only.')
    archive, roles = out / 'database.dump', out / 'roles.sql'
    pg_run([binaries['pg_dump'], '--no-password', '--format=custom', '--lock-wait-timeout=10s', '--file=' + str(archive)], env)
    os.chmod(archive, 0o600)
    pg_run([binaries['pg_dumpall'], '--no-password', '--roles-only', '--no-role-passwords', '--file=' + str(roles)], env)
    os.chmod(roles, 0o600)
    # Parse the archive without executing any restored SQL or starting copied jobs.
    pg_run([binaries['pg_restore'], '--list', str(archive)], env, stdout=subprocess.DEVNULL)
    files = []
    for path in (archive, roles):
        sha, size = digest(path)
        if not size:
            raise RecoveryError('A database export file was empty.')
        files.append({'name': path.name, 'sha256': sha, 'size': size})
    write_json(out / 'manifest.json', {'format': 'cage-database-backup', 'version': 1, 'complete': True, 'created_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'source': source, 'files': files, 'restore_tested': False, 'role_passwords_included': False})
    return {'archive_structure_verified': True, 'restore_tested': False, 'files': len(files)}


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    storage = commands.add_parser('storage', help='Read-only Storage export; private credential config required')
    storage.add_argument('--config', required=True)
    storage.add_argument('--output', required=True)
    verify = commands.add_parser('verify-storage', help='Verify every file against the completed manifest')
    verify.add_argument('directory')
    database = commands.add_parser('database', help='Read-only custom archive and role definitions; no restore')
    database.add_argument('--service', required=True)
    database.add_argument('--service-file', required=True)
    database.add_argument('--password-file', required=True)
    database.add_argument('--output', required=True)
    database.add_argument('--binary-dir')
    args = parser.parse_args()
    try:
        if args.command == 'storage':
            result = backup_storage(json.loads(private_file(args.config).read_text()), args.output)
        elif args.command == 'verify-storage':
            result = verify_storage(args.directory)
        else:
            result = backup_database(args.service, args.service_file, args.password_file, args.output, binary_dir=args.binary_dir)
        print(json.dumps(result))
        return 0
    except (RecoveryError, OSError, ValueError, KeyError, TypeError):
        # Never serialize a secret config, HTTP response body, command environment,
        # connection URL or object path to shared terminal/CI logs.
        print('Recovery operation stopped. Check private configuration, permissions, connectivity and backup completeness. Incomplete output is not a verified backup.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
