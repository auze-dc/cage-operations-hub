import { createClient } from "jsr:@supabase/supabase-js@2";

const CAGE_TERMS = [
  "drone", "uav", "uas", "geospatial", "gis", "mapping", "survey", "remote sensing",
  "agriculture", "disaster", "climate", "utility", "inspection", "training", "malawi",
  "africa", "women", "stem", "digital twin", "aerial", "lidar", "thermal"
];
const esc = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const textOf = (block: string, tag: string) => {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return (match?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
};
const linkOf = (block: string) => textOf(block, "link") || block.match(/<link[^>]+href=["']([^"']+)/i)?.[1] || "";
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(b => b.toString(16).padStart(2, "0")).join("");

async function aiScore(item: { title: string; description: string; link: string }, fallback: number) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey || fallback < 35) return { score: fallback, reason: "Matched CAGE capability and geography keywords." };
  const model = Deno.env.get("AI_MODEL") || "gpt-5-mini";
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: `Score this funding or tender opportunity from 0-100 for CAGE, a Malawi company providing drones, GIS, mapping, inspections, agriculture, disaster response, training and a geospatial data platform. Penalize ineligible geography, closed deadlines, or capabilities CAGE lacks. Return only JSON with integer score and a one-sentence reason.\nTitle: ${item.title}\nDescription: ${item.description}\nURL: ${item.link}`,
        text: { format: { type: "json_schema", name: "match", strict: true, schema: { type: "object", properties: { score: { type: "integer", minimum: 0, maximum: 100 }, reason: { type: "string" } }, required: ["score", "reason"], additionalProperties: false } } }
      }),
    });
    const data = await response.json();
    const raw = data.output?.flatMap((entry: any) => entry.content || []).find((entry: any) => entry.type === "output_text")?.text;
    return raw ? JSON.parse(raw) : { score: fallback, reason: "Matched CAGE capability and geography keywords." };
  } catch {
    return { score: fallback, reason: "Matched CAGE capability and geography keywords; AI review was unavailable." };
  }
}

Deno.serve(async req => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("Unauthorized", { status: 401 });
  const body = await req.json().catch(() => ({}));
  const organizationId = body.organizationId || "00000000-0000-4000-8000-000000000001";
  const feeds = (Deno.env.get("OPPORTUNITY_FEEDS") || "").split(",").map(v => v.trim()).filter(Boolean);
  const minimum = Number(Deno.env.get("OPPORTUNITY_MIN_SCORE") || 80);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const matches = [];

  for (const feed of feeds) {
    try {
      const xml = await (await fetch(feed, { headers: { "User-Agent": "CAGE-Opportunity-Monitor/1.0" } })).text();
      const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
      for (const block of blocks.slice(0, 40)) {
        const item = { title: textOf(block, "title"), description: textOf(block, "description") || textOf(block, "summary") || textOf(block, "content"), link: linkOf(block) };
        if (!item.title || !item.link) continue;
        const haystack = `${item.title} ${item.description}`.toLowerCase();
        const termCount = CAGE_TERMS.filter(term => haystack.includes(term)).length;
        const fallback = Math.min(95, 20 + termCount * 9 + (haystack.includes("malawi") ? 15 : 0) + (haystack.includes("africa") ? 8 : 0));
        const scored = await aiScore(item, fallback);
        if (scored.score < minimum) continue;
        matches.push({
          organization_id: organizationId,
          external_key: await hash(item.link),
          title: item.title,
          organization: "",
          opportunity_type: /tender|rfq|procurement|bid/i.test(haystack) ? "Tender / RFQ" : "Grant",
          source_name: new URL(feed).hostname,
          source_url: item.link,
          match_score: scored.score,
          match_reason: scored.reason,
          raw_data: item,
        });
      }
    } catch (error) {
      console.error(`Feed failed: ${feed}`, error);
    }
  }

  let inserted = 0;
  for (const match of matches) {
    const result = await supabase.from("opportunity_matches").upsert(match, { onConflict: "organization_id,external_key", ignoreDuplicates: true });
    if (!result.error) inserted += 1;
  }

  if (inserted > 0 && Deno.env.get("RESEND_API_KEY") && Deno.env.get("OPPORTUNITY_ALERT_TO")) {
    const recipients = Deno.env.get("OPPORTUNITY_ALERT_TO")!.split(",").map(v => v.trim()).filter(Boolean);
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("EMAIL_FROM") || "CAGE Operations <operations@cagemw.com>",
        to: recipients,
        subject: `${inserted} new CAGE opportunity match${inserted === 1 ? "" : "es"}`,
        html: `<h2>CAGE Opportunity Monitor</h2><p>${inserted} new strong match${inserted === 1 ? " was" : "es were"} found.</p><ul>${matches.slice(0, 10).map(m => `<li><a href="${esc(m.source_url)}">${esc(m.title)}</a> — ${m.match_score}%</li>`).join("")}</ul>`,
      }),
    });
  }
  return new Response(JSON.stringify({ ok: true, scannedFeeds: feeds.length, matches: inserted }), { headers: { "Content-Type": "application/json" } });
});
