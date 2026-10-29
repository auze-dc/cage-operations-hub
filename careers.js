(function () {
  'use strict';
  const config=window.CAGE_CONFIG||{},list=document.getElementById('jobs-list'),dialog=document.getElementById('application-dialog'),form=document.getElementById('application-form'),message=document.getElementById('application-message');
  const endpoint=config.supabaseUrl?`${config.supabaseUrl}/functions/v1/careers`:'';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Blantyre'}).format(new Date(`${v}T12:00:00Z`)):'Not specified';
  const clean=v=>String(v||'').replace(/\r\n?/g,'\n').trim();
  // Treat vacancy content as text, never HTML. Preserve paragraph and list structure.
  function formatted(text,requirements=false){
    const blocks=clean(text).split(/\n\s*\n/).filter(Boolean);let html='',items=[],listMode=requirements;
    const flush=()=>{if(items.length){html+=`<ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;items=[];}};
    for(const block of blocks){
      const heading=block.replace(/^#{1,4}\s+/,'').replace(/:\s*$/,'');
      const isHeading=/^#{1,4}\s/.test(block)||/^(key responsibilities( include)?|responsibilities|requirements|qualifications|an added advantage|added advantage|application and assessment|how to apply|about (the role|you|us)|what (you.ll do|we offer))$/i.test(heading);
      if(isHeading){flush();html+=`<h4>${esc(heading)}</h4>`;listMode=/responsibilit|requirements|qualifications/i.test(heading);continue;}
      const lines=block.split('\n');
      if(lines.every(x=>/^\s*(?:[-*•]|\d+[.)])\s+/.test(x))){flush();html+=`<ul>${lines.map(x=>`<li>${esc(x.replace(/^\s*(?:[-*•]|\d+[.)])\s+/,''))}</li>`).join('')}</ul>`;continue;}
      if(/^The (internship|role|position) will /i.test(block)){flush();listMode=false;}
      if(listMode)items.push(block);else html+=`<p>${esc(block)}</p>`;
    }
    flush();return html;
  }
  let jobs=[],step=0,busy=false,opener=null;
  const next=document.getElementById('application-next'),back=document.getElementById('application-back'),close=document.getElementById('close-application'),success=document.getElementById('application-success');
  async function loadJobs(){
    list.setAttribute('aria-busy','true');
    if(!endpoint){list.innerHTML='<div class="empty">Careers are temporarily unavailable. Please check again shortly.</div>';list.setAttribute('aria-busy','false');return;}
    try{
      const response=await fetch(endpoint),result=await response.json();
      if(!response.ok||!result.ok||!Array.isArray(result.jobs))throw new Error('Unavailable');
      jobs=result.jobs;document.getElementById('job-count').textContent=`${jobs.length} open role${jobs.length===1?'':'s'}`;
      list.innerHTML=jobs.length?jobs.map(job=>`<article class="job-card" id="role-${esc(job.id)}"><header class="job-head"><span class="job-label">${esc(job.department||'CAGE')} · Now recruiting</span><h3>${esc(job.title)}</h3><div class="job-meta">${[job.location,job.employment_type,job.work_arrangement,job.duration].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join('')}<span>Closes ${esc(date(job.closing_date))}</span></div></header><div class="job-body"><div class="job-copy"><h4>About the opportunity</h4>${window.CAGE_JOB_ADVERT.body(job,formatted)}</div><aside class="job-sidebar" aria-label="Application details"><dl><dt>Applications close</dt><dd>${esc(date(job.closing_date))}</dd><dt>Location</dt><dd>${esc(job.location||'See role description')}</dd><dt>Employment type</dt><dd>${esc(job.employment_type||'See role description')}</dd>${job.compensation?`<dt>Salary / stipend offered</dt><dd>${esc(job.compensation)}</dd>`:""}${job.positions?`<dt>Positions</dt><dd>${esc(job.positions)}</dd>`:""}</dl><button class="button primary" data-apply="${esc(job.id)}">Apply for this role <span aria-hidden="true">↗</span></button><small>Have your CV ready. Review the role’s application guidance before you begin.</small></aside></div></article>`).join(''):'<div class="empty"><h3>No open roles just now.</h3><p>Please check back for future opportunities at CAGE.</p></div>';
    }catch{list.innerHTML='<div class="empty"><h3>We couldn’t load the opportunities.</h3><p>Please check your connection and try again.</p><button class="button secondary" data-retry>Try again</button></div>';}
    finally{list.setAttribute('aria-busy','false');}
  }
  function setStep(value,focus=true){
    step=value;message.textContent='';form.querySelectorAll('[data-step]').forEach(el=>el.hidden=Number(el.dataset.step)!==step);
    form.querySelectorAll('[data-step-label]').forEach(el=>{const n=Number(el.dataset.stepLabel);if(n===step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');el.classList.toggle('complete',n<step);});
    back.hidden=step===0;document.getElementById('step-position').textContent=`Step ${step+1} of 3`;next.textContent=step===2?'Submit application':'Continue →';
    if(step===2){const f=form.elements;document.getElementById('application-review').innerHTML=[['Full name',f.fullName.value],['Email address',f.email.value],['Phone number',f.phone.value],['Location',f.location.value||'Not supplied'],['Cover note',f.coverNote.value||'Not supplied'],['Salary expectation',`${f.salaryCurrency.value} ${Number(f.salaryExpectation.value).toLocaleString()} / ${f.salaryPeriod.value} gross`],...Array.from(document.querySelectorAll('[data-screening-question]')).map(x=>[x.dataset.screeningQuestion,x.value]),['CV',f.cv.files[0]?.name||'Not selected']].map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');}
    if(focus)form.querySelector(`[data-step="${step}"] h3`).focus();
  }
  function validate(section){
    for(const input of form.querySelectorAll(`[data-step="${section}"] input,[data-step="${section}"] textarea,[data-step="${section}"] select`)){
      if(input.name==='salaryExpectation')input.setCustomValidity(input.value!==''&&Number.isFinite(Number(input.value))&&Number(input.value)>=0?'':'Please enter a valid salary expectation.');
      if(input.required && input.tagName==='TEXTAREA')input.setCustomValidity(input.value.trim()?'':'Please complete this field.');
      if(['fullName','phone'].includes(input.name))input.setCustomValidity(input.value.trim()?'':'Please enter your '+(input.name==='fullName'?'full name.':'phone number.'));
      if(!input.checkValidity()){setStep(section,false);input.reportValidity();input.focus();return false;}
    }return true;
  }
  function validateFile(){
    const file=form.elements.cv.files[0],input=form.elements.cv;
    input.setCustomValidity(!file?'Please select your CV.':file.size===0?'This file is empty. Please choose your CV.':file.size>10*1024*1024?'Your CV must be no larger than 10 MB.':!(/\.(pdf|doc|docx)$/i.test(file.name))?'Choose a PDF, DOC or DOCX file.':'');
  }
  function finish(){if(busy)return;dialog.close();opener?.focus();}
  list.addEventListener('click',event=>{
    if(event.target.closest('[data-retry]')){loadJobs();return;}
    const button=event.target.closest('[data-apply]');if(!button)return;const job=jobs.find(x=>x.id===button.dataset.apply);if(!job)return;
    opener=button;form.reset();form.querySelectorAll('input').forEach(x=>x.setCustomValidity(''));form.hidden=false;success.hidden=true;message.textContent='';
    document.getElementById('cv-status').textContent='';document.getElementById('note-count').textContent='0 / 2,500';
    form.elements.jobId.value=job.id;document.getElementById('application-title').textContent=job.title;document.getElementById('application-context').textContent=[job.location,`Closes ${date(job.closing_date)}`].filter(Boolean).join(' · ');
    form.elements.coverNote.required=Boolean(job.cover_note_required);document.getElementById('cover-note-requirement').textContent=job.cover_note_required?'*':'(optional)';
    document.getElementById('screening-fields').innerHTML=(job.screening_questions||[]).map((question,i)=>`<label>${esc(question)} *<textarea name="screening-${i}" data-screening-question="${esc(question)}" rows="3" maxlength="2000" required></textarea></label>`).join('');
    setStep(0,false);dialog.showModal();form.elements.fullName.focus();
  });
  close.addEventListener('click',finish);document.getElementById('application-done').addEventListener('click',finish);
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish();});
  back.addEventListener('click',()=>{if(!busy)setStep(Math.max(0,step-1));});
  form.elements.coverNote.addEventListener('input',()=>document.getElementById('note-count').textContent=`${form.elements.coverNote.value.length.toLocaleString()} / 2,500`);
  for(const name of ['fullName','phone','salaryExpectation'])form.elements[name].addEventListener('input',()=>form.elements[name].setCustomValidity(''));
  form.elements.cv.addEventListener('change',()=>{validateFile();const file=form.elements.cv.files[0];document.getElementById('cv-status').textContent=form.elements.cv.validationMessage||(file?`${file.name} · ${(file.size/1024/1024).toFixed(2)} MB`:'');});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    if(step===1)validateFile();if(!validate(step))return;
    if(step<2){setStep(step+1);return;}
    validateFile();if(![0,1,2].every(validate))return;
    const data=new FormData(form);data.set('consent',form.elements.consent.checked?'true':'false');
    data.set('screeningAnswers',JSON.stringify(Array.from(document.querySelectorAll('[data-screening-question]')).map(x=>x.value.trim())));
    // Some devices omit MIME metadata. Use the validated extension for the supported CV types.
    const file=form.elements.cv.files[0],types={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
    if(!file.type)data.set('cv',new File([file],file.name,{type:types[file.name.split('.').pop().toLowerCase()]}));
    busy=true;next.disabled=true;back.disabled=true;close.disabled=true;next.textContent='Submitting…';message.textContent='';form.setAttribute('aria-busy','true');
    try{
      const response=await fetch(endpoint,{method:'POST',body:data}),result=await response.json();
      if(!response.ok||!result.ok)throw new Error(result.error||'Your application could not be submitted. Please try again.');
      form.hidden=true;success.hidden=false;document.getElementById('application-reference').textContent=result.applicationId?`Application reference: ${result.applicationId}`:'';success.focus();
    }catch(error){message.textContent=error.message||'Your application could not be submitted. Please try again.';message.focus();}
    finally{busy=false;next.disabled=false;back.disabled=false;close.disabled=false;next.textContent='Submit application';form.removeAttribute('aria-busy');}
  });
  loadJobs();
})();
