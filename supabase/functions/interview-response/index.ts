import {createClient} from 'jsr:@supabase/supabase-js@2';
const headers={'Access-Control-Allow-Origin':'https://hub.cagemw.com','Access-Control-Allow-Headers':'apikey, content-type','Access-Control-Allow-Methods':'POST, GET, OPTIONS','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');
const pixel=()=>new Response(Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),c=>c.charCodeAt(0)),{headers:{...headers,'Content-Type':'image/gif'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method==='GET'){
  const url=new URL(req.url),token=url.searchParams.get('token');
  if(url.searchParams.get('action')==='open'&&token&&/^[a-f0-9]{64}$/.test(token)){
   try{const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);await db.rpc('interview_invitation_response',{p_hash:await hash(token),p_mode:'open'}).abortSignal(AbortSignal.timeout(10000));}catch{/* Always return the same pixel, without revealing token validity. */}
  }
  return pixel();
 }
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  if(Number(req.headers.get('content-length')||0)>6000)return json({error:'Request too large'},413);
  const raw=await req.text();if(raw.length>6000)return json({error:'Request too large'},413);
  const body=JSON.parse(raw);
  if(typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token))return json({error:'This invitation link is invalid or unavailable.'},400);
  if(body.action!=null&&!['accepted','declined'].includes(body.action))return json({error:'Choose accept or decline.'},400);
  if(body.action!=null&&body.confirmed!==true)return json({error:'Confirm your response before submitting.'},400);
  if(body.reason!=null&&(typeof body.reason!=='string'||body.reason.length>2000))return json({error:'Keep your reason within 2,000 characters.'},400);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const r=await db.rpc('interview_invitation_response',{p_hash:await hash(body.token),p_mode:body.action?'respond':'view',p_response:body.action||null,p_reason:body.reason||null}).abortSignal(AbortSignal.timeout(15000));
  if(r.error)return json({error:r.error.code==='P0001'?r.error.message:'This invitation is unavailable. Contact CAGE for help.'},409);
  return json(r.data);
 }catch{return json({error:'Unable to process this invitation. Please try again.'},400);}
});
