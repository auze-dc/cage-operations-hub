import { assertStaffMfa } from "../_shared/staff-mfa.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({error:"Method not allowed"},405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: auth } = await userClient.auth.getUser();
  if (!auth.user) return json({ ok: false, error: "Unauthorized" }, 401);
  const mfaError=await assertStaffMfa(userClient);if(mfaError)return json({ok:false,error:mfaError},403);
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
  const makeToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
  const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, "0")).join("");
  const responseToken=makeToken(),trackingToken=makeToken();
  const prepared=await service.rpc("interview_invitation_prepare", {p_interview:interviewId,p_response_hash:await hash(responseToken),p_tracking_hash:await hash(trackingToken),p_recipient:application.data.email});
  if(prepared.error)return json({ok:false,error:"Interview invitation could not be prepared. Please try again."},400);
  const responseLink=new URL("/interview-response",Deno.env.get("APP_URL")||"https://hub.cagemw.com");responseLink.hash="token="+responseToken;
  const trackingLink=new URL(url+"/functions/v1/interview-response");trackingLink.searchParams.set("action","open");trackingLink.searchParams.set("token",trackingToken);
  const start = new Date(prepared.data.scheduled_start).toLocaleString("en-MW", { timeZone: "Africa/Blantyre", dateStyle: "full", timeStyle: "short" });
  let response;
  try { response = await fetch("https://api.resend.com/emails", { method: "POST", signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": "cage-interview-"+prepared.data.id }, body: JSON.stringify({
    from: Deno.env.get("EMAIL_FROM") || "CAGE HR <hr@cagemw.com>",
    to: [application.data.email],
    subject: `Interview invitation — ${prepared.data.vacancy_title}`,
    text: `Dear ${prepared.data.candidate_name},\nInterview: ${start} (Malawi time)\n${prepared.data.location_or_link}\nPlease accept or decline the proposed time: ${responseLink.href}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:650px;margin:auto"><h2 style="color:#071724">Interview invitation</h2><p>Dear ${esc(prepared.data.candidate_name)},</p><p>Thank you for your application for <strong>${esc(prepared.data.vacancy_title)}</strong>. We would like to invite you to an interview.</p><p><strong>Date and time:</strong> ${esc(start)}<br><strong>Format:</strong> ${esc(prepared.data.format)}<br><strong>Location/link:</strong> ${esc(prepared.data.location_or_link)}</p><p><a href="${esc(responseLink.href)}" style="display:inline-block;background:#007eae;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Accept or decline the interview time</a></p><p>You can include a reason or suggest another time in your response.</p><p>Kind regards,<br>CAGE HR</p><p style="font-size:11px;color:#667085">This invitation may record an approximate email-open signal. Your response is recorded when you submit the response form.</p><img src="${esc(trackingLink.href)}" width="1" height="1" alt="" /></div>`
  }) }); } catch {
    return json({ok:true,emailSent:false,warning:"Email sending could not be confirmed. The interview remains saved."});
  }
  if (!response.ok) {
    await service.rpc("interview_invitation_delivery",{p_id:prepared.data.id,p_status:"failed"});
    return json({ok:true,emailSent:false,warning:"Interview saved but email sending failed."});
  }
  const provider=await response.json().catch(()=>({}));
  let saved=await service.rpc("interview_invitation_delivery",{p_id:prepared.data.id,p_status:"sent",p_provider_id:provider.id||null});
  if(saved.error)saved=await service.rpc("interview_invitation_delivery",{p_id:prepared.data.id,p_status:"sent",p_provider_id:provider.id||null});
  return json({ok:true,emailSent:true,warning:saved.error?"Invitation sent, but response tracking could not be activated. Contact the administrator.":""});
});
