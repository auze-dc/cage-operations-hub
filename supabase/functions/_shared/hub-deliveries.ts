// Reuses the existing authenticated cron, sender and provider. No browser service key.
export async function dispatchHubDeliveries(db:any,key:string,from:string,base:string){
 const checked=async(q:any)=>{const r=await q;if(r.error)throw r.error;return r.data;};
 const jobs=await checked(db.rpc('claim_hub_deliveries'));let sent=0,retrying=0;
 const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 const labels:Record<string,string>={notice:'New CAGE notice',invitation:'CAGE calendar invitation',reminder:'CAGE calendar reminder',updated:'CAGE event updated',cancelled:'CAGE event cancelled',occurrence_updated:'CAGE occurrence updated',occurrence_cancelled:'CAGE occurrence cancelled'};
 for(let i=0;i<jobs.length;i+=5)await Promise.all(jobs.slice(i,i+5).map(async(claim:any)=>{
  const job=await checked(db.rpc('prepare_hub_delivery',{jid:claim.id}));if(!job)return;
  try{
   const url=new URL(base);if(url.protocol!=='https:')throw Error('APP_URL must be an https URL');url.searchParams.set('view',job.notice_id?'notices':'calendar');url.searchParams.set('record',job.notice_id||job.event_id);
   let payload=job.payload;if(!payload){payload={from,to:[job.recipient],subject:labels[job.kind]||'CAGE work update',html:`<div style="font-family:Arial,sans-serif;max-width:600px;color:#202c3b"><h1>${esc(labels[job.kind])}</h1><p>You have an update in CAGE Operations Hub.</p>${job.occurrence_at?`<p>Occurrence reference: ${esc(new Date(job.occurrence_at).toLocaleString('en-GB',{timeZone:'Africa/Blantyre'}))} CAT. Open the event for its current time.</p>`:''}<p><a href="${esc(url.href)}">Open ${job.notice_id?'notice':'calendar event'}</a></p><p>Sign in with your authorised CAGE account to view the details.</p></div>`};await checked(db.from('hub_delivery_jobs').update({payload}).eq('id',job.id).eq('status','processing'));}
   const r=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'cage-hub-'+job.id},body:JSON.stringify(payload)});
   if(!r.ok)throw Error('Email provider returned '+r.status);const result=await r.json();if(!result.id)throw Error('Email provider returned no confirmation');
   await checked(db.from('hub_delivery_jobs').update({status:'sent',sent_at:new Date().toISOString(),provider_id:result.id,error:null}).eq('id',job.id).eq('status','processing'));sent++;
  }catch(e){await checked(db.from('hub_delivery_jobs').update({status:'pending',error:e instanceof Error?e.message:'Delivery failed',available_at:new Date(Date.now()+300000).toISOString()}).eq('id',job.id).eq('status','processing'));retrying++;}
 }));return {sent,retrying};
}
