"""Check the real source ZIP without publishing or retaining an uploaded artifact."""
from pathlib import PurePosixPath
from zipfile import ZipFile
with ZipFile('CAGE_Operations_Hub_Production_Export.zip') as archive:
    names = archive.namelist()
    assert 'dist/hr.js' in names and 'scripts/export.mjs' in names
    for name in names:
        parts = PurePosixPath(name).parts
        assert '.git' not in parts and 'node_modules' not in parts
        assert not any(part == '.env' or part.startswith('.env.') for part in parts)
        assert not name.endswith(('runtime-config.js', '.pgpass', '.pg_service.conf', '.recovery-secrets.json'))
    assert b'candidate-vacancy-filter' in archive.read('dist/hr.js')
print('PASS: source ZIP contains current code and excludes Git metadata, dependencies, runtime configuration and private credential files.')
