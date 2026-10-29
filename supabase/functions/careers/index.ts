import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, apikey", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const allowedTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const organizationId = "00000000-0000-4000-8000-000000000001";

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Blantyre", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
  if (req.method === "GET") {
    const result = await client.from("job_openings").select("id, title, department, location, employment_type, description, requirements, closing_date, responsibilities, desirable_skills, benefits, work_arrangement, duration, positions, compensation, cover_note_required, screening_questions").eq("organization_id", organizationId).eq("status", "Open").gte("closing_date", today).order("closing_date");
    return result.error ? json({ ok: false, error: result.error.message }, 500) : json({ ok: true, jobs: result.data });
  }
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  let form: FormData;
  try { form = await req.formData(); } catch { return json({ok:false,error:"Invalid application form"},400); }
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
  const salaryText = String(form.get("salaryExpectation") ?? "").trim();
  const salaryExpectation = Number(salaryText);
  const salaryCurrency = String(form.get("salaryCurrency") || "");
  const salaryPeriod = String(form.get("salaryPeriod") || "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(salaryText) || !Number.isFinite(salaryExpectation) || salaryExpectation < 0 || salaryExpectation > 999999999999 || !["MWK","USD","GBP","EUR","ZAR"].includes(salaryCurrency) || !["month","year","day","hour"].includes(salaryPeriod)) return json({ok:false,error:"Enter your expected gross salary, currency and pay period. Refresh this page if the salary fields are missing."},400);
  const cv = form.get("cv");
  if (!jobId || !fullName || !/^\S+@\S+\.\S+$/.test(email) || !phone || !consent || !(cv instanceof File)) return json({ ok: false, error: "Complete all required fields and attach a CV" }, 400);
  if (cv.size === 0 || cv.size > 10 * 1024 * 1024 || !allowedTypes.includes(cv.type)) return json({ ok: false, error: "CV must be PDF, DOC or DOCX and no larger than 10 MB" }, 400);
  const job = await client.from("job_openings").select("id, status, closing_date, cover_note_required, screening_questions").eq("id", jobId).eq("organization_id", organizationId).single();
  if (job.error || job.data.status !== "Open" || job.data.closing_date < today) return json({ ok: false, error: "This vacancy is not accepting applications" }, 400);

  if (job.data.cover_note_required && !coverNote) return json({ok:false,error:"A cover note is required for this vacancy"},400);
  let answers: unknown;
  try { answers = JSON.parse(String(form.get("screeningAnswers") || "[]")); } catch { return json({ok:false,error:"Invalid screening answers"},400); }
  const questions: string[] = job.data.screening_questions || [];
  if (!Array.isArray(answers) || answers.length !== questions.length || answers.some(x=>typeof x!=="string" || !x.trim() || x.length>2000)) return json({ok:false,error:"Answer all screening questions. If the vacancy has changed, refresh and review it again."},400);
  const screeningAnswers = questions.map((question,i)=>({question,answer:(answers as string[])[i].trim()}));
  const applicationId = crypto.randomUUID();
  const safeName = cv.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-180) || "cv";
  const storagePath = `${organizationId}/recruitment/${applicationId}/${safeName}`;
  const uploaded = await client.storage.from("cage-files").upload(storagePath, cv, { contentType: cv.type, upsert: false });
  if (uploaded.error) return json({ ok: false, error: "CV upload failed" }, 500);
  const inserted = await client.from("job_applications").insert({ id: applicationId, organization_id: organizationId, job_opening_id: jobId, full_name: fullName, email, phone, location, cover_note: coverNote, cv_file_name: cv.name, cv_storage_path: storagePath, salary_expectation: salaryExpectation, salary_currency: salaryCurrency, salary_period: salaryPeriod, screening_answers: screeningAnswers, consent_at: new Date().toISOString() });
  if (inserted.error) {
    await client.storage.from("cage-files").remove([storagePath]);
    if (inserted.error.code === "23505") return json({ ok: false, error: "An application using this email already exists for the vacancy" }, 409);
    return json({ ok: false, error: "Application could not be saved. Please try again." }, 500);
  }
  return json({ ok: true, applicationId });
});
