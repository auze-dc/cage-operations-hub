import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const CAGE_TERMS = ["drone", "uav", "uas", "geospatial", "gis", "mapping", "survey", "remote sensing", "agriculture", "disaster", "climate", "utility", "inspection", "training", "malawi", "africa", "women", "stem", "digital twin", "aerial", "lidar", "thermal"];
const DEFAULT_SEARCH_FEEDS = [
  "https://news.google.com/rss/search?q=%28RFP%20OR%20tender%20OR%20grant%29%20%28drone%20OR%20geospatial%20OR%20GIS%29%20Africa&hl=en&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=%28call%20for%20proposals%20OR%20funding%29%20%28climate%20mapping%20OR%20earth%20observation%29%20Africa&hl=en&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=%28procurement%20OR%20RFQ%29%20%28GIS%20OR%20survey%20OR%20drone%29%20Malawi&hl=en&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=site%3Aungm.org%20%28GIS%20OR%20mapping%20OR%20drone%29&hl=en&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=%28LinkedIn%20OR%20Facebook%29%20%28RFP%20OR%20grant%29%20%28geospatial%20OR%20drone%29%20Africa&hl=en&gl=US&ceid=US:en",
];
const esc = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const textOf = (block: string, tag: string) => {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return (match?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
};
const linkOf = (block: string) => textOf(block, "link") || block.match(/<link[^>]+href=["']([^"']+)/i)?.[1] || "";
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(b => b.toString(16).padStart(2, "0")).join("");

function deadlineIsOpen(deadline: string) {
  if (!deadline || deadline.toLowerCase() === "rolling") return true;
  const value = new Date(`${deadline}T23:59:59Z`).getTime();
  return Number.isFinite(value) && value > Date.now() + 48 * 60 * 60 * 1000;
}

function nextWeekdayAtSevenCAT() {
  const next = new Date();
  next.setUTCHours(5, 0, 0, 0);
  if (next.getTime() <= Date.now()) next.setUTCDate(next.getUTCDate() + 1);
  while ([0, 6].includes(next.getUTCDay())) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

function extractDeadline(value: string) {
  const text = value.replace(/(st|nd|rd|th)/gi, "");
  const patterns = [
    /(?:deadline|closes?|due|submit(?:ted)? by)\D{0,28}([A-Z][a-z]+\s+\d{1,2},?\s+20\d{2})/i,
    /(?:deadline|closes?|due|submit(?:ted)? by)\D{0,28}(\d{1,2}\s+[A-Z][a-z]+\s+20\d{2})/i,
    /(?:deadline|closes?|due|submit(?:ted)? by)\D{0,28}(20\d{2}-\d{2}-\d{2})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const parsed = new Date(match[1]);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return "";
}

async function analyse(item: { title: string; description: string; link: string }, fallback: number) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (fallback < 35) return null;
  if (!apiKey) {
    const haystack = `${item.title} ${item.description}`;
    const deadline = extractDeadline(haystack);
    if (!deadline) return null;
    return {
      eligible: fallback >= 60,
      score: fallback,
      reason: "Matches CAGE's drone, GIS, mapping, climate, agriculture or training capabilities; confirm the full eligibility notice before proceeding.",
      organization: textOf(item.description, "source") || "Organisation shown in source",
      opportunityType: /tender|rfq|procurement|bid/i.test(haystack) ? "Tender / RFQ" : /partner/i.test(haystack) ? "Partnership" : "Grant",
      estimatedValue: "Not published",
      deadline,
      requirements: ["Open the direct notice and confirm Malawi company eligibility.", "Check mandatory experience, budget, submission format and delivery location."],
    };
  }
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("AI_MODEL") || "gpt-5-mini",
        input: `Review this live web result for CAGE, a Malawi company providing drones, GIS, mapping, inspections, precision agriculture, disaster response, accredited drone training and a geospatial data platform. Reject expired items, items closing within 48 hours, news without an open application, and opportunities for which a Malawi company cannot apply or join as an implementation partner. Return concise factual fields only.\nTitle: ${item.title}\nDescription: ${item.description}\nURL: ${item.link}`,
        text: { format: { type: "json_schema", name: "opportunity", strict: true, schema: { type: "object", properties: {
          eligible: { type: "boolean" }, score: { type: "integer", minimum: 0, maximum: 100 }, reason: { type: "string" }, organization: { type: "string" }, opportunityType: { type: "string", enum: ["Grant", "Tender / RFQ", "Contract", "Partnership"] }, estimatedValue: { type: "string" }, deadline: { type: "string", description: "YYYY-MM-DD or Rolling" }, requirements: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2 }
        }, required: ["eligible", "score", "reason", "organization", "opportunityType", "estimatedValue", "deadline", "requirements"], additionalProperties: false } } }
      }),
    });
    const data = await response.json();
    const raw = data.output?.flatMap((entry: any) => entry.content || []).find((entry: any) => entry.type === "output_text")?.text;
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error("Opportunity analysis failed", error);
    return null;
  }
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const cronSecret = Deno.env.get("CRON_SECRET");
  const isCron = Boolean(cronSecret && req.headers.get("x-cron-secret") === cronSecret);
  if (!isCron) {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    const userResult = token ? await supabase.auth.getUser(token) : null;
    const userId = userResult?.data?.user?.id;
    const profileResult = userId ? await supabase.from("profiles").select("role, active").eq("id", userId).maybeSingle() : null;
    if (!profileResult?.data?.active || !["admin", "manager"].includes(profileResult.data.role)) {
      return new Response(JSON.stringify({ ok: false, error: "Administrator or Manager access is required." }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }
  }

  const body = await req.json().catch(() => ({}));
  const organizationId = body.organizationId || "00000000-0000-4000-8000-000000000001";
  const configuredFeeds = (Deno.env.get("OPPORTUNITY_FEEDS") || "").split(",").map(v => v.trim()).filter(Boolean);
  const feeds = [...new Set([...DEFAULT_SEARCH_FEEDS, ...configuredFeeds])];
  const minimum = Number(Deno.env.get("OPPORTUNITY_MIN_SCORE") || 60);
  const opportunities: any[] = [];

  for (const feed of feeds) {
    try {
      const response = await fetch(feed, { headers: { "User-Agent": "CAGE-Opportunity-Monitor/2.0" } });
      if (!response.ok) continue;
      const xml = await response.text();
      const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
      for (const block of blocks.slice(0, 25)) {
        const item = { title: textOf(block, "title"), description: textOf(block, "description") || textOf(block, "summary") || textOf(block, "content"), link: linkOf(block) };
        if (!item.title || !item.link || opportunities.some(existing => existing.url === item.link)) continue;
        const haystack = `${item.title} ${item.description}`.toLowerCase();
        const termCount = CAGE_TERMS.filter(term => haystack.includes(term)).length;
        const fallback = Math.min(95, 20 + termCount * 9 + (haystack.includes("malawi") ? 15 : 0) + (haystack.includes("africa") ? 8 : 0));
        const reviewed = await analyse(item, fallback);
        if (!reviewed?.eligible || reviewed.score < minimum || !deadlineIsOpen(reviewed.deadline)) continue;
        opportunities.push({
          id: `scan-${(await hash(item.link)).slice(0, 16)}`, title: item.title, organisation: reviewed.organization,
          type: reviewed.opportunityType, source: new URL(feed).hostname.includes("google") ? "Google News live search" : new URL(feed).hostname,
          platform: new URL(item.link).hostname.replace(/^www\./, ""), estimatedValue: reviewed.estimatedValue,
          deadline: reviewed.deadline, url: item.link, match: reviewed.score,
          matchLevel: reviewed.score >= 80 ? "High" : reviewed.score >= 65 ? "Medium" : "Low",
          reason: reviewed.reason, requirements: reviewed.requirements,
        });
      }
    } catch (error) {
      console.error(`Feed failed: ${feed}`, error);
    }
  }

  for (const item of opportunities) {
    await supabase.from("opportunity_matches").upsert({
      organization_id: organizationId, external_key: await hash(item.url), title: item.title, organization: item.organisation,
      opportunity_type: item.type === "Tender / RFQ" ? "Tender / RFQ" : "Grant", source_name: item.platform, source_url: item.url,
      deadline: item.deadline === "Rolling" ? null : item.deadline, match_score: item.match, match_reason: item.reason, raw_data: item,
    }, { onConflict: "organization_id,external_key" });
  }

  if (isCron && opportunities.length && Deno.env.get("RESEND_API_KEY") && Deno.env.get("OPPORTUNITY_ALERT_TO")) {
    const recipients = Deno.env.get("OPPORTUNITY_ALERT_TO")!.split(",").map(v => v.trim()).filter(Boolean);
    await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: Deno.env.get("EMAIL_FROM") || "CAGE Operations <noreply@notifications.cagemw.com>", to: recipients, subject: `${opportunities.length} verified CAGE opportunity match${opportunities.length === 1 ? "" : "es"}`, html: `<h2>CAGE Opportunity Monitor</h2><p>New live matches were found in the weekday 07:00 CAT scan.</p><ul>${opportunities.slice(0, 10).map(item => `<li><a href="${esc(item.url)}">${esc(item.title)}</a> — ${item.match}% fit — ${esc(item.deadline)}</li>`).join("")}</ul>` }),
    });
  }

  return new Response(JSON.stringify({ ok: true, scannedFeeds: feeds.length, opportunities, nextScan: nextWeekdayAtSevenCAT() }), { headers: { ...cors, "Content-Type": "application/json" } });
});
