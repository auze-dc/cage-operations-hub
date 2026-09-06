(function () {
  "use strict";
  const STAGES = ["New", "Screening", "Shortlisted", "Interview", "Reference checks", "Offer", "Hired", "Rejected", "Withdrawn"];
  const ROLE_LABELS = { admin: "Administrator", manager: "Manager", hr: "HR", finance: "Finance", member: "Member", viewer: "Viewer", shared: "Shared account" };
  let hrData = { jobs: [], applications: [], interviews: [], employeeProfile: null, documents: [] };
  let adminData = [];
  let loading = false;
  const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const profile = () => window.CAGE_BACKEND?.currentProfile?.();
  const canHR = () => ["admin", "manager", "hr"].includes(profile()?.role);
  const isAdmin = () => profile()?.role === "admin";

  function metrics() {
    const openJobs = hrData.jobs.filter(job => job.status === "Open").length;
    const activeCandidates = hrData.applications.filter(item => !["Hired", "Rejected", "Withdrawn"].includes(item.stage)).length;
    const interviews = hrData.interviews.filter(item => item.status === "Scheduled" && new Date(item.scheduled_start) >= new Date()).length;
    document.getElementById("hr-nav-count").textContent = String(activeCandidates);
    document.getElementById("hr-metrics").innerHTML = [
      ["Open vacancies", openJobs, "Currently accepting applications"],
      ["Active candidates", activeCandidates, "Still in the recruitment pipeline"],
      ["Upcoming interviews", interviews, "Scheduled and awaiting completion"],
      ["My documents", hrData.documents.length, "CVs, certificates and employment records"]
    ].map(([label, value, note]) => `<article class="metric-card"><span>${esc(label)}</span><strong>${value}</strong><small>${esc(note)}</small></article>`).join("");
  }

  function renderProfile() {
    const target = document.getElementById("my-employee-profile");
    const p = profile();
    const employee = hrData.employeeProfile;
    target.innerHTML = `<div class="employee-record"><div class="employee-facts"><div><span>Name</span><strong>${esc(p?.full_name || "")}</strong></div><div><span>Role</span><strong>${esc(employee?.job_title || ROLE_LABELS[p?.role] || "Team member")}</strong></div><div><span>Department</span><strong>${esc(employee?.department || "Not recorded")}</strong></div><div><span>Start date</span><strong>${esc(employee?.start_date || "Not recorded")}</strong></div></div><div class="employee-documents">${hrData.documents.length ? hrData.documents.map(doc => `<div class="employee-document"><span><strong>${esc(doc.document_type)}</strong>${esc(doc.file_name)}${doc.expiry_date ? ` · expires ${esc(doc.expiry_date)}` : ""}</span><button data-open-hr-file="${esc(doc.storage_path)}">Open</button></div>`).join("") : '<div class="empty-state"><p>No employee documents uploaded yet.</p></div>'}</div></div>`;
  }

  function renderJobs() {
    const target = document.getElementById("job-opening-list");
    if (!canHR()) { target.innerHTML = ""; return; }
    target.innerHTML = hrData.jobs.length ? hrData.jobs.map(job => `<div class="hr-list-row"><div><strong>${esc(job.title)}</strong><span>${esc(job.department)} · ${esc(job.employment_type)} · closes ${esc(job.closing_date)}</span></div><div class="hr-row-actions"><span class="status-pill ${job.status === "Open" ? "done" : "attention"}">${esc(job.status)}</span></div></div>`).join("") : '<div class="empty-state"><p>No vacancies have been created.</p></div>';
  }

  function renderInterviews() {
    const target = document.getElementById("interview-list");
    if (!canHR()) { target.innerHTML = ""; return; }
    const upcoming = hrData.interviews.filter(item => new Date(item.scheduled_end) >= new Date()).slice(0, 8);
    target.innerHTML = upcoming.length ? upcoming.map(item => {
      const application = hrData.applications.find(app => app.id === item.application_id);
      return `<div class="hr-list-row"><div><strong>${esc(application?.full_name || "Candidate")}</strong><span>${new Date(item.scheduled_start).toLocaleString("en-MW", { dateStyle: "medium", timeStyle: "short" })} · ${esc(item.format)}</span></div><div class="hr-row-actions"><span>${esc(item.status)}</span></div></div>`;
    }).join("") : '<div class="empty-state"><p>No upcoming interviews.</p></div>';
  }

  function renderCandidates() {
    const target = document.getElementById("candidate-board");
    if (!canHR()) { target.innerHTML = ""; return; }
    const query = document.getElementById("candidate-search").value.trim().toLowerCase();
    const candidates = hrData.applications.filter(item => `${item.full_name} ${item.email}`.toLowerCase().includes(query));
    const columns = [
      ["New", ["New"]], ["Screening", ["Screening"]], ["Shortlisted", ["Shortlisted"]],
      ["Interview", ["Interview", "Reference checks"]], ["Decision", ["Offer", "Hired", "Rejected", "Withdrawn"]]
    ];
    target.innerHTML = columns.map(([title, stages]) => `<section class="candidate-column"><h4>${title} · ${candidates.filter(item => stages.includes(item.stage)).length}</h4>${candidates.filter(item => stages.includes(item.stage)).map(item => {
      const job = hrData.jobs.find(job => job.id === item.job_opening_id);
      return `<article class="candidate-card"><strong>${esc(item.full_name)}</strong><small>${esc(job?.title || "Vacancy")}<br>${esc(item.email)} · ${esc(item.phone)}</small><div class="hr-row-actions"><button data-candidate-cv="${esc(item.cv_storage_path)}">CV</button><button data-interview-candidate="${item.id}">Interview</button></div><select data-candidate-stage="${item.id}" aria-label="Stage for ${esc(item.full_name)}">${STAGES.map(stage => `<option ${stage === item.stage ? "selected" : ""}>${stage}</option>`).join("")}</select></article>`;
    }).join("")}</section>`).join("");
  }

  function renderAdmin() {
    const target = document.getElementById("admin-user-list");
    if (!isAdmin()) { target.innerHTML = '<div class="empty-state"><p>Administrator access is required.</p></div>'; return; }
    target.innerHTML = adminData.length ? adminData.map(user => `<div class="admin-user-row"><div><strong>${esc(user.full_name)}</strong><span>${esc(user.email)} · ${user.invited ? "Account active" : "Invitation pending"}</span></div><select data-user-role="${esc(user.email)}">${Object.entries(ROLE_LABELS).map(([value, label]) => `<option value="${value}" ${value === user.role ? "selected" : ""}>${label}</option>`).join("")}</select><label><input type="checkbox" data-user-active="${esc(user.email)}" ${user.active ? "checked" : ""}> Active</label></div>`).join("") : '<div class="empty-state"><p>No accounts found.</p></div>';
  }

  function render() {
    if (!document.getElementById("hr-metrics")) return;
    metrics(); renderProfile(); renderJobs(); renderInterviews(); renderCandidates(); renderAdmin();
  }

  async function load(includeAdmin = false) {
    if (loading || !window.CAGE_BACKEND?.currentProfile?.()) return;
    loading = true;
    try {
      hrData = await window.CAGE_BACKEND.loadHR();
      if ((includeAdmin || isAdmin()) && isAdmin()) adminData = (await window.CAGE_BACKEND.adminUsers("list")).users || [];
      render();
    } catch (error) { showToast(error.message || "HR records could not be loaded."); }
    finally { loading = false; }
  }

  document.getElementById("new-job-button").addEventListener("click", () => { const form = document.getElementById("job-form"); form.reset(); form.elements.location.value = "Malawi"; document.getElementById("job-dialog").showModal(); });
  document.getElementById("schedule-interview-button").addEventListener("click", () => openInterview());
  document.getElementById("upload-cv-button").addEventListener("click", () => { document.getElementById("employee-document-form").reset(); document.getElementById("employee-document-dialog").showModal(); });
  document.getElementById("invite-user-button").addEventListener("click", () => { document.getElementById("invite-user-form").reset(); document.getElementById("invite-user-dialog").showModal(); });
  document.getElementById("candidate-search").addEventListener("input", renderCandidates);

  function openInterview(applicationId = "") {
    const form = document.getElementById("interview-form"); form.reset();
    const eligible = hrData.applications.filter(item => !["Hired", "Rejected", "Withdrawn"].includes(item.stage));
    document.getElementById("interview-candidate-input").innerHTML = '<option value="">Select candidate</option>' + eligible.map(item => `<option value="${item.id}" ${item.id === applicationId ? "selected" : ""}>${esc(item.full_name)} · ${esc(hrData.jobs.find(job => job.id === item.job_opening_id)?.title || "Vacancy")}</option>`).join("");
    document.getElementById("interview-dialog").showModal();
  }

  document.getElementById("job-form").addEventListener("submit", async event => {
    event.preventDefault(); if (event.submitter?.value === "cancel") return document.getElementById("job-dialog").close();
    const form = event.currentTarget; const data = new FormData(form); const error = document.getElementById("job-form-error"); error.textContent = "";
    try { await window.CAGE_BACKEND.createJob(Object.fromEntries(data)); document.getElementById("job-dialog").close(); showToast("Vacancy created."); await load(); }
    catch (e) { error.textContent = e.message || "Vacancy could not be created."; }
  });
  document.getElementById("interview-form").addEventListener("submit", async event => {
    event.preventDefault(); if (event.submitter?.value === "cancel") return document.getElementById("interview-dialog").close();
    const data = new FormData(event.currentTarget); const payload = Object.fromEntries(data); const error = document.getElementById("interview-form-error"); error.textContent = "";
    if (payload.end <= payload.start) { error.textContent = "Interview end time must be after the start."; return; }
    try {
      const result = await window.CAGE_BACKEND.scheduleInterview(payload);
      const application = hrData.applications.find(item => item.id === payload.applicationId);
      state.events.push({ id: `ev-interview-${Date.now()}`, title: `Interview — ${application?.full_name || "Candidate"}`, date: payload.start.slice(0, 10), start: payload.start.slice(11, 16), end: payload.end.slice(11, 16), type: "Meeting", owner: window.CAGE_BACKEND.currentMemberId(), project: "", attendees: `${application?.full_name || "Candidate"} · ${payload.format} · ${payload.location}` });
      saveState();
      document.getElementById("interview-dialog").close();
      showToast(result.emailSent ? "Interview scheduled and invitation emailed." : "Interview scheduled; check the email configuration before notifying the candidate.");
      await load();
    }
    catch (e) { error.textContent = e.message || "Interview could not be scheduled."; }
  });
  document.getElementById("employee-document-form").addEventListener("submit", async event => {
    event.preventDefault(); if (event.submitter?.value === "cancel") return document.getElementById("employee-document-dialog").close();
    const form = event.currentTarget; const file = form.elements.file.files?.[0]; const error = document.getElementById("employee-document-form-error"); error.textContent = "";
    try { await window.CAGE_BACKEND.uploadEmployeeDocument(file, form.elements.documentType.value, form.elements.expiryDate.value); document.getElementById("employee-document-dialog").close(); showToast("Employee document uploaded securely."); await load(); }
    catch (e) { error.textContent = e.message || "Document upload failed."; }
  });
  document.getElementById("invite-user-form").addEventListener("submit", async event => {
    event.preventDefault(); if (event.submitter?.value === "cancel") return document.getElementById("invite-user-dialog").close();
    const error = document.getElementById("invite-user-form-error"); error.textContent = "";
    try { await window.CAGE_BACKEND.adminUsers("invite", Object.fromEntries(new FormData(event.currentTarget))); document.getElementById("invite-user-dialog").close(); showToast("Invitation sent."); await load(true); }
    catch (e) { error.textContent = e.message || "User could not be invited."; }
  });

  document.addEventListener("change", async event => {
    if (event.target.matches("[data-candidate-stage]")) {
      try { await window.CAGE_BACKEND.updateApplicationStage(event.target.dataset.candidateStage, event.target.value); showToast("Candidate stage updated."); await load(); }
      catch (e) { showToast(e.message || "Stage could not be changed."); }
    }
    if (event.target.matches("[data-user-role], [data-user-active]")) {
      const row = event.target.closest(".admin-user-row"); const roleSelect = row.querySelector("[data-user-role]"); const activeInput = row.querySelector("[data-user-active]"); const email = roleSelect.dataset.userRole;
      try { await window.CAGE_BACKEND.adminUsers("update", { email, role: roleSelect.value, active: activeInput.checked }); showToast("User access updated."); await load(true); }
      catch (e) { showToast(e.message || "User access could not be updated."); await load(true); }
    }
  });
  document.addEventListener("click", event => {
    const interview = event.target.closest("[data-interview-candidate]"); if (interview) openInterview(interview.dataset.interviewCandidate);
    const cv = event.target.closest("[data-candidate-cv]"); if (cv) window.CAGE_BACKEND.openFile(cv.dataset.candidateCv).catch(e => showToast(e.message));
    const file = event.target.closest("[data-open-hr-file]"); if (file) window.CAGE_BACKEND.openFile(file.dataset.openHrFile).catch(e => showToast(e.message));
  });

  window.addEventListener("cage:session-ready", () => load(isAdmin()));
  window.CAGE_HR_UI = { load, render };
})();
