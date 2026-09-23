(function(){'use strict';
 const $=id=>document.getElementById(id),form=$('response-form');
 const token=location.hash.slice(1);let pdfUrl;
 const error=message=>{$('error').textContent=message;$('error').hidden=false;};
 async function call(values){
  const c=window.CAGE_CONFIG||{};
  if(!c.supabaseUrl||!c.supabaseAnonKey)throw new Error('This page is not configured. Please contact CAGE.');
  const r=await fetch(c.supabaseUrl+'/functions/v1/quote-response',{method:'POST',headers:{'Content-Type':'application/json',apikey:c.supabaseAnonKey},body:JSON.stringify({token,...values}),signal:AbortSignal.timeout(20000)});
  const result=await r.json();if(!r.ok)throw new Error(result.error||'Unable to submit. Please try again.');return result;
 }
 function complete(r){$('details').hidden=true;$('success').hidden=false;$('success').textContent=`${r.number}: ${r.decision}. Recorded for ${r.name} on ${new Date(r.respondedAt).toLocaleString('en-GB',{timeZone:'Africa/Blantyre'})} CAT. CAGE has been notified.`;}
 form.elements.action.onchange=()=>{form.elements.note.required=form.elements.action.value==='Changes requested';form.elements.note.minLength=form.elements.note.required?5:0;};
 form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('button');if(b.disabled)return;b.disabled=true;$('error').hidden=true;
  try{complete(await call({action:form.elements.action.value,name:form.elements.name.value,note:form.elements.note.value,authorised:form.elements.authorised.checked}));}
  catch(e){error(e.message||'Connection interrupted. Retry the same response.');}finally{b.disabled=false;}
 };
 (async()=>{try{
  const r=await call({});if(r.decision){complete(r);return;}
  for(const key of ['number','client','description'])$(key).textContent=r[key]||'';
  $('amount').textContent=(r.currency||'MWK')+' '+Number(r.amount).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
  $('valid').textContent='Valid until '+r.validUntil+' · Malawi time (CAT)';
  $('approver').textContent='Private response invitation for '+r.approver;
  const bytes=Uint8Array.from(atob(r.pdf.content),c=>c.charCodeAt(0));pdfUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));$('pdf').href=pdfUrl;$('pdf').download=r.pdf.filename;
  $('details').hidden=false;
 }catch(e){error(e.message||'Unable to load. Reload this page to retry.');}finally{$('loading').hidden=true;}})();
 window.addEventListener('pagehide',()=>{if(pdfUrl)URL.revokeObjectURL(pdfUrl);});
})();
