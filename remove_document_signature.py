#!/usr/bin/env python3
"""Run from the CAGE repository root to remove only the signature line."""
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

root = Path.cwd()
needle = " text('Signature: __________________',35,Math.min(y-18,approvalTop-48),11);\n"
updates = {}
for name in ('dist/document-pdf.js', 'supabase/functions/_shared/document-pdf.js'):
    path = root / name
    source = path.read_text()
    if source.count(needle) == 1:
        updates[path] = source.replace(needle, '', 1)
    elif 'Signature:' not in source and 'function createDocumentPDF(' in source:
        updates[path] = source
    else:
        raise SystemExit('STOP: unexpected document template in '+name+'. No files changed.')
index = root / 'dist/index.html'
html = index.read_text()
pattern = r'(src=["\']\./document-pdf\.js)(?:\?[^"\']*)?(["\'])'
if len(re.findall(pattern, html)) != 1:
    raise SystemExit('STOP: expected one document-pdf.js script tag. No files changed.')
updates[index] = re.sub(pattern, r'\1?v=no-signature-20260923\2', html)
with tempfile.TemporaryDirectory() as tmp:
    for path, content in updates.items():
        if path.suffix == '.js':
            candidate = Path(tmp) / 'candidate.js'
            candidate.write_text(content)
            subprocess.run(['node', '--check', str(candidate)], check=True)
backup = Path(tempfile.mkdtemp(prefix='cage-before-signature-removal-'))
for path, content in updates.items():
    relative = path.relative_to(root)
    original = backup / relative
    original.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, original)
    path.write_text(content)
    print('Updated:', relative)
print('Original files saved to:', backup)
print('Signature line removed from quote and invoice PDF templates. Company stamp retained.')
print('Deploy the frontend and the send-document function. No SQL or secret changes required.')
