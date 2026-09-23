"""Run from the existing CAGE repository: python3 apply_reset_frontend_patch.py
Updates only dist/production.js and its cache version in dist/index.html.
Stops without writing if the expected source differs. No secrets/database access.
"""
from pathlib import Path
import re, tempfile, shutil
replacements = [('  function writableChanges(base, next) {', '  // CAGE reset compatibility 2026-09-23\n  function resetEpoch(state) { return typeof state?._resetEpoch === \'string\' ? state._resetEpoch : null; }\n  function quarantineResetDraft(saved) {\n    const recoveryKey=draftKey()+":before-reset:"+Date.now();\n    // Write the recovery copy successfully before removing the active draft.\n    localStorage.setItem(recoveryKey,JSON.stringify({savedAt:new Date().toISOString(),draft:saved}));\n    localStorage.removeItem(draftKey());\n    pendingState=null;syncConflicts=[];\n    window.dispatchEvent(new CustomEvent("cage:sync",{detail:{pending:false}}));\n  }\n  function writableChanges(base, next) {'), ('const changes=window.CAGE_SYNC.changes(base,next);', 'const changes=window.CAGE_SYNC.changes(base,next).filter(c=>c.key!=="_resetEpoch");'), ('async function syncRpcWithRetry(patches)', 'async function syncRpcWithRetry(patches, expectedEpoch)'), ('client.rpc("save_workspace_changes",{changes:patches})', 'client.rpc("save_workspace_changes",{changes:patches,expected_epoch:expectedEpoch})'), ('await syncRpcWithRetry(patches);', 'await syncRpcWithRetry(patches,resetEpoch(base));'), ('      await loadWorkspace();\n      const newer=writableChanges(snapshot,pendingState||snapshot);', '      await loadWorkspace();\n      if(resetEpoch(base)!==resetEpoch(cloudBase)) {\n        quarantineResetDraft({base,next:pendingState||snapshot});\n        showBanner("The workspace was reset. Your old draft was kept separately and was not restored.","error");\n        return;\n      }\n      const newer=writableChanges(snapshot,pendingState||snapshot);'), ('    } catch(error){showBanner("Not synced: "+error.message+". Your draft is kept on this device.","error");', '    } catch(error){\n      if(/Workspace was reset/i.test(error.message||"")) {\n        quarantineResetDraft({base,next:pendingState||snapshot});\n        await loadWorkspace();\n        showBanner("The workspace was reset. Your old draft was kept separately and was not restored.","error");\n        return;\n      }\n      showBanner("Not synced: "+error.message+". Your draft is kept on this device.","error");'), ('    const patches=writableChanges(saved.base,saved.next);', '    if(resetEpoch(saved.base)!==resetEpoch(cloudBase)) {\n      quarantineResetDraft(saved);app.replaceState(cloudBase);\n      showBanner("A draft from before the reset was kept separately. The fresh workspace is ready.","error");\n      return;\n    }\n    const patches=writableChanges(saved.base,saved.next);')]
p=Path('dist/production.js'); h=Path('dist/index.html')
s=p.read_text(); html=h.read_text()
if 'CAGE reset compatibility 2026-09-23' in s:
    raise SystemExit('Patch already present. Nothing changed.')
for old,new in replacements:
    if s.count(old)!=1: raise SystemExit('STOP: source differs from reviewed code. Send the current dist/production.js for review. No files changed.')
    s=s.replace(old,new)
html,n=re.subn(r'(production\.js\?v=)[^"\s]+',r'\g<1>reset-20260923',html)
if n!=1: raise SystemExit('STOP: production script reference differs. No files changed.')
backup=Path(tempfile.mkdtemp(prefix='cage-before-reset-patch-'))
shutil.copy2(p,backup/'production.js');shutil.copy2(h,backup/'index.html')
p.write_text(s);h.write_text(html)
print('Patched dist/production.js and dist/index.html. Backup:',backup)
