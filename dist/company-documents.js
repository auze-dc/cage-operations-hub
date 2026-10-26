/* Company documents: organisation-scoped, shared with all active staff. */
(function(){'use strict';
const api=()=>window.CAGE_BACKEND,app=()=>window.CAGE_APP;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories=['Registration','Tax','Licences & permits','Insurance','Company profile','Policies & templates','Other'];
const today=()=>new Date(Date.now()+7200000).toISOString().slice(0,10);
function status(doc){if(doc.archived)return 'Archived';if(!doc.expires_on)return 'No expiry';const days=Math.round((Date.parse(doc.expires_on+'T00:00:00Z')-Date.parse(today()+'T00:00:00Z'))/86400000);return days<0?'Expired':days<=30?'Expiring soon':'Current';}
const badge=doc=>{const s=status(doc);return `<span class="company-badge ${s==='Expired'?'expired':s==='Expiring soon'?'soon':s==='Current'?'':'neutral'}">${s}</span>`;};
const date=v=>v?new Date(v.length===10?v+'T12:00:00Z':v).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Blantyre'}):'No expiry';
let data=null,epoch=0,loading=null,busy=false,tab='overview',activeId=null,pickerTarget=null;
const panel=document.querySelector('[data-view-panel="compliance"]');if(!panel)return;
const dialog=document.createElement('dialog');dialog.className='company-dialog';dialog.setAttribute('aria-labelledby','company-dialog-title');document.body.append(dialog);
const feedback=document.getElementById('company-feedback');
const person=id=>data?.people.find(p=>p.id===id)?.full_name||'Staff member';
const versions=id=>(data?.versions||[]).filter(v=>v.document_id===id).sort((a,b)=>b.version-a.version);
const docBy=id=>data?.documents.find(d=>d.id===id);
function permitted(){const p=api()?.currentProfile();return !!p?.active&&p.role!=='shared';}
function shell(title,body){dialog.innerHTML=`<div class="dialog-heading"><h2 id="company-dialog-title">${esc(title)}</h2><button type="button" class="icon-button" data-company-close aria-label="Close">×</button></div>${body}<p class="company-error" role="alert"></p>`;if(!dialog.open)dialog.showModal();}
function message(error){feedback.textContent=error;feedback.className=error?'company-error':'';}
async function refresh(force=false){
 if(!permitted())return;
 if(loading)return loading;
 if(data&&!force){render();return;}
 const token=epoch;message('Loading company documents…');
 loading=(async()=>{try{const result=await api().companyDocuments();if(token!==epoch)return;data=result;message('');render();}catch(e){if(token===epoch)message('Documents could not load: '+e.message+' Use Refresh to retry.');}finally{if(token===epoch)loading=null;}})();
 return loading;
}
function switchTab(next){tab=next;for(const b of panel.querySelectorAll('[data-company-tab]')){const selected=b.dataset.companyTab===next;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;}for(const name of ['overview','documents','requirements'])document.getElementById('company-'+name).hidden=name!==next;refresh();}
function render(){
 if(!data)return;
 const docs=data.documents,active=docs.filter(d=>!d.archived),urgent=active.filter(d=>['Expired','Expiring soon'].includes(status(d))).sort((a,b)=>a.expires_on.localeCompare(b.expires_on));
 document.getElementById('company-summary').innerHTML=`<article class="surface company-summary"><p class="section-kicker">Company documents</p><h3>Your company records, ready when you need them</h3><div class="company-summary-counts"><div><strong>${active.length}</strong><span>Active documents</span></div><div><strong>${active.filter(d=>status(d)==='Expired').length}</strong><span>Expired</span></div><div><strong>${active.filter(d=>status(d)==='Expiring soon').length}</strong><span>Due within 30 days</span></div><div><strong>${active.filter(d=>!d.expires_on).length}</strong><span>No expiry date</span></div></div>${urgent.length?urgent.slice(0,8).map(d=>`<div class="company-row"><div><strong>${esc(d.title)}</strong><p>${date(d.expires_on)} · ${d.owner_id?esc(person(d.owner_id)):'No renewal owner assigned'}</p></div><div class="company-actions">${badge(d)}<button class="secondary-button" data-company-open="${d.id}">Review</button></div></div>`).join(''):'<p class="company-muted">'+(active.length?'No document renewals due in the next 30 days.':'Upload your business registration, tax documents and licences to get started.')+'</p>'}<button class="secondary-button" data-company-browse>Browse company documents</button></article>`;
 renderList();decorateRequirements();
}
function renderList(){
 const target=document.getElementById('company-list');if(!data){target.innerHTML='<p class="company-empty">Your document library will appear here after loading.</p>';return;}
 const q=document.getElementById('company-search').value.trim().toLowerCase(),category=document.getElementById('company-category').value,filter=document.getElementById('company-status').value;
 const rows=data.documents.filter(d=>(filter==='Archived'?d.archived:!d.archived)&&(!filter||status(d)===filter)&&(!category||d.category===category)&&[d.title,d.reference,d.issuer,d.notes].join(' ').toLowerCase().includes(q)).sort((a,b)=>a.title.localeCompare(b.title));
 target.innerHTML=rows.length?`<p class="company-muted">${rows.length} document${rows.length===1?'':'s'}</p>`+rows.map(d=>{const v=versions(d.id)[0];return `<article class="company-row"><div><h4>${esc(d.title)}</h4><p>${esc(d.category)}${d.reference?' · '+esc(d.reference):''}</p><p>${d.expires_on?'Expires '+date(d.expires_on):'No expiry date'} · ${d.owner_id?esc(person(d.owner_id)):'No renewal owner'}${v?' · Version '+v.version:''}</p></div><div class="company-actions">${badge(d)}${v?`<button class="secondary-button" data-company-download="${v.id}">Download</button>`:''}<button class="secondary-button" data-company-open="${d.id}">Details</button></div></article>`;}).join(''):'<div class="company-empty"><h3>No documents in this view</h3><p>Upload a document or adjust your search and filters.</p></div>';
}
function decorateRequirements(){
 panel.querySelectorAll('.company-linked').forEach(el=>el.remove());if(!data)return;
 for(const button of panel.querySelectorAll('[data-open-compliance]')){const id=button.dataset.openCompliance,docs=data.documents.filter(d=>!d.archived&&d.requirement_ids?.includes(id));const links=document.createElement('span');links.className='company-linked';links.innerHTML=docs.map(d=>`<button type="button" data-company-open="${d.id}">${esc(d.title)}</button>`).join('');button.parentElement.append(links);}
}
async function open(id){
 activeId=id;pickerTarget=null;const d=docBy(id);if(!d)return;
 const reqs=app()?.getState()?.compliance||[];
 shell(d.title,`<p>${badge(d)} <span class="company-muted">${esc(d.category)}</span></p><p>${esc(d.issuer)}${d.reference?' · '+esc(d.reference):''}</p><p><strong>Issued:</strong> ${d.issued_on?date(d.issued_on):'Not recorded'} · <strong>Expiry:</strong> ${date(d.expires_on)}</p><p><strong>Renewal owner:</strong> ${d.owner_id?esc(person(d.owner_id)):'Unassigned'}</p><p style="white-space:pre-wrap">${esc(d.notes)}</p><p><strong>Linked requirements:</strong> ${(d.requirement_ids||[]).map(id=>esc(reqs.find(r=>r.id===id)?.title||'Removed requirement')).join(', ')||'None'}</p><div class="company-actions"><button class="primary-button" data-company-edit="${id}">Edit / upload new version</button><button class="secondary-button" data-company-archive="${id}">${d.archived?'Restore':'Archive'}</button></div><h3>File versions</h3><p class="company-muted">Earlier versions are preserved. Downloads are private, short-lived links.</p>${versions(id).map(v=>`<div class="company-row"><div><strong>Version ${v.version} · ${esc(v.file_name)}</strong><p>${date(v.uploaded_at)} · ${esc(person(v.uploaded_by))} · ${(v.size_bytes/1024).toFixed(0)} KB</p></div><button class="secondary-button" data-company-download="${v.id}">Download</button></div>`).join('')}<details open><summary>Activity history</summary><div id="company-history">Loading history…</div></details>`);
 const token=epoch;
 try{const events=await api().companyDocumentHistory(id);if(token!==epoch||activeId!==id||!dialog.querySelector('#company-history'))return;dialog.querySelector('#company-history').innerHTML=events.length?events.map(e=>`<div class="company-history"><strong>${esc(e.action)}</strong> · ${esc(person(e.actor_id))}<p class="company-muted">${date(e.created_at)}${e.details?.version?' · Version '+e.details.version:''}</p>${e.details?.before?.title&&e.details.before.title!==e.details.after?.title?'<p>Previous title: '+esc(e.details.before.title)+'</p>':''}</div>`).join(''):'No history yet.';}catch(e){const el=dialog.querySelector('#company-history');if(token===epoch&&activeId===id&&el)el.textContent=e.message;}
}
const field=(name,label,value='',type='text',extra='')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value||'')}" ${extra}></label>`;
function edit(id){
 const d=docBy(id)||{id:crypto.randomUUID(),revision:0,category:'Registration',requirement_ids:[]};activeId=d.id;pickerTarget=null;
 const reqs=app()?.getState()?.compliance||[];
 shell(d.revision?'Edit document':'Upload company document',`<form id="company-form"><p class="company-muted">All active staff can view and update this document.</p><div class="company-form-grid"><label class="company-wide">Document title *<input name="title" required maxlength="160" value="${esc(d.title)}" placeholder="e.g. CAGE business registration"></label><label>Category<select name="category">${categories.map(c=>`<option ${d.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label>${field('reference','Reference / certificate number',d.reference,'text','maxlength="300"')}${field('issuer','Issuing organisation',d.issuer,'text','maxlength="300"')}<label>Renewal owner<select name="owner_id"><option value="">Unassigned</option>${(data?.people||[]).map(p=>`<option value="${p.id}" ${d.owner_id===p.id?'selected':''}>${esc(p.full_name)}</option>`).join('')}</select></label>${field('issued_on','Issue date',d.issued_on,'date')}${field('expires_on','Expiry date (leave blank if none)',d.expires_on,'date')}<label class="company-wide">Notes<textarea name="notes" rows="3" maxlength="5000">${esc(d.notes)}</textarea></label><label class="company-wide">${d.revision?'New file version (optional)':'File *'}<input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt" ${d.revision?'':'required'}><small class="company-muted">PDF, images, Word, Excel or text. Maximum 20 MB. Previous versions are retained.</small></label></div><details><summary>Link to compliance requirements</summary>${reqs.length?reqs.map(r=>`<label class="company-check"><input type="checkbox" name="requirement_ids" value="${esc(r.id)}" ${d.requirement_ids.includes(r.id)?'checked':''}>${esc(r.title)}</label>`).join(''):'<p>Add a requirement in Requirements &amp; Renewals first.</p>'}</details><div class="dialog-actions"><button type="button" class="secondary-button" data-company-close>Cancel</button><button class="primary-button" type="submit">Save document</button></div></form>`);
 dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=e.currentTarget,v=Object.fromEntries(new FormData(f));delete v.file;v.requirement_ids=new FormData(f).getAll('requirement_ids');v.archived=!!d.archived;if(v.expires_on&&v.issued_on&&v.expires_on<v.issued_on){dialog.querySelector('.company-error').textContent='Expiry must be on or after the issue date.';return;}await mutate(()=>api().companyDocumentSave(d.id,d.revision,v,f.elements.file.files[0]));};
}
async function mutate(fn,after){
 if(busy)return;busy=true;const token=epoch;dialog.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=true);dialog.querySelector('.company-error').textContent='';
 try{await fn();if(token!==epoch)return;data=null;await refresh(true);if(token!==epoch)return;if(after)after();else{dialog.close();activeId=null;app()?.showToast('Company document saved.');}}
 catch(e){if(token===epoch)dialog.querySelector('.company-error').textContent=e.message;}
 finally{if(token===epoch){busy=false;dialog.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=false);}}
}
function archive(id){const d=docBy(id);if(!d)return;shell(d.archived?'Restore document?':'Archive document?',`<p>${esc(d.title)}</p><p>${d.archived?'This document will return to the active library.':'This document will move to Archived. Its files, history and opportunity links will be retained.'}</p><div class="dialog-actions"><button class="secondary-button" data-company-close>Cancel</button><button class="primary-button" id="company-confirm-archive">${d.archived?'Restore':'Archive document'}</button></div>`);dialog.querySelector('#company-confirm-archive').onclick=()=>mutate(()=>api().companyDocumentSave(id,d.revision,{...d,archived:!d.archived}));}
async function download(id){const v=data?.versions.find(x=>x.id===id);if(!v)return;const token=epoch;try{const url=await api().companyDocumentUrl(v.storage_path);if(token!==epoch)return;const a=document.createElement('a');a.href=url;a.rel='noopener noreferrer';a.target='_blank';a.download=v.file_name;a.click();}catch(e){if(token===epoch){if(dialog.open)dialog.querySelector('.company-error').textContent=e.message;else message(e.message);}}}
async function picker(opportunity){
 const token=epoch;await refresh(true);if(token!==epoch||!data)return;pickerTarget=opportunity;activeId=null;
 const draw=()=>{shell('Company documents for this opportunity',`<p class="company-muted">Link documents from the shared library. Files stay in one place; the latest version is available here. This does not send files to the client.</p><label>Find a document<input id="company-picker-search" type="search" placeholder="Search titles"></label><div class="company-picker-list" id="company-picker-list"></div>`);const list=()=>{const q=dialog.querySelector('#company-picker-search').value.toLowerCase();dialog.querySelector('#company-picker-list').innerHTML=data.documents.filter(d=>(!d.archived||data.links.some(l=>l.document_id===d.id&&l.opportunity_id===opportunity))&&d.title.toLowerCase().includes(q)).map(d=>{const linked=data.links.some(l=>l.document_id===d.id&&l.opportunity_id===opportunity),v=versions(d.id)[0];return `<div class="company-row"><div><strong>${esc(d.title)}</strong><p>${badge(d)}${v?' · Version '+v.version:''}</p></div><div class="company-actions">${v?`<button class="secondary-button" data-company-download="${v.id}">Download</button>`:''}<button class="secondary-button" data-company-link="${d.id}" data-linked="${linked}">${linked?'Unlink':'Link document'}</button></div></div>`;}).join('')||'<p class="company-empty">No matching documents. Upload documents under Compliance → Company Documents.</p>';};dialog.querySelector('#company-picker-search').oninput=list;list();};draw();
}
async function click(e){const b=e.target.closest('button');if(!b)return;
 if(b.dataset.companyTab)switchTab(b.dataset.companyTab);
 if(b.hasAttribute('data-company-browse'))switchTab('documents');
 if(b.hasAttribute('data-company-close')&&!busy){dialog.close();activeId=null;pickerTarget=null;}
 if(b.dataset.companyOpen)open(b.dataset.companyOpen);
 if(b.dataset.companyEdit)edit(b.dataset.companyEdit);
 if(b.dataset.companyArchive)archive(b.dataset.companyArchive);
 if(b.dataset.companyDownload)download(b.dataset.companyDownload);
 if(b.dataset.companyLink){const opportunity=pickerTarget;await mutate(()=>api().companyDocumentLink(b.dataset.companyLink,opportunity,b.dataset.linked!=='true'),()=>{picker(opportunity);window.dispatchEvent(new CustomEvent('cage:company-documents-changed'));});}
}
panel.addEventListener('click',click);dialog.addEventListener('click',click);
dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();else{activeId=null;pickerTarget=null;}});
panel.querySelector('.company-tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const buttons=[...panel.querySelectorAll('[data-company-tab]')],i=buttons.indexOf(document.activeElement);if(i<0)return;e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;switchTab(buttons[n].dataset.companyTab);buttons[n].focus();});
document.getElementById('company-add').onclick=async()=>{await refresh();if(data&&permitted())edit();};
document.getElementById('company-refresh').onclick=()=>refresh(true);
document.getElementById('company-category').innerHTML+=categories.map(c=>`<option>${esc(c)}</option>`).join('');
for(const id of ['company-search','company-category','company-status'])document.getElementById(id).addEventListener(id==='company-search'?'input':'change',renderList);
new MutationObserver(()=>{if(panel.classList.contains('active'))refresh();}).observe(panel,{attributes:true,attributeFilter:['class']});
for(const event of ['cage:access-closed','cage:session-ready'])window.addEventListener(event,()=>{epoch++;data=null;loading=null;busy=false;activeId=null;pickerTarget=null;dialog.close();dialog.innerHTML='';document.getElementById('company-list').innerHTML='';document.getElementById('company-summary').innerHTML='';message('');decorateRequirements();if(event==='cage:session-ready'&&panel.classList.contains('active'))refresh();});
window.CAGE_COMPANY_DOCUMENTS={decorateRequirements,picker,refresh,status,linkedCount:async opportunity=>{await refresh();return data?.links.filter(l=>l.opportunity_id===opportunity).length||0;}};
if(panel.classList.contains('active'))refresh();
})();
