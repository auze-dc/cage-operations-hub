import {createClient} from 'jsr:@supabase/supabase-js@2';
import {sha256} from '../_shared/document-recipients.js';
const headers={'Access-Control-Allow-Origin':'https://hub.cagemw.com','Access-Control-Allow-Headers':'apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
  const body=await req.text();if(body.length>8000)return reply({error:'Request too large'},413);
  const p=JSON.parse(body);
  if(typeof p.token!=='string'||! /^[a-f0-9]{64}$/.test(p.token))return reply({error:'Invalid response link.'},400);
  if(p.action!=null&&(!['Accepted','Changes requested','Declined'].includes(p.action)||p.authorised!==true))return reply({error:'Confirm that you are authorised to respond.'},400);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const result=await db.rpc('quote_response_v2',{link_hash:await sha256(p.token),action_value:p.action||null,name_value:typeof p.name==='string'?p.name:null,note_value:typeof p.note==='string'?p.note:null});
  if(result.error)return reply({error:result.error.code==='P0001'?result.error.message:'Unable to record your response. Please try again.'},409);
  return reply(result.data);
 }catch{return reply({error:'Unable to open this quotation. Please try again.'},400);}
});
