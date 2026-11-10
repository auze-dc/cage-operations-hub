(function(){
 'use strict';
 const $=id=>document.getElementById(id),form=$('invitation-response-form'),status=$('response-status'),error=$('response-error');
 const token=new URLSearchParams(location.hash.slice(1)).get('token');
 history.replaceState(null,'',location.pathname);
 let busy=false;
 const stamp=value=>new Date(value).toLocaleString('en-GB',{timeZone:'Africa/Blantyre',dateStyle:'full',timeStyle:'short'});
 function failed(message){error.textContent=message;error.hidden=false;status.textContent='';}
 function controls(){form.querySelectorAll('input,textarea,button').forEach(el=>el.disabled=busy);$('response-retry').disabled=busy;}
 function render(data){
  $('candidate-greeting').textContent='Hello '+data.candidate_name+',';$('vacancy-title').textContent=data.vacancy_title;
  $('interview-time').textContent=stamp(data.scheduled_start)+' – '+new Date(data.scheduled_end).toLocaleTimeString('en-GB',{timeZone:'Africa/Blantyre',hour:'2-digit',minute:'2-digit'})+' (Malawi time)';
  $('interview-format').textContent=data.format;const place=$('interview-location');place.textContent='';
  try{const url=new URL(data.location_or_link);if(!['http:','https:'].includes(url.protocol))throw Error();const link=document.createElement('a');link.href=url.href;link.textContent=data.location_or_link;link.target='_blank';link.rel='noopener noreferrer';place.append(link);}catch{place.textContent=data.location_or_link;}
  $('invitation-details').hidden=false;$('response-retry').hidden=true;
  const done=data.response!=='pending';form.hidden=done;$('recorded-response').hidden=!done;
  if(done){$('recorded-response').textContent=(data.response==='accepted'?'You accepted the proposed interview time.':'You declined the proposed interview time.')+(data.reason?'\nYour message: '+data.reason:'')+'\nRecorded '+stamp(data.responded_at)+' (Malawi time). To change this response, contact CAGE.';status.textContent='Your response is recorded. Thank you.';}
  else status.textContent='Please confirm whether you can attend at the proposed time.';
 }
 async function request(action=null){
  const config=window.CAGE_CONFIG;if(!config?.supabaseUrl)throw Error('The invitation service is unavailable. Please contact CAGE.');
  const response=await fetch(config.supabaseUrl+'/functions/v1/interview-response',{method:'POST',headers:{'Content-Type':'application/json',...(config.supabaseAnonKey?{apikey:config.supabaseAnonKey}:{})},referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000),body:JSON.stringify({token,...(action?{action,reason:form.elements.reason.value.trim(),confirmed:form.elements.confirmed.checked}:{})})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Your response could not be confirmed. Please try again.');return data;
 }
 async function load(){
  if(busy)return;if(!token||!/^[a-f0-9]{64}$/.test(token)){failed('Open the private response link in your interview invitation email.');return;}
  busy=true;controls();error.hidden=true;status.textContent='Loading your invitation…';
  try{render(await request());}catch(e){failed(e.message||'Unable to load your invitation. Please try again.');$('response-retry').hidden=false;}finally{busy=false;controls();}
 }
 form.addEventListener('change',()=>{$('reason-label').textContent=form.elements.response.value==='declined'?'Reason / alternative time *':'Reason or message (optional)';});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;error.hidden=true;const choice=form.elements.response.value;
  if(!choice){failed('Choose whether you accept or decline the proposed time.');return;}
  if(choice==='declined'&&!form.elements.reason.value.trim()){failed('Please give a reason or suggest another time.');form.elements.reason.focus();return;}
  if(!form.elements.confirmed.checked){failed('Confirm your response before submitting.');return;}
  busy=true;controls();status.textContent='Recording your response…';try{render(await request(choice));}catch(e){failed(e.message||'Your response could not be confirmed. Your message is kept; please retry.');}finally{busy=false;controls();}
 });
 $('response-retry').addEventListener('click',load);load();
})();
