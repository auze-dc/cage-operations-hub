(function(){
'use strict';
const $=id=>document.getElementById(id), esc=escapeHtml, backend=()=>window.CAGE_BACKEND;
const modules=['requests','projects','tasks','crm','calendar','missions','assets','compliance','chat','finance','approvals','commercial','leave','knowledge','team','evidence','reports','hr','training'];
let personal={reminders:[],notifications:[]}, users=[], rules=[], poll, recorder, stream, chunks=[], voiceBlob, voiceUrl, voiceThread, started, clock, discarded=false;
const profile=()=>backend().currentProfile(), me=()=>backend().currentMemberId();
function panel(id,content){const section=document.createElement('section');section.className='view-panel';section.dataset.viewPanel=id;section.innerHTML=content;document.querySelector('[data-view-panel="dashboard"]').parentElement.append(section);}
const nav=document.querySelector('.nav-item[data-view="dashboard"]');
nav.insertAdjacentHTML('afterend','<button class="nav-item" data-view="mywork"><span class="nav-icon">✓</span><span>My work</span></button>');
document.querySelector('#admin-nav-item')?.insertAdjacentHTML('afterend','<button class="nav-item" data-view="access" id="module-access-nav" hidden><span class="nav-icon">⚙</span><span>Module access</span></button>');
const bell=document.querySelector('.notification-button');bell.dataset.view='notifications';bell.setAttribute('aria-label','Open my notifications');
panel('mywork',`<div class="section-intro mywork-intro"><div><p class="date-line">Personal workspace</p><h2>My work</h2><p>Plan your day, protect your focus and keep every commitment visible.</p></div><button class="primary-button" id="add-personal-reminder">＋ Set reminder</button></div><p id="personal-error" role="status"></p><div class="mywork-layout"><main id="mywork-planner-slot"></main><aside class="mywork-sidebar"><article class="surface mywork-side-card"><div class="mywork-card-heading"><span class="mywork-card-icon">◷</span><div><h3>Reminders</h3><p>Personal prompts you control</p></div></div><div id="personal-reminders"></div></article><article class="surface mywork-side-card"><div class="mywork-card-heading"><span class="mywork-card-icon">◇</span><div><h3>Other responsibilities</h3><p>Work outside your task plan</p></div></div><div id="personal-responsibilities"></div></article></aside></div>`);
panel('notifications',`<div class="section-intro"><div><h2>Notifications for you</h2><p>Mentions, assignments and personal reminders. Open a notification to go to the relevant work.</p></div><button class="secondary-button" id="read-all-notifications">Mark all read</button></div><div id="personal-notifications" class="surface"></div>`);
panel('access',`<div class="section-intro"><div><h2>Staff module access</h2><p>Choose which modules each staff account may open or edit. Administrators retain full access.</p></div></div><article class="surface"><label class="field"><span>Staff member</span><select id="access-user"></select></label><div id="module-access-grid" class="module-access-grid"></div><button class="primary-button" id="save-module-access">Save module access</button><p id="access-status" role="status"></p></article>`);
document.body.insertAdjacentHTML('beforeend',`<dialog id="personal-reminder-dialog" class="app-dialog"><form id="personal-reminder-form"><div class="dialog-heading"><h2>Set a personal reminder</h2><button type="button" data-close-personal="personal-reminder-dialog" aria-label="Close">×</button></div><input type="hidden" name="id"><label class="field"><span>What do you want to work on?</span><input name="title" required maxlength="250"></label><label class="field"><span>When? (your device's time zone)</span><input type="datetime-local" name="due" required></label><label class="field"><span>Remind me before</span><select name="lead"><option value="0">At the planned time</option><option value="15" selected>15 minutes</option><option value="60">1 hour</option><option value="1440">1 day</option></select></label><p>Reminders appear in your notification centre, including when you return to the Hub. A gentle daily nudge continues until you complete or reschedule the plan.</p><p id="reminder-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary-button" data-close-personal="personal-reminder-dialog">Cancel</button><button class="primary-button">Save reminder</button></div></form></dialog>
<dialog id="equipment-action-dialog" class="app-dialog"><form id="equipment-action-form"><div class="dialog-heading"><h2 id="equipment-action-title">Equipment handover</h2><button type="button" data-close-personal="equipment-action-dialog">×</button></div><input name="id" type="hidden"><input name="action" type="hidden"><label class="field"><span>Responsible staff</span><select name="custodian" id="handover-custodian"></select></label><label class="field"><span>Project</span><select name="project" id="handover-project"></select></label><label class="field"><span>Expected return</span><input type="date" name="returnDate"></label><label class="field"><span>Condition at handover</span><select name="condition"><option>Excellent</option><option>Good</option><option>Needs inspection</option><option>Damaged</option></select></label><label class="field"><span>Handover notes / accessories</span><textarea name="notes" required></textarea></label><p id="handover-error" role="alert"></p><button class="primary-button">Save handover</button></form></dialog><dialog id="equipment-history-dialog" class="app-dialog"><h2>Equipment history</h2><div id="equipment-history-content"></div><button type="button" data-close-personal="equipment-history-dialog">Close</button></dialog>`);
const expenseForm=$('expense-form');expenseForm.querySelector('.form-grid').insertAdjacentHTML('beforeend','<label class="field field-wide"><span>Receipt attachment (PDF or image, up to 20 MB)</span><input name="receiptFile" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"><small>Choose a file or take a receipt photo on your phone.</small></label>');
$('asset-form').querySelector('.form-grid').insertAdjacentHTML('beforeend','<label class="field"><span>Serial number</span><input name="serial"></label><label class="field"><span>Storage location</span><input name="location"></label><label class="field field-wide"><span>Accessories / notes</span><textarea name="notes"></textarea></label>');
$('chat-mention').insertAdjacentHTML('afterend','<button type="button" id="record-voice" aria-label="Record a voice message">🎙 Voice</button>');
$('chat-form').insertAdjacentHTML('beforebegin','<div id="voice-bar" class="voice-bar" hidden><span id="voice-status" role="status"></span><audio id="voice-preview" controls hidden></audio><button type="button" id="stop-voice">Stop</button><button type="button" id="send-voice" hidden>Send voice message</button><button type="button" id="cancel-voice">Discard</button></div>');
function applyAccess(){
 if(!profile()) return;
 document.querySelectorAll('.nav-item[data-view]').forEach(el=>{el.hidden=(el.dataset.view==='access' ? profile().role!=='admin' : backend().moduleLevel(el.dataset.view)==='none');});
 document.querySelectorAll('[data-view-panel]').forEach(panel=>{
   if(['mywork','notifications'].includes(panel.dataset.viewPanel))return;
   const level=backend().moduleLevel(panel.dataset.viewPanel);
   panel.querySelectorAll('button,input,select,textarea').forEach(el=>{
    if(el.dataset.accessDisabled){el.disabled=false;delete el.dataset.accessDisabled;}
    const isNavigation=el.matches('[data-view],[data-go-view],[data-chat-thread],[data-chat-filter],[data-open-project],[data-project-tab],[data-play-voice],[data-preview-chat-file],[data-open-receipt],[data-equipment-history]') || el.type==='search';
    if(level==='view' && !isNavigation && !el.closest('[data-personal-readonly]')) { el.disabled=true;el.dataset.accessDisabled='true'; }
   });
 });
 if(backend().moduleLevel(activeView)==='none' || (activeView==='access' && profile().role!=='admin')) setView('mywork');
}
function updateBadge(){const count=personal.notifications.filter(n=>!n.read_at).length;$('notification-count').textContent=count;bell.setAttribute('aria-label',`Notifications: ${count} unread`);}
async function refresh(){if(!profile())return;try{personal=await backend().personalData();updateBadge();refreshView();$('personal-error').textContent='';}catch(e){$('personal-error').textContent=e.message||'Could not load personal reminders.';}}
function formatWhen(value){return new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});}
function refreshView(){
 if(activeView==='mywork')renderMine();
 if(activeView==='notifications')renderNotifications();
 updateBadge();
}
function renderMine(){
 const list=personal.reminders.filter(r=>!r.completed_at);
 $('personal-reminders').innerHTML=list.map(r=>`<div class="personal-row" data-reminder-row="${r.id}"><div><strong>${esc(r.title)}</strong><small>${esc(formatWhen(r.due_at))}${new Date(r.due_at)<new Date()?' · Ready for your next step':''}</small></div><div class="personal-actions"><button data-edit-reminder="${r.id}">Reschedule</button><button data-complete-reminder="${r.id}">Done</button></div></div>`).join('')||'<p>No pending reminders. Set a plan for your next task.</p>';
 const mine=[];
 const add=(key,module,label,match,title)=>{if(backend().moduleLevel(module)==='none')return;(state[key]||[]).filter(match).forEach(r=>mine.push({id:r.id,module,title:title(r),label,due:r.due||r.deadline||r.nextService||''}));};
 add('requests','requests','Request',r=>r.owner===me()&&!['Converted','Lost / Declined'].includes(r.stage),r=>r.title);
 add('projects','projects','Project',r=>r.owner===me()||r.lead===me()||(r.team||r.members||[]).includes(me()),r=>r.name);
 add('assets','assets','Equipment',r=>r.custodian===me(),r=>r.name);
 add('deals','crm','Opportunity',r=>r.owner===me()&&!['Won','Lost'].includes(r.stage),r=>r.name);
 $('personal-responsibilities').innerHTML=mine.map(r=>`<div class="personal-row responsibility-row"><div><span class="responsibility-kind">${r.label}</span><button class="personal-link" data-personal-view="${r.module}" data-personal-target="${esc(r.id)}">${esc(r.title)}</button><small>${r.due?'Due '+esc(r.due):'Open responsibility'}</small></div><button class="icon-reminder" data-plan-title="${esc(r.title)}" aria-label="Set reminder">◷</button></div>`).join('')||'<div class="mywork-empty"><span>✓</span><p>No other responsibilities need your attention.</p></div>';
}
function renderNotifications(){
 $('personal-notifications').innerHTML=personal.notifications.map(n=>`<button class="notification-entry ${n.read_at?'':'unread'}" data-notification="${n.id}"><span><strong>${esc(n.title)}</strong><span>${esc(n.body)}</span><small>${esc(formatWhen(n.created_at))}${n.read_at?'':' · Unread'}</small></span><span aria-hidden="true">→</span></button>`).join('')||'<p>You are up to date. Relevant notifications will appear here.</p>';
}
function openReminder(id='',title=''){
 const f=$('personal-reminder-form');f.reset();f.elements.id.value=id;
 const r=personal.reminders.find(r=>r.id===id);f.elements.title.value=r?.title||title;
 const date=new Date(r?.due_at||Date.now()+3600000);date.setMinutes(date.getMinutes()-date.getTimezoneOffset());f.elements.due.value=date.toISOString().slice(0,16);f.elements.lead.value=r?.lead_minutes??15;
 $('reminder-error').textContent='';$('personal-reminder-dialog').showModal();
}
function navigate(view,id){
 if(backend().moduleLevel(view)==='none'){showToast('Your module access has changed. Ask an administrator if you need this record.');return;}
 setView(view);
 if(view==='chat')selectChatThread(id);
 if(view==='requests' && requestById(id))openRequest(id);
 if(view==='assets'){const asset=assetById(id);if(asset){$('asset-search').value=asset.tag;assetFilter='all';renderAssets();}}
 if(view==='crm' && dealById(id))openDealDialog(id);
 if(view==='projects' && projectById(id))openProject(id);
 if(view==='finance'){const type=state.quotes.some(r=>r.id===id)?'quote':state.invoices.some(r=>r.id===id)?'invoice':null;if(type)openSendDocument(type,id);}
 if(view==='approvals')document.querySelector(`[data-decide-approval="${CSS.escape(id)}"]`)?.closest('article')?.scrollIntoView({block:'center'});
 if(view==='tasks') { const task=state.tasks.find(t=>t.id===id);if(task)openTask(id); }
 if(view==='mywork'){const row=document.querySelector(`[data-reminder-row="${CSS.escape(id)}"]`);row?.scrollIntoView({block:'center'});}
}
async function renderAccess(){
 if(profile()?.role!=='admin')return;
 try{const result=await backend().accessAccounts();users=result.users;rules=result.rules;$('access-user').innerHTML=users.map(u=>`<option value="${u.id}">${esc(u.full_name)} · ${esc(u.role)}</option>`).join('');renderAccessGrid();}catch(e){$('access-status').textContent=e.message;}
}
function renderAccessGrid(){
 const u=users.find(u=>u.id===$('access-user').value);const admin=u?.role==='admin';
 $('module-access-grid').innerHTML=modules.map(m=>{const explicit=rules.find(r=>r.user_id===u?.id&&r.module===m);const defaultLevel=u?.role==='viewer'?'view':m==='approvals'&&u?.role!=='manager'?'none':m==='hr'&&!['manager','hr'].includes(u?.role)?'view':'edit';const level=admin?'edit':u?.role==='viewer'?(explicit?.access==='none'?'none':'view'):explicit?.access||defaultLevel;return `<label class="field"><span>${esc(viewMeta[m]?.[0]||m)}</span><select data-module="${m}" ${admin?'disabled':''}>${['none','view','edit'].map(v=>`<option value="${v}" ${v==='edit'&&u?.role==='viewer'?'disabled':''} ${level===v?'selected':''}>${{none:'No access',view:'View only',edit:'View and edit'}[v]}</option>`).join('')}</select></label>`;}).join('');
 $('save-module-access').disabled=admin;$('access-status').textContent=admin?'Administrators always have full access.':'';
}
$('access-user').addEventListener('change',renderAccessGrid);
$('save-module-access').addEventListener('click',async()=>{const b=$('save-module-access');b.disabled=true;try{await backend().saveModuleAccess($('access-user').value,Object.fromEntries([...document.querySelectorAll('[data-module]')].map(e=>[e.dataset.module,e.value])));$('access-status').textContent='Access saved. Changes apply on the staff member’s next refresh or sync.';}catch(e){$('access-status').textContent=e.message;}finally{b.disabled=false;}});
$('add-personal-reminder').onclick=()=>openReminder();
$('personal-reminder-form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;try{if(new Date(f.elements.due.value)<=new Date())throw new Error('Choose a time in the future.');await backend().saveReminder({title:f.elements.title.value.trim(),due_at:new Date(f.elements.due.value).toISOString(),lead_minutes:Number(f.elements.lead.value)},f.elements.id.value||null);$('personal-reminder-dialog').close();await refresh();}catch(e){$('reminder-error').textContent=e.message;}};
$('read-all-notifications').onclick=async()=>{try{await backend().readNotification();await refresh();}catch(e){showToast(e.message);}};
function cleanupVoice(){clearInterval(clock);stream?.getTracks().forEach(t=>t.stop());stream=null;if(voiceUrl)URL.revokeObjectURL(voiceUrl);voiceUrl=null;voiceBlob=null;$('voice-preview').removeAttribute('src');$('voice-bar').hidden=true;$('record-voice').disabled=false;}
$('record-voice').onclick=async()=>{
 if(backend().moduleLevel('chat')!=='edit')return;
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){showToast('Voice recording is unavailable in this browser. You can attach an audio file instead.');return;}
 try{
 voiceThread=activeChatThread;discarded=false;chunks=[];voiceBlob=null;$('record-voice').disabled=true;
 stream=await navigator.mediaDevices.getUserMedia({audio:true});
 const type=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
 recorder=new MediaRecorder(stream,type?{mimeType:type}:{});
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 recorder.onerror=()=>{discarded=true;cleanupVoice();showToast('Recording failed. Please try again.');};
 recorder.onstop=()=>{clearInterval(clock);stream?.getTracks().forEach(t=>t.stop());if(discarded){cleanupVoice();return;}voiceBlob=new Blob(chunks,{type:recorder.mimeType});voiceBlob.duration=Math.min(300,(Date.now()-started)/1000);voiceUrl=URL.createObjectURL(voiceBlob);$('voice-preview').src=voiceUrl;$('voice-preview').hidden=false;$('stop-voice').hidden=true;$('send-voice').hidden=false;$('voice-status').textContent='Listen before sending';};
 recorder.start();started=Date.now();$('voice-bar').hidden=false;$('voice-preview').hidden=true;$('stop-voice').hidden=false;$('send-voice').hidden=true;
 clock=setInterval(()=>{const secs=Math.floor((Date.now()-started)/1000);$('voice-status').textContent=`Recording ${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')} · max 5 minutes`;if(secs>=300&&recorder.state==='recording')recorder.stop();},250);
 }catch(e){cleanupVoice();showToast(e.name==='NotAllowedError'?'Microphone access was declined. Allow it in your browser to record.':e.message);}
};
$('stop-voice').onclick=()=>{if(recorder?.state==='recording')recorder.stop();};
$('cancel-voice').onclick=()=>{discarded=true;if(recorder?.state==='recording')recorder.stop();else cleanupVoice();};
$('send-voice').onclick=async()=>{
 if(!voiceBlob)return;if(activeChatThread!==voiceThread){showToast('Return to the chat where you started recording before sending.');return;}
 const button=$('send-voice');button.disabled=true;const caption=$('chat-input').value;const targetThread=voiceThread;
 try{const ext=voiceBlob.type.includes('mp4')?'m4a':voiceBlob.type.includes('ogg')?'ogg':'webm';const file=new File([voiceBlob],`voice-${Date.now()}.${ext}`,{type:voiceBlob.type});const uploaded=await backend().uploadFile(file,'chat',voiceThread);if(activeChatThread!==targetThread)selectChatThread(targetThread);sendChatMessage(caption,uploaded.name,uploaded.path,{audio:true,audioDuration:voiceBlob.duration});cleanupVoice();}catch(e){$('voice-status').textContent=e.message||'Upload failed. Your recording is ready to retry.';}finally{button.disabled=false;}
};
window.addEventListener('pagehide',()=>{discarded=true;if(recorder?.state==='recording')recorder.stop();cleanupVoice();});
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 try{
 if(b.dataset.closePersonal)$(b.dataset.closePersonal).close();
 if(b.dataset.editReminder)openReminder(b.dataset.editReminder);
 if(b.dataset.planTitle)openReminder('',b.dataset.planTitle);
 if(b.dataset.completeReminder){await backend().saveReminder({completed_at:new Date().toISOString()},b.dataset.completeReminder);await refresh();}
 if(b.dataset.personalView)navigate(b.dataset.personalView,b.dataset.personalTarget);
 if(b.dataset.notification){const n=personal.notifications.find(n=>n.id===b.dataset.notification);await backend().readNotification(n.id);navigate(n.target_view,n.target_id);await refresh();}
 if(b.dataset.openReceipt){const r=state.expenses.find(x=>x.id===b.dataset.openReceipt);if(r?.receiptPath)await backend().openFile(r.receiptPath);}
 if(b.dataset.playVoice){const m=state.messages.find(m=>m.id===b.dataset.playVoice);const url=await backend().fileUrl(m.attachmentPath);const host=document.querySelector(`[data-voice-player="${CSS.escape(m.id)}"]`);host.innerHTML='';const audio=document.createElement('audio');audio.controls=true;audio.src=url;host.append(audio);audio.play().catch(()=>{});}
 if(b.dataset.editEquipment){if(backend().moduleLevel('assets')!=='edit')throw new Error('Equipment edit access is required.');openAssetDialog(b.dataset.editEquipment);}
 if(b.dataset.equipmentAction){const a=assetById(b.dataset.equipmentId);if(b.dataset.equipmentAction==='checkout'&&a.status!=='Available')throw new Error('This equipment is not available. Complete maintenance or return it first.');const f=$('equipment-action-form');f.reset();f.elements.id.value=a.id;f.elements.action.value=b.dataset.equipmentAction;$('handover-custodian').innerHTML=assignableTeam().map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');$('handover-project').innerHTML='<option value="">Choose project</option>'+state.projects.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');f.elements.project.value=a.project||'';f.elements.custodian.value=a.custodian||me();f.elements.returnDate.required=b.dataset.equipmentAction==='checkout';f.elements.project.required=b.dataset.equipmentAction==='checkout';$('equipment-action-title').textContent=`${b.dataset.equipmentAction==='checkout'?'Check out':'Return'} · ${a.name}`;$('handover-error').textContent='';$('equipment-action-dialog').showModal();}
 if(b.dataset.equipmentHistory){const a=assetById(b.dataset.equipmentHistory);$('equipment-history-content').innerHTML=(a.history||[]).slice().reverse().map(h=>`<div class="personal-row"><div><strong>${esc(h.action)} · ${esc(formatWhen(h.at))}</strong><p>${esc(h.notes)} · ${esc(teamMember(h.by).name)}</p><small>${esc(h.condition||'')} · ${esc(h.returnDate||'')}</small></div></div>`).join('')||'<p>No handovers recorded yet.</p>';$('equipment-history-dialog').showModal();}
 }catch(error){showToast(error.message||'This action could not be completed.');}
});
$('equipment-action-form').onsubmit=e=>{e.preventDefault();if(backend().moduleLevel('assets')!=='edit')return;const f=e.currentTarget,a=assetById(f.elements.id.value),action=f.elements.action.value;const condition=f.elements.condition.value;
 if(action==='checkout'&&(a.status!=='Available'||f.elements.returnDate.value<new Date().toISOString().slice(0,10))){$('handover-error').textContent='Choose available equipment and a return date of today or later.';return;}
 a.history=a.history||[];a.history.push({action,at:new Date().toISOString(),by:me(),custodian:f.elements.custodian.value,project:f.elements.project.value,condition,notes:f.elements.notes.value,returnDate:f.elements.returnDate.value});a.custodian=f.elements.custodian.value;a.condition=condition;a.project=action==='checkout'?f.elements.project.value:'';a.returnDate=action==='checkout'?f.elements.returnDate.value:'';a.status=action==='checkout'?'Assigned':['Damaged','Needs inspection'].includes(condition)?'Maintenance':'Available';saveState();renderAssets();$('equipment-action-dialog').close();};
