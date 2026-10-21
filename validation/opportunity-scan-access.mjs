import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const source=fs.readFileSync('supabase/functions/opportunity-scan/index.ts','utf8').replace(/^import .*;\n/gm,'');
const script=stripTypeScriptTypes(source);
async function check({role='member',active=true,signedIn=true,access=true}={}){
 let handler,begin=0;
 const service={auth:{getUser:async()=>({data:{user:signedIn?{id:'staff'}:null},error:null})},from:table=>{assert.equal(table,'profiles');return {select:()=>({eq:()=>({single:async()=>({data:{organization_id:'org',role,active}})})})};},rpc:async name=>{assert.equal(name,'opportunity_scan_begin');begin++;return {data:null};}};
 const user={rpc:async(name,args)=>{assert.equal(name,'opportunity_access');assert.equal(args.editing,false);return {data:access};}};
 const context={Response,console,Deno:{env:{get:name=>name==='SUPABASE_SERVICE_ROLE_KEY'?'service':'anon'},serve:fn=>{handler=fn;}},createClient:(url,key)=>key==='service'?service:user,validCronToken:async()=>false};
 vm.runInNewContext(script,context);
 const response=await handler(new Request('https://example.test',{method:'POST',body:'{}',headers:{Authorization:'Bearer test'}}));
 return {status:response.status,begin,body:await response.json()};
}
for(const role of ['member','manager','admin']){const result=await check({role});assert.equal(result.status,200);assert.equal(result.begin,1);assert.equal(result.body.skipped,true);}
for(const args of [{role:'shared'},{active:false},{access:false}]){const result=await check(args);assert.equal(result.status,403);assert.equal(result.begin,0);}
assert.equal((await check({signedIn:false})).status,401);
console.log('PASS: ordinary staff and managers can request scans; shared, inactive, signed-out and inaccessible accounts cannot.');
