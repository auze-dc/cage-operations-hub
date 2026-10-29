import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=await fs.realpath(path.resolve(import.meta.dirname,'../dist'));
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.ttf':'font/ttf','.pdf':'application/pdf'};
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
 try{
  const raw=decodeURIComponent((req.url||'/').split('?')[0]);
  if(raw.includes('\0')||raw.includes('\\')||raw.split('/').some(p=>p==='..'||p.startsWith('.')))throw Error('Not found');
  let target=path.resolve(root,'.'+raw);
  if(!target.startsWith(root+path.sep)&&target!==root)throw Error('Not found');
  let st=await fs.stat(target).catch(()=>null);
  if(st?.isDirectory()){target=path.join(target,'index.html');st=await fs.stat(target).catch(()=>null);}
  if(!st&&!path.extname(target)){target+='.html';st=await fs.stat(target).catch(()=>null);}
  if(!st?.isFile())throw Error('Not found');
  target=await fs.realpath(target);if(!target.startsWith(root+path.sep))throw Error('Not found');
  const data=await fs.readFile(target);
  res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Content-Length':data.length});
  res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404,{'Content-Type':'text/plain'}).end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log('CAGE development server: '+server.address().port));
process.on('SIGTERM',()=>server.close());
