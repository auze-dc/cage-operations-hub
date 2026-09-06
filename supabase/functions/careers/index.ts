import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, apikey", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const allowedTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const organizationId = "00000000-0000-4000-8000-000000000001";

  if (req.method === "GET") {
    const result = await client.from("job_openings").select("id, title, department, location, employment_type, description, requirements, closing_date").eq("organization_id", organizationId).eq("status", "Open").gte("closing_date", new Date().toISOString().slice(0, 10)).order("closing_date");
    return result.error ? json({ ok: false, error: result.error.message }, 500) : json({ ok: true, jobs: result.data });
  }
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const form = await req.formData();
  if (String(form.get("website") || "")) return json({ ok: true, applicationId: crypto.randomUUID() });
  const sourceIp = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sourceIp));
  const ipHash = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
  const limited = await client.rpc("check_application_rate_limit", { p_ip_hash: ipHash });
  if (limited.error || !limited.data) return json({ ok: false, error: "Too many applications. Please try again later." }, 429);
  const jobId = String(form.get("jobId") || "");
  const fullName = String(form.get("fullName") || "").trim().slice(0, 160);
  const email = String(form.get("email") || "").trim().toLowerCase().slice(0, 254);
  const phone = String(form.get("phone") || "").trim().slice(0, 50);
  const location = String(form.get("location") || "").trim().slice(0, 160);
  const coverNote = String(form.get("coverNote") || "").trim().slice(0, 2500);
  const consent = form.get("consent") === "true";
  const cv = form.get("cv");
  if (!jobId || !fullName || !/^\S+@\S+\.\S+$/.test(email) || !phone || !consent || !(cv instanceof File)) return json({ ok: false, error: "Complete all required fields and attach a CV" }, 400);
  if (cv.size > 10 * 1024 * 1024 || !allowedTypes.includes(cv.type)) return json({ ok: false, error: "CV must be PDF, DOC or DOCX and no larger than 10 MB" }, 400);
  const job = await client.from("job_openings").select("id, status, closing_date").eq("id", jobId).eq("organization_id", organizationId).single();
  if (job.error || job.data.status !== "Open" || job.data.closing_date < new Date().toISOString().slice(0, 10)) return json({ ok: false, error: "This vacancy is not accepting applications" }, 400);

  const applicationId = crypto.randomUUID();
  const safeName = cv.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-180) || "cv";
  const storagePath = `${organizationId}/recruitment/${applicationId}/${safeName}`;
  const uploaded = await client.storage.from("cage-files").upload(storagePath, cv, { contentType: cv.type, upsert: false });
  if (uploaded.error) return json({ ok: false, error: "CV upload failed" }, 500);
  const inserted = await client.from("job_applications").insert({ id: applicationId, organization_id: organizationId, job_opening_id: jobId, full_name: fullName, email, phone, location, cover_note: coverNote, cv_file_name: cv.name, cv_storage_path: storagePath, consent_at: new Date().toISOString() });
  if (inserted.error) {
    await client.storage.from("cage-files").remove([storagePath]);
    if (inserted.error.code === "23505") return json({ ok: false, error: "An application using this email already exists for the vacancy" }, 409);
    return json({ ok: false, error: inserted.error.message }, 500);
  }
  return json({ ok: true, applicationId });
});
