import { createClient } from "jsr:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'POST required'},405);
 try{
  const authorization=req.headers.get('Authorization')||'';
  const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_ANON_KEY')!;
  const user=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const auth=await user.auth.getUser();if(auth.error||!auth.data.user)return reply({error:'Sign in again.'},401);
  const body=await req.json();let id=body.retry;
  if(!id){const result=await user.rpc(body.source==='nested'?'delete_nested_record':body.source==='workspace'?'delete_workspace_record':'delete_database_record',{kind:body.kind,rid:body.id,expected:body.expected});if(result.error)return reply({error:result.error.message},400);id=result.data;}
  const log=await user.from('record_deletion_log').select('*').eq('id',id).single();
  if(log.error||!log.data)return reply({error:'Deletion receipt unavailable'},403);
  const row=log.data;
  if(row.storage_path&&!row.storage_removed_at){
   const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
   // Only persisted, server-authored deletion receipts can request cleanup.
   const prefix=row.kind==='hub_notice_files'?`${row.snapshot.notice_id}/`:row.kind==='employee_documents'?`${row.organization_id}/employees/${row.snapshot.user_id}/`:row.kind==='attachments'?`${row.organization_id}/${row.snapshot.record_type}/${row.snapshot.record_id}/`:row.kind==='academy_application_files'?`${row.organization_id}/${row.snapshot.application_id}/`:`${row.organization_id}/`;
   if(!row.storage_path.startsWith(prefix))return reply({ok:true,cleanupPending:true,receipt:id,warning:'Record deleted. File path needs administrator review.'});
   // Retain shared files until the last business reference is removed.
   for(const [table,column] of [['attachments','storage_path'],['training_documents','file_path'],['training_certificates','file_path'],['training_assessments','evidence_path'],['employee_documents','storage_path'],['hub_notice_files','path'],['academy_application_files','path']]){
    const refs=await admin.from(table).select('*',{head:true,count:'exact'}).eq(column,row.storage_path);
    if(refs.error)return reply({ok:true,cleanupPending:true,receipt:id,warning:'Record deleted. File cleanup needs a retry.'});
    if(refs.count)return reply({ok:true,sharedFile:true,receipt:id,warning:'Record deleted. The file is retained because another record uses it.'});
   }
   const workspace=await admin.from('workspace_states').select('data').eq('organization_id',row.organization_id).single();
   if(workspace.error)return reply({ok:true,cleanupPending:true,receipt:id,warning:'Record deleted. File cleanup needs a retry.'});
   const refers=(value:unknown):boolean=>value===row.storage_path||(Array.isArray(value)?value.some(refers):!!value&&typeof value==='object'&&Object.values(value).some(refers));
   if(refers(workspace.data?.data))return reply({ok:true,sharedFile:true,receipt:id,warning:'Record deleted. A chat message or another workspace record still uses this file; remove that reference before retrying cleanup.'});
   const removed=await admin.storage.from(row.storage_bucket).remove([row.storage_path]);
   if(removed.error)return reply({ok:true,cleanupPending:true,receipt:id,warning:'Record deleted. File cleanup needs a retry.'});
   const done=await admin.from('record_deletion_log').update({storage_removed_at:new Date().toISOString()}).eq('id',id);
   if(done.error)return reply({ok:true,cleanupPending:true,receipt:id,warning:'File removed. Cleanup receipt needs a retry.'});
  }
  return reply({ok:true,receipt:id});
 }catch(e){return reply({error:e instanceof Error?e.message:'Deletion failed'},400);}
});
