(function(){
 'use strict';
 let openDialog=null;
 const prefixes=['cage-unsynced-'];
 function keysFor(userId,storage=localStorage){
  if(!userId)return [];
  const start='cage-unsynced-'+userId;
  const keys=[];for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k===start||k.startsWith(start+':'))keys.push(k);}
  return keys;
 }
 function download(userId){
  const entries={};for(const key of keysFor(userId))entries[key]=localStorage.getItem(key);
  const url=URL.createObjectURL(new Blob([JSON.stringify({exportedAt:new Date().toISOString(),drafts:entries},null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='CAGE-unsynced-draft-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function choose(userId){
  if(!keysFor(userId).length)return 'clear';
  if(openDialog)return 'cancel';
  const d=document.createElement('dialog');openDialog=d;d.className='dialog';d.setAttribute('aria-label','Protect your unsynced work');
  const body=document.createElement('div');body.className='dialog-body';
  const heading=document.createElement('h2');heading.textContent='Protect your unsynced work';
  const message=document.createElement('p');message.textContent='This browser contains unsynced work or recovery drafts. Download a backup before clearing a shared device. Only keep drafts on a device you trust.';
  const downloadButton=document.createElement('button');downloadButton.type='button';downloadButton.textContent='Download draft backup';downloadButton.onclick=()=>download(userId);
  const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';label.append(check,document.createTextNode(' I saved a backup or no longer need these local drafts.'));
  const actions=document.createElement('div');actions.className='dialog-actions';
  const clear=document.createElement('button');clear.type='button';clear.textContent='Clear this device and sign out';clear.disabled=true;
  check.onchange=()=>clear.disabled=!check.checked;
  const keep=document.createElement('button');keep.type='button';keep.textContent='Keep on this trusted device and sign out';
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';
  body.append(heading,message,downloadButton,label);actions.append(cancel,keep,clear);body.append(actions);d.append(body);document.body.append(d);
  return new Promise(resolve=>{
   let done=false;function finish(value){if(done)return;done=true;d.close();d.remove();openDialog=null;resolve(value);}
   d.addEventListener('cancel',e=>{e.preventDefault();finish('cancel');});
   clear.onclick=()=>{if(check.checked)finish('clear')};keep.onclick=()=>finish('keep');cancel.onclick=()=>finish('cancel');d.showModal();
  });
 }
 function clear(userId){for(const k of keysFor(userId))localStorage.removeItem(k);localStorage.removeItem('cage-operations-hub-production-cache-v1');}
 window.CAGE_DRAFT_PRIVACY={choose,clear,keysFor,download};
})();
