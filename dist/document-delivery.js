(function(){'use strict';
 const $=id=>document.getElementById(id),escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const split=value=>[...new Set(String(value||'').split(/[,;\n]/).map(s=>s.trim().toLowerCase()).filter(Boolean))];
 function refreshApprovers(form){
  const select=form.elements.clientApprover;if(!select)return;
  const prior=select.value,addresses=split(form.elements.recipient.value);
  select.replaceChildren(new Option('Choose authorised client approver',''),...addresses.map(a=>new Option(a,a)));
  if(addresses.includes(prior))select.value=prior;else if(addresses.length===1)select.value=addresses[0];
 }
 for(const id of ['quote-form','invoice-form','send-form']){
  const form=$(id);if(!form)continue;
  const to=form.elements.recipient;to.multiple=true;to.placeholder='client@example.org, accounts@example.org';
  to.closest('label').querySelector('span').textContent='To email addresses *';
  to.closest('label').insertAdjacentHTML('afterend',`<label class="field"><span>CC (optional)</span><input type="email" name="deliveryCc" multiple placeholder="Copy visible to recipients"></label><label class="field"><span>BCC (optional)</span><input type="email" name="deliveryBcc" multiple placeholder="Copy hidden from other recipients"></label>${id!=='invoice-form'?'<label class="field field-wide" data-approver-field><span>Authorised client approver</span><select name="clientApprover"></select><small>The approver must be a To recipient. Only this person receives a separate private response link. CC and BCC receive the PDF email only.</small></label>':''}<p class="field field-wide">Separate email addresses with commas. Up to 50 recipients. CC/BCC apply to this send only.</p>`);
  for(const field of [to,form.elements.deliveryCc,form.elements.deliveryBcc])field.addEventListener('change',()=>{field.value=split(field.value).join(', ');refreshApprovers(form);});
  to.addEventListener('input',()=>refreshApprovers(form));
  form.addEventListener('reset',()=>setTimeout(()=>refreshApprovers(form),0));refreshApprovers(form);
 }
 function fields(payload){
  const send=$('send-form');
  const form=$('send-dialog').open&&send.elements.documentId.value===payload.record.id?send:$(payload.type+'-form');
  for(const name of ['recipient','deliveryCc','deliveryBcc']){const field=form?.elements[name];if(field&&!field.checkValidity())throw new Error('Enter valid email addresses separated by commas.');}
  if(new Set([...split(payload.recipient),...split(form?.elements.deliveryCc?.value),...split(form?.elements.deliveryBcc?.value)]).size>50)throw new Error('Use no more than 50 recipients in total.');
  const selected=form?.elements.clientApprover?.value||'';
  if(payload.type==='quote'&&payload.record.status!=='Accepted'&&!selected&&split(payload.recipient).length!==1)throw new Error('Choose the authorised client approver.');
  return {recipient:split(payload.recipient).join(', '),cc:split(form?.elements.deliveryCc?.value),bcc:split(form?.elements.deliveryBcc?.value),approver:payload.type==='quote'&&payload.record.status!=='Accepted'?(selected|| (split(payload.recipient).length===1?split(payload.recipient)[0]:'')):null};
 }
 function open(type,record,form){
  const field=form.querySelector('[data-approver-field]');field.hidden=type!=='quote'||record.status==='Accepted';
  refreshApprovers(form);
 }
 document.body.insertAdjacentHTML('beforeend','<dialog id="document-history-v2" class="app-dialog"><div class="dialog-heading"><h2>Delivery and client responses</h2><button type="button" id="close-history-v2">Close</button></div><div id="document-history-content" aria-live="polite"></div></dialog>');
 $('close-history-v2').onclick=()=>$('document-history-v2').close();
 async function history(type,id){
  const dialog=$('document-history-v2'),box=$('document-history-content');box.textContent='Loading…';dialog.showModal();
  try{
   const rows=await window.CAGE_BACKEND.documentHistory(type,id);
   box.innerHTML=rows.length?rows.map(r=>`<article style="padding:16px 0;border-bottom:1px solid #dce5eb"><p><strong>${escape(new Date(r.createdAt).toLocaleString('en-GB',{timeZone:'Africa/Blantyre'}))} CAT</strong></p><p>To: ${escape(r.to.join(', '))}<br>CC: ${escape(r.cc.join(', ')||'None')}<br>BCC: ${escape(r.bccHidden?'Visible only to sender and administrators':r.bcc.join(', ')||'None')}</p><p>PDF email: ${escape(r.emailStatus)}<br>Response invitation: ${escape(r.invitationStatus)}</p>${r.approver?`<p>Approver: ${escape(r.approver)}</p>`:''}${r.decision?`<p><strong>${escape(r.decision)}</strong> · ${escape(r.name)} · ${escape(new Date(r.respondedAt).toLocaleString('en-GB',{timeZone:'Africa/Blantyre'}))} CAT</p><p style="white-space:pre-wrap">${escape(r.note)}</p>`:''}</article>`).join(''):'No sends recorded by the updated delivery system yet.';
   box.insertAdjacentHTML('beforeend','<p>Provider accepted means the email provider accepted the message; it does not confirm inbox delivery. Client identity is based on possession of the private email link and the name entered.</p>');
  }catch(e){box.textContent=e.message||'History could not be loaded. Close and reopen to retry.';}
 }
 document.addEventListener('click',e=>{const b=e.target.closest('[data-delivery-history]');if(b)history(b.dataset.deliveryHistory,b.dataset.documentId);});
 function addHistoryButtons(){
  document.querySelectorAll('[data-send-document][data-document-id]').forEach(b=>{
   if(b.nextElementSibling?.hasAttribute('data-delivery-history'))return;
   const button=document.createElement('button');button.type='button';button.className='document-action';button.dataset.deliveryHistory=b.dataset.sendDocument;button.dataset.documentId=b.dataset.documentId;button.textContent='History';b.after(button);
  });
 }
 new MutationObserver(addHistoryButtons).observe(document.body,{childList:true,subtree:true});addHistoryButtons();
 window.CAGE_DELIVERY={fields,open};
})();
