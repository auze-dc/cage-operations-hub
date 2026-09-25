(function(){'use strict';
const api=()=>window.CAGE_BACKEND, app=()=>window.CAGE_APP,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const catalog={
  "workspace": {
    "requests": "Requests",
    "projects": "Projects",
    "tasks": "Tasks",
    "contacts": "Contacts",
    "deals": "CRM opportunities",
    "events": "Legacy calendar events",
    "invoices": "Invoices",
    "quotes": "Quotations",
    "expenses": "Expenses",
    "boardLists": "Task board lists",
    "leaveRequests": "Leave requests",
    "knowledge": "Knowledge",
    "messages": "Work chat messages",
    "chatGroups": "Chat groups",
    "missions": "Missions",
    "assets": "Assets",
    "compliance": "Compliance",
    "approvals": "Approvals",
    "commercialRecords": "Commercial records",
    "opportunityMatches": "Opportunity matches"
  },
  "database": {
    "hub_work_categories": [
      "Custom categories",
      "categories"
    ],
    "task_plans": [
      "Task plans",
      "tasks"
    ],
    "daily_priorities": [
      "Daily priorities",
      "tasks"
    ],
    "training_courses": [
      "Courses",
      "training"
    ],
    "training_cohorts": [
      "Cohorts",
      "training"
    ],
    "learners": [
      "Learners",
      "training"
    ],
    "training_sessions": [
      "Training sessions",
      "training"
    ],
    "learner_attendance": [
      "Attendance",
      "training"
    ],
    "training_assessments": [
      "Assessments",
      "training"
    ],
    "training_certificates": [
      "Certificates",
      "training"
    ],
    "training_practical_logs": [
      "Practical logs",
      "training"
    ],
    "training_documents": [
      "Learner documents",
      "training"
    ],
    "training_materials": [
      "Training materials",
      "training"
    ],
    "cohort_messages": [
      "Cohort messages",
      "training"
    ],
    "academy_intakes": [
      "Application calls",
      "training"
    ],
    "academy_applications": [
      "Applications",
      "training"
    ],
    "academy_application_files": [
      "Application files",
      "training"
    ],
    "stem_applications": [
      "STEM applications",
      "training"
    ],
    "job_openings": [
      "Job openings",
      "hr"
    ],
    "job_applications": [
      "Job applications",
      "hr"
    ],
    "interviews": [
      "Interviews",
      "hr"
    ],
    "employee_documents": [
      "Employee documents",
      "hr"
    ],
    "equipment_kits": [
      "Equipment kits",
      "assets"
    ],
    "equipment_reservations": [
      "Equipment reservations",
      "assets"
    ],
    "invoice_payments": [
      "Invoice payments",
      "finance"
    ],
    "personal_reminders": [
      "Personal reminders",
      "mywork"
    ],
    "hub_events": [
      "Calendar events",
      "calendar"
    ],
    "hub_notices": [
      "Notices",
      "notices"
    ],
    "hub_notice_files": [
      "Notice attachments",
      "notices"
    ],
    "attachments": [
      "Uploaded files",
      "evidence"
    ]
  }
};
const label=r=>r.number||r.name||r.title||r.full_name||r.file_name||r.subject||r.description||r.text||r.exercise||r.id||'Record';
const recordId=r=>r.id||(r.session_id?[r.session_id,r.learner_id]:[r.user_id,r.task_id||r.day]).join(':');
let records=[],generation=0,busy=false,recordPage=1;
document.body.insertAdjacentHTML('beforeend',`<dialog id="records-dialog" class="app-dialog records-dialog"><div class="dialog-heading"><h2>Manage records</h2><button type="button" data-record-close>Close</button></div><p>Find a record and delete it. Create/edit access and access to the record are checked when you delete. Linked records must be removed or reassigned first.</p><div class="record-controls"><label>Record type<select id="records-kind"></select></label><label>Search<input id="records-search" type="search" placeholder="Name, number or description"></label><button type="button" id="records-refresh">Refresh</button><button type="button" id="records-cleanup">File cleanup</button></div><p id="records-status" role="status"></p><div id="records-list"></div><div id="records-pages" class="record-pages"></div></dialog>`);
const dialog=document.getElementById('records-dialog'),kind=document.getElementById('records-kind'),search=document.getElementById('records-search'),status=document.getElementById('records-status'),list=document.getElementById('records-list'),pages=document.getElementById('records-pages');
kind.innerHTML='<optgroup label="Workspace">'+Object.entries(catalog.workspace).map(([k,v])=>`<option value="workspace:${k}">${esc(v)}</option>`).join('')+'</optgroup><optgroup label="Academy, files and other records">'+Object.entries(catalog.database).map(([k,v])=>`<option value="database:${k}">${esc(v[0])}</option>`).join('')+'</optgroup><optgroup label="Project and task items"><option value="nested:projectMilestones">Project milestones</option><option value="nested:taskSubtasks">Task subtasks</option></optgroup>';
function draw(){const q=search.value.toLowerCase().trim(),filtered=records.filter(r=>[label(r),r.client,r.email,r.status,r.record_id,r.created_at].join(' ').toLowerCase().includes(q));const count=Math.max(1,Math.ceil(filtered.length/20));recordPage=Math.min(recordPage,count);list.innerHTML=filtered.slice((recordPage-1)*20,recordPage*20).map(r=>`<div class="managed-record"><span><strong>${esc(label(r))}</strong><small>${esc(r.client||r.email||r.status||r.record_type||'')} · ${esc(r.created_at||r.issued||r.date||'')}<br>Reference: ${esc(recordId(r))}</small></span><button type="button" class="record-delete" data-record-delete="${esc(recordId(r))}" ${busy?'disabled':''}>Delete</button></div>`).join('')||'<p>No records match.</p>';pages.innerHTML=`<button data-record-page="-1" ${recordPage===1?'disabled':''}>Previous</button><span>${filtered.length} records · Page ${recordPage} of ${count}</span><button data-record-page="1" ${recordPage===count?'disabled':''}>Next</button>`;}
async function load(){const token=++generation;status.textContent='Loading…';records=[];draw();try{const [source,key]=kind.value.split(':');const rows=source==='nested'?(app().getState()[key==='projectMilestones'?'projects':'tasks']||[]).flatMap(p=>(p[key==='projectMilestones'?'milestones':'subtasks']||[]).filter(c=>c.id).map(c=>({id:p.id+'/'+c.id,title:(p.name||p.title)+' · '+(c.title||c.text||c.id),parentId:p.id,child:c}))):source==='workspace'?(app().getState()[key]||[]):await api().managedRecords(key);if(token!==generation)return;records=structuredClone(rows);status.textContent='';recordPage=1;draw();}catch(e){if(token===generation)status.textContent=e.message;}}
function open(value){if(value)kind.value=value;search.value='';if(!dialog.open)dialog.showModal();load();}
document.body.insertAdjacentHTML('beforeend',`<dialog id="record-delete-dialog" class="app-dialog record-delete-dialog" aria-labelledby="record-delete-title"><h2 id="record-delete-title">Delete this record?</h2><p id="record-delete-name"></p><p class="record-delete-reference" id="record-delete-reference"></p><p>This removes the record for everyone with access. Attached files may be permanently removed. An audit record is kept.</p><p id="record-delete-error" role="alert"></p><p id="record-delete-progress" role="status"></p><div class="dialog-actions"><button type="button" id="record-delete-cancel" class="secondary-button">Cancel</button><button type="button" id="record-delete-confirm" class="record-delete">Delete</button></div></dialog>`);
const deleteDialog=document.getElementById('record-delete-dialog'),deleteButton=document.getElementById('record-delete-confirm'),cancelDelete=document.getElementById('record-delete-cancel');
function remove(source,key,row){
 let deleting=false;
 if(busy)return Promise.resolve(false);
 busy=true;
 document.getElementById('record-delete-name').textContent=label(row);
 document.getElementById('record-delete-reference').textContent='Reference: '+recordId(row);
 document.getElementById('record-delete-error').textContent='';
 document.getElementById('record-delete-progress').textContent='';
 deleteButton.disabled=false;cancelDelete.disabled=false;deleteButton.textContent='Delete';
 deleteDialog.showModal();cancelDelete.focus();
 return new Promise(resolve=>{
  let completed=false,closed=false;
  deleteDialog.oncancel=e=>{if(deleting)e.preventDefault();};
  deleteDialog.onclose=()=>{closed=true;busy=false;resolve(completed);if(dialog.open)draw();};
  cancelDelete.onclick=()=>{if(!deleting)deleteDialog.close();};
  deleteButton.onclick=async()=>{
   if(deleting)return;
   deleting=true;deleteButton.disabled=true;cancelDelete.disabled=true;deleteButton.textContent='Deleting…';
   document.getElementById('record-delete-error').textContent='';
   document.getElementById('record-delete-progress').textContent='Deleting the record…';
   try{
    const result=await api().deleteManagedRecord(source,key,row);
    if(closed)return;
    completed=true;deleteDialog.close();app().showToast(result.warning||'Record deleted.');
    if(dialog.open)await load();
    if(source==='database'){
     if(key.startsWith('training_')||['learners','learner_attendance','cohort_messages'].includes(key))window.CAGE_ACADEMY?.load();
     if(key.startsWith('academy_'))window.CAGE_ADMISSIONS?.reload();
     if(['job_openings','job_applications','interviews','employee_documents'].includes(key))window.CAGE_HR_UI?.load();
    }
    if(typeof renderProjectWorkspace==='function'&&typeof activeProjectId!=='undefined'&&activeProjectId)renderProjectWorkspace();
   }catch(e){if(!closed){document.getElementById('record-delete-error').textContent=e.message||'Deletion failed. Please retry.';document.getElementById('record-delete-progress').textContent='';deleteButton.textContent='Retry deletion';}}
   finally{deleting=false;if(!closed){deleteButton.disabled=false;cancelDelete.disabled=false;}}
  };
 });
}

dialog.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-record-close'))dialog.close();if(b.dataset.recordPage){recordPage+=Number(b.dataset.recordPage);draw();}if(b.dataset.recordDelete){const row=records.find(r=>recordId(r)===b.dataset.recordDelete);if(row){const [source,key]=kind.value.split(':');await remove(source,key,row);}}});
window.addEventListener('cage:access-closed',()=>{generation++;records=[];deleteDialog.close();dialog.close();list.replaceChildren();pages.replaceChildren();});
window.addEventListener('cage:session-ready',()=>{generation++;records=[];deleteDialog.close();dialog.close();list.replaceChildren();pages.replaceChildren();});
kind.onchange=load;search.oninput=()=>{recordPage=1;draw();};document.getElementById('records-refresh').onclick=load;
document.getElementById('records-cleanup').onclick=async()=>{try{const rows=(await api().deletionReceipts()).filter(r=>r.storage_path&&!r.storage_removed_at);list.innerHTML=rows.map(r=>`<div class="managed-record"><span>${esc(r.storage_path)}</span><button data-cleanup-id="${esc(r.id)}">Retry file cleanup</button></div>`).join('')||'<p>No pending file cleanup in your latest 100 deletions.</p>';pages.innerHTML='';status.textContent='These records were deleted. Retry any remaining file cleanup.';}catch(e){status.textContent=e.message;}};
dialog.addEventListener('click',async e=>{const b=e.target.closest('[data-cleanup-id]');if(!b)return;b.disabled=true;try{const r=await api().retryFileCleanup(b.dataset.cleanupId);status.textContent=r.warning||'File cleanup complete.';if(!r.cleanupPending&&!r.sharedFile)b.closest('.managed-record').remove();}catch(e){status.textContent=e.message;}finally{b.disabled=false;}});
function addActions(){
 const top=document.querySelector('.topbar-actions');if(top&&!document.getElementById('manage-records-open')){const b=document.createElement('button');b.id='manage-records-open';b.type='button';b.textContent='Manage records';b.onclick=()=>open();top.append(b);}
 document.querySelectorAll('[data-send-document][data-document-id]').forEach(send=>{const type=send.dataset.sendDocument;if(!['quote','invoice'].includes(type))return;let b=send.parentElement.querySelector('[data-delete-finance]');if(!b){b=document.createElement('button');b.type='button';b.className='document-action record-delete';b.textContent='Delete';b.dataset.deleteFinance=type;b.dataset.id=send.dataset.documentId;send.parentElement.append(b);}b.hidden=api()?.moduleLevel('finance')!=='edit';});
 document.querySelectorAll('[data-open-project-file]').forEach(openButton=>{if(openButton.parentElement.classList.contains('project-file-actions'))return;const id=openButton.dataset.openProjectFile;if(!id.startsWith('attachment-'))return;const wrapper=document.createElement('div');wrapper.className='project-file-actions';openButton.before(wrapper);wrapper.append(openButton);const b=document.createElement('button');b.type='button';b.textContent='Delete';b.className='record-delete';b.dataset.deleteProjectFile=id.slice(11);b.hidden=api()?.moduleLevel('projects')!=='edit';wrapper.append(b);});
}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-delete-finance],[data-delete-project-file]');if(!b)return;if(b.dataset.deleteFinance){const key=b.dataset.deleteFinance==='quote'?'quotes':'invoices',r=app().getState()[key].find(r=>r.id===b.dataset.id);if(r)await remove('workspace',key,r);}else{try{const rows=await api().managedRecords('attachments'),r=rows.find(r=>r.id===b.dataset.deleteProjectFile);if(r)await remove('database','attachments',r);}catch(error){app().showToast(error.message);}}});
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const filters={quotes:{q:'',client:'',year:'',month:'',status:'',page:1},invoices:{q:'',client:'',year:'',month:'',status:'',page:1}};
try{const saved=JSON.parse(sessionStorage.getItem('cage-finance-list-filters')||'{}');for(const k of Object.keys(filters))Object.assign(filters[k],saved[k]||{});}catch{}
function financeRows(key,rows){const f=filters[key];let out=rows.filter(r=>(!f.q||[r.number,r.client,r.description].join(' ').toLowerCase().includes(f.q.toLowerCase()))&&(!f.client||r.client===f.client)&&(!f.year||String(r.issued||r.created_at||'').slice(0,4)===f.year)&&(!f.month||String(r.issued||r.created_at||'').slice(5,7)===f.month)&&(!f.status||(key==='invoices'?effectiveInvoiceStatus(r):r.status)===f.status));out.sort((a,b)=>String(b.issued||b.created_at||'').localeCompare(String(a.issued||a.created_at||''))||String(a.number).localeCompare(String(b.number)));const max=Math.max(1,Math.ceil(out.length/20));f.page=Math.min(Math.max(1,Number(f.page)||1),max);const pager=document.getElementById('finance-pages-'+key);if(pager)pager.innerHTML=`<button data-finance-page="${key}:-1" ${f.page===1?'disabled':''}>Previous</button><span>${out.length} documents · Page ${f.page} of ${max}</span><button data-finance-page="${key}:1" ${f.page===max?'disabled':''}>Next</button>`;return out.slice((f.page-1)*20,f.page*20);}
function financeControls(){for(const key of ['quotes','invoices']){const body=document.getElementById(key==='quotes'?'finance-quote-list':'finance-invoice-list');if(!body||document.getElementById('finance-controls-'+key))continue;const f=filters[key],table=body.closest('table'),control=document.createElement('div');control.id='finance-controls-'+key;control.className='record-controls';control.innerHTML=`<label>Search<input type="search" data-finance-filter="${key}:q" value="${esc(f.q)}" placeholder="Number, client or description"></label><label>Client<select data-finance-filter="${key}:client"><option value="">All clients</option></select></label><label>Year<select data-finance-filter="${key}:year"><option value="">All years</option></select></label><label>Month<select data-finance-filter="${key}:month"><option value="">All months</option>${months.map((name,index)=>{const value=String(index+1).padStart(2,'0');return `<option value="${value}" ${f.month===value?'selected':''}>${name}</option>`;}).join('')}</select></label><label>Status<select data-finance-filter="${key}:status"><option value="">All statuses</option></select></label>`;table.before(control);const pager=document.createElement('div');pager.id='finance-pages-'+key;pager.className='record-pages';table.after(pager);}}
function options(){for(const key of ['quotes','invoices']){const rows=app()?.getState()?.[key]||[];for(const name of ['client','year','status']){const select=document.querySelector(`[data-finance-filter="${key}:${name}"]`);if(!select)continue;const values=[...new Set(rows.map(r=>name==='year'?String(r.issued||r.created_at||'').slice(0,4):name==='status'&&key==='invoices'?effectiveInvoiceStatus(r):r[name]).filter(Boolean))].sort();if(filters[key][name]&&!values.includes(filters[key][name]))values.push(filters[key][name]);const fingerprint=JSON.stringify(values);if(select.dataset.values!==fingerprint){select.dataset.values=fingerprint;select.innerHTML=`<option value="">All ${name==='status'?'statuses':name+'s'}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');select.value=filters[key][name];}}}}
function refreshFinance(){try{sessionStorage.setItem('cage-finance-list-filters',JSON.stringify(filters));}catch{}renderFinance();options();}
document.addEventListener('input',e=>{const attr=e.target.dataset.financeFilter;if(!attr)return;const [key,name]=attr.split(':');filters[key][name]=e.target.value;filters[key].page=1;refreshFinance();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-finance-page]');if(!b)return;const [key,delta]=b.dataset.financePage.split(':');filters[key].page+=Number(delta);refreshFinance();});
let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;addActions();financeControls();options();});}).observe(document.body,{childList:true,subtree:true});
window.CAGE_RECORDS={open,financeRows,remove};financeControls();addActions();if(app()){options();renderFinance();}
})();
