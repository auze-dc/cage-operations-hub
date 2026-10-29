import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
export function syncSourceMirrors(write=false){
 const drift=[];
 for(const entry of fs.readdirSync(root,{withFileTypes:true})){
  if(!entry.isFile()||!/\.(js|css|html)$/.test(entry.name))continue;
  const deployed=path.join(root,'dist',entry.name),mirror=path.join(root,entry.name);
  if(!fs.existsSync(deployed))continue;
  const data=fs.readFileSync(deployed);
  if(!data.equals(fs.readFileSync(mirror))){drift.push(entry.name);if(write)fs.writeFileSync(mirror,data);}
 }
 if(drift.length&&!write)throw new Error('Source mirror drift: '+drift.join(', ')+'. Edit dist (canonical), then run npm run build and commit the refreshed mirrors.');
 return drift;
}
