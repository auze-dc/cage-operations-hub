(function () {
  'use strict';
  const dialog = document.getElementById('job-dialog'), form = document.getElementById('job-form');
  const error = document.getElementById('job-form-error'), saved = document.getElementById('vacancy-save-state');
  const {esc, body, today} = window.CAGE_JOB_ADVERT;
  const fields = ['title','department','location','employmentType','workArrangement','positions','duration','closingDate','compensation','description','responsibilities','requirements','desirableSkills','benefits','screeningQuestions','status'];
  let current = null, step = 0, busy = false, key = '', owner = '', sourceJob = null, sourceDuplicate = false;
  function values() {
    const data = Object.fromEntries(fields.map(name => [name,form.elements[name].value.trim()]));
    data.coverNoteRequired = form.elements.coverNoteRequired.checked;
    data.screeningQuestions = data.screeningQuestions.split('\n').map(x=>x.trim()).filter(Boolean);
    return data;
  }
  function preview() {
    const v = values();
    document.getElementById('vacancy-preview-content').innerHTML = `<p class="section-kicker">${esc(v.department || 'Your department')} · CAGE</p><h2>${esc(v.title || 'Your next opportunity')}</h2><div class="vacancy-tags">${[v.location,v.employmentType,v.workArrangement,v.duration,`${v.positions || 1} position(s)`].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join('')}</div><p>Closes ${esc(v.closingDate || '—')} · Malawi time</p>${v.compensation ? `<p><strong>${esc(v.compensation)}</strong></p>` : ''}${body({...v,desirable_skills:v.desirableSkills})}`;
  }
  function autosave() {
    if (busy || !key || owner !== window.CAGE_BACKEND.currentProfile()?.id) return;
    try { sessionStorage.setItem(key,JSON.stringify({values:values(),current,step})); saved.textContent = 'Changes saved in this tab · Use Save draft to save to the Hub.'; }
    catch { saved.textContent = 'Tab recovery unavailable. Use Save draft to keep your work.'; }
  }
  function setStep(n) {
    step = n;
    form.querySelectorAll('[data-vacancy-panel]').forEach(el => el.hidden = Number(el.dataset.vacancyPanel) !== n);
    form.querySelectorAll('[data-vacancy-step]').forEach(el => { if (Number(el.dataset.vacancyStep) === n) el.setAttribute('aria-current','step'); else el.removeAttribute('aria-current'); });
    document.getElementById('vacancy-back').hidden = n === 0;
    document.getElementById('vacancy-next').hidden = n === 2;
    document.getElementById('vacancy-publish').hidden = n !== 2;
    document.getElementById('vacancy-publish').textContent = form.elements.status.value === 'Paused' || form.elements.status.value === 'Closed' ? 'Save changes' : 'Publish vacancy';
  }
  function populate(v) {
    fields.forEach(name => { if (v[name] != null) form.elements[name].value = Array.isArray(v[name]) ? v[name].join('\n') : v[name]; });
    form.elements.coverNoteRequired.checked = Boolean(v.coverNoteRequired);
  }
  function open(job, duplicate = false, recover = true) {
    const profile = window.CAGE_BACKEND.currentProfile();
    if (!profile || !['admin','manager','hr'].includes(profile.role)) return;
    sourceJob = job; sourceDuplicate = duplicate; owner = profile.id; current = job && !duplicate ? {id:job.id,updatedAt:job.updated_at} : null;
    key = `cage-vacancy-draft:${owner}:${job ? (duplicate ? 'copy-' : '') + job.id : 'new'}`;
    form.reset(); error.textContent = ''; form.elements.location.value = 'Lilongwe, Malawi';
    if (job) populate({...job,employmentType:job.employment_type,workArrangement:job.work_arrangement || 'On-site',closingDate:job.closing_date,desirableSkills:job.desirable_skills,coverNoteRequired:job.cover_note_required,screeningQuestions:job.screening_questions || [],status:duplicate ? 'Draft' : job.status,title:duplicate ? `${job.title} (copy)` : job.title});
    let recovered = false;
    if (recover) try { const draft = JSON.parse(sessionStorage.getItem(key) || 'null'); if (draft?.values) { populate(draft.values); current = draft.current; recovered = true; } } catch { /* A damaged recovery copy must not block opening the editor. */ }
    saved.textContent = recovered ? 'Recovered unsaved changes from this tab.' : 'Your work is saved automatically in this tab.';
    document.getElementById('vacancy-discard').hidden = !recovered;
    document.getElementById('vacancy-editor-title').textContent = current ? 'Edit vacancy' : 'Create vacancy';
    setStep(0); preview(); if (!dialog.open) dialog.showModal(); form.elements.title.focus();
  }
  function close() { if (busy) return; autosave(); dialog.close(); document.getElementById('new-job-button').focus(); }
  document.getElementById('vacancy-close').addEventListener('click',close);
  dialog.addEventListener('cancel',event => {event.preventDefault(); close();});
  form.addEventListener('input',()=>{preview();autosave();});
  form.addEventListener('change',()=>{preview();setStep(step);autosave();});
  form.querySelectorAll('[data-vacancy-step]').forEach(el=>el.addEventListener('click',()=>setStep(Number(el.dataset.vacancyStep))));
  document.getElementById('vacancy-next').addEventListener('click',()=>setStep(Math.min(2,step+1)));
  document.getElementById('vacancy-back').addEventListener('click',()=>setStep(Math.max(0,step-1)));
  document.getElementById('vacancy-discard').addEventListener('click',()=>{try{sessionStorage.removeItem(key);}catch{} dialog.close(); open(sourceJob,sourceDuplicate,false);});
  document.getElementById('vacancy-template').addEventListener('change',event=>{
    const template = event.target.value; if (!template) return;
    // Templates only fill empty fields, preserving anything the author has written.
    const defaults = {Internship:{employmentType:'Intern',duration:'6 months'},'Drone operations':{department:'Operations'},'GIS & data':{department:'Geospatial & Data'},Administration:{department:'Administration'}}[template];
    for (const [name,value] of Object.entries(defaults || {})) if (!form.elements[name].value || name === 'employmentType') form.elements[name].value = value;
    preview(); autosave();
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault(); if (busy) return;
    const data = values(), draft = event.submitter?.value === 'draft';
    error.textContent = '';
    const required = draft ? ['title','closingDate'] : ['title','department','location','closingDate','description','responsibilities','requirements'];
    const invalid = required.find(name=>!data[name]);
    const fail = (message,name) => { error.textContent=message; if(name){setStep(form.elements[name].closest('[data-vacancy-panel]').dataset.vacancyPanel*1);form.elements[name].focus();}else error.focus(); };
    if (invalid) return fail('Please complete the required fields before saving.',invalid);
    if (!Number.isInteger(Number(data.positions)) || Number(data.positions)<1 || Number(data.positions)>1000) return fail('Enter between 1 and 1,000 positions.','positions');
    if (data.screeningQuestions.length>5 || data.screeningQuestions.some(x=>x.length>250) || new Set(data.screeningQuestions).size!==data.screeningQuestions.length) return fail('Use up to 5 different screening questions, each no more than 250 characters.','screeningQuestions');
    if (!draft && !['Paused','Closed'].includes(data.status) && data.closingDate < today()) return fail('Choose today or a future closing date before publishing.','closingDate');
    if (!draft && ![0,1,2].every(n=>Array.from(form.querySelectorAll(`[data-vacancy-panel="${n}"] input,[data-vacancy-panel="${n}"] textarea`)).every(input=>input.checkValidity()))) return fail('Check field lengths and dates before publishing.');
    if (current && !draft && ['Paused','Closed'].includes(data.status)) { /* Preserve the explicit status selected by the author. */ }
    else data.status = draft ? 'Draft' : 'Open';
    if (owner !== window.CAGE_BACKEND.currentProfile()?.id) return fail('Your session changed. Sign in again before saving.');
    busy = true; form.setAttribute('aria-busy','true'); const buttons = [...form.querySelectorAll('button')]; buttons.forEach(x=>x.disabled=true);
    try {
      const result = await window.CAGE_BACKEND.createJob({...data,...current});
      try {sessionStorage.removeItem(key);} catch {}
      current = {id:result.id,updatedAt:result.updated_at};
      dialog.close(); showToast(data.status === 'Open' ? 'Vacancy published on CAGE Careers.' : `Vacancy saved as ${data.status.toLowerCase()}.`); await window.CAGE_HR_UI.load();
    } catch(e) {error.textContent = e.message || 'Unable to save. Your changes remain in this tab.';error.focus();}
    finally {busy=false; buttons.forEach(x=>x.disabled=false); form.removeAttribute('aria-busy');}
  });
  // Tab-only recovery is scoped to the author; clear it when that author signs out.
  window.addEventListener('cage:session-ready',()=>{ if (owner && owner !== window.CAGE_BACKEND.currentProfile()?.id) { try {for(const k of Object.keys(sessionStorage)) if(k.startsWith(`cage-vacancy-draft:${owner}:`))sessionStorage.removeItem(k);}catch{} if(dialog.open)dialog.close();owner='';key=''; } });
  window.addEventListener('cage:session-ended',()=>{try{for(const k of Object.keys(sessionStorage))if(k.startsWith('cage-vacancy-draft:'))sessionStorage.removeItem(k);}catch{} if(dialog.open)dialog.close();form.reset();owner='';key='';current=null;sourceJob=null;});
  window.CAGE_VACANCY_EDITOR = {open};
})();
