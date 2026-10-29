import fs from 'node:fs';
import {validateBrowserConfig,readBrowserConfig} from '../scripts/runtime-config.mjs';
const base='https://hub.cagemw.com',project='https://lrvcpiobxqtmcntwhaat.supabase.co';
const results=[];
async function check(name,url,validate,headers={}){
 for(let attempt=1;attempt<=2;attempt++){
  const started=Date.now();let status=0;
  try{
   const response=await fetch(url,{headers:{...headers,'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000),redirect:'error'});
   status=response.status;const body=await response.text();await validate(response,body);
   results.push({name,ok:true,status,attempt,duration_ms:Date.now()-started});return body;
  }catch{
   results.push({name,ok:false,status,attempt,duration_ms:Date.now()-started});
   if(attempt===2)throw new Error(name+' failed twice. Inspect the health artifact and provider logs.');
  }
 }
}
function requireOk(response,body){if(!response.ok||!body.length)throw Error('Response unavailable');}
function requireHtml(response,body){requireOk(response,body);if(!/text\/html/.test(response.headers.get('content-type')||'')||!/<html\b/i.test(body))throw Error('HTML unavailable');if(response.headers.get('x-content-type-options')!=='nosniff')throw Error('Security header missing');}
let failed=false;
try{
 const runtime=await check('public-runtime',base+'/runtime-config.js',requireOk);
 const config=validateBrowserConfig(readBrowserConfig(runtime));
 if(config.supabaseUrl.replace(/\/$/,'')!==project||new URL(config.appUrl).origin!==base)throw Error('Unexpected production target');
 const headers={apikey:config.supabaseAnonKey};
 const work=[
  check('hub',base+'/',(r,b)=>{requireHtml(r,b);if(!b.includes('security.js'))throw Error('Secure sign-in asset missing');}),
  check('applications-page',base+'/apply',requireHtml),
  check('careers-page',base+'/careers',requireHtml),
  check('secure-sign-in-asset',base+'/security.js',(r,b)=>{requireOk(r,b);if(!/javascript/.test(r.headers.get('content-type')||'')||!b.includes('CAGE_SECURITY'))throw Error('Script unavailable');}),
  check('public-careers-api',project+'/functions/v1/careers',(r,b)=>{requireOk(r,b);const d=JSON.parse(b);if(d.ok!==true||!Array.isArray(d.jobs))throw Error('Invalid catalog');},headers),
  check('public-training-api',project+'/functions/v1/academy-admissions?action=catalog',(r,b)=>{requireOk(r,b);if(!Array.isArray(JSON.parse(b).intakes))throw Error('Invalid catalog');},headers),
  check('auth-service',project+'/auth/v1/health',(r,b)=>{requireOk(r,b);JSON.parse(b);},headers),
  check('private-bootstrap-denies-anonymous',project+'/rest/v1/rpc/hub_security_status',(r)=>{if(![401,403].includes(r.status))throw Error('Anonymous bootstrap unexpectedly accessible');},headers)
 ];
 const settled=await Promise.allSettled(work);failed=settled.some(x=>x.status==='rejected');
}catch(error){failed=true;console.error(error.message.includes('failed twice')?error.message:'Live health setup failed. Verify runtime and target configuration.');}
finally{
 const report={checked_at:new Date().toISOString(),target:base,read_only:true,ok:!failed,checks:results};
 fs.writeFileSync('live-health.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
 if(failed)process.exitCode=1;
}
