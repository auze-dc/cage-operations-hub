/* Work-session location. Visible notice, browser permission, account-bound reader. */
(()=>{'use strict';
const api=()=>window.CAGE_BACKEND,me=()=>api()?.currentProfile?.();
const host=document.querySelector('#cage-online-dialog .cage-status-actions');if(!host)return;
let session=null,generation=0,busy=false,readAllowed=false,user=null,viewGeneration=0,denied=false,permission=null;
const mobile=()=>navigator.userAgentData?.mobile===true||/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const box=document.createElement('section');box.innerHTML='<p>This work Hub automatically shares this device’s browser location with Alexander (alexander@cagemw.com) while you are online. Only Alexander can view map pins. Browser and device location permission are required.</p><button type="button" class="secondary-button" data-location-view hidden>View device locations</button><p data-location-status role="status"></p>';host.after(box);
const badge=document.createElement('small');badge.id='cage-location-notice';badge.hidden=true;badge.style.cssText='display:block;max-width:250px;font-size:12px;line-height:1.4;padding:6px;color:#475569';document.querySelector('.user-card')?.after(badge);
const view=box.querySelector('[data-location-view]'),status=box.querySelector('[data-location-status]');
function message(value){status.textContent=value;badge.textContent=value;}
const dialog=document.createElement('dialog');dialog.className='app-dialog';dialog.setAttribute('aria-label','Device locations');dialog.innerHTML='<div class="dialog-heading"><h2>Device locations</h2><button type="button" class="secondary-button" data-location-close>Close</button></div><p>Fresh online device locations only. Accuracy depends on the device; these pins are not proof of attendance. Opening a pin shares that coordinate with Google Maps.</p><div data-location-list role="status"></div><button type="button" class="secondary-button" data-location-refresh>Refresh</button>';document.body.append(dialog);const list=dialog.querySelector('[data-location-list]');
function paint(){const allowed=!!me()&&me().active&&me().role!=='shared';box.hidden=!allowed;badge.hidden=!allowed;badge.style.display=allowed?'block':'none';view.hidden=!readAllowed;}
async function stopSharing(text='Location paused while this Hub session is offline.'){
 const previous=session;session=null;generation++;message(text);paint();
 if(previous)try{await api().locationStop(previous);}catch{message(text+' The previous pin expires within 90 seconds.');}
}
function eligible(){return !!me()?.active&&me().role!=='shared'&&navigator.onLine&&!(mobile()&&document.hidden)&&window.CAGE_PRESENCE?.status(me().id)==='online';}
async function sample(){
 if(busy||denied)return;
 if(!eligible()){if(session)await stopSharing('Location paused while you are away or offline.');return;}
 if(!navigator.geolocation||!window.isSecureContext){message('Location unavailable: HTTPS and browser location support are required.');return;}
 if(!session){session=crypto.randomUUID();generation++;}const id=session,token=generation;busy=true;let timer;
 try{
 message('Work location: requesting a fresh location for Alexander.');
 const pos=await Promise.race([new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:10000,maximumAge:0})),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Location timeout')),12000);})]);
 if(id!==session||token!==generation||!eligible())return;
 await api().locationPublish({sid:id,lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy,captured_at:new Date(pos.timestamp).toISOString()});
 if(id===session&&token===generation)message(`Work location shared with Alexander · accuracy approximately ${Math.round(pos.coords.accuracy)} m.`);
 }catch(e){if(id===session&&token===generation){if(e.code===1){denied=true;await stopSharing('Work location blocked. Allow location for this site in your browser and enable device location.');}else message('Work location unavailable. Retrying automatically; older pins expire within 90 seconds.');}}
 finally{clearTimeout(timer);busy=false;}
}
async function refresh(){
 if(!readAllowed||!dialog.open)return;const token=++viewGeneration,uid=me()?.id;list.textContent='Loading locations…';
 try{const rows=await api().locationList();if(token!==viewGeneration||uid!==me()?.id||!dialog.open||!readAllowed)return;
 list.replaceChildren();const fresh=rows.filter(r=>new Date(r.expires_at)>new Date());
 if(!fresh.length){list.textContent='No online devices have a fresh location. Device permission, connectivity and browser background limits can affect availability.';return;}
 for(const r of fresh){const p=document.createElement('p');p.dataset.expires=r.expires_at;const name=document.createElement('strong');name.textContent=r.name;const detail=document.createElement('span');detail.textContent=` · device ${r.session_id.slice(0,8)} · accuracy approximately ${Math.round(r.accuracy_m)} m · ${new Date(r.observed_at).toLocaleTimeString()} `;const a=document.createElement('a');a.textContent='Open Google Maps pin';a.href=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.latitude+','+r.longitude)}`;a.target='_blank';a.rel='noopener noreferrer';p.append(name,detail,a);list.append(p);}
 }catch{if(token===viewGeneration)list.textContent='Locations are unavailable or your account does not have access.';}
}
view.addEventListener('click',()=>{if(readAllowed){dialog.showModal();refresh();}});dialog.querySelector('[data-location-close]').addEventListener('click',()=>dialog.close());dialog.querySelector('[data-location-refresh]').addEventListener('click',refresh);dialog.addEventListener('close',()=>{viewGeneration++;list.replaceChildren();});
async function reset(){
 user=me()?.id;readAllowed=false;denied=false;viewGeneration++;dialog.close();list.replaceChildren();await stopSharing('Work location starts automatically when online. Only Alexander can view it.');const uid=user;if(!uid)return;
 try{const allowed=await api().locationCanRead();if(uid===me()?.id){readAllowed=allowed===true;paint();}}catch{paint();}
 if(uid!==me()?.id)return;
 try{permission=await navigator.permissions?.query({name:'geolocation'});if(permission){denied=permission.state==='denied';permission.onchange=()=>{denied=permission.state==='denied';if(denied)stopSharing('Work location blocked by browser permission.');else sample();};}}catch{}
 if(denied)message('Work location blocked. Allow location for this site and enable device location.');else sample();
}
window.addEventListener('cage:session-ready',reset);window.addEventListener('cage:presence-updated',()=>{if(!eligible()&&session)stopSharing('Location paused while you are away or offline.');else if(!session)sample();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){dialog.close();list.replaceChildren();if(mobile())stopSharing('Location paused while the Hub is in the background.');}else sample();});
window.addEventListener('pagehide',()=>{stopSharing();dialog.close();list.replaceChildren();});window.addEventListener('offline',()=>stopSharing());window.addEventListener('online',sample);
setInterval(()=>{if(user!==me()?.id){reset();return;}paint();sample();if(dialog.open)refresh();},30000);
setInterval(()=>{for(const p of list.querySelectorAll('[data-expires]'))if(new Date(p.dataset.expires)<=new Date())p.remove();if(!me()){readAllowed=false;dialog.close();list.replaceChildren();paint();}},1000);
window.CAGE_LOCATION={stop:stopSharing};reset();
})();
