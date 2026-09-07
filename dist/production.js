(function () {
  "use strict";

  const config = window.CAGE_CONFIG || {};
  const gate = document.getElementById("auth-gate");
  const banner = document.getElementById("sync-banner");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const passwordSetupForm = document.getElementById("password-setup-form");
  const passwordSetupError = document.getElementById("password-setup-error");
  const forgotPasswordButton = document.getElementById("forgot-password");
  const authCallbackType = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type")
    || new URLSearchParams(window.location.search).get("type");
  let passwordSetupPending = ["invite", "recovery"].includes(authCallbackType);
  let client = null;
  let app = null;
  let profile = null;
  let workspaceVersion = 0;
  let saveTimer = null;
  let pendingState = null;
  let saveChain = Promise.resolve();
  let realtimeChannel = null;
  let applyingRemote = false;

  function configured() {
    return config.mode === "production" && config.supabaseUrl && config.supabaseAnonKey && config.organizationId;
  }

  function showBanner(message, tone = "") {
    banner.textContent = message;
    banner.className = `sync-banner visible ${tone}`.trim();
  }

  function hideBanner(delay = 1200) {
    window.setTimeout(() => { banner.className = "sync-banner"; }, delay);
  }

  function showLogin(message = "") {
    document.body.classList.add("auth-pending");
    gate.hidden = false;
    loginForm.hidden = false;
    passwordSetupForm.hidden = true;
    forgotPasswordButton.hidden = false;
    document.getElementById("auth-title").textContent = "Sign in to Operations Hub";
    loginError.textContent = message;
  }

  function showPasswordSetup(message = "") {
    document.body.classList.add("auth-pending");
    gate.hidden = false;
    loginForm.hidden = true;
    passwordSetupForm.hidden = false;
    forgotPasswordButton.hidden = true;
    document.getElementById("auth-title").textContent = authCallbackType === "recovery" ? "Choose a new password" : "Complete your CAGE account";
    passwordSetupError.textContent = message;
    document.getElementById("new-password").focus();
  }

  function hideLogin() {
    gate.hidden = true;
    document.body.classList.remove("auth-pending");
  }

  function setCurrentUser() {
    const name = document.getElementById("current-user-name");
    const role = document.getElementById("current-user-role");
    const avatar = document.querySelector(".user-card .avatar");
    if (!profile) return;
    name.textContent = profile.full_name;
    const labels = { admin: "Administrator", manager: "Manager", hr: "HR", finance: "Finance", member: "Team member", viewer: "Viewer", shared: "Shared account" };
    role.textContent = labels[profile.role] || "Team member";
    avatar.textContent = profile.initials || profile.full_name.split(/\s+/).slice(0, 2).map(part => part[0]).join("");
  }

  function applyPermissions() {
    const isAdmin = profile?.role === "admin";
    const canApprove = ["admin", "manager"].includes(profile?.role);
    const isViewer = profile?.role === "viewer";
    ["manage-purpose-button", "reset-prototype", "import-workspace-label"].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.hidden = !isAdmin;
    });
    document.querySelectorAll("[data-decide-approval]").forEach(button => {
      button.disabled = !canApprove;
      if (!canApprove) button.title = "Manager or administrator approval required";
    });
    const adminNav = document.getElementById("admin-nav-item");
    if (adminNav) adminNav.hidden = !isAdmin;
    document.querySelectorAll(".hr-privileged").forEach(element => { element.hidden = !["admin", "manager", "hr"].includes(profile?.role); });
    if (isViewer) document.querySelectorAll("button.primary-button, .mobile-add-button").forEach(button => { if (!button.closest(".auth-card")) button.disabled = true; });
  }

  async function loadProfile(userId) {
    const { data, error } = await client
      .from("profiles")
      .select("id, organization_id, email, full_name, initials, role, active, assignable")
      .eq("id", userId)
      .eq("organization_id", config.organizationId)
      .single();
    if (error || !data?.active) throw new Error("This account is not active for the CAGE Operations Hub.");
    return data;
  }

  async function loadWorkspace() {
    const { data, error } = await client
      .from("workspace_states")
      .select("data, version, updated_at")
      .eq("organization_id", config.organizationId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      if (profile.role !== "admin") throw new Error("The workspace has not been initialized. Ask an administrator to sign in first.");
      const initial = { organization_id: config.organizationId, data: app.seedData, version: 1, updated_by: profile.id };
      const result = await client.from("workspace_states").insert(initial).select("data, version").single();
      if (result.error) throw result.error;
      workspaceVersion = result.data.version;
      app.replaceState(result.data.data);
      return;
    }
    workspaceVersion = data.version || 0;
    app.replaceState(data.data);
  }

  function subscribe() {
    if (realtimeChannel) client.removeChannel(realtimeChannel);
    realtimeChannel = client
      .channel(`cage-workspace-${config.organizationId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "workspace_states",
        filter: `organization_id=eq.${config.organizationId}`
      }, payload => {
        const incoming = payload.new;
        if (!incoming || incoming.version <= workspaceVersion) return;
        workspaceVersion = incoming.version;
        applyingRemote = true;
        app.replaceState(incoming.data);
        applyingRemote = false;
        applyPermissions();
        showBanner("Workspace updated by a teammate", "success");
        hideBanner();
      })
      .subscribe(status => {
        if (status === "SUBSCRIBED") {
          showBanner("Connected to the shared workspace", "success");
          hideBanner();
        }
      });
  }

  async function flushSave() {
    if (!pendingState || !profile || applyingRemote) return;
    const snapshot = pendingState;
    pendingState = null;
    const expectedVersion = workspaceVersion;
    showBanner("Saving changes…");
    const { data, error } = await client
      .from("workspace_states")
      .update({ data: snapshot, version: expectedVersion + 1, updated_by: profile.id })
      .eq("organization_id", config.organizationId)
      .eq("version", expectedVersion)
      .select("version")
      .maybeSingle();
    if (error) {
      showBanner("Changes are saved on this device; cloud sync will retry", "error");
      pendingState = snapshot;
      window.setTimeout(() => scheduleSave(snapshot), 4000);
      return;
    }
    if (!data) {
      showBanner("A teammate changed this record. Refreshing the latest workspace…", "error");
      await loadWorkspace();
      hideBanner(2200);
      return;
    }
    workspaceVersion = data.version;
    showBanner("All changes saved", "success");
    hideBanner();
  }

  function scheduleSave(nextState) {
    if (!configured() || !profile || applyingRemote) return;
    pendingState = JSON.parse(JSON.stringify(nextState));
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveChain = saveChain.then(flushSave).catch(error => {
        showBanner(error.message || "Cloud sync failed", "error");
      });
    }, 650);
  }

  async function establishSession(session) {
    if (!session?.user) {
      showLogin();
      return;
    }
    showBanner("Opening the secure CAGE workspace…");
    try {
      profile = await loadProfile(session.user.id);
      await loadWorkspace();
      setCurrentUser();
      applyPermissions();
      subscribe();
      hideLogin();
      hideBanner();
      window.dispatchEvent(new CustomEvent("cage:session-ready", { detail: { profile } }));
    } catch (error) {
      await client.auth.signOut();
      showLogin(error.message || "Access could not be verified.");
      banner.className = "sync-banner";
    }
  }

  async function boot(appApi) {
    app = appApi;
    document.body.classList.add("auth-pending");
    if (!configured()) {
      showLogin("Deployment setup is incomplete. Add the Supabase settings described in DEPLOYMENT_GUIDE.md and rebuild.");
      return;
    }
    if (!window.supabase?.createClient) {
      showLogin("The secure database client could not load. Check the deployment build.");
      return;
    }
    client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data } = await client.auth.getSession();
    if (passwordSetupPending && data.session) showPasswordSetup();
    else await establishSession(data.session);
    client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        passwordSetupPending = true;
        showPasswordSetup();
        return;
      }
      if (event === "SIGNED_IN" && passwordSetupPending) {
        showPasswordSetup();
        return;
      }
      if (event === "SIGNED_IN" && session?.user && profile?.id !== session.user.id) establishSession(session);
      if (event === "SIGNED_OUT") {
        profile = null;
        showLogin();
      }
    });
  }

  loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!client) return;
    loginError.textContent = "";
    const button = event.submitter;
    button.disabled = true;
    button.textContent = "Signing in…";
    const { error } = await client.auth.signInWithPassword({
      email: document.getElementById("login-email").value.trim().toLowerCase(),
      password: document.getElementById("login-password").value
    });
    if (error) loginError.textContent = "The email or password is incorrect, or the account has not been invited.";
    button.disabled = false;
    button.textContent = "Sign in";
  });

  passwordSetupForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!client) return;
    passwordSetupError.textContent = "";
    const password = document.getElementById("new-password").value;
    const confirmation = document.getElementById("confirm-password").value;
    if (password !== confirmation) {
      passwordSetupError.textContent = "The two passwords do not match.";
      return;
    }
    const button = event.submitter;
    button.disabled = true;
    button.textContent = "Saving password…";
    const { data, error } = await client.auth.updateUser({ password });
    if (error) {
      passwordSetupError.textContent = error.message;
      button.disabled = false;
      button.textContent = "Save password and continue";
      return;
    }
    passwordSetupPending = false;
    history.replaceState({}, document.title, window.location.pathname);
    button.textContent = "Password saved";
    await establishSession(data.user ? (await client.auth.getSession()).data.session : null);
  });

  forgotPasswordButton.addEventListener("click", async () => {
    const email = document.getElementById("login-email").value.trim().toLowerCase();
    if (!email) {
      loginError.textContent = "Enter your approved email address first.";
      return;
    }
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: config.appUrl });
    loginError.textContent = error ? error.message : "A password reset email has been sent.";
  });

  document.getElementById("sign-out-button").addEventListener("click", async () => {
    if (client) await client.auth.signOut();
  });

  async function sendDocument(payload) {
    const { data, error } = await client.functions.invoke("send-document", { body: payload });
    if (error) throw new Error(error.message || "Email delivery failed.");
    if (!data?.ok) throw new Error(data?.error || "Email delivery failed.");
    return data;
  }

  async function uploadFile(file, recordType, recordId) {
    if (!client || !profile) throw new Error("Sign in before uploading files.");
    if (file.size > 50 * 1024 * 1024) throw new Error("Files must be 50 MB or smaller.");
    const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
    const safeRecord = String(recordId || "general").replace(/[^a-zA-Z0-9._-]+/g, "-");
    const path = `${config.organizationId}/${recordType}/${safeRecord}/${Date.now()}-${safeName}`;
    const uploaded = await client.storage.from("cage-files").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (uploaded.error) throw new Error(uploaded.error.message);
    const logged = await client.from("attachments").insert({
      organization_id: config.organizationId,
      record_type: recordType,
      record_id: String(recordId || ""),
      file_name: file.name,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: profile.id
    });
    if (logged.error) {
      await client.storage.from("cage-files").remove([path]);
      throw new Error(logged.error.message);
    }
    return { path, name: file.name };
  }

  async function openFile(path) {
    const result = await client.storage.from("cage-files").createSignedUrl(path, 60);
    if (result.error || !result.data?.signedUrl) throw new Error(result.error?.message || "The file link could not be created.");
    const link = document.createElement("a");
    link.href = result.data.signedUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  }

  async function loadHR() {
    if (!client || !profile) throw new Error("Sign in first.");
    const [jobs, applications, interviews, employeeProfile, documents] = await Promise.all([
      client.from("job_openings").select("*").eq("organization_id", config.organizationId).order("created_at", { ascending: false }),
      client.from("job_applications").select("*").eq("organization_id", config.organizationId).order("applied_at", { ascending: false }),
      client.from("interviews").select("*").eq("organization_id", config.organizationId).order("scheduled_start"),
      client.from("employee_profiles").select("*").eq("user_id", profile.id).maybeSingle(),
      client.from("employee_documents").select("*").eq("user_id", profile.id).order("created_at", { ascending: false })
    ]);
    const failed = [jobs, applications, interviews, employeeProfile, documents].find(result => result.error);
    if (failed?.error) throw new Error(failed.error.message);
    return { jobs: jobs.data || [], applications: applications.data || [], interviews: interviews.data || [], employeeProfile: employeeProfile.data || null, documents: documents.data || [] };
  }

  async function createJob(payload) {
    const result = await client.from("job_openings").insert({
      organization_id: config.organizationId,
      title: payload.title,
      department: payload.department,
      location: payload.location,
      employment_type: payload.employmentType,
      description: payload.description,
      requirements: payload.requirements,
      closing_date: payload.closingDate,
      status: payload.status,
      hiring_manager: profile.id,
      created_by: profile.id
    }).select().single();
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }

  async function updateApplicationStage(id, stage) {
    const result = await client.from("job_applications").update({ stage, updated_by: profile.id, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }

  async function scheduleInterview(payload) {
    const result = await client.from("interviews").insert({
      organization_id: config.organizationId,
      application_id: payload.applicationId,
      scheduled_start: new Date(payload.start).toISOString(),
      scheduled_end: new Date(payload.end).toISOString(),
      format: payload.format,
      location_or_link: payload.location,
      notes: payload.panel ? `Panel: ${payload.panel}` : null,
      created_by: profile.id
    }).select().single();
    if (result.error) throw new Error(result.error.message);
    await updateApplicationStage(payload.applicationId, "Interview");
    const notification = await client.functions.invoke("notify-interview", { body: { interviewId: result.data.id } });
    return { ...result.data, emailSent: Boolean(notification.data?.emailSent), warning: notification.data?.warning || notification.error?.message || "" };
  }

  async function uploadEmployeeDocument(file, documentType, expiryDate) {
    if (file.size > 10 * 1024 * 1024) throw new Error("Employee documents must be 10 MB or smaller.");
    const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-") || "document";
    const path = `${config.organizationId}/employees/${profile.id}/${Date.now()}-${safeName}`;
    const upload = await client.storage.from("cage-files").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (upload.error) throw new Error(upload.error.message);
    const record = await client.from("employee_documents").insert({ organization_id: config.organizationId, user_id: profile.id, document_type: documentType, file_name: file.name, storage_path: path, expiry_date: expiryDate || null, uploaded_by: profile.id }).select().single();
    if (record.error) { await client.storage.from("cage-files").remove([path]); throw new Error(record.error.message); }
    return record.data;
  }

  async function adminUsers(action, payload = {}) {
    const result = await client.functions.invoke("admin-users", { body: { action, ...payload } });
    if (result.error) throw new Error(result.error.message || "User administration failed.");
    if (!result.data?.ok) throw new Error(result.data?.error || "User administration failed.");
    return result.data;
  }

  async function loadTraining() {
    if (!client || !profile) throw new Error("Sign in first.");
    const [courses, cohorts, learners, staff] = await Promise.all([
      client.from("training_courses").select("*").eq("organization_id", config.organizationId).order("name"),
      client.from("training_cohorts").select("*").eq("organization_id", config.organizationId).order("start_date", { ascending: false }),
      client.from("learners").select("*").eq("organization_id", config.organizationId).order("created_at", { ascending: false }),
      client.from("profiles").select("id, full_name, email, active, assignable").eq("organization_id", config.organizationId).eq("active", true)
    ]);
    const failed = [courses, cohorts, learners, staff].find(result => result.error);
    if (failed?.error) throw new Error(failed.error.message);
    return { courses: courses.data || [], cohorts: cohorts.data || [], learners: learners.data || [], staff: (staff.data || []).filter(item => item.assignable !== false) };
  }

  async function createTrainingCourse(payload) {
    const result = await client.from("training_courses").insert({
      organization_id: config.organizationId, name: payload.name, category: payload.category,
      duration: payload.duration, default_fee: Number(payload.fee || 0), certificate_type: payload.certificate,
      requirements: payload.requirements || null, outcome: payload.outcome, created_by: profile.id
    }).select().single();
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }

  async function createTrainingCohort(payload) {
    const result = await client.from("training_cohorts").insert({
      organization_id: config.organizationId, course_id: payload.courseId, name: payload.name,
      lead_instructor: payload.lead || null, start_date: payload.start, end_date: payload.end,
      venue: payload.venue, capacity: Number(payload.capacity), source_reference: payload.source || null,
      status: "Planned", created_by: profile.id
    }).select().single();
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }

  async function createLearner(payload) {
    const expiryMatch = String(payload.rplNumber || "").match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    const result = await client.from("learners").insert({
      organization_id: config.organizationId, cohort_id: payload.cohortId, full_name: payload.fullName,
      email: payload.email || null, phone: payload.phone, date_of_birth: payload.dob || null,
      sponsor: payload.sponsor || null, guardian_name: payload.guardian || null, rpl_number: payload.rplNumber || null,
      rpl_expiry: expiryMatch?.[1] || null, renewal_due: expiryMatch?.[1] || null,
      stage: payload.documentsComplete ? "Registered" : "Documents pending", fee_status: payload.feeStatus,
      documents_complete: Boolean(payload.documentsComplete), created_by: profile.id
    }).select().single();
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }

  async function updateLearnerStage(id, stage) {
    const result = await client.from("learners").update({ stage, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", config.organizationId).select().single();
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }

  window.CAGE_BACKEND = {
    boot,
    scheduleSave,
    sendDocument,
    uploadFile,
    openFile,
    loadHR,
    createJob,
    updateApplicationStage,
    scheduleInterview,
    uploadEmployeeDocument,
    adminUsers,
    loadTraining,
    createTrainingCourse,
    createTrainingCohort,
    createLearner,
    updateLearnerStage,
    isProduction: configured,
    currentProfile: () => profile,
    currentMemberId: () => profile?.email?.split("@")[0] === "bonfancio" ? "bonifancio" : profile?.email?.split("@")[0] || "alexander"
  };
})();
