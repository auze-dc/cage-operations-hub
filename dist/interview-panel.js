(function () {
  'use strict';
  const api = () => window.CAGE_BACKEND;
  const esc = window.CAGE_JOB_ADVERT.esc;
  const criteria = {role_skills:'Role-specific skills', relevant_experience:'Relevant experience', communication:'Communication', problem_solving:'Problem solving'};
  const total = scores => Object.values(scores || {}).reduce((sum, value) => sum + Number(value), 0);
  const stamp = value => new Date(value).toLocaleString('en-GB', {timeZone:'Africa/Blantyre',dateStyle:'medium',timeStyle:'short'});
  function location(value) {
    try { const url = new URL(value); if (['https:', 'http:'].includes(url.protocol)) return `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(value)}</a>`; } catch {}
    return `<span>${esc(value || 'Not recorded')}</span>`;
  }
  function responseStatus(meeting) {
    if(!meeting.invitation_id)return '<p class="review-history-help">A response was not requested for this invitation.</p>';
    const label=meeting.invitation_response||'Awaiting response';
    return `<div class="invitation-response"><strong class="status-pill ${label==='Accepted'?'done':label==='Declined'?'attention':''}">${esc(label)}</strong>${meeting.invitation_responded_at?`<small>Responded ${esc(stamp(meeting.invitation_responded_at))} (Malawi)</small>`:''}${meeting.invitation_response_reason?`<p class="invitation-response-note">${esc(meeting.invitation_response_reason)}</p>`:''}${meeting.invitation_viewed_at?`<small>Response page viewed ${esc(stamp(meeting.invitation_viewed_at))} (Malawi)</small>`:''}${meeting.invitation_opened_at?`<small>Email open detected ${esc(stamp(meeting.invitation_opened_at))} (Malawi) · approximate</small>`:'<small>No email-open signal recorded.</small>'}</div>`;
  }
  function card(meeting) {
    return `<div class="candidate-interview"><strong>${esc(meeting.status)} interview</strong><time datetime="${esc(meeting.scheduled_start)}">${esc(stamp(meeting.scheduled_start))} (Malawi)</time><small>Until ${esc(new Date(meeting.scheduled_end).toLocaleTimeString('en-GB',{timeZone:'Africa/Blantyre',hour:'2-digit',minute:'2-digit'}))} · ${esc(meeting.format)}</small><small>${meeting.invitation_sent_at?"Invitation link / location":"Meeting link / location"}</small><div class="candidate-interview-link">${location(meeting.invitation_location || meeting.location_or_link)}</div>${responseStatus(meeting)}<button type="button" class="secondary-button" data-interview-panel="${esc(meeting.id)}">Interview details & scores</button></div>`;
  }
  const dialog = document.createElement('dialog'); dialog.id='interview-panel-dialog'; dialog.className='app-dialog interview-panel-dialog';dialog.setAttribute('aria-labelledby','interview-panel-title');
  dialog.innerHTML=`<header class="review-header"><div><p class="section-kicker">Interview workspace</p><h2 id="interview-panel-title">Interview details & scores</h2><p id="interview-panel-candidate"></p></div><button type="button" class="icon-button" id="interview-panel-close" aria-label="Close interview workspace">×</button></header><label class="field"><span>Interview session</span><select id="interview-session"></select></label><p id="interview-panel-status" role="status" aria-live="polite"></p><p id="interview-panel-error" role="alert" tabindex="-1"></p><button type="button" class="text-button" id="interview-panel-reload">Reload records</button><div id="interview-panel-content" hidden><section id="interview-panel-details" class="interview-details"></section><div class="review-layout"><section class="review-compose"><h3>Record during the interview</h3><p class="review-history-help">Select the panelist whose feedback you are recording. Every entry also records your signed-in account and the time. Saved entries stay in the history.</p><form id="interview-panel-form" novalidate><label class="field"><span>Panelist *</span><select name="panelist" required></select></label><label class="field"><span>Entry type</span><select name="kind"><option value="score">Scorecard & notes</option><option value="note">Note only</option></select></label><div id="interview-panel-scores"><p class="review-rubric">Score each criterion from 1 (limited evidence) to 5 (exceptional evidence). Scores support the panel’s judgment.</p>${Object.entries(criteria).map(([key,label])=>`<label class="review-score-field"><span>${label}</span><select name="${key}" aria-label="${label}"><option value="">Not scored</option>${[1,2,3,4,5].map(n=>`<option value="${n}">${n}</option>`).join('')}</select></label>`).join('')}<p id="interview-panel-total"></p></div><label class="field"><span>Interview evidence / notes *</span><textarea name="notes" rows="6" maxlength="5000" placeholder="Record the applicant’s answers, examples and your observations."></textarea></label><label class="field"><span>Recommendation (optional)</span><select name="recommendation"><option value="">Not decided</option><option>Strong yes</option><option>Yes</option><option>Hold</option><option>No</option></select></label><button type="submit" class="primary-button" id="interview-panel-save">Save interview record</button></form></section><section class="review-record"><h3>Latest score by panelist</h3><div id="interview-panel-latest"></div><h3>Interview record</h3><div id="interview-panel-history"></div><button type="button" class="text-button" id="interview-panel-more" hidden>Load older entries</button></section></div></div>`;
  document.body.append(dialog);
  const find = id => dialog.querySelector('#'+id), form=find('interview-panel-form'), error=find('interview-panel-error'), status=find('interview-panel-status');
  let context=null, id=null, owner=null, generation=0, busy=false, loading=false, request=null, next=null, opener=null, readFailed=false;
  function controls() {
    form.querySelectorAll('select,textarea,button').forEach(el=>el.disabled=busy||loading||!context?.can_edit||readFailed);
    find('interview-panel-close').disabled=busy;find('interview-session').disabled=busy||loading;
    find('interview-panel-reload').disabled=busy||loading;find('interview-panel-more').disabled=busy||loading;
  }
  function fields() {
    find('interview-panel-scores').hidden=form.elements.kind.value==='note';
    const values=Object.keys(criteria).map(key=>form.elements[key].value);
    find('interview-panel-total').textContent=values.every(Boolean)?`${values.reduce((sum,v)=>sum+Number(v),0)} / 20`:'Complete all four scores.';
  }
  function entryHtml(entry) {
    return `<article class="review-event"><strong>${esc(entry.panelist_name)} · ${Object.keys(entry.scores).length?`${total(entry.scores)} / 20`:'Interview note'}</strong><small>${esc(stamp(entry.created_at))} (Malawi) · Recorded by ${esc(entry.recorder_name)}</small>${Object.keys(entry.scores).length?`<dl class="review-score-list">${Object.entries(criteria).map(([key,label])=>`<dt>${esc(label)}</dt><dd>${esc(entry.scores[key])} / 5</dd>`).join('')}</dl>`:''}<p>${esc(entry.notes)}</p>${entry.recommendation?`<p>Recommendation: ${esc(entry.recommendation)}</p>`:''}</article>`;
  }
  function draw(data) {
    context=data;next=data.next_before;readFailed=false;
    find('interview-panel-candidate').textContent=data.candidate;
    const meeting=data.interview;
    find('interview-panel-details').innerHTML=`<h3>${esc(stamp(meeting.scheduled_start))} (Malawi)</h3><p>Ends ${esc(stamp(meeting.scheduled_end))} · ${esc(meeting.format)} · ${esc(meeting.status)}</p><strong>Scheduled location / meeting link</strong><div>${location(meeting.location_or_link)}</div>${meeting.invitation_sent_at?`<p>Invitation accepted by email provider on ${esc(stamp(meeting.invitation_sent_at))} (Malawi), addressed to ${esc(meeting.invitation_recipient)}.</p><strong>Link / location included in that invitation</strong><div>${location(meeting.invitation_location)}</div>`:'<p class="review-history-help">Invitation sending was not recorded for this interview. The scheduled link above is the one used by the invitation workflow.</p>'}${meeting.notes?`<p>${esc(meeting.notes)}</p>`:''}${responseStatus(meeting)}<p class="review-history-help">Email-open signals can be blocked or generated by mail privacy services. Acceptance or decline is recorded only when the applicant submits a response.</p>`;
    const selected=form.elements.panelist.value;
    form.elements.panelist.innerHTML='<option value="">Select panelist</option>'+data.panelists.map(person=>`<option value="${esc(person.id)}">${esc(person.name)}</option>`).join('');
    if(data.panelists.some(p=>p.id===selected)) form.elements.panelist.value=selected;
    else if(data.panelists.some(p=>p.id===owner)) form.elements.panelist.value=owner;
    find('interview-panel-latest').innerHTML=data.latest_scores.length?data.latest_scores.map(entryHtml).join(''):'<p class="review-empty">No interview scores recorded yet.</p>';
    find('interview-panel-history').innerHTML=data.history.length?data.history.map(entryHtml).join(''):'<p class="review-empty">No interview records yet.</p>';
    find('interview-panel-more').hidden=!next;find('interview-panel-content').hidden=false;fields();controls();
  }
  async function refresh() {
    if(busy||loading)return;const token=generation;loading=true;controls();error.textContent='';status.textContent='Loading interview records…';
    try {const data=await api().interviewPanelRead(id);if(token!==generation||owner!==api().currentProfile()?.id)return;draw(data);status.textContent=data.can_edit?'Ready to record panel feedback.':'Interview records are read-only.';}
    catch(e){if(token===generation){readFailed=true;error.textContent=e.message||'Records could not be loaded. Reload to try again.';status.textContent='';}}
    finally{if(token===generation){loading=false;controls();}}
  }
  async function open(meetingId,button) {
    if(busy)return;
    const profile=api().currentProfile();if(!profile||!['admin','manager','hr'].includes(profile.role))return;
    generation++;id=meetingId;owner=profile.id;opener=button;context=null;request=null;next=null;loading=false;readFailed=false;form.reset();
    find('interview-panel-content').hidden=true;find('interview-panel-candidate').textContent='';error.textContent='';
    const meetings=window.CAGE_HR_UI.interviewsFor(meetingId);
    find('interview-session').innerHTML=meetings.map(m=>`<option value="${esc(m.id)}">${esc(stamp(m.scheduled_start))} (Malawi) · ${esc(m.status)}</option>`).join('');find('interview-session').value=id;
    if(!dialog.open)dialog.showModal();await refresh();
  }
  function hasDraft(){return form.elements.notes.value.trim()||form.elements.recommendation.value||Object.keys(criteria).some(key=>form.elements[key].value);}
  function close(){if(busy)return;if(hasDraft()&&!window.confirm('Discard the unsaved interview entry?'))return;generation++;loading=false;dialog.close();form.reset();context=null;request=null;opener?.focus();}
  find('interview-panel-close').addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  find('interview-panel-reload').addEventListener('click',refresh);
  find('interview-session').addEventListener('change',async e=>{const selected=e.target.value;if(hasDraft()&&!window.confirm('Discard the unsaved entry and switch interview?')){e.target.value=id;return;}await open(selected,opener);});
  form.addEventListener('input',()=>{request=null;fields();});form.addEventListener('change',()=>{request=null;fields();});
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(busy||loading||readFailed||!context?.can_edit)return;error.textContent='';
    const notes=form.elements.notes.value.trim(),panelist=form.elements.panelist.value;
    const scores=form.elements.kind.value==='note'?{}:Object.fromEntries(Object.keys(criteria).map(key=>[key,Number(form.elements[key].value)]));
    if(!panelist){error.textContent='Select the panelist.';form.elements.panelist.focus();return;}
    if(Object.values(scores).some(n=>!Number.isInteger(n)||n<1||n>5)){error.textContent='Score all four criteria from 1 to 5, or choose Note only.';return;}
    if(!notes||notes.length>5000){error.textContent='Record interview evidence or notes, up to 5,000 characters.';form.elements.notes.focus();return;}
    if(owner!==api().currentProfile()?.id){error.textContent='Your session changed. Reopen the interview after signing in.';return;}
    request ||= crypto.randomUUID();const token=generation;busy=true;controls();status.textContent='Saving interview record…';let saved=false;
    try{await api().interviewPanelWrite({p_interview:id,p_panelist:panelist,p_scores:scores,p_notes:notes,p_recommendation:form.elements.recommendation.value||null,p_request_id:request});saved=true;}
    catch(e){if(token===generation){error.textContent=e.message||'Save could not be confirmed. Your entry is kept; retry to confirm it.';status.textContent='';}}
    finally{if(token===generation){busy=false;controls();}}
    if(saved&&token===generation&&owner===api().currentProfile()?.id){request=null;form.elements.notes.value='';form.elements.recommendation.value='';Object.keys(criteria).forEach(key=>form.elements[key].value='');await refresh();status.textContent=error.textContent?'Record saved. Reload to see the updated history.':'Interview record saved.';}
  });
  find('interview-panel-more').addEventListener('click',async()=>{
    if(!next||busy||loading)return;const token=generation,before=next;loading=true;controls();
    try{const data=await api().interviewPanelRead(id,before);if(token!==generation||owner!==api().currentProfile()?.id)return;find('interview-panel-history').insertAdjacentHTML('beforeend',data.history.map(entryHtml).join(''));next=data.next_before;find('interview-panel-more').hidden=!next;}
    catch(e){if(token===generation)error.textContent=e.message||'Older records could not be loaded.';}finally{if(token===generation){loading=false;controls();}}
  });
  document.addEventListener('click',e=>{const button=e.target.closest('[data-interview-panel]');if(button)open(button.dataset.interviewPanel,button);});
  window.addEventListener('cage:session-ended',()=>{generation++;busy=false;loading=false;context=null;id=null;owner=null;request=null;form.reset();find('interview-panel-content').hidden=true;['interview-panel-details','interview-panel-history','interview-panel-latest','interview-panel-candidate','interview-panel-status','interview-panel-error'].forEach(key=>find(key).textContent='');find('interview-session').innerHTML='';form.elements.panelist.innerHTML='';if(dialog.open)dialog.close();});
  window.setInterval(()=>{if(dialog.open&&!document.hidden&&!busy&&!loading)refresh();},30000);
  window.CAGE_INTERVIEWS={open,card};
})();
