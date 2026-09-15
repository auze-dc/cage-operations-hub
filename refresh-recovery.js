(function(){
'use strict';
const api=()=>window.CAGE_BACKEND,uid=()=>api()?.currentProfile()?.id;
const tab=sessionStorage.getItem('cage-recovery-tab')||crypto.randomUUID();sessionStorage.setItem('cage-recovery-tab',tab);
const key=()=>`cage-refresh-v1:${uid()}:${tab}`;
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
function globals(){return {activeView,activeChatThread,activeRequestId,activeContactId,activeProjectId,activeProjectTab,editingTaskId,editingDealId,taskFilter,projectFilter,taskDisplay,financeFilter,boardProjectFilter,chatFilter,knowledgeFilter,assetFilter,commercialFilter,requestFilter,calendar:calendarCursor.toISOString()};}
function snapshot(){
 if(!ready||restoring||!uid())return;
 const panel=document.querySelector(`[data-view-panel="${CSS.escape(activeView)}"]`);
 const dialogs=[...document.querySelectorAll('dialog[open]')].filter(d=>d.id!=='pdf-preview-dialog'&&!d.id.includes('login')).map(d=>({id:d.id,origin:origins.get(d)||null,fields:values(d),forms:[...d.querySelectorAll('form')].map(f=>({id:f.id,data:Object.fromEntries(Object.entries(f.dataset).filter(([k])=>k!=='submitting'))})),items:d.querySelectorAll('.document-item').length,subtasks:d.querySelectorAll('[data-subtask]').length}));
 try{localStorage.setItem(key(),JSON.stringify({globals:globals(),panel:panel?values(panel):[],dialogs,scroll:{x:scrollX,y:scrollY},url:location.href,updated:Date.now()}));}catch{warn();}
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
 activeChatThread=g.activeChatThread||GENERAL_CHAT_THREAD_ID;activeRequestId=g.activeRequestId||'';activeContactId=g.activeContactId||'';activeProjectId=g.activeProjectId||'';activeProjectTab=g.activeProjectTab||'overview';editingTaskId=g.editingTaskId||'';editingDealId=g.editingDealId||'';
 taskFilter=g.taskFilter;projectFilter=g.projectFilter;taskDisplay=g.taskDisplay;financeFilter=g.financeFilter;boardProjectFilter=g.boardProjectFilter;chatFilter=g.chatFilter;knowledgeFilter=g.knowledgeFilter;assetFilter=g.assetFilter;commercialFilter=g.commercialFilter;requestFilter=g.requestFilter;
 if(g.calendar)calendarCursor=new Date(g.calendar);
}
async function restore(){
 if(ready||!uid())return;restoring=true;
 try{
 const saved=JSON.parse(localStorage.getItem(key())||'null');
 // Email deep links take priority over a previous working page.
 if(!saved||(saved.url!==location.href&&new URLSearchParams(location.search).has('view')))return;
 const g=saved.globals;if(api().moduleLevel(g.activeView)==='none')return;
 restoreGlobals(g);setView(g.activeView);await wait(450);
 if(g.activeView==='projects'&&g.activeProjectId&&state.projects.some(p=>p.id===g.activeProjectId))openProject(g.activeProjectId);
 if(g.activeView==='requests'&&g.activeRequestId&&state.requests.some(p=>p.id===g.activeRequestId))openRequest(g.activeRequestId);
 const panel=document.querySelector(`[data-view-panel="${CSS.escape(g.activeView)}"]`);if(panel)await apply(panel,saved.panel);
 for(const savedDialog of saved.dialogs||[]){
 let dialog=document.getElementById(savedDialog.id);const opener=locate(savedDialog.origin);
 if(opener&&!opener.disabled){opener.click();for(let n=0;n<30;n++){await wait(100);dialog=document.getElementById(savedDialog.id);if(dialog?.open)break;}}
 if(!dialog){showToast('Your form draft is retained. Reopen its form to recover it.');continue;}
 if(!dialog.open)dialog.showModal();
 // Recreate repeatable rows using the existing handlers.
 for(let n=dialog.querySelectorAll('.document-item').length;n<savedDialog.items;n++)dialog.querySelector('[data-add-document-item]')?.click();
 for(let n=dialog.querySelectorAll('[data-subtask]').length;n<savedDialog.subtasks;n++)document.getElementById('ops-add-subtask')?.click();
 for(const f of savedDialog.forms){const form=document.getElementById(f.id);if(form)Object.assign(form.dataset,f.data);}
 await wait(50);await apply(dialog,savedDialog.fields);origins.set(dialog,savedDialog.origin);
 }
 restoreGlobals(g);window.scrollTo(saved.scroll.x,saved.scroll.y);
 if(saved.dialogs.length)showToast('Your open form and draft have been restored.');
 }catch(e){showToast('Could not reopen the previous form automatically. Your saved draft has been kept.');console.error('Form recovery failed',e);}
 finally{restoring=false;ready=true;}
}
window.addEventListener('cage:workspace-ready',restore);
// Save navigation and open forms after asynchronous controls settle.
setInterval(()=>{if(ready&&!document.hidden)snapshot();},2000);
})();
