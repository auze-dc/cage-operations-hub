#!/usr/bin/env python3
"""Run from the CAGE repository root. Changes only app.js and its cache tag."""
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

root = Path.cwd()
app = root / 'dist/app.js'
index = root / 'dist/index.html'
source = app.read_text()
html = index.read_text()
old = '''function renderOpportunityMonitor() {
  const monitor = state.opportunityMonitor;'''
new = '''function renderOpportunityMonitor() {
  // Missing scan history is normal in a fresh workspace. Never seed demo results.
  const savedMonitor = state.opportunityMonitor || {};
  const monitor = {
    ...savedMonitor,
    sources: Array.isArray(savedMonitor.sources) ? savedMonitor.sources : [],
    coverage: Array.isArray(savedMonitor.coverage) ? savedMonitor.coverage : []
  };'''
if new in source:
    patched = source
elif source.count(old) == 1:
    patched = source.replace(old, new, 1)
else:
    raise SystemExit('STOP: app.js differs from the reviewed code. No files changed. Share the current app.js for review.')
pattern = r'(src=["\']\./app\.js)(?:\?[^"\']*)?(["\'])'
if len(re.findall(pattern, html)) != 1:
    raise SystemExit('STOP: expected exactly one app.js script tag. No files changed.')
patched_html = re.sub(pattern, r'\1?v=empty-workspace-20260923\2', html)
with tempfile.TemporaryDirectory() as tmp:
    candidate = Path(tmp) / 'app.js'
    candidate.write_text(patched)
    subprocess.run(['node', '--check', str(candidate)], check=True)
if source == patched and html == patched_html:
    print('Fix already applied. No changes needed.')
else:
    backup = Path(tempfile.mkdtemp(prefix='cage-before-empty-workspace-fix-'))
    shutil.copy2(app, backup / 'app.js')
    shutil.copy2(index, backup / 'index.html')
    app.write_text(patched)
    index.write_text(patched_html)
    print('Updated dist/app.js and dist/index.html.')
    print('Original files saved to:', backup)
    print('No database, runtime configuration, or production.js changes were made.')
