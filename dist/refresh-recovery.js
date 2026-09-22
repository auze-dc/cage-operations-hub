(function(){
'use strict';
const api=()=>window.CAGE_BACKEND,uid=()=>api()?.currentProfile()?.id;
let tab;try{tab=sessionStorage.getItem('cage-recovery-tab')||String(Date.now())+'-'+Math.random().toString(36).slice(2);sessionStorage.setItem('cage-recovery-tab',tab);}catch{tab='storage-unavailable';}
const key=()=>`cage-refresh-v1:${uid()}:${tab}`;
const entryUrl=location.href;
// Let a saved same-tab page take precedence over a previously followed email link.
window.CAGE_REFRESH={hasCurrentPage(){try{const saved=JSON.parse(localStorage.getItem(key())||'null');return !!(uid()&&saved?.globals?.activeView&&saved.url===entryUrl);}catch{return false;}}};
let restoring=false,ready=false,timer,lastAction=null;const origins=new WeakMap();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const allowed=el=>el.matches('input,textarea,select,[contenteditable="true"]')&&!['password','submit','button','reset'].includes(el.type)&&!el.closest('#login-form,#invite-user-form')&&!/password|secret|token|api.?key/i.test(el.name||el.id||'');
function controls(root){return [...root.querySelectorAll('input,textarea,select,[contenteditable="true"]')].filter(allowed);}
function values(root){return controls(root).map((el,index)=>({index,id:el.id,name:el.name,tag:el.tagName,type:el.type,value:el.type==='file'?null:el.isContentEditable?el.textContent:el.value,checked:el.checked,selected:el.multiple?[...el.selectedOptions].map(o=>o.value):null}));}
function fileDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('cage-refresh-files',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function filesOperation(mode,k,value){const db=await fileDB();try{return await new Promise((resolve,reject)=>{const t=db.transaction('files',mode==='get'?'readonly':'readwrite'),s=t.objectStore('files'),r=mode==='get'?s.get(k):mode==='delete'?s.delete(k):s.put(value,k);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}}
function fileKey(root,index){return key()+':'+root.id+':'+index;}
function warn(){showToast('Draft storage is unavailable or full. Keep this page open until your work is saved.');}
function descriptor(el){if(!el)return null;return {id:el.id||'',tag:el.tagName,attrs:[...el.attributes].filter(a=>a.name.startsWith('data-')&&!/submitting/.test(a.name)).map(a=>[a.name,a.value]),text:el.textContent.trim(),parent:el.closest('dialog')?.id||''};}
function locate(d){if(!d)return null;if(d.id)return document.getElementById(d.id);const root=d.parent?document.getElementById(d.parent):document;if(!root)return null;return [...root.querySelectorAll(d.tag||'button')].find(el=>d.attrs.every(([k,v])=>el.getAttribute(k)===v)&&el.textContent.trim()===d.text);}
function globals(){return {collaboration:window.CAGE_COLLAB?.capture(),opportunityFilter,opportunityQuery,admissions:window.CAGE_ADMISSIONS?.captureView?.(),activeView,activeChatThread,activeRequestId,activeContactId,activeProjectId,activeProjectTab,editingTaskId,editingDealId,taskFilter,projectFilter,taskDisplay,financeFilter,boardProjectFilter,chatFilter,knowledgeFilter,assetFilter,commercialFilter,requestFilter,calendar:calendarCursor.toISOString()};}
function snapshot(){
 if(!ready||restoring||!uid())return;
 const panel=document.querySelector(`[data-view-panel="${CSS.escape(activeView)}"]`);
 const dialogs=[...document.querySelectorAll('dialog[open]')].filter(d=>d.id!=='pdf-preview-dialog'&&!d.id.includes('login')).map(d=>({id:d.id,hubRecord:d.dataset.hubRecord||'',origin:origins.get(d)||null,fields:values(d),forms:[...d.querySelectorAll('form')].map(f=>({id:f.id,data:Object.fromEntries(Object.entries(f.dataset).filter(([k])=>k!=='submitting'))})),items:d.querySelectorAll('.document-item').length,subtasks:d.querySelectorAll('[data-subtask]').length,scrollTop:d.scrollTop,details:[...d.querySelectorAll('details')].map(x=>x.open)}));
 try{localStorage.setItem(key(),JSON.stringify({globals:globals(),panel:panel?values(panel):[],dialogs,scroll:{x:scrollX,y:scrollY},containers:[...document.querySelectorAll('[id]')].filter(x=>x.clientHeight>0&&x.scrollHeight>x.clientHeight).map(x=>({id:x.id,top:x.scrollTop,left:x.scrollLeft})),url:location.href,updated:Date.now()}));}catch{warn();}
}
function schedule(){if(restoring)return;clearTimeout(timer);timer=setTimeout(snapshot,120);}
const originalShow=HTMLDialogElement.prototype.showModal;
HTMLDialogElement.prototype.showModal=function(){if(!restoring)origins.set(this,lastAction);const result=originalShow.call(this);schedule();return result;};
document.addEventListener('click',e=>{if(restoring)return;lastAction=descriptor(e.target.closest('button,a,[role="button"]'));schedule();},true);
document.addEventListener('input',schedule,true);document.addEventListener('change',async e=>{
 schedule();const el=e.target;if(el.type!=='file'||!uid())return;const root=el.closest('dialog')||el.closest('[data-view-panel]');if(!root)return;
 try{await filesOperation('put',fileKey(root,controls(root).indexOf(el)),[...el.files]);}catch{warn();}
},true);
document.addEventListener('close',e=>{if(restoring)return;const root=e.target;if(!root.matches?.('dialog'))return;controls(root).forEach((el,i)=>{if(el.type==='file')filesOperation('delete',fileKey(root,i)).catch(()=>{});});schedule();},true);
window.addEventListener('pagehide',snapshot);window.addEventListener('beforeunload',snapshot);document.addEventListener('visibilitychange',()=>{if(document.hidden)snapshot();});
const setViewBase=setView;setView=function(...args){const r=setViewBase(...args);schedule();return r;};
const threadBase=selectChatThread;selectChatThread=function(...args){const r=threadBase(...args);schedule();return r;};
async function apply(root,fields){
 const all=controls(root);
 for(const v of fields||[]){const el=v.id?root.querySelector('#'+CSS.escape(v.id)):all[v.index];if(!el||!allowed(el)||el.tagName!==v.tag||el.type!==v.type)continue;
 if(el.type==='file'){try{const stored=await filesOperation('get',fileKey(root,v.index));if(stored?.length){const dt=new DataTransfer();for(const f of stored)dt.items.add(f);el.files=dt.files;}}catch{showToast('Please reselect the attachment; your form text was recovered.');}continue;}
 if(el.isContentEditable)el.textContent=v.value;else el.value=v.value??'';
 if(el.type==='checkbox'||el.type==='radio')el.checked=v.checked;
 if(v.selected)for(const o of el.options)o.selected=v.selected.includes(o.value);
 }
}
function restoreGlobals(g){
 window.CAGE_COLLAB?.restoreView(g.collaboration);
 opportunityFilter=g.opportunityFilter||'open';opportunityQuery=g.opportunityQuery||'';window.CAGE_ADMISSIONS?.restoreView?.(g.admissions);
 activeChatThread=g.activeChatThread||GENERAL_CHAT_THREAD_ID;activeRequestId=g.activeRequestId||'';activeContactId=g.activeContactId||'';activeProjectId=g.activeProjectId||'';activeProjectTab=g.activeProjectTab||'overview';editingTaskId=g.editingTaskId||'';editingDealId=g.editingDealId||'';
 taskFilter=g.taskFilter;projectFilter=g.projectFilter;taskDisplay=g.taskDisplay;financeFilter=g.financeFilter;boardProjectFilter=g.boardProjectFilter;chatFilter=g.chatFilter;knowledgeFilter=g.knowledgeFilter;assetFilter=g.assetFilter;commercialFilter=g.commercialFilter;requestFilter=g.requestFilter;
 if(g.calendar)calendarCursor=new Date(g.calendar);
}
async function restore(){
 if(ready||restoring||!uid())return;restoring=true;
 try{
 const saved=JSON.parse(localStorage.getItem(key())||'null');
 // Email deep links take priority over a previous working page.
 if(!saved||(saved.url!==entryUrl&&new URL(entryUrl).searchParams.has('view')))return;
 const g=saved.globals;if(api().moduleLevel(g.activeView)==='none')return;
 restoreGlobals(g);setView(g.activeView);await wait(450);
 if(g.activeView==='training'){await window.CAGE_TRAINING_UI?.load();await window.CAGE_ACADEMY?.load();}
 // Record IDs can remain selected after a dialog closes. Only reopen saved open dialogs.
 const panel=document.querySelector(`[data-view-panel="${CSS.escape(g.activeView)}"]`);if(panel)await apply(panel,saved.panel);
 for(const savedDialog of saved.dialogs||[]){
 if(savedDialog.id==='project-dialog'&&state.projects.some(p=>p.id===g.activeProjectId)){openProject(g.activeProjectId);activeProjectTab=g.activeProjectTab||'overview';renderProjectWorkspace();}
 if(savedDialog.id==='request-detail-dialog'&&state.requests.some(p=>p.id===g.activeRequestId))openRequest(g.activeRequestId);
 if(savedDialog.id==='task-dialog')openTaskDialog(savedDialog.fields.find(f=>f.name==='project')?.value||'',g.editingTaskId||'');
 if(['hub-notice-dialog','hub-event-dialog'].includes(savedDialog.id))await window.CAGE_COLLAB.restore(savedDialog);
 if(savedDialog.id==='admission-dialog') await window.CAGE_ADMISSIONS.restore(savedDialog);
 if(savedDialog.id==='stem-review-dialog') await window.CAGE_STEM.restore(savedDialog);
 if(savedDialog.id==='academy-dialog') await window.CAGE_ACADEMY.restore(savedDialog);
 let dialog=document.getElementById(savedDialog.id);const opener=['hub-notice-dialog','hub-event-dialog','project-dialog','request-detail-dialog','task-dialog','academy-dialog','stem-review-dialog','admission-dialog'].includes(savedDialog.id)?null:locate(savedDialog.origin);
 if(opener&&!opener.disabled&&!(opener.tagName==='BUTTON'&&opener.type==='submit')&&!/delete|remove|send|approve|reject|save|submit/i.test(JSON.stringify(savedDialog.origin))){opener.click();for(let n=0;n<30;n++){await wait(100);dialog=document.getElementById(savedDialog.id);if(dialog?.open)break;}}
 if(!dialog){showToast('Your form draft is retained. Reopen its form to recover it.');continue;}
 if(!dialog.open){showToast('Your draft is retained. Reopen the original form to continue.');continue;}
 if(savedDialog.id==='task-dialog'){
   editingTaskId=g.editingTaskId||'';
   const project=savedDialog.fields.find(f=>f.name==='project');
   if(project)document.getElementById('task-form').elements.project.value=project.value;
   window.CAGE_OPS?.refreshTaskDependencies?.([]);
   const rows=[...dialog.querySelectorAll('[data-subtask]')];
   rows.slice(savedDialog.subtasks||0).forEach(row=>row.remove());
 }
 // Recreate repeatable rows using the existing handlers.
 for(let n=dialog.querySelectorAll('.document-item').length;n<savedDialog.items;n++)dialog.querySelector('[data-add-document-item]')?.click();
 for(let n=dialog.querySelectorAll('[data-subtask]').length;n<savedDialog.subtasks;n++)document.getElementById('ops-add-subtask')?.click();
 for(const f of savedDialog.forms){const form=document.getElementById(f.id);if(form)Object.assign(form.dataset,f.data);}
 await wait(50);await apply(dialog,savedDialog.fields);origins.set(dialog,savedDialog.origin);dialog.scrollTop=savedDialog.scrollTop||0;[...dialog.querySelectorAll('details')].forEach((x,i)=>{if(savedDialog.details&&i<savedDialog.details.length)x.open=savedDialog.details[i];});
 }
 restoreGlobals(g);for(const c of saved.containers||[]){const el=document.getElementById(c.id);if(el){el.scrollTop=c.top;el.scrollLeft=c.left;}}window.scrollTo(saved.scroll?.x||0,saved.scroll?.y||0);
 
 }catch(e){showToast('Could not reopen the previous form automatically. Your saved draft has been kept.');console.error('Form recovery failed',e);}
 finally{restoring=false;ready=true;document.body.classList.remove('restoring-workspace');}
}
window.addEventListener('cage:session-ready',()=>{
 ready=false;
 if(!window.CAGE_REFRESH.hasCurrentPage())return;
 try{
  const saved=JSON.parse(localStorage.getItem(key()));const g=saved.globals;
  if(api().moduleLevel(g.activeView)==='none')return;
  // Select the saved page synchronously, before the browser paints the signed-in shell.
  // Keep the existing loader visible until data and any open dialog are restored.
  document.body.classList.add('restoring-workspace');
  restoreGlobals(g);setView(g.activeView);
 }catch{document.body.classList.remove('restoring-workspace');}
});
window.addEventListener('cage:workspace-ready',restore);
// Save navigation and open forms after asynchronous controls settle.
setInterval(()=>{if(ready&&!document.hidden)snapshot();},2000);
})();