document.addEventListener('submit',e=>{
 const formModules={'asset-form':'assets','equipment-action-form':'assets','expense-form':'finance','invoice-form':'finance','quote-form':'finance','send-form':'finance','task-form':'tasks','project-form':'projects','chat-form':'chat','training-program-form':'training','training-cohort-form':'training','learner-form':'training'};
 const module=formModules[e.target.id];
 if(module&&backend().moduleLevel(module)!=='edit'&&e.submitter?.value!=='cancel'){e.preventDefault();e.stopImmediatePropagation();showToast('You have view-only access to this module. Ask an administrator for edit access.');}
},true);
window.CAGE_PERSONAL={applyAccess,updateBadge,refreshView,refresh,chatUnread(thread){return personal.notifications.filter(n=>!n.read_at&&n.target_view==='chat'&&n.target_id===thread).length;},chatUnreadTotal(){return personal.notifications.filter(n=>!n.read_at&&n.target_view==='chat').length;},view(v){if(v!=='chat'&&recorder?.state==='recording')recorder.stop();if(v==='mywork'||v==='notifications'){refreshView();refresh();}if(v==='access')renderAccess();}};
window.addEventListener('cage:session-ready',()=>{refresh();applyAccess();if(poll)clearInterval(poll);poll=setInterval(()=>{if(!document.hidden)refresh();},30000);setView('mywork');});
})();
