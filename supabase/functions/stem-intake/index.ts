import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const EXPECTED_FORM='1Hnm1FoP5eYrW7nNn_sYDjZivUt2hHISyCO4psgCxJ0Y';
Deno.serve(async req=>{
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':Deno.env.get('APP_URL')||'https://hub.cagemw.com','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'content-type, x-stem-secret','Cache-Control':'no-store'};
 const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{headers});
 const org=Deno.env.get('STEM_ORGANIZATION_ID'),secret=Deno.env.get('STEM_INTAKE_SECRET');
 if(!org||!secret||secret.length<32)return reply({error:'STEM connection is not configured.'},503);
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 if(req.method==='GET'){
 const r=await admin.from('stem_connections').select('public_url,form_title,accepting_responses').eq('organization_id',org).eq('form_id',EXPECTED_FORM).maybeSingle();
 if(r.error)return reply({error:'Form connection unavailable'},503);
 return r.data?reply(r.data):reply({error:'The parent form connection has not been activated.'},503);
 }
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const supplied=req.headers.get('x-stem-secret')||'';
 const enc=new TextEncoder();const a=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(secret))),b=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(supplied)));let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];if(diff!==0)return reply({error:'Unauthorized'},401);
 if(Number(req.headers.get('content-length')||0)>524288)return reply({error:'Payload too large'},413);
 const raw=await req.text();if(raw.length>524288)return reply({error:'Payload too large'},413);
 let p;try{p=JSON.parse(raw);}catch{return reply({error:'Invalid JSON'},400);}
 if(p.formId!==EXPECTED_FORM)return reply({error:'Wrong form'},400);
 if(p.kind==='configuration'){
 let u;try{u=new URL(p.publicUrl);}catch{return reply({error:'Invalid public form URL'},400);}
 if(u.protocol!=='https:'||u.hostname!=='docs.google.com'||!u.pathname.startsWith('/forms/')||!u.pathname.endsWith('/viewform'))return reply({error:'A Google Forms responder URL is required'},400);
 if(!Array.isArray(p.questions)||p.questions.length>300||typeof p.title!=='string')return reply({error:'Invalid form configuration'},400);
 const r=await admin.from('stem_connections').upsert({organization_id:org,form_id:EXPECTED_FORM,form_title:p.title.slice(0,300),public_url:u.href,questions:p.questions,accepting_responses:p.accepting!==false,connected_at:new Date().toISOString()});
 return r.error?reply({error:'Configuration could not be stored'},500):reply({ok:true});
 }
 if(p.kind!=='response'||typeof p.responseId!=='string'||!p.responseId||p.responseId.length>300||!Array.isArray(p.answers)||p.answers.length>300||!Number.isFinite(Date.parse(p.submittedAt)))return reply({error:'Invalid form response'},400);
 if(p.answers.some((x:any)=>typeof x.id!=='string'||typeof x.title!=='string'||x.title.length>2000||!['string','number','boolean','object'].includes(typeof x.answer)))return reply({error:'Invalid answer'},400);
 const result=await admin.rpc('ingest_stem_response',{org,form_key:EXPECTED_FORM,response_key:p.responseId,submitted:p.submittedAt,email:typeof p.email==='string'?p.email.slice(0,320):null,items:p.answers});
 return result.error?reply({error:'Response could not be stored; retry is safe.'},500):reply({ok:true,id:result.data});
});
