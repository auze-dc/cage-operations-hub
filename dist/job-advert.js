(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function paragraphs(value) { return String(value || '').trim().split(/\n\s*\n/).filter(Boolean).map(x => `<p>${esc(x).replaceAll('\n','<br>')}</p>`).join(''); }
  function bullets(value) { return `<ul>${String(value || '').split('\n').map(x => x.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`; }
  function body(job, legacy) {
    if (!job.responsibilities && !job.benefits && !job.desirable_skills) return `<h4>About the opportunity</h4>${legacy ? legacy(job.description) : paragraphs(job.description)}<h4>What you’ll bring</h4>${legacy ? legacy(job.requirements,true) : bullets(job.requirements)}`;
    return [['About the role',job.description,false],['Responsibilities',job.responsibilities,true],['Essential requirements',job.requirements,true],['Desirable skills',job.desirable_skills,true],['What we offer',job.benefits,false]].filter(x=>x[1]).map(([title,value,list])=>`<h4>${title}</h4>${list ? bullets(value) : paragraphs(value)}`).join('');
  }
  const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Blantyre',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  window.CAGE_JOB_ADVERT = {esc, body, today};
})();
