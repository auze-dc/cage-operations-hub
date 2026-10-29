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
      document.getElementById('job-department').innerHTML='<option value="">All departments</option>'+[...new Set(jobs.map(job=>job.department).filter(Boolean))].sort().map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('');
      renderDirectory();
      openLinkedRole();
    }catch{list.innerHTML='<div class="empty"><h3>We couldn’t load the opportunities.</h3><p>Please check your connection and try again.</p><button class="button secondary" data-retry>Try again</button></div>';}
    finally{list.setAttribute('aria-busy','false');}
  }
  const roleDialog=document.getElementById('role-dialog'),search=document.getElementById('job-search'),department=document.getElementById('job-department');
  let roleOpener=null;
  function renderDirectory(){
    const query=search.value.trim().toLowerCase();
    const matches=jobs.filter(job=>(!department.value||job.department===department.value)&&(!query||[job.title,job.department,job.location,job.description,job.requirements,job.responsibilities,job.desirable_skills].join(' ').toLowerCase().includes(query)));
    document.getElementById('job-results').textContent=jobs.length ? `${matches.length === jobs.length ? 'Showing all' : 'Showing '+matches.length+' of'} ${jobs.length} opportunit${jobs.length===1?'y':'ies'} · Select a role to view details and apply.` : '';
    list.innerHTML=matches.length?matches.map(job=>`<article class="opportunity-card" id="role-${esc(job.id)}"><div class="opportunity-card-top"><span class="job-label">${esc(job.department||'CAGE')}</span><span class="open-badge">Now recruiting</span></div><h3><button class="role-title-button" data-view-role="${esc(job.id)}">${esc(job.title)}</button></h3><div class="job-meta">${[job.employment_type,job.work_arrangement,job.location].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join('')}</div><p class="role-excerpt">${esc(clean(job.description).replace(/\s+/g,' ').slice(0,220))}</p><div class="opportunity-card-bottom"><div><span class="closing-label">Applications close</span><strong>${esc(date(job.closing_date))}</strong></div><button class="button primary" data-view-role="${esc(job.id)}" aria-label="View ${esc(job.title)}">View opportunity <span aria-hidden="true">↗</span></button></div></article>`).join(''):jobs.length?'<div class="empty"><h3>No matching opportunities</h3><p>Try another search or department to see more roles.</p><button class="button secondary" data-clear-filters>Show all opportunities</button></div>':'<div class="empty"><h3>No open roles just now.</h3><p>Please check back for future opportunities at CAGE.</p></div>';
  }
  function openRole(job,button){
    roleOpener=button||document.getElementById(`role-${job.id}`)?.querySelector("[data-view-role]");
    document.getElementById('role-dialog-title').textContent=job.title;
    document.getElementById('role-dialog-meta').textContent=[job.department,job.employment_type,job.work_arrangement,job.location].filter(Boolean).join(' · ');
    document.getElementById('role-dialog-content').innerHTML=`<div class="job-body"><div class="job-copy">${window.CAGE_JOB_ADVERT.body(job,formatted)}</div><aside class="job-sidebar" aria-label="Application details"><dl><dt>Applications close</dt><dd>${esc(date(job.closing_date))}</dd>${job.duration?`<dt>Duration</dt><dd>${esc(job.duration)}</dd>`:''}${job.compensation?`<dt>Salary / stipend offered</dt><dd>${esc(job.compensation)}</dd>`:''}<dt>Positions</dt><dd>${esc(job.positions||1)}</dd></dl><button class="button primary" data-apply="${esc(job.id)}">Apply for this role <span aria-hidden="true">↗</span></button><small>You will need your CV, salary expectation and answers to any screening questions. Review the role before applying.</small><button type="button" class="button secondary all-opportunities" data-back-opportunities>All opportunities</button></aside></div>`;
    if(!roleDialog.open)roleDialog.showModal();roleDialog.scrollTop=0;document.getElementById('role-dialog-title').focus();
  }
  function closeRole(){roleDialog.close();roleOpener?.focus();}
  function openLinkedRole(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}const job=jobs.find(x=>`role-${x.id}`===id);if(job)openRole(job);}
  search.addEventListener('input',renderDirectory);department.addEventListener('change',renderDirectory);
  document.getElementById('close-role').addEventListener('click',closeRole);
  roleDialog.addEventListener('cancel',event=>{event.preventDefault();closeRole();});
  list.addEventListener('click',event=>{
    if(event.target.closest('[data-clear-filters]')){search.value='';department.value='';renderDirectory();search.focus();return;}
    const button=event.target.closest('[data-view-role]');if(button){const job=jobs.find(x=>x.id===button.dataset.viewRole);if(job)openRole(job,button);}
  });
  roleDialog.addEventListener('click',event=>{if(event.target.closest('[data-back-opportunities]'))closeRole();});
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
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-retry]')){loadJobs();return;}
    const button=event.target.closest('[data-apply]');if(!button)return;const job=jobs.find(x=>x.id===button.dataset.apply);if(!job)return;
    opener=roleOpener||button;if(roleDialog.open)roleDialog.close();form.reset();form.querySelectorAll('input').forEach(x=>x.setCustomValidity(''));form.hidden=false;success.hidden=true;message.textContent='';
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
