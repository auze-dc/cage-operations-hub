(function () {
  "use strict";
  const STAGES = ["New", "Screening", "Shortlisted", "Interview", "Reference checks", "Offer", "Hired", "Rejected", "Withdrawn"];
  const stageLabel = stage => stage === "Rejected" ? "Not Shortlisted" : stage;
  const ROLE_LABELS = { admin: "Administrator", manager: "Manager", hr: "HR", finance: "Finance", member: "Member", viewer: "Viewer", shared: "Shared account" };
  let hrData = { jobs: [], applications: [], interviews: [], employeeProfile: null, documents: [] };
  let adminData = [];
  let loading = false;
  const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const profile = () => window.CAGE_BACKEND?.currentProfile?.();
  const canHR = () => ["admin", "manager", "hr"].includes(profile()?.role);
  const isAdmin = () => profile()?.role === "admin";

  function metrics() {
    const openJobs = hrData.jobs.filter(job => job.status === "Open" && job.closing_date >= window.CAGE_JOB_ADVERT.today()).length;
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
    target.innerHTML = hrData.jobs.length ? hrData.jobs.map(job => `<div class="hr-list-row"><div><strong>${esc(job.title)}</strong><span>${esc(job.department)} · ${esc(job.employment_type)} · closes ${esc(job.closing_date)}</span></div><div class="hr-row-actions"><span class="status-pill ${job.status === "Open" ? "done" : "attention"}">${esc(job.status === "Open" && job.closing_date < window.CAGE_JOB_ADVERT.today() ? "Closed" : job.status)}</span><button data-view-applicants="${esc(job.id)}">View applicants (${hrData.applications.filter(item => item.job_opening_id === job.id).length})</button><a class="vacancy-advert-link" href="./careers#role-${encodeURIComponent(job.id)}" target="_blank" rel="noopener">Open advert ↗</a><button data-edit-vacancy="${job.id}">Edit</button><button data-duplicate-vacancy="${job.id}">Duplicate</button></div></div>`).join("") : '<div class="empty-state"><p>No vacancies have been created.</p></div>';
  }

  function renderInterviews() {
    const target = document.getElementById("interview-list");
    if (!canHR()) { target.innerHTML = ""; return; }
    const upcoming = hrData.interviews.filter(item => new Date(item.scheduled_end) >= new Date()).slice(0, 8);
    target.innerHTML = upcoming.length ? upcoming.map(item => {
      const application = hrData.applications.find(app => app.id === item.application_id);
      return `<div class="hr-list-row"><div><strong>${esc(application?.full_name || "Candidate")}</strong><span>${new Date(item.scheduled_start).toLocaleString("en-GB", { timeZone: "Africa/Blantyre", dateStyle: "medium", timeStyle: "short" })} (Malawi) · ${esc(item.format)}</span></div><div class="hr-row-actions"><span>${esc(item.status)}</span><button type="button" data-interview-panel="${esc(item.id)}">Details & scores</button></div></div>`;
    }).join("") : '<div class="empty-state"><p>No upcoming interviews.</p></div>';
  }

  function renderVacancyFilter() {
    const select = document.getElementById("candidate-vacancy-filter"), selected = select.value;
    const counts = new Map();
    for (const item of hrData.applications) counts.set(item.job_opening_id, (counts.get(item.job_opening_id) || 0) + 1);
    select.innerHTML = `<option value="">All vacancies (${hrData.applications.length})</option>` + hrData.jobs.map(job => `<option value="${esc(job.id)}">${esc(job.title)} · ${esc(job.closing_date)} (${counts.get(job.id) || 0})</option>`).join("") + [...counts].filter(([id]) => !hrData.jobs.some(job => job.id === id)).map(([id,count]) => `<option value="${esc(id)}">Vacancy details unavailable (${count})</option>`).join("");
    if ([...select.options].some(option => option.value === selected)) select.value = selected;
  }

  function candidateInterview(applicationId) {
    const meetings=hrData.interviews.filter(item=>item.application_id===applicationId);
    const upcoming=meetings.filter(item=>item.status==='Scheduled'&&new Date(item.scheduled_end)>=new Date()).sort((a,b)=>new Date(a.scheduled_start)-new Date(b.scheduled_start));
    const recent=meetings.filter(item=>item.status!=='Cancelled').sort((a,b)=>new Date(b.scheduled_start)-new Date(a.scheduled_start));
    const meeting=upcoming[0]||recent[0]||meetings[meetings.length-1];
    return meeting&&window.CAGE_INTERVIEWS?window.CAGE_INTERVIEWS.card(meeting):'';
  }

  function renderCandidates() {
    clearCandidateDrag();
    const target = document.getElementById("candidate-board");
    if (!canHR()) { target.innerHTML = ""; return; }
    const query = document.getElementById("candidate-search").value.trim().toLowerCase();
    const vacancyId = document.getElementById("candidate-vacancy-filter").value;
    const candidates = hrData.applications.filter(item => (!vacancyId || item.job_opening_id === vacancyId) && (!document.getElementById("candidate-assigned-to-me").checked || item.assigned_reviewer === profile()?.id) && `${item.full_name} ${item.email}`.toLowerCase().includes(query));
    const vacancy = hrData.jobs.find(job => job.id === vacancyId);
    document.getElementById("candidate-result-summary").textContent = `Showing ${candidates.length} of ${hrData.applications.length} applications · ${vacancyId ? vacancy?.title || "Vacancy details unavailable" : "All vacancies"}${query ? " · Search applied" : ""}${document.getElementById("candidate-assigned-to-me").checked ? " · Assigned to me" : ""}`;
    if (!candidates.length) { target.innerHTML = '<div class="empty-state candidate-filter-empty"><p>No applications match this view. Choose All vacancies or clear your search to see more applicants.</p></div>'; return; }
    const columns = [
      ["New", ["New"]], ["Screening", ["Screening"]], ["Shortlisted", ["Shortlisted"]],
      ["Interview", ["Interview", "Reference checks"]], ["Decision", ["Offer", "Hired", "Withdrawn"]], ["Not Shortlisted", ["Rejected"]]
    ];
    target.innerHTML = columns.map(([title, stages]) => `<section class="candidate-column" data-candidate-stages="${stages.join("|")}" aria-label="${esc(title)}"><h4>${title} · ${candidates.filter(item => stages.includes(item.stage)).length}</h4>${candidates.filter(item => stages.includes(item.stage)).map(item => {
      const job = hrData.jobs.find(job => job.id === item.job_opening_id);
      return `<article class="candidate-card" data-candidate-id="${esc(item.id)}"><button type="button" class="candidate-drag-handle" data-move-candidate="${esc(item.id)}" aria-label="Move ${esc(item.full_name)} to another recruitment section" title="Drag to another section, or click to choose a stage">⠿ Move</button><strong>${esc(item.full_name)}</strong><small><span class="candidate-vacancy-label">${esc(job?.title || "Vacancy details unavailable")}</span><br>${esc(item.email)} · ${esc(item.phone)}</small><p class="candidate-salary">${item.salary_expectation != null ? `${esc(item.salary_currency)} ${Number(item.salary_expectation).toLocaleString()} / ${esc(item.salary_period)} gross` : "Salary expectation not supplied (earlier application)"}</p>${(item.screening_answers || []).map(answer => `<details><summary>${esc(answer.question)}</summary><p>${esc(answer.answer)}</p></details>`).join("")}<div class="hr-row-actions"><button data-candidate-cv="${esc(item.cv_storage_path)}">CV</button>${!["Hired", "Rejected", "Withdrawn"].includes(item.stage) ? `<button data-interview-candidate="${item.id}">Interview</button><button class="candidate-not-shortlisted" data-not-shortlisted="${esc(item.id)}">Not shortlisted</button>` : ""}</div>${candidateInterview(item.id)}<div class="candidate-review-line"><span class="status-pill">${esc(stageLabel(item.stage))}</span><span>${item.assigned_reviewer ? item.assigned_reviewer === profile()?.id ? "Assigned to you" : "Reviewer assigned" : "Unassigned"}</span></div><button class="secondary-button candidate-review-button" data-review-candidate="${esc(item.id)}">Review applicant</button></article>`;
    }).join("")}</section>`).join("");
  }

  // Dragging prepares an audited decision; only Save review changes the record.
  let candidateDrag = null;
  const candidateBoard = document.getElementById("candidate-board");
  function clearCandidateDrag() {
    if (!candidateDrag) return;
    const drag = candidateDrag; candidateDrag = null;
    drag.card.classList.remove("candidate-dragging");
    drag.handle.setAttribute("aria-pressed", "false");
    candidateBoard.querySelectorAll(".candidate-drop-target").forEach(el => el.classList.remove("candidate-drop-target"));
    if (drag.handle.hasPointerCapture?.(drag.pointerId)) drag.handle.releasePointerCapture(drag.pointerId);
  }
  function dropColumn(event) {
    const column = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-candidate-stages]");
    return column && candidateBoard.contains(column) ? column : null;
  }
  candidateBoard.addEventListener("pointerdown", event => {
    const handle = event.target.closest("[data-move-candidate]");
    if (!handle || event.button !== 0 || event.isPrimary === false || !canHR()) return;
    clearCandidateDrag();
    candidateDrag = { handle, card: handle.closest(".candidate-card"), id: handle.dataset.moveCandidate, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    handle.setPointerCapture?.(event.pointerId);
  });
  candidateBoard.addEventListener("pointermove", event => {
    const drag = candidateDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
    drag.moved = true; event.preventDefault();
    drag.card.classList.add("candidate-dragging");drag.handle.setAttribute("aria-pressed", "true");
    const column = dropColumn(event);
    candidateBoard.querySelectorAll("[data-candidate-stages]").forEach(el => el.classList.toggle("candidate-drop-target", el === column && el !== drag.card.closest(".candidate-column")));
    // Scroll the board near either edge so all sections remain reachable.
    const bounds = candidateBoard.getBoundingClientRect();
    if (event.clientX > bounds.right - 48) candidateBoard.scrollLeft += 24;
    else if (event.clientX < bounds.left + 48) candidateBoard.scrollLeft -= 24;
  });
  candidateBoard.addEventListener("pointerup", event => {
    const drag = candidateDrag;if (!drag || event.pointerId !== drag.pointerId) return;
    const column = drag.moved ? dropColumn(event) : null;
    const stages = column?.dataset.candidateStages.split("|");
    const application = hrData.applications.find(item => item.id === drag.id);
    clearCandidateDrag();
    if (!canHR() || !application) return;
    if (!drag.moved) { window.CAGE_RECRUITMENT_REVIEWS?.open(drag.id, drag.handle, application.stage); return; }
    if (stages && !stages.includes(application.stage)) window.CAGE_RECRUITMENT_REVIEWS?.open(drag.id, drag.handle, stages[0]);
  });
  candidateBoard.addEventListener("pointercancel", clearCandidateDrag);
  candidateBoard.addEventListener("lostpointercapture", clearCandidateDrag);
  candidateBoard.addEventListener("click", event => {
    const handle = event.target.closest("[data-move-candidate]");
    // Keyboard and assistive technology clicks have no preceding pointerup.
    if (handle && event.detail === 0 && canHR()) {
      const application = hrData.applications.find(item => item.id === handle.dataset.moveCandidate);
      if (application) window.CAGE_RECRUITMENT_REVIEWS?.open(application.id, handle, application.stage);
    }
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") clearCandidateDrag(); });
  window.addEventListener("cage:session-ended", clearCandidateDrag);

  function renderAdmin() {
    const target = document.getElementById("admin-user-list");
    if (!isAdmin()) { target.innerHTML = '<div class="empty-state"><p>Administrator access is required.</p></div>'; return; }
    const currentEmail = String(profile()?.email || "").toLowerCase();
    target.innerHTML = adminData.length ? adminData.map(user => {
      const self = String(user.email).toLowerCase() === currentEmail;
      return `<div class="admin-user-row"><div><strong>${esc(user.full_name)}</strong><span>${esc(user.email)} · ${user.invited ? "Account active" : "Invitation pending"}</span></div><select data-user-role="${esc(user.email)}" aria-label="Role for ${esc(user.full_name)}" ${self ? "disabled" : ""}>${Object.entries(ROLE_LABELS).map(([value, label]) => `<option value="${value}" ${value === user.role ? "selected" : ""}>${label}</option>`).join("")}</select><label><input type="checkbox" data-user-active="${esc(user.email)}" ${user.active ? "checked" : ""} ${self ? "disabled" : ""}> Active</label><button class="secondary-button admin-save-access" data-save-user-access="${esc(user.email)}" ${self ? "disabled" : ""}>Save access</button>${self ? '<small class="admin-self-note">Your own administrator access is protected.</small>' : ""}</div>`;
    }).join("") : '<div class="empty-state"><p>No accounts found.</p></div>';
  }

  function render() {
    if (!document.getElementById("hr-metrics")) return;
    metrics(); renderProfile(); renderJobs(); renderInterviews(); renderVacancyFilter(); renderCandidates(); renderAdmin();
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

  document.getElementById("new-job-button").addEventListener("click", () => window.CAGE_VACANCY_EDITOR.open());
  document.getElementById("schedule-interview-button").addEventListener("click", () => openInterview());
  document.getElementById("upload-cv-button").addEventListener("click", () => { document.getElementById("employee-document-form").reset(); document.getElementById("employee-document-dialog").showModal(); });
  document.getElementById("invite-user-button").addEventListener("click", () => { document.getElementById("invite-user-form").reset(); document.getElementById("invite-user-dialog").showModal(); });
  document.getElementById("candidate-search").addEventListener("input", renderCandidates);
  document.getElementById("candidate-vacancy-filter").addEventListener("change", renderCandidates);
  document.getElementById("candidate-assigned-to-me").addEventListener("change", renderCandidates);

  function openInterview(applicationId = "") {
    const form = document.getElementById("interview-form"); form.reset();
    const eligible = hrData.applications.filter(item => !["Hired", "Rejected", "Withdrawn"].includes(item.stage));
    document.getElementById("interview-candidate-input").innerHTML = '<option value="">Select candidate</option>' + eligible.map(item => `<option value="${item.id}" ${item.id === applicationId ? "selected" : ""}>${esc(item.full_name)} · ${esc(hrData.jobs.find(job => job.id === item.job_opening_id)?.title || "Vacancy")}</option>`).join("");
    document.getElementById("interview-dialog").showModal();
  }

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
      showToast(result.warning || (result.emailSent ? "Interview scheduled and invitation emailed." : "Interview scheduled; check the email configuration before notifying the candidate."));
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

  document.addEventListener("click", event => {
    const applicants = event.target.closest("[data-view-applicants]");
    if (applicants) {
      const select = document.getElementById("candidate-vacancy-filter");
      select.value = applicants.dataset.viewApplicants;
      document.getElementById("candidate-search").value = "";
      document.getElementById("candidate-assigned-to-me").checked = false;
      renderCandidates(); select.scrollIntoView({ block: "center" }); select.focus({preventScroll:true});
    }
    const vacancy = event.target.closest("[data-edit-vacancy],[data-duplicate-vacancy]");
    if (vacancy) window.CAGE_VACANCY_EDITOR.open(hrData.jobs.find(job => job.id === (vacancy.dataset.editVacancy || vacancy.dataset.duplicateVacancy)), Boolean(vacancy.dataset.duplicateVacancy));
    const saveAccess = event.target.closest("[data-save-user-access]");
    if (saveAccess) {
      const row = saveAccess.closest(".admin-user-row");
      const roleSelect = row.querySelector("[data-user-role]");
      const activeInput = row.querySelector("[data-user-active]");
      saveAccess.disabled = true;
      saveAccess.textContent = "Saving…";
      window.CAGE_BACKEND.adminUsers("update", { email: saveAccess.dataset.saveUserAccess, role: roleSelect.value, active: activeInput.checked })
        .then(async () => { showToast("User role and access saved."); await load(true); })
        .catch(async e => { showToast(e.message || "User access could not be updated."); await load(true); });
    }
    const interview = event.target.closest("[data-interview-candidate]"); if (interview) openInterview(interview.dataset.interviewCandidate);
    const cv = event.target.closest("[data-candidate-cv]"); if (cv) window.CAGE_BACKEND.openFile(cv.dataset.candidateCv).catch(e => showToast(e.message));
    const file = event.target.closest("[data-open-hr-file]"); if (file) window.CAGE_BACKEND.openFile(file.dataset.openHrFile).catch(e => showToast(e.message));
  });

  window.addEventListener("cage:session-ready", () => load(isAdmin()));
  window.CAGE_HR_UI = { load, render, interviewsFor: id => { if(!canHR())return []; const meeting=hrData.interviews.find(item=>item.id===id);return meeting?hrData.interviews.filter(item=>item.application_id===meeting.application_id).sort((a,b)=>new Date(b.scheduled_start)-new Date(a.scheduled_start)):[]; }, application: id => canHR() ? hrData.applications.find(item => item.id === id) : null };
})();
