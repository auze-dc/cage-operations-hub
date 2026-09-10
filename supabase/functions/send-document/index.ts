import * as PDFLib from "npm:pdf-lib@1.17.1";
import "../_shared/document-pdf.js";
import { logoBase64 } from "../_shared/logo.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});
const esc = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const money = (amount: unknown) => new Intl.NumberFormat("en-MW", {
  style: "currency", currency: "MWK", maximumFractionDigits: 0,
}).format(Number(amount) || 0);

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return json({ ok: false, error: "Unauthorized" }, 401);

  const { data: profile } = await adminClient.from("profiles")
    .select("organization_id, active").eq("id", auth.user.id).single();
  if (!profile?.active) return json({ ok: false, error: "Account is not active" }, 403);

  const payload = await req.json().catch(()=>({}));
  const { type, recipient, subject, message } = payload;
  const access = await userClient.rpc("module_level",{m:"finance"});
  if(access.error || access.data !== "edit") return json({ok:false,error:"Finance edit access is required"},403);
  const visible=await userClient.rpc("can_work_record",{k:type==="quote"?"quotes":"invoices",rid:payload.record?.id||""});
  if(visible.error||!visible.data)return json({ok:false,error:"Document is outside your access"},403);
  const workspace = await adminClient.from("workspace_states").select("data").eq("organization_id",profile.organization_id).single();
  const records = workspace.data?.data?.[type === "quote" ? "quotes" : "invoices"] || [];
  const record = records.find((item: {id:string})=>item.id === payload.record?.id);
  if(type === "quote" && !["Approved","Sent","Accepted"].includes(record?.status)) return json({ok:false,error:"Quotation must be approved"},403);
  if (!["quote", "invoice"].includes(type) || !record?.id || !record?.number || !recipient || !subject) {
    return json({ ok: false, error: "Required document fields are missing" }, 400);
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM") || "CAGE Operations <operations@cagemw.com>";
  if (!resendKey) return json({ ok: false, error: "Email delivery has not been configured" }, 503);

  const sendingAt=new Date();
  const stampDate=(globalThis as any).CagePDF.stampDateAt(sendingAt);
  let pdfBytes: Uint8Array;
  try {
    pdfBytes=await (globalThis as any).CagePDF.createDocumentPDF(PDFLib,record,type,Uint8Array.from(atob(logoBase64),c=>c.charCodeAt(0)),sendingAt);
  } catch(error) { return json({ok:false,error:"The PDF could not be generated: "+String(error)},400); }
  let binary=""; for(const byte of pdfBytes) binary+=String.fromCharCode(byte);
  const filename=String(record.number).replace(/[^a-zA-Z0-9_-]/g,"-")+".pdf";
  const title = type === "quote" ? "Quotation" : "Invoice";
  const html = `<!doctype html><html><body style="margin:0;background:#f2f6f8;font-family:Arial,sans-serif;color:#102b3a">
    <div style="max-width:680px;margin:32px auto;background:white;border-radius:14px;overflow:hidden;border:1px solid #dce8ee">
      <div style="background:#071724;padding:24px 30px;color:white"><strong style="font-size:22px">CAGE</strong><span style="float:right;color:#6dd7ff">${esc(title)}</span></div>
      <div style="padding:30px"><p style="white-space:pre-line;line-height:1.6">${esc(message)}</p>
        <div style="margin:24px 0;padding:22px;background:#f4f9fb;border-left:4px solid #00adef">
          <div style="font-size:13px;color:#647985">${esc(title)} number</div><strong style="font-size:21px">${esc(record.number)}</strong>
          <p style="margin:16px 0 6px">${esc(record.description)}</p>
          <strong style="font-size:24px;color:#007cab">${esc(record.currency||"MWK")} ${Number(record.amount).toLocaleString("en-GB",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong>
          ${record.due ? `<p style="color:#647985">Due: ${esc(record.due)}</p>` : ""}
          ${record.validUntil ? `<p style="color:#647985">Valid until: ${esc(record.validUntil)}</p>` : ""}
        </div>
        <p style="font-size:13px;color:#71818b">This message was sent from the secure CAGE Operations Hub.</p>
      </div>
    </div></body></html>`;

  let response: Response;
  try { response = await fetch("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json",
      "Idempotency-Key": Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify([record.id,record.sentAt||"first",recipient,subject,message,record.amount,stampDate]))))).map(b=>b.toString(16).padStart(2,"0")).join("")
    },
    body: JSON.stringify({ from, to: [recipient], subject, html, attachments:[{filename,content:btoa(binary)}] }),
  });
  } catch(error) {
    await adminClient.from("email_log").insert({organization_id:profile.organization_id,sender_id:auth.user.id,document_type:type,document_id:record.id,recipient,subject,status:"failed",error_message:String(error)});
    return json({ok:false,error:"Delivery could not be confirmed. Review the document before retrying."},502);
  }
  const result = await response.json().catch(()=>({message:"Unexpected email provider response"}));
  await adminClient.from("email_log").insert({
    organization_id: profile.organization_id,
    sender_id: auth.user.id,
    document_type: type,
    document_id: record.id,
    recipient,
    subject,
    provider_message_id: result.id || null,
    status: response.ok ? "sent" : "failed",
    error_message: response.ok ? null : JSON.stringify(result),
  });
  if (!response.ok) return json({ ok: false, error: result.message || "Email provider rejected the message" }, 502);
  return json({ ok: true, messageId: result.id });
});
