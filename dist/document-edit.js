(function(){
'use strict';
const $=id=>document.getElementById(id),api=()=>window.CAGE_BACKEND;
const sessions=new Map();
function allowed(){return api()?.moduleLevel('finance')==='edit';}
function addButtons(){
 document.querySelectorAll('[data-send-document][data-document-id]').forEach(send=>{
  const type=send.dataset.sendDocument,id=send.dataset.documentId;
  if(!['quote','invoice'].includes(type))return;
  let button=[...send.parentElement.querySelectorAll('[data-edit-finance]')].find(b=>b.dataset.editFinance===type&&b.dataset.recordId===id);
  if(!button){button=document.createElement('button');button.type='button';button.className='document-action';button.dataset.editFinance=type;button.dataset.recordId=id;button.textContent='Edit';send.parentElement.append(button);}
  button.hidden=!allowed();button.disabled=!allowed();
 });
}
function open(type,id){
 if(!allowed())return window.CAGE_APP.showToast('Finance edit access is required. Contact your administrator.');
 const record=window.CAGE_APP.getState()[type==='quote'?'quotes':'invoices'].find(r=>r.id===id);if(!record)return;
 if(type==='quote')openQuoteDialog(record.deal||'',record.project||'');else openInvoiceDialog(record.project||'');
 const form=$(type+'-form');form.dataset.editDocumentId=id;form.dataset.editDocumentNumber=record.number;
 sessions.set(type,structuredClone(record));
 for(const [name,value] of Object.entries(record)){
  const field=form.elements.namedItem(name);if(!field||name==='status'||name==='amount')continue;
  if(field.tagName==='SELECT'&&value&&!Array.from(field.options).some(o=>o.value===String(value)))field.add(new Option(String(value),String(value)));
  if(['INPUT','TEXTAREA','SELECT'].includes(field.tagName)&&field.type!=='checkbox')field.value=value??'';
 }
 window.CAGE_DOCUMENTS.fillItems(form,record.items?.length?record.items:[{description:record.description||'',quantity:1,unitPrice:record.amount||0}]);
 form.elements.currency.value=record.currency||'MWK';
 form.elements.preparedBy.value=record.preparedBy||api().currentProfile()?.full_name||'CAGE';
 form.querySelector('.dialog-heading h2').textContent=`Edit ${record.number}`;
 const accepted=type==='quote'&&(record.status==='Accepted'||record.clientResponse?.decision==='Accepted');
 form.querySelector('.dialog-actions .primary-button').textContent=accepted?'Save as new quotation':'Save changes';
 for(const name of ['status','sendNow','deliveryCc','deliveryBcc','clientApprover']){const f=form.elements.namedItem(name);if(f){f.disabled=true;f.closest('label').hidden=true;}}
 let note=form.querySelector('[data-edit-notice]');if(!note){note=document.createElement('p');note.dataset.editNotice='';form.querySelector('.dialog-actions').before(note);}
 note.hidden=false;note.textContent=accepted?`The client accepted ${record.number}. Saving creates a new draft quotation with a new number; the accepted original and its response stay unchanged.`:'Save changes, review the PDF, then use Send to email the revised document. Earlier emails and delivery history remain unchanged. Recorded invoice payments are preserved.';
 if(record.revisionOfNumber)note.textContent+=` Revision of ${record.revisionOfNumber}.`;
 form.elements.recipient.dispatchEvent(new Event('input',{bubbles:true}));
}
for(const type of ['quote','invoice']){
 const form=$(type+'-form'),heading=form.querySelector('.dialog-heading h2'),submit=form.querySelector('.dialog-actions .primary-button');
 const originalTitle=heading.textContent,originalSubmit=submit.textContent;
 form.addEventListener('reset',()=>{
  delete form.dataset.editDocumentId;delete form.dataset.editDocumentNumber;sessions.delete(type);
  heading.textContent=originalTitle;submit.textContent=originalSubmit;
  for(const name of ['status','sendNow','deliveryCc','deliveryBcc','clientApprover']){const f=form.elements.namedItem(name);if(f){f.disabled=false;f.closest('label').hidden=false;}}
  const note=form.querySelector('[data-edit-notice]');if(note)note.hidden=true;
 });
 // Capture the edit submission so the original create handler cannot duplicate it.
 form.addEventListener('submit',async event=>{
  if(!form.dataset.editDocumentId)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(event.submitter?.value==='cancel'){$(type+'-dialog').close();return;}
  if(form.dataset.editSaving)return;
  const error=$(type+'-form-error');error.textContent='';
  if(!allowed()){error.textContent='Finance edit access is required. Contact your administrator.';return;}
  form.dataset.editSaving='true';submit.disabled=true;
  try{
   const edits=window.CAGE_DOCUMENTS.fields(form);delete edits.amount;
   for(const name of ['client','recipient','description','issued',type==='quote'?'validUntil':'due',type==='quote'?'deal':'project'])edits[name]=form.elements.namedItem(name).value.trim();
   const result=await api().opsRpc('edit_finance_document',{doc_type:type,expected_record:sessions.get(type),edits});
   $(type+'-dialog').close();delete form.dataset.editDocumentId;sessions.delete(type);
   window.CAGE_APP.showToast(result.newRevision?`${result.record.number} saved as a new quotation. Review it, then send.`:`${result.record.number} updated. Review the PDF before sending again.`);
  }catch(e){error.textContent=e.message||'Unable to save. Your edits remain in this form.';}
  finally{delete form.dataset.editSaving;submit.disabled=false;}
 },true);
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-edit-finance]');if(b)open(b.dataset.editFinance,b.dataset.recordId);});
let scheduled=false;new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;addButtons();});}}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('cage:session-ready',addButtons);addButtons();
})();
