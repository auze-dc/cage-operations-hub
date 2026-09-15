(function () {
  const config = window.CAGE_CONFIG || {};
  const list = document.getElementById("jobs-list");
  const dialog = document.getElementById("application-dialog");
  const form = document.getElementById("application-form");
  const message = document.getElementById("application-message");
  const endpoint = config.supabaseUrl ? `${config.supabaseUrl}/functions/v1/careers` : "";
  const esc = value => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

  async function loadJobs() {
    if (!endpoint) { list.innerHTML = '<div class="empty">Careers will be available after production setup is completed.</div>'; return; }
    try {
      const response = await fetch(endpoint);
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Vacancies unavailable");
      document.getElementById("job-count").textContent = `${result.jobs.length} open role${result.jobs.length === 1 ? "" : "s"}`;
      list.innerHTML = result.jobs.length ? result.jobs.map(job => `<article class="job-card"><div><h3>${esc(job.title)}</h3><div class="job-meta"><span>${esc(job.department)}</span><span>·</span><span>${esc(job.location)}</span><span>·</span><span>${esc(job.employment_type)}</span><span>·</span><span>Closes ${esc(job.closing_date)}</span></div><p>${esc(job.description)}</p></div><button data-apply="${job.id}" data-title="${esc(job.title)}">Apply</button></article>`).join("") : '<div class="empty">There are no open vacancies right now. Please check again later.</div>';
    } catch { list.innerHTML = '<div class="empty">Vacancies could not be loaded. Please try again later.</div>'; }
  }

  list.addEventListener("click", event => {
    const button = event.target.closest("[data-apply]");
    if (!button) return;
    form.reset();
    message.textContent = "";
    document.getElementById("application-job-id").value = button.dataset.apply;
    document.getElementById("application-title").textContent = `Apply — ${button.dataset.title}`;
    dialog.showModal();
  });
  document.getElementById("close-application").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const submit = event.submitter;
    const data = new FormData(form);
    data.set("consent", form.elements.consent.checked ? "true" : "false");
    submit.disabled = true; submit.textContent = "Submitting…"; message.textContent = "";
    try {
      const response = await fetch(endpoint, { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Application failed");
      form.innerHTML = '<div class="empty"><h2>Application received</h2><p>Thank you. CAGE will contact you if your application progresses.</p></div>';
    } catch (error) { message.textContent = error.message || "Your application could not be submitted."; }
    finally { submit.disabled = false; submit.textContent = "Submit application"; }
  });
  loadJobs();
})();
