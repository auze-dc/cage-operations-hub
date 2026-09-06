import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const ROLES = ["admin", "manager", "hr", "finance", "member", "viewer", "shared"];

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const callerClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const adminClient = createClient(url, service);
  const { data: auth } = await callerClient.auth.getUser();
  if (!auth.user) return json({ ok: false, error: "Unauthorized" }, 401);
  const { data: caller } = await adminClient.from("profiles").select("organization_id, email, role, active").eq("id", auth.user.id).single();
  if (!caller?.active || caller.role !== "admin") return json({ ok: false, error: "Administrator access required" }, 403);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "list");
  if (action === "list") {
    const accounts = await adminClient.from("allowed_accounts").select("email, full_name, initials, role, assignable, active, created_at").eq("organization_id", caller.organization_id).order("full_name");
    const profiles = await adminClient.from("profiles").select("id, email, updated_at").eq("organization_id", caller.organization_id);
    if (accounts.error) return json({ ok: false, error: accounts.error.message }, 400);
    const profileByEmail = new Map((profiles.data || []).map(item => [String(item.email).toLowerCase(), item]));
    return json({ ok: true, users: (accounts.data || []).map(account => ({ ...account, userId: profileByEmail.get(String(account.email).toLowerCase())?.id || null, invited: profileByEmail.has(String(account.email).toLowerCase()) })) });
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!email.endsWith("@cagemw.com")) return json({ ok: false, error: "Use a CAGE work email" }, 400);

  if (action === "invite") {
    const fullName = String(body.fullName || "").trim();
    const initials = String(body.initials || "").trim().slice(0, 3).toUpperCase();
    const role = ROLES.includes(body.role) ? body.role : "member";
    if (!fullName || !initials) return json({ ok: false, error: "Name and initials are required" }, 400);
    const allowed = await adminClient.from("allowed_accounts").upsert({ email, organization_id: caller.organization_id, full_name: fullName, initials, role, assignable: role !== "shared", active: true });
    if (allowed.error) return json({ ok: false, error: allowed.error.message }, 400);
    const invited = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo: Deno.env.get("APP_URL") || undefined });
    if (invited.error && !/already.*registered/i.test(invited.error.message)) return json({ ok: false, error: invited.error.message }, 400);
    await adminClient.from("audit_log").insert({ organization_id: caller.organization_id, actor_id: auth.user.id, action: "invite", entity_type: "user_access", entity_id: email, new_data: { email, full_name: fullName, role, active: true } });
    return json({ ok: true });
  }

  if (action === "update") {
    const role = ROLES.includes(body.role) ? body.role : null;
    const active = Boolean(body.active);
    if (!role) return json({ ok: false, error: "Select a valid role" }, 400);
    if (email === String(caller.email).toLowerCase() && (role !== "admin" || !active)) return json({ ok: false, error: "You cannot remove your own administrator access" }, 400);
    const previous = await adminClient.from("allowed_accounts").select("role, active, assignable").eq("organization_id", caller.organization_id).eq("email", email).maybeSingle();
    if (!previous.data) return json({ ok: false, error: "User account not found" }, 404);
    const allowed = await adminClient.from("allowed_accounts").update({ role, assignable: role !== "shared", active }).eq("organization_id", caller.organization_id).eq("email", email);
    if (allowed.error) return json({ ok: false, error: allowed.error.message }, 400);
    const profileUpdate = await adminClient.from("profiles").update({ role, assignable: role !== "shared", active, updated_at: new Date().toISOString() }).eq("organization_id", caller.organization_id).eq("email", email);
    if (profileUpdate.error) return json({ ok: false, error: profileUpdate.error.message }, 400);
    await adminClient.from("audit_log").insert({ organization_id: caller.organization_id, actor_id: auth.user.id, action: "update", entity_type: "user_access", entity_id: email, old_data: previous.data, new_data: { role, active, assignable: role !== "shared" } });
    return json({ ok: true });
  }

  return json({ ok: false, error: "Unknown action" }, 400);
});
