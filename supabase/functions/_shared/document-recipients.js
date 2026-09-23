// Shared, dependency-free recipient validation. One address per entry; no display names.
export function recipients(input) {
 const seen=new Set();
 const parse=(value)=>{
  const values=Array.isArray(value)?value:String(value||'').split(/[,;\n]/);
  const result=[];
  for(const raw of values){
   const address=String(raw).trim().toLowerCase();if(!address)continue;
   if(address.length>254||! /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(address))throw new Error('Enter valid email addresses separated by commas.');
   if(!seen.has(address)){seen.add(address);result.push(address);}
  }return result;
 };
 const to=parse(input.recipient),cc=parse(input.cc),bcc=parse(input.bcc);
 if(!to.length)throw new Error('Enter at least one To recipient.');
 if(seen.size>50)throw new Error('Use no more than 50 recipients in total.');
 let approver=null;
 if(input.type==='quote'&&input.record?.status!=='Accepted'){
  approver=String(input.approver||'').trim().toLowerCase();
  if(!approver||!to.includes(approver))throw new Error('Choose one To recipient as the authorised client approver.');
 }
 return {to,cc,bcc,approver};
}
export const content=r=>Object.fromEntries(Object.entries(r).filter(([k])=>!['status','recipient','sentAt','automaticFollowUp','clientResponse'].includes(k)));
export const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export async function sha256(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
export function expiry(record, now=Date.now()){
 const end=Date.parse(String(record.validUntil)+'T23:59:59+02:00');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(record.validUntil)||!Number.isFinite(end)||end<=now)throw new Error('The quote validity date has expired or is missing. Revise and approve the quote first.');
 return new Date(Math.min(end,now+30*86400000)).toISOString();
}
