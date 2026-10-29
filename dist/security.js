(function(){
"use strict";
let active=null;
const cancelError=()=>Object.assign(new Error("Two-step verification was cancelled. Sign in or retry when you have your authenticator."),{code:"MFA_CANCELLED",status:403});
function element(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
function checked(result){if(result.error)throw Object.assign(new Error(result.error.message||'Secure sign-in could not be checked.'),result.error);return result.data;}
async function verify(client,factor,enrollment){
 return new Promise((resolve,reject)=>{
  const dialog=element("dialog");dialog.className="app-dialog security-dialog";dialog.setAttribute("aria-labelledby","security-title");
  const title=element("h2",enrollment?"Protect your CAGE administrator account":"Verify your sign-in");title.id="security-title";dialog.append(title);
  dialog.append(element("p",enrollment?"Add CAGE to an authenticator app on your phone, then enter its six-digit code. CAGE will require this code when you sign in.":"Enter the current six-digit code from your authenticator app."));
  if(enrollment){
   const img=element("img");img.alt="Scan this QR code with your authenticator app";img.width=224;img.height=224;
   const qr=enrollment.totp.qr_code;img.src=qr.startsWith("data:image/svg+xml")?qr:"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(qr);dialog.append(img);
   dialog.append(element("p","If you cannot scan, enter this setup key in your authenticator:"));
   const secret=element("code",enrollment.totp.secret);secret.className="security-setup-key";dialog.append(secret);
   dialog.append(element("p","Keep access to your authenticator. If your phone is lost, contact the CAGE system owner for identity-verified recovery. Never share a setup key or a code."));
  }
  const form=element("form"),label=element("label","Authenticator code"),input=element("input");
  input.name="authenticator-code";input.type="text";input.inputMode="numeric";input.autocomplete="one-time-code";input.pattern="[0-9]{6}";input.maxLength=6;input.required=true;label.append(input);form.append(label);
  const error=element("p");error.className="form-error";error.setAttribute("role","alert");form.append(error);
  const actions=element("div");actions.className="dialog-actions";
  const cancel=element("button","Cancel"),submit=element("button","Verify and continue");cancel.type="button";cancel.className="secondary-button";submit.type="submit";submit.className="primary-button";actions.append(cancel,submit);form.append(actions);dialog.append(form);document.body.append(dialog);
  let busy=false,finished=false;
  function finish(err){if(finished)return;finished=true;dialog.close();dialog.replaceChildren();dialog.remove();err?reject(err):resolve();}
  cancel.addEventListener("click",()=>{if(!busy)finish(cancelError());});
  dialog.addEventListener("cancel",event=>{event.preventDefault();if(!busy)finish(cancelError());});
  form.addEventListener("submit",async event=>{
   event.preventDefault();if(busy||!/^\d{6}$/.test(input.value.trim()))return;
   busy=true;submit.disabled=true;cancel.disabled=true;error.textContent="";
   try{
    checked(await client.auth.mfa.challengeAndVerify({factorId:factor.id,code:input.value.trim()}));
    const level=checked(await client.auth.mfa.getAuthenticatorAssuranceLevel());
    if(level.currentLevel!=="aal2")throw new Error("Verification did not complete. Please retry.");
    finish();
   }catch(err){error.textContent=err.message||"Could not verify the code. Check your phone time and try a fresh code.";input.value="";input.focus();}
   finally{busy=false;submit.disabled=false;cancel.disabled=false;}
  });
  dialog.showModal();input.focus();
 });
}
async function run(client,options){
 if(!client?.auth?.mfa)throw new Error("The secure sign-in component could not load. Refresh CAGE.");
 const level=checked(await client.auth.mfa.getAuthenticatorAssuranceLevel());
 if(level.currentLevel==="aal2")return;
 let required=Boolean(options.requireEnrollment);
 if(options.bootstrap){
  const status=await client.rpc("hub_security_status").abortSignal(AbortSignal.timeout(15000));
  if(status.error){
   // The UI deploys before the database guard. Only a missing RPC permits the
   // existing role check to continue; connectivity or access errors fail closed.
   if(!["PGRST202","42883"].includes(status.error.code))throw Object.assign(new Error(status.error.message||'Secure sign-in could not be checked.'),status.error);
  }else required=Boolean(status.data?.required);
 }
 const listed=checked(await client.auth.mfa.listFactors());
 const factors=(listed.totp||[]).filter(f=>f.status==="verified");
 if(factors.length){await verify(client,factors[0],null);return;}
 if(!required)return;
 let enrolled;
 try{
  enrolled=checked(await client.auth.mfa.enroll({factorType:"totp",friendlyName:"CAGE "+new Date().toISOString()}));
  await verify(client,{id:enrolled.id},enrolled);
 }catch(err){
  // Remove only the incomplete factor created by this attempt.
  if(enrolled?.id){try{const current=checked(await client.auth.mfa.listFactors());if(!(current.totp||[]).some(f=>f.id===enrolled.id&&f.status==="verified"))await client.auth.mfa.unenroll({factorId:enrolled.id});}catch{}}
  throw err;
 }
}
window.CAGE_SECURITY=Object.freeze({ensure(client,options={}){
 if(active)return active;
 active=run(client,options).finally(()=>{active=null;});return active;
}});
})();
