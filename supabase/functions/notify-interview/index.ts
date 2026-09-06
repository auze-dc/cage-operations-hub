import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: auth } = await userClient.auth.getUser();
  if (!auth.user) return json({ ok: false, error: "Unauthorized" }, 401);
  const caller = await service.from("profiles").select("role, active, organization_id").eq("id", auth.user.id).single();
  if (!caller.data?.active || !["admin", "manager", "hr"].includes(caller.data.role)) return json({ ok: false, error: "HR access required" }, 403);
  const { interviewId } = await req.json();
  const interview = await service.from("interviews").select("*").eq("id", interviewId).eq("organization_id", caller.data.organization_id).single();
  if (interview.error) return json({ ok: false, error: "Interview not found" }, 404);
  const application = await service.from("job_applications").select("full_name, email, job_opening_id").eq("id", interview.data.application_id).single();
  const job = application.data ? await service.from("job_openings").select("title").eq("id", application.data.job_opening_id).single() : { data: null };
  if (!application.data) return json({ ok: false, error: "Candidate not found" }, 404);
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return json({ ok: true, emailSent: false, warning: "Email is not configured" });
  const start = new Date(interview.data.scheduled_start).toLocaleString("en-MW", { timeZone: "Africa/Blantyre", dateStyle: "full", timeStyle: "short" });
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({
    from: Deno.env.get("EMAIL_FROM") || "CAGE HR <hr@cagemw.com>",
    to: [application.data.email],
    subject: `Interview invitation — ${job.data?.title || "CAGE opportunity"}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:650px;margin:auto"><h2 style="color:#071724">Interview invitation</h2><p>Dear ${esc(application.data.full_name)},</p><p>Thank you for your application for <strong>${esc(job.data?.title || "the CAGE vacancy")}</strong>. We would like to invite you to an interview.</p><p><strong>Date and time:</strong> ${esc(start)}<br><strong>Format:</strong> ${esc(interview.data.format)}<br><strong>Location/link:</strong> ${esc(interview.data.location_or_link)}</p><p>Please reply to confirm your availability.</p><p>Kind regards,<br>CAGE HR</p></div>`
  }) });
  return response.ok ? json({ ok: true, emailSent: true }) : json({ ok: true, emailSent: false, warning: "Interview saved but email delivery failed" });
});
