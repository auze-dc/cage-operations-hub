(function () {
  "use strict";
  const STAGES = ["Enquiry", "Registered", "Documents pending", "Training", "Assessment", "Certification", "Completed", "Withdrawn"];
  const COLUMNS = [["Enquiry", ["Enquiry"]], ["Registered", ["Registered", "Documents pending"]], ["Training", ["Training"]], ["Assessment", ["Assessment"]], ["Certification", ["Certification"]], ["Completed", ["Completed", "Withdrawn"]]];
  let records = { courses: [], cohorts: [], learners: [], staff: [] };
  let loading = false;
  let draggedLearner = null;
  const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const course = id => records.courses.find(item => item.id === id);
  const cohort = id => records.cohorts.find(item => item.id === id);
  const learner = id => records.learners.find(item => item.id === id);
  const learnerCourse = item => course(cohort(item.cohort_id)?.course_id);

  function renderMetrics() {
    const activeCohorts = records.cohorts.filter(item => !["Completed", "Cancelled"].includes(item.status)).length;
    const activeLearners = records.learners.filter(item => !["Completed", "Withdrawn"].includes(item.stage)).length;
    const docGaps = records.learners.filter(item => !item.documents_complete && !["Enquiry", "Withdrawn"].includes(item.stage)).length;
    const completed = records.learners.filter(item => item.stage === "Completed").length;
    document.getElementById("training-nav-count").textContent = String(activeLearners);
    document.getElementById("training-metrics").innerHTML = [
      ["Active cohorts", activeCohorts, "Across all training types", "△", "#008fc8", "#e6f7fe"],
      ["Active learners", activeLearners, "Students and participants", "◎", "#7357c8", "#f0edfb"],
      ["Document gaps", docGaps, "Resolve before regulated training", "!", "#d64e4b", "#feeceb"],
      ["Completed", completed, "Certificates and follow-up", "✓", "#168a65", "#e5f5ef"]
    ].map(([label, value, note, icon, tone, tint]) => `<article class="metric-card" style="--tone:${tone};--tint:${tint}"><div class="metric-card-top"><span class="metric-icon">${icon}</span><span class="metric-label">${label}</span></div><div class="metric-value">${value}</div><p>${note}</p></article>`).join("");
  }

  function renderCohorts() {
    const query = document.getElementById("training-search").value.trim().toLowerCase();
    const matching = records.cohorts.filter(item => `${item.name} ${course(item.course_id)?.name || ""} ${item.venue}`.toLowerCase().includes(query) || records.learners.some(person => person.cohort_id === item.id && person.full_name.toLowerCase().includes(query)));
    document.getElementById("training-cohort-list").innerHTML = matching.length ? matching.map(item => {
      const enrolled = records.learners.filter(person => person.cohort_id === item.id && person.stage !== "Withdrawn").length;
      const lead = records.staff.find(person => person.id === item.lead_instructor)?.full_name || "Not assigned";
      return `<div class="cohort-card"><div><h4>${esc(item.name)}</h4><p><strong>${esc(course(item.course_id)?.name || "Course")}</strong></p><p>${esc(item.start_date)} to ${esc(item.end_date)} · ${esc(item.venue)}<br>Lead: ${esc(lead)} · Source: ${esc(item.source_reference || "Direct")}</p><div class="hr-row-actions"><button data-cohort-action="attendance" data-cohort-id="${item.id}">Attendance</button><button data-cohort-action="assessment" data-cohort-id="${item.id}">Assessments</button><button data-cohort-action="message" data-cohort-id="${item.id}">Message cohort</button></div></div><div class="cohort-progress"><strong>${enrolled}/${item.capacity}</strong><span>Learners enrolled</span><span>${esc(item.status)}</span></div></div>`;
    }).join("") : '<div class="empty-state"><p>No cohorts have been created yet.</p></div>';
  }

  function renderAlerts() {
    const docGaps = records.learners.filter(item => !item.documents_complete && !["Enquiry", "Withdrawn"].includes(item.stage));
    const unpaid = records.learners.filter(item => ["Not invoiced", "Invoiced", "Part-paid"].includes(item.fee_status) && !["Enquiry", "Withdrawn"].includes(item.stage));
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 90);
    const renewals = records.learners.filter(item => item.renewal_due && new Date(item.renewal_due) <= cutoff);
    const capacity = records.cohorts.filter(item => records.learners.filter(person => person.cohort_id === item.id && person.stage !== "Withdrawn").length >= Number(item.capacity));
    const alerts = [[docGaps.length ? "danger" : "", "!", `${docGaps.length} document checks pending`, "RPL medical/ID, refresher licence or child consent must be complete."], [unpaid.length ? "warning" : "", "¤", `${unpaid.length} learner accounts need action`, "Raise invoices, record sponsorship or follow up balances."], [renewals.length ? "warning" : "", "↻", `${renewals.length} RPL renewal follow-up`, "Contact returning pilots before their licence or recurrent date."], [capacity.length ? "danger" : "", "◎", `${capacity.length} cohorts at capacity`, "Create another cohort before accepting more learners."]];
    document.getElementById("training-alerts").innerHTML = alerts.map(([tone, icon, title, copy]) => `<div class="training-alert ${tone}"><b>${icon}</b><div><strong>${title}</strong><span>${copy}</span></div></div>`).join("");
  }

  function renderLearners() {
    const query = document.getElementById("training-search").value.trim().toLowerCase();
    const matching = records.learners.filter(item => `${item.full_name} ${cohort(item.cohort_id)?.name || ""} ${learnerCourse(item)?.category || ""}`.toLowerCase().includes(query));
    document.getElementById("learner-board").innerHTML = COLUMNS.map(([title, stages]) => {
      const items = matching.filter(item => stages.includes(item.stage));
      return `<section class="learner-column" data-learner-drop="${stages[0]}"><h4><span>${title}</span><span>${items.length}</span></h4>${items.map(item => `<article class="learner-card" draggable="true" data-learner-id="${item.id}"><strong>${esc(item.full_name)}</strong><small>${esc(learnerCourse(item)?.category || "Training")}<br>${esc(cohort(item.cohort_id)?.name || "No cohort")}</small><div class="learner-tags"><span>${esc(item.fee_status)}</span>${item.documents_complete ? '<span>Docs ✓</span>' : '<span class="tag-warning">Docs pending</span>'}${item.guardian_name ? '<span>Guardian ✓</span>' : ""}${Number(item.attendance_percent) ? `<span>${Number(item.attendance_percent)}% attendance</span>` : ""}</div><select data-learner-stage="${item.id}" aria-label="Stage for ${esc(item.full_name)}">${STAGES.map(stage => `<option ${stage === item.stage ? "selected" : ""}>${stage}</option>`).join("")}</select></article>`).join("")}</section>`;
    }).join("");
  }

  function renderCourses() {
    document.getElementById("training-course-grid").innerHTML = records.courses.length ? records.courses.map(item => `<article class="course-card"><span class="course-type">${esc(item.category)}</span><h4>${esc(item.name)}</h4><p>${esc(item.outcome)}</p><p><strong>Controls:</strong> ${esc(item.requirements || "Defined per cohort")}</p><footer><span>${esc(item.duration)}</span><span>${esc(item.certificate_type)}</span></footer></article>`).join("") : '<div class="empty-state"><p>Run migration 004 to load the CAGE course catalogue.</p></div>';
  }

  function populateDialogs() {
    document.getElementById("cohort-course-input").innerHTML = records.courses.filter(item => item.active).map(item => `<option value="${item.id}">${esc(item.name)}</option>`).join("");
    document.getElementById("cohort-lead-input").innerHTML = records.staff.map(item => `<option value="${item.id}">${esc(item.full_name)}</option>`).join("");
    document.getElementById("learner-cohort-input").innerHTML = records.cohorts.filter(item => !["Completed", "Cancelled"].includes(item.status)).map(item => `<option value="${item.id}">${esc(item.name)}</option>`).join("");
  }
  function updateConditionalFields() {
    const selected = cohort(document.getElementById("learner-cohort-input").value); const category = course(selected?.course_id)?.category || "";
    document.getElementById("rpl-fields").hidden = category !== "RPL Refresher"; document.getElementById("guardian-fields").hidden = category !== "STEM";
  }
  function render() { if (!document.getElementById("training-metrics")) return; renderMetrics(); renderCohorts(); renderAlerts(); renderLearners(); renderCourses(); populateDialogs(); updateConditionalFields(); }
  async function load() { if (loading || !window.CAGE_BACKEND?.currentProfile?.()) return; loading = true; try { records = await window.CAGE_BACKEND.loadTraining(); render(); } catch (error) { showToast(error.message || "Training records could not be loaded."); } finally { loading = false; } }

  document.getElementById("new-training-program-button").addEventListener("click", () => { document.getElementById("training-program-form").reset(); document.getElementById("training-program-dialog").showModal(); });
  document.getElementById("new-cohort-button").addEventListener("click", () => { populateDialogs(); document.getElementById("training-cohort-form").reset(); populateDialogs(); document.getElementById("training-cohort-dialog").showModal(); });
  document.getElementById("enrol-learner-button").addEventListener("click", () => { populateDialogs(); document.getElementById("learner-form").reset(); populateDialogs(); updateConditionalFields(); document.getElementById("learner-dialog").showModal(); });
  document.getElementById("training-search").addEventListener("input", () => { renderCohorts(); renderLearners(); });
  document.getElementById("learner-cohort-input").addEventListener("change", updateConditionalFields);

  document.getElementById("training-program-form").addEventListener("submit", async event => { event.preventDefault(); if (event.submitter?.value === "cancel") return document.getElementById("training-program-dialog").close(); const error = document.getElementById("training-program-error"); error.textContent = ""; try { await window.CAGE_BACKEND.createTrainingCourse(Object.fromEntries(new FormData(event.currentTarget))); document.getElementById("training-program-dialog").close(); showToast("Course added to the CAGE catalogue."); await load(); } catch (e) { error.textContent = e.message || "Course could not be created."; } });
  document.getElementById("training-cohort-form").addEventListener("submit", async event => { event.preventDefault(); if (event.submitter?.value === "cancel") return document.getElementById("training-cohort-dialog").close(); const payload = Object.fromEntries(new FormData(event.currentTarget)); const error = document.getElementById("training-cohort-error"); error.textContent = ""; if (payload.end < payload.start) { error.textContent = "The end date must be on or after the start date."; return; } try { await window.CAGE_BACKEND.createTrainingCohort(payload); state.events.push({ id: `ev-training-${Date.now()}`, title: payload.name, date: payload.start, start: "08:00", end: "16:00", type: "Training", owner: window.CAGE_BACKEND.currentMemberId(), project: "", attendees: `${payload.capacity} learner capacity · ${payload.venue}` }); saveState(); document.getElementById("training-cohort-dialog").close(); showToast("Cohort created and added to the shared calendar."); await load(); } catch (e) { error.textContent = e.message || "Cohort could not be created."; } });
  document.getElementById("learner-form").addEventListener("submit", async event => { event.preventDefault(); if (event.submitter?.value === "cancel") return document.getElementById("learner-dialog").close(); const form = new FormData(event.currentTarget); const payload = Object.fromEntries(form); payload.documentsComplete = Boolean(form.get("documentsComplete")); const selectedCohort = cohort(payload.cohortId); const selectedCourse = course(selectedCohort?.course_id); const error = document.getElementById("learner-form-error"); error.textContent = ""; if (selectedCourse?.category === "RPL Refresher" && !/20\d{2}-\d{2}-\d{2}/.test(payload.rplNumber || "")) { error.textContent = "Add the existing RPL number and expiry date in YYYY-MM-DD format."; return; } const age = payload.dob ? Math.floor((Date.now() - new Date(payload.dob)) / 31557600000) : null; if (selectedCourse?.category === "STEM" && (age === null || age < 18) && !String(payload.guardian || "").trim()) { error.textContent = "Add the parent or guardian for a child enrolled in STEM training."; return; } const current = records.learners.filter(item => item.cohort_id === payload.cohortId && item.stage !== "Withdrawn").length; if (current >= Number(selectedCohort.capacity)) { error.textContent = "This cohort is at capacity. Create another cohort first."; return; } try { await window.CAGE_BACKEND.createLearner(payload); document.getElementById("learner-dialog").close(); showToast("Learner enrolled securely."); await load(); } catch (e) { error.textContent = e.message || "Learner could not be enrolled."; } });

  document.addEventListener("change", async event => { const select = event.target.closest("[data-learner-stage]"); if (!select) return; const item = learner(select.dataset.learnerStage); if (["Training", "Assessment", "Certification", "Completed"].includes(select.value) && !item.documents_complete) { select.value = item.stage; showToast("Complete the learner required documents before advancing."); return; } try { await window.CAGE_BACKEND.updateLearnerStage(item.id, select.value); await load(); } catch (error) { select.value = item.stage; showToast(error.message || "Stage could not be updated."); } });
  document.addEventListener("click", event => { const button = event.target.closest("[data-cohort-action]"); if (!button) return; const item = cohort(button.dataset.cohortId); const labels = { attendance: "Attendance register", assessment: "Assessments and instructor sign-offs", message: "Learner and guardian communication" }; showToast(`${labels[button.dataset.cohortAction]} for ${item?.name || "this cohort"} is stored against the cohort.`); });
  document.addEventListener("dragstart", event => { const card = event.target.closest("[data-learner-id]"); if (card) { draggedLearner = card.dataset.learnerId; event.dataTransfer.effectAllowed = "move"; } });
  document.addEventListener("dragover", event => { const column = event.target.closest("[data-learner-drop]"); if (column) { event.preventDefault(); column.classList.add("drag-over"); } });
  document.addEventListener("dragleave", event => { const column = event.target.closest("[data-learner-drop]"); if (column) column.classList.remove("drag-over"); });
  document.addEventListener("drop", async event => { const column = event.target.closest("[data-learner-drop]"); if (!column || !draggedLearner) return; event.preventDefault(); document.querySelectorAll(".learner-column").forEach(el => el.classList.remove("drag-over")); const item = learner(draggedLearner); draggedLearner = null; const next = column.dataset.learnerDrop; if (["Training", "Assessment", "Certification", "Completed"].includes(next) && !item.documents_complete) { showToast("Complete the learner required documents before advancing."); return; } try { await window.CAGE_BACKEND.updateLearnerStage(item.id, next); await load(); } catch (error) { showToast(error.message || "Stage could not be updated."); } });

  window.addEventListener("cage:session-ready", load);
  window.CAGE_TRAINING_UI = { load, render };
})();
