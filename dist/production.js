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
  let cloudBase = {}, syncConflicts = [], savingNow=false;
  const draftKey=()=>"cage-unsynced-"+profile?.id;
  let saveChain = Promise.resolve();
  let realtimeChannel = null;
  let applyingRemote = false;
  let lastAccessRefresh = 0;
  let moduleAccess = {};
  let workspacePoll = null;
  let greetingLanguage = "English";

  const GREETINGS = {
    English: { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" },
    Chichewa: { morning: "Mwadzuka bwanji", afternoon: "Mwaswera bwanji", evening: "Madzulo abwino" },
    Yao: { morning: "Ajimwiche uli", afternoon: "Kusweele", evening: "Subayeedi" },
    Tumbuka: { morning: "Mwawuka uli", afternoon: "Mwatandala uli", evening: "Mwatandala uli" }
  };

  function chooseGreetingLanguage() {
    const previous = localStorage.getItem("cage-last-greeting-language");
    const choices = Object.keys(GREETINGS).filter(language => language !== previous);
    greetingLanguage = choices[Math.floor(Math.random() * choices.length)] || "English";
    localStorage.setItem("cage-last-greeting-language", greetingLanguage);
  }

  function configured() {
    return config.mode === "production" && config.supabaseUrl && config.supabaseAnonKey && config.organizationId;
  }

  function showBanner(message, tone = "") {
    if (tone !== "error" && /^(All changes saved|Saving changes|Workspace updated|Connected to)/.test(message)) return;
    banner.textContent = message;
    banner.className = `sync-banner visible ${tone}`.trim();
  }

  function hideBanner(delay = 1200) {
    window.setTimeout(() => { banner.className = "sync-banner"; }, delay);
  }

  function showLogin(message = "") {
    document.body.classList.remove("session-checking");
    document.body.classList.add("auth-pending");
    gate.hidden = false;
    loginForm.hidden = false;
    passwordSetupForm.hidden = true;
    forgotPasswordButton.hidden = false;
    document.getElementById("auth-title").textContent = "Sign in to Operations Hub";
    loginError.textContent = message;
  }

  function showPasswordSetup(message = "") {
    document.body.classList.remove("session-checking");
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
    document.body.classList.remove("session-checking");
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
    updateDashboardWelcome();
  }

  function updateDashboardWelcome() {
    const now = new Date();
    const date = document.getElementById("today-label");
    const greeting = document.getElementById("dashboard-greeting");
    const hour = now.getHours();
    const period = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    const salutation = GREETINGS[greetingLanguage]?.[period] || GREETINGS.English[period];
    const firstName = profile?.full_name?.trim().split(/\s+/)[0] || "there";
    if (date) {
      date.textContent = new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(now);
    }
    if (greeting) greeting.textContent = `${salutation}, ${firstName}.`;
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
    const settingsNav = document.getElementById("settings-nav-item");
    if (settingsNav) settingsNav.hidden = !isAdmin;
    document.querySelectorAll(".hr-privileged").forEach(element => { element.hidden = !["admin", "manager", "hr"].includes(profile?.role); });
    window.CAGE_PERSONAL?.applyAccess();
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
    const { data, error } = await client.rpc("get_my_workspace");
    if (error) throw error;
    if (!data) {
      if (profile.role !== "admin") throw new Error("The workspace has not been initialized. Ask an administrator to sign in first.");
      const initial = { organization_id: config.organizationId, data: app.seedData, version: 1, updated_by: profile.id };
      const result = await client.from("workspace_states").insert(initial).select("data, version").single();
      if (result.error) throw result.error;
      workspaceVersion = result.data.version;
      cloudBase=structuredClone(result.data.data);
      app.replaceState(result.data.data);
      return;
    }
    workspaceVersion = data.version || 0;
    cloudBase=structuredClone(data.data);
    app.replaceState(data.data);
  }

  function subscribe() {
    if (workspacePoll) clearInterval(workspacePoll);
    workspacePoll = setInterval(async () => {
      if (!profile || document.hidden || pendingState) return;
      try {
        await loadModuleAccess();
        const result = await client.rpc("get_my_workspace");
        if (result.error) throw result.error;
        if (result.data && result.data.version !== workspaceVersion) {
          workspaceVersion = result.data.version;
          applyingRemote = true;
          cloudBase=structuredClone(result.data.data);
          app.replaceState(result.data.data);
          applyingRemote = false;
        }
        applyPermissions();
      } catch (error) { applyingRemote = false; showBanner(error.message || "Connection interrupted", "error"); }
    }, 8000);
  }

  // Chat messages are append-only. Read state is stored in personal_notifications,
  // so legacy changes to an existing message (such as unread=false) must never be
  // sent back through the workspace save function.
  function writableChanges(base, next) {
    return window.CAGE_SYNC.changes(base, next).filter(change =>
      change.key !== "messages" || (change.before === null && change.after !== null)
    );
  }

  function transientSyncError(error) {
    const message=String(error?.message||error||'').toLowerCase();
    return !navigator.onLine || /fetch|network|timeout|timed out|jwt|token|connection|502|503|504/.test(message);
  }
  async function syncRpcWithRetry(patches) {
    let lastError;
    for (let attempt=0; attempt<3; attempt++) {
      try {
        if (!navigator.onLine) throw new Error('You are offline');
        if (attempt) { try { await client.auth.refreshSession(); } catch {} await new Promise(r=>setTimeout(r,350*attempt)); }
        const result=await client.rpc("save_workspace_changes",{changes:patches});
        if(result.error)throw result.error;
        return result.data;
      } catch(error) {
        lastError=error;
        if(!transientSyncError(error)||attempt===2)throw error;
      }
    }
    throw lastError;
  }

  async function flushSave() {
    if(!pendingState||!profile||applyingRemote||savingNow||syncConflicts.length)return;
    const snapshot=structuredClone(pendingState),base=structuredClone(cloudBase),patches=writableChanges(base,snapshot);
    if(!patches.length){pendingState=null;localStorage.removeItem(draftKey());hideBanner(0);app.replaceState(cloudBase);window.dispatchEvent(new CustomEvent("cage:sync",{detail:{pending:false}}));return;}
    savingNow=true;showBanner("Saving changes…");
    try {
      const data=await syncRpcWithRetry(patches);
      if(data?.conflicts?.length){syncConflicts=data.conflicts;window.dispatchEvent(new CustomEvent("cage:conflicts",{detail:{conflicts:syncConflicts,patches}}));showBanner("Your draft is safe. Review the conflicting changes.","error");return;}
      await loadWorkspace();
      const newer=writableChanges(snapshot,pendingState||snapshot);
      pendingState=null;
      if(newer.length){pendingState=window.CAGE_SYNC.apply(cloudBase,newer);app.replaceState(pendingState);localStorage.setItem(draftKey(),JSON.stringify({base:cloudBase,next:pendingState}));}
      else localStorage.removeItem(draftKey());
      hideBanner(0);window.dispatchEvent(new CustomEvent("cage:sync",{detail:{pending:!!pendingState}}));
    } catch(error){showBanner("Not synced: "+error.message+". Your draft is kept on this device.","error");window.dispatchEvent(new CustomEvent("cage:sync",{detail:{pending:true,error:error.message}}));}
    finally {savingNow=false;if(pendingState&&!syncConflicts.length)setTimeout(()=>{if(navigator.onLine)flushSave();},6000);}
  }
  async function resolveSync(choices) {
    for(const c of syncConflicts){const choice=choices.find(x=>x.key===c.key&&x.id===c.id)?.choice;if(!choice)throw new Error("Choose which version to keep for every conflict");cloudBase=window.CAGE_SYNC.apply(cloudBase,[{...c,after:c.current}]);if(choice==='theirs')pendingState=window.CAGE_SYNC.apply(pendingState,[{...c,after:c.current}]);}
    syncConflicts=[];localStorage.setItem(draftKey(),JSON.stringify({base:cloudBase,next:pendingState}));app.replaceState(pendingState);await flushSave();
  }

  function reviewSync() {if(syncConflicts.length)window.dispatchEvent(new CustomEvent("cage:conflicts",{detail:{conflicts:syncConflicts,patches:writableChanges(cloudBase,pendingState)}}));return writableChanges(cloudBase,pendingState||cloudBase);}
  async function discardDraftRecord(key,id) {pendingState=window.CAGE_SYNC.apply(pendingState,[{key,id,after:id===null?cloudBase[key]:cloudBase[key]?.find(r=>r.id===id)||null}]);syncConflicts=syncConflicts.filter(c=>c.key!==key||c.id!==id);localStorage.setItem(draftKey(),JSON.stringify({base:cloudBase,next:pendingState}));app.replaceState(pendingState);await flushSave();}
  async function restoreDraft() {
    const saved=JSON.parse(localStorage.getItem(draftKey())||"null");if(!saved)return;
    const patches=writableChanges(saved.base,saved.next);
    if(!patches.length){localStorage.removeItem(draftKey());pendingState=null;app.replaceState(cloudBase);window.dispatchEvent(new CustomEvent("cage:sync",{detail:{pending:false}}));return;}
    pendingState=window.CAGE_SYNC.apply(cloudBase,patches);cloudBase=window.CAGE_SYNC.apply(cloudBase,patches.map(c=>({...c,after:c.before})));app.replaceState(pendingState);await flushSave();
  }
  window.addEventListener("online",()=>flushSave());

  function scheduleSave(nextState) {
    if (!configured() || !profile || applyingRemote) return;
    pendingState = JSON.parse(JSON.stringify(nextState));
    localStorage.setItem(draftKey(),JSON.stringify({base:cloudBase,next:pendingState}));
    window.dispatchEvent(new CustomEvent("cage:sync",{detail:{pending:true}}));
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
      await loadModuleAccess();
      await loadWorkspace();
      chooseGreetingLanguage();
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

  async function refreshAccess() {
    if (!client || !profile || Date.now() - lastAccessRefresh < 3000) return;
    lastAccessRefresh = Date.now();
    try {
      profile = await loadProfile(profile.id);
      await loadModuleAccess();
      if(!pendingState) await loadWorkspace();
      setCurrentUser();
      app?.renderAll?.();
      applyPermissions();
    } catch (error) {
      await client.auth.signOut();
      showLogin(error.message || "Your access has changed. Sign in again.");
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
    localStorage.removeItem("cage-operations-hub-production-cache-v1");
    if (client) await client.auth.signOut();
  });

  async function sendDocument(payload) {
    if(moduleLevel("finance")!=="edit") throw new Error("Finance edit access is required.");
    clearTimeout(saveTimer);
    await saveChain;
    if(pendingState) await flushSave();
    if(pendingState) throw new Error("Wait for cloud sync before sending this document.");
    const prepared=await client.rpc("prepare_document_delivery",{doc_type:payload.type,doc_record:payload.record});
    if(prepared.error) throw prepared.error;
    workspaceVersion=prepared.data.version;
    await loadWorkspace();
    payload={...payload,record:prepared.data.record};
    const attemptKey=`cage-send-attempt:${profile.id}:${payload.type}:${payload.record.id}`;
    const fingerprint=JSON.stringify([payload.type,payload.record,payload.recipient,payload.subject,payload.message]);
    let attempt;try{attempt=JSON.parse(localStorage.getItem(attemptKey)||'null');}catch{}
    if(!attempt||attempt.fingerprint!==fingerprint)attempt={id:crypto.randomUUID(),fingerprint};
    localStorage.setItem(attemptKey,JSON.stringify(attempt));
    const { data, error } = await client.functions.invoke("send-document", { body: {...payload,deliveryAttempt:attempt.id} });
    if (error) {
      let message=error.message || "Email delivery failed.";
      try { const response=await error.context?.json(); message=response?.error || message; } catch {}
      throw new Error(message);
    }
    if (!data?.ok) throw new Error(data?.error || "Email delivery failed.");
    localStorage.removeItem(attemptKey);
    return data;
  }

  async function opportunityData(){
    const rows=[];for(let offset=0;;offset+=1000){
      const r=await client.from('opportunity_matches').select('*').eq('organization_id',profile.organization_id).order('found_at',{ascending:false}).order('id').range(offset,offset+999);
      if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<1000)break;
    }return rows;
  }
  async function admissionReminderHistory(id){const r=await client.from('academy_payment_reminders').select('kind,status,due_on,sent_at,created_at,error').eq('organization_id',profile.organization_id).eq('application_id',id).order('created_at',{ascending:false}).limit(5);if(r.error)throw r.error;return r.data;}
  async function admissionBalance(id){const r=await client.rpc('academy_payment_summary',{app:id});if(r.error)throw r.error;return r.data;}
  async function admissionReminder(id,due,note,requestKey){const r=await client.rpc('queue_academy_payment_reminder',{app:id,due_on:due,note,request_key:requestKey});if(r.error)throw r.error;return r.data;}
  async function scanOpportunities() {
    if (!client || !profile) throw new Error("Sign in before running an opportunity scan.");
    if (!['admin', 'manager'].includes(profile.role)) throw new Error("Only an Administrator or Manager can run a live scan.");
    const { data, error } = await client.functions.invoke("opportunity-scan", { body: { organizationId: config.organizationId, manual: true } });
    if (error) throw new Error(error.message || "Live opportunity search failed.");
    if (!data?.ok) throw new Error(data?.error || "Live opportunity search failed.");
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
    if (result.error) {
      let message = result.error.message || "User administration failed.";
      try {
        const details = await result.error.context?.json?.();
        if (details?.error) message = details.error;
      } catch { /* Keep the transport error when no JSON response is available. */ }
      throw new Error(message);
    }
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

  window.addEventListener("focus", refreshAccess);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshAccess();
  });

  async function loadModuleAccess() {
    const result = await client.from("module_access").select("module,access").eq("user_id",profile.id);
    if(result.error) throw new Error("Install the Hub 14 database update before using this version. " + result.error.message);
    const previous = JSON.stringify(moduleAccess);
    moduleAccess = Object.fromEntries((result.data||[]).map(row=>[row.module,row.access]));
    if(previous !== JSON.stringify(moduleAccess)) workspaceVersion = -1;
  }
  function moduleLevel(module) {
    if (!profile) return "none";
    if(profile.role === "admin") return "edit";
    if(["admin","settings"].includes(module)) return "none";
    if(profile.role === "viewer") return moduleAccess[module] === "none" ? "none" : "view";
    if(moduleAccess[module]) return moduleAccess[module];
    if(module === "approvals") return profile.role === "manager" ? "edit" : "none";
    if(module === "hr") return ["manager","hr"].includes(profile.role) ? "edit" : "view";
    return profile.role === "viewer" ? "view" : "edit";
  }
  async function plannerData(userId = profile.id) {
    const results=await Promise.all([
      client.from("task_plans").select("*").eq("user_id",userId),
      client.from("planner_preferences").select("daily_minutes").eq("user_id",userId).maybeSingle(),
      client.from("profiles").select("id,full_name,email,role").eq("organization_id",config.organizationId).eq("active",true)
    ]);
    for(const r of results) if(r.error) throw r.error;
    return {plans:results[0].data,capacity:results[1].data?.daily_minutes||480,users:results[2].data};
  }
  async function saveTaskPlan(plan) {
    const allowed=Object.fromEntries(Object.entries(plan).filter(([k])=>["task_id","bucket","plan_date","estimate_minutes","start_at","end_at","time_zone"].includes(k)));
    const r=await client.from("task_plans").upsert({...allowed,user_id:profile.id},{onConflict:"user_id,task_id"});
    if(r.error)throw r.error;
  }
  async function savePlanningCapacity(minutes) {
    const r=await client.from("planner_preferences").upsert({user_id:profile.id,daily_minutes:minutes});if(r.error)throw r.error;
  }
  async function updatePlannedTask(payload) {
    clearTimeout(saveTimer);await saveChain;if(pendingState)await flushSave();
    if(pendingState)throw new Error("Wait for cloud sync before updating this task.");
    const r=await client.rpc("update_planned_task",payload);if(r.error)throw r.error;
    await loadWorkspace();
  }
  async function personalData() {
    const results=await Promise.all([
      client.from("personal_reminders").select("*").order("due_at"),
      client.from("personal_notifications").select("*").order("created_at",{ascending:false}).limit(150)
    ]);
    for(const r of results) if(r.error) throw r.error;
    return {reminders:results[0].data,notifications:results[1].data};
  }
  async function saveReminder(data,id) {
    const allowed = Object.fromEntries(Object.entries(data).filter(([k])=>["title","due_at","lead_minutes","completed_at","target_view","target_id"].includes(k)));
    if(allowed.due_at) { allowed.before_sent=false; allowed.last_nudged_at=null; }
    const r=id ? await client.from("personal_reminders").update(allowed).eq("id",id).eq("user_id",profile.id) : await client.from("personal_reminders").insert({...allowed,user_id:profile.id});
    if(r.error) throw r.error;
  }
  async function readNotification(id) {
    let q=client.from("personal_notifications").update({read_at:new Date().toISOString()}).eq("user_id",profile.id);
    if(id) q=q.eq("id",id); else q=q.is("read_at",null);
    const r=await q; if(r.error) throw r.error;
  }
  async function accessAccounts() {
    if(profile.role!=="admin") throw new Error("Administrator access required.");
    const result=await client.from("profiles").select("id,full_name,email,role").eq("organization_id",config.organizationId).eq("active",true);
    if(result.error) throw result.error;
    const rules=await client.from("module_access").select("*"); if(rules.error) throw rules.error;
    return {users:result.data,rules:rules.data};
  }
  async function saveModuleAccess(userId, rules) {
    if(profile.role!=="admin") throw new Error("Administrator access required.");
    const result=await client.from("module_access").upsert(Object.entries(rules).map(([module,access])=>({user_id:userId,module,access})),{onConflict:"user_id,module"});
    if(result.error) throw result.error;
  }
  async function fileUrl(path) {
    const r=await client.storage.from("cage-files").createSignedUrl(path,3600);
    if(r.error) throw r.error; return r.data.signedUrl;
  }

  async function emailPreferences() {
    const result=await client.from("staff_email_preferences").select("*").eq("user_id",profile.id).maybeSingle();
    if(result.error)throw result.error;return result.data;
  }
  async function saveEmailPreferences(values) {
    const result=await client.from("staff_email_preferences").upsert({...values,user_id:profile.id});if(result.error)throw result.error;
  }
  async function emailRouting() {
    if(profile.role!=="admin")throw new Error("Administrator access required");
    const results=await Promise.all([client.from("staff_email_routing").select("*").eq("organization_id",profile.organization_id).maybeSingle(),client.from("profiles").select("id,full_name,role").eq("organization_id",profile.organization_id).eq("active",true),client.from("staff_email_outbox").select("id,user_id,subject,status,created_at,error").order("created_at",{ascending:false}).limit(30)]);
    for(const r of results)if(r.error)throw r.error;return {routing:results[0].data||{},users:results[1].data,history:results[2].data};
  }
  async function saveEmailRouting(values) {
    if(profile.role!=="admin")throw new Error("Administrator access required");
    const r=await client.from("staff_email_routing").upsert({...values,organization_id:profile.organization_id});if(r.error)throw r.error;
  }
  async function readChatNotifications(thread) {
    const r=await client.from("personal_notifications").update({read_at:new Date().toISOString()}).eq("user_id",profile.id).eq("target_view","chat").eq("target_id",thread).is("read_at",null);if(r.error)throw r.error;
  }
  async function requestTaskHelp(taskId) {
    const r=await client.rpc("request_task_help",{task_key:taskId});if(r.error)throw r.error;await loadWorkspace();
  }


  async function opsData(table,filters={}) {
    const allowed=['staff_work_settings','record_access','equipment_reservations','invoice_payments','daily_priorities','equipment_kits','training_sessions','learner_attendance','training_assessments','cohort_messages'];
    if(!allowed.includes(table))throw new Error('Unknown work data');let q=client.from(table).select('*');for(const [k,v] of Object.entries(filters))q=q.eq(k,v);const r=await q;if(r.error)throw r.error;return r.data;
  }
  async function opsSave(table,values,conflict) {
    const scoped=['equipment_kits','training_sessions','training_assessments','cohort_messages'];
    if(![...scoped,'staff_work_settings','record_access','daily_priorities','learner_attendance'].includes(table))throw new Error('Unknown work data');
    if(scoped.includes(table))values={...values,organization_id:profile.organization_id};
    if(table==='training_sessions'||table==='training_assessments')values={...values,created_by:profile.id};
    if(table==='cohort_messages')values={...values,sender_id:profile.id};
    if(table==='learner_attendance')values={...values,recorded_by:profile.id};
    if(table==='daily_priorities')values={...values,user_id:profile.id};
    const r=await client.from(table).upsert(values,table==='cohort_messages'?{onConflict:'id',ignoreDuplicates:true}:conflict?{onConflict:conflict}:undefined).select();if(r.error)throw r.error;return r.data;
  }
  async function opsRpc(name,args) {
    if(!['reserve_equipment','cancel_reservation','record_payment','equipment_busy'].includes(name))throw new Error('Unknown action');
    if(name==='equipment_busy'){const r=await client.rpc(name,args);if(r.error)throw r.error;return r.data;}
    await flushSave();if(pendingState)throw new Error('Sync your draft before continuing');const r=await client.rpc(name,args);if(r.error)throw r.error;await loadWorkspace();return r.data;
  }
  async function sendCohort(payload) {const r=await client.functions.invoke('send-cohort-message',{body:payload});if(r.error)throw r.error;if(!r.data?.ok)throw new Error(r.data?.error||'Email failed');return r.data;}
  async function academyData() {
    if (!client || !profile) throw new Error("Sign in first.");
    const base = await loadTraining();
    const names = {sessions:'training_sessions', attendance:'learner_attendance', assessments:'training_assessments', certificates:'training_certificates', practical:'training_practical_logs', documents:'training_documents', materials:'training_materials'};
    const entries = await Promise.all(Object.entries(names).map(async ([key,table]) => {
      const r = await client.from(table).select('*');
      if (r.error) throw new Error('Academy could not load. Confirm migration 014 is installed. ' + r.error.message);
      return [key,r.data || []];
    }));
    let payments=[];
    if(moduleLevel('finance')!=='none') payments=await opsData('invoice_payments');
    let applicationBalances=[],applicationBalancesUnavailable=false;
    if(['admin','manager'].includes(profile.role)&&moduleLevel('training')==='edit'){
      try{const admissions=await admissionData();applicationBalances=admissions.applications.filter(a=>a.learner_id).map(a=>{const paid=admissions.files.filter(f=>f.application_id===a.id&&f.kind==='payment'&&f.review_status==='Verified').reduce((n,f)=>n+Number(f.amount||0),0);return {application_id:a.id,learner_id:a.learner_id,balance:Math.max(Number(a.form_snapshot.fee||0)-paid,0),currency:a.form_snapshot.currency,due_on:a.balance_due_on};});}
      catch{applicationBalancesUnavailable=true;}
    }
    return {...base,...Object.fromEntries(entries),payments,applicationBalances,applicationBalancesUnavailable};
  }
  async function academySave(table, values, id) {
    const fields = {
      training_courses:['name','category','duration','default_fee','certificate_type','requirements','outcome','active','modules','minimum_attendance','practical_minutes','required_assessments'],
      training_cohorts:['name','lead_instructor','start_date','end_date','venue','capacity','status','source_reference','project_id'],
      learners:['full_name','email','phone','date_of_birth','sponsor','guardian_name','guardian_phone','guardian_consent','collection_contacts','documents_complete','invoice_id','external_licence_status','rpl_number','rpl_expiry','renewal_due','notes','alumni_consent','skills'],
      training_sessions:['cohort_id','title','starts_at','ends_at','instructor_id','venue','session_type','cancelled'],
      training_practical_logs:['learner_id','performed_on','aircraft','exercise','minutes','notes','signed_off_by'],
      training_documents:['learner_id','title','file_path'],
      training_materials:['cohort_id','title','description','resource_url']
    };
    if (!fields[table] || !profile) throw new Error('Unknown Academy action');
    if(id && ['training_practical_logs','training_documents'].includes(table)) throw new Error('Training evidence is append-only.');
    const clean=Object.fromEntries(Object.entries(values).filter(([key])=>fields[table].includes(key)));
    let q;
    if(id) q=client.from(table).update(clean).eq('id',id).eq('organization_id',profile.organization_id);
    else q=client.from(table).insert({...clean,organization_id:profile.organization_id,created_by:profile.id});
    const result=await q.select().single();if(result.error)throw new Error(result.error.message);return result.data;
  }
  async function academyCompletion(id,issue=false) {
    const r=await client.rpc(issue?'issue_academy_certificate':'academy_completion',{learner_key:id});
    if(r.error)throw new Error(r.error.message);return r.data;
  }
  async function academyAttendance(rows) {
    const result=await client.from('learner_attendance').upsert(rows.map(r=>({...r,recorded_by:profile.id,recorded_at:new Date().toISOString()})),{onConflict:'session_id,learner_id'});
    if(result.error)throw new Error(result.error.message);
  }
  async function chatReceipts(threadId) {
    let rows=[];for(let offset=0;;offset+=1000){const r=await client.from('chat_receipts').select('*').eq('thread_id',threadId).range(offset,offset+999);if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<1000)break;}return rows;
  }
  async function acknowledgeChat(keys,read=false) {
    for(let i=0;i<keys.length;i+=500){const r=await client.rpc('acknowledge_chat_messages',{message_keys:keys.slice(i,i+500),mark_read:read});if(r.error)throw r.error;}
  }
  async function appNotificationPreferences(values) {
    const q=values?client.from('app_notification_preferences').upsert({...values,user_id:profile.id,updated_at:new Date().toISOString()}).select().single():client.from('app_notification_preferences').select('*').eq('user_id',profile.id).maybeSingle();
    const r=await q;if(r.error)throw r.error;return r.data;
  }
  const applicationColumns='id,organization_id,intake_id,full_name,email,phone,answers,form_snapshot,category,identity_type,status,staff_notes,submitted_at,reviewed_by,updated_at,learner_id,cohort_id,balance_due_on,balance_plan_version';
  async function admissionData(){
    const read=async(table,columns='*')=>{let out=[];for(let offset=0;;offset+=1000){const r=await client.from(table).select(columns).eq('organization_id',profile.organization_id).range(offset,offset+999);if(r.error)throw r.error;out.push(...r.data);if(r.data.length<1000)return out;}};
    const [intakes,applications,files,emailResult]=await Promise.all([
      read('academy_intakes'),read('academy_applications',applicationColumns),read('academy_application_files'),
      read('enrollment_email_outbox','id,source,application_id,status,sent_at').then(emails=>({emails})).catch(()=>({emails:[],emailStatusUnavailable:true}))
    ]);return {intakes,applications,files,...emailResult};
  }
  async function admissionSave(values,id,revision){
    const keys=['category','title','description','published','accepting','closes_on','start_date','fee','currency','payment_instructions','venue','fields','schedule','schedule_notes'];
    const clean=Object.fromEntries(Object.entries(values).filter(([key])=>keys.includes(key)));
    const q=id?client.from('academy_intakes').update(clean).eq('id',id).eq('revision',revision).eq('organization_id',profile.organization_id):client.from('academy_intakes').insert({...clean,organization_id:profile.organization_id,created_by:profile.id});
    const r=await q.select().maybeSingle();if(r.error)throw r.error;if(!r.data)throw new Error('This call was changed by another staff member. Refresh before saving. Your editing form is still open.');return r.data;
  }
  async function admissionReview(id,status,note){const r=await client.rpc('review_academy_application',{app:id,new_status:status,note});if(r.error)throw r.error;}
  async function admissionPayment(id,status,note){const r=await client.rpc('review_academy_payment',{file_key:id,new_status:status,note});if(r.error)throw r.error;}
  // Enrollment queues the welcome email in the same database transaction.
  // Reading delivery status must never cause a second send.
  async function admissionEmailStatus(id){
    const r=await client.from('enrollment_email_outbox').select('status,sent_at')
      .eq('organization_id',profile.organization_id).eq('source','academy_applications')
      .eq('application_id',id).maybeSingle();
    if(r.error)throw r.error;
    return r.data||{status:'not_queued'};
  }
  async function admissionEnrol(id,cohort,details){
    const r=await client.rpc('enrol_academy_application',{app:id,cohort_key:cohort,details});
    if(r.error)throw r.error;
    const result={learnerId:r.data,emailWarning:'Welcome email now uses the delivery queue. Refresh the Hub to check its status.'};
    try{return {...result,emailStatus:(await admissionEmailStatus(id)).status};}
    catch{return {...result,emailStatus:'unavailable'};}
  }
  // Cached older screens must not claim that a read-only status check sent mail.
  async function admissionEnrolmentEmail(){throw new Error('Welcome emails now use the delivery queue. Refresh the Hub and choose Check email status.');}
  async function admissionFile(id){const body=new FormData();body.set('file',id);const r=await client.functions.invoke('academy-admissions?action=staff-file',{body});if(r.error)throw r.error;if(r.data.error)throw new Error(r.data.error);return r.data.url;}
  async function stemData() {
    const c=await client.from('stem_connections').select('*').eq('organization_id',profile.organization_id).maybeSingle();if(c.error)throw c.error;
    let rows=[];for(let offset=0;;offset+=1000){const r=await client.from('stem_applications').select('*').eq('organization_id',profile.organization_id).order('submitted_at',{ascending:false}).range(offset,offset+999);if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<1000)break;}return {connection:c.data,applications:rows};
  }
  async function reviewStem(id,values) {
    const r=await client.from('stem_applications').update({status:values.status,notes:values.notes,reviewed_by:profile.id,updated_at:new Date().toISOString()}).eq('id',id).select().single();if(r.error)throw r.error;return r.data;
  }
  async function enrolStem(application,cohort,details) {const r=await client.rpc('enrol_stem_application',{application_key:application,cohort_key:cohort,details});if(r.error)throw r.error;return r.data;}
  window.CAGE_BACKEND = {
    admissionData,admissionSave,admissionReview,admissionPayment,admissionFile,admissionEnrol,admissionEmailStatus,admissionEnrolmentEmail,
    enrolStem,
    chatReceipts,acknowledgeChat,appNotificationPreferences,stemData,reviewStem,
    academyAttendance,
    academyData, academySave, academyCompletion,
    opsData,opsSave,opsRpc,sendCohort,
    resolveSync, restoreDraft, flushSave, reviewSync, discardDraftRecord, syncState:()=>({pending:!!pendingState,conflicts:syncConflicts.length}),
    emailPreferences, saveEmailPreferences, emailRouting, saveEmailRouting, readChatNotifications, requestTaskHelp,
    plannerData, saveTaskPlan, savePlanningCapacity, updatePlannedTask,
    moduleLevel, personalData, saveReminder, readNotification, accessAccounts, saveModuleAccess, fileUrl,
    boot,
    scheduleSave,
    sendDocument,
    scanOpportunities, opportunityData, admissionBalance, admissionReminder, admissionReminderHistory,
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
    applyPermissions,
    canApprove: () => ["admin", "manager"].includes(profile?.role),
    isProduction: configured,
    currentProfile: () => profile,
    currentMemberId: () => profile?.email?.split("@")[0] === "bonfancio" ? "bonifancio" : profile?.email?.split("@")[0] || "alexander"
  };
})();
