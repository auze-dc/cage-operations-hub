"""Disposable Storage fixtures only. Never contacts a production service."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODULE = Path(__file__).resolve().parents[1] / 'scripts/recovery.py'
spec = importlib.util.spec_from_file_location('recovery', MODULE)
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)


class Fixture(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def reply(self, data, status=200):
        self.send_response(status)
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == '/storage/v1/bucket':
            if self.server.mode == 'redirect':
                self.send_response(302)
                self.send_header('Location', '/must-not-follow')
                self.end_headers()
            else:
                self.reply(json.dumps([{'id': 'private', 'public': False}]).encode())
        elif self.path.startswith('/storage/v1/object/authenticated/'):
            self.server.downloads += 1
            self.reply(b'content' if self.server.mode != 'truncate' else b'cut')
        else:
            self.server.unexpected += 1
            self.reply(b'bad request', 400)

    def do_POST(self):
        if not self.path.startswith('/storage/v1/object/list/'):
            self.server.unexpected += 1
            self.reply(b'not a read request', 405)
            return
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        prefix, offset = body['prefix'], body['offset']
        if prefix == 'folder/':
            rows = [{'id': 'nested', 'name': 'unicode-\u00e9.pdf', 'updated_at': 'stable', 'metadata': {'size': 7}}]
        else:
            rows = [{'id': None, 'name': 'folder'}] + [
                {'id': str(n), 'name': '%03d.bin' % n, 'updated_at': 'changed' if self.server.mode == 'change' and self.server.downloads else 'stable', 'metadata': {'size': 7}}
                for n in range(101)
            ]
            if self.server.mode == 'traversal':
                rows[1]['name'] = '../escape'
        self.reply(json.dumps(rows[offset:offset + body['limit']]).encode())


class RecoveryTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='cage-recovery-fixtures-')
        self.root = Path(self.temp.name)
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Fixture)
        self.server.mode, self.server.downloads, self.server.unexpected = 'normal', 0, 0
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.config = {'url': 'http://127.0.0.1:' + str(self.server.server_port), 'api_key': 'fixture', 'token': 'fixture', 'expected_counts': {'private': 102}}

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def export(self, name='backup'):
        return recovery.backup_storage(self.config, self.root / name, allow_test_http=True)

    def test_paginated_recursive_backup_and_byte_verification(self):
        self.assertEqual(self.export(), {'verified': True, 'objects': 102, 'bytes': 714})
        manifest = json.loads((self.root / 'backup/manifest.json').read_text())
        self.assertEqual(len(manifest['files']), 102)
        self.assertEqual(len(list((self.root / 'backup/blobs').glob('*.bin'))), 1, 'identical content may be stored once without losing object identity')
        self.assertEqual(self.server.downloads, 102)
        self.assertEqual(self.server.unexpected, 0, 'only listing and download endpoints are used')
        blob = next((self.root / 'backup/blobs').glob('*.bin'))
        blob.write_bytes(b'tamper!')
        with self.assertRaises(recovery.RecoveryError):
            recovery.verify_storage(self.root / 'backup')

    def test_incomplete_or_changed_storage_is_not_sealed(self):
        for mode in ('truncate', 'change', 'traversal'):
            with self.subTest(mode=mode):
                self.server.mode, self.server.downloads = mode, 0
                with self.assertRaises(recovery.RecoveryError):
                    self.export(mode)
                self.assertFalse((self.root / mode / 'manifest.json').exists())

    def test_redirects_cannot_forward_credentials(self):
        self.server.mode = 'redirect'
        with self.assertRaises(recovery.RecoveryError):
            self.export()
        self.assertEqual(self.server.unexpected, 0)

    def test_expected_counts_prevent_silent_partial_listing(self):
        self.config['expected_counts'] = {'private': 103}
        with self.assertRaises(recovery.RecoveryError):
            self.export()
        self.assertEqual(self.server.downloads, 0)

    def test_existing_backups_are_not_overwritten(self):
        self.export()
        with self.assertRaises(recovery.RecoveryError):
            self.export()

    def test_plain_http_is_only_available_to_internal_fixture_tests(self):
        with self.assertRaises(recovery.RecoveryError):
            recovery.Storage(self.config)

    def test_credentials_cannot_be_sent_to_an_unrelated_origin(self):
        config = {**self.config, 'url': 'https://unrelated.example', 'project_ref': 'a' * 20}
        with self.assertRaises(recovery.RecoveryError):
            recovery.Storage(config)

    def test_database_connection_enforces_private_files_tls_and_read_only(self):
        service, password = self.root / 'services', self.root / 'passwords'
        service.write_text('[fixture]\nhost=example.invalid\nuser=fixture\ndbname=fixture\nsslmode=verify-full\n')
        password.write_text('fixture-only')
        os.chmod(service, 0o600)
        os.chmod(password, 0o600)
        env = recovery.pg_environment('fixture', service, password)
        self.assertEqual(env['PGSERVICE'], 'fixture')
        self.assertIn('default_transaction_read_only=on', env['PGOPTIONS'])
        self.assertNotIn('PGPASSWORD', env)
        for suffix in ('options=-c default_transaction_read_only=off\n', 'password=not-allowed\n'):
            original = service.read_text()
            service.write_text(original + suffix)
            with self.assertRaises(recovery.RecoveryError):
                recovery.pg_environment('fixture', service, password)
            service.write_text(original)
        service.write_text(service.read_text().replace('verify-full', 'require'))
        with self.assertRaises(recovery.RecoveryError):
            recovery.pg_environment('fixture', service, password)

    def test_private_config_and_git_worktree_boundaries(self):
        secret = self.root / 'private.json'
        secret.write_text('{}')
        os.chmod(secret, 0o644)
        with self.assertRaises(recovery.RecoveryError):
            recovery.private_file(secret)
        os.chmod(secret, 0o600)
        self.assertEqual(recovery.private_file(secret), secret)
        tree = self.root / 'repo'
        tree.mkdir()
        (tree / '.git').write_text('gitdir: elsewhere')
        with self.assertRaises(recovery.RecoveryError):
            recovery.destination(tree / 'backups')

    def test_manifest_cannot_escape_or_follow_symlinks(self):
        self.export()
        path = self.root / 'backup/manifest.json'
        manifest = json.loads(path.read_text())
        blob = self.root / 'backup/blobs' / (manifest['files'][0]['sha256'] + '.bin')
        original = self.root / 'original'
        blob.rename(original)
        blob.symlink_to(original)
        with self.assertRaises(recovery.RecoveryError):
            recovery.verify_storage(self.root / 'backup')
        manifest['files'][0]['sha256'] = '../original'
        path.write_text(json.dumps(manifest))
        with self.assertRaises(recovery.RecoveryError):
            recovery.verify_storage(self.root / 'backup')


if __name__ == '__main__':
    unittest.main()
