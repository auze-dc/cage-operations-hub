import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const CAGE_TERMS = ["drone", "uav", "uas", "geospatial", "gis", "mapping", "survey", "remote sensing", "earth observation", "photogrammetry", "lidar", "thermal", "digital twin", "geoportal", "agriculture", "precision agriculture", "disaster", "climate", "utility", "inspection", "training", "rpl", "stem", "data platform"];
const ELIGIBLE_GEOGRAPHY_TERMS = ["malawi", "southern africa", "sub-saharan africa", "africa", "african", "global", "worldwide", "international bidders", "developing countries", "least developed countries"];
const OPPORTUNITY_TERMS = ["grant", "funding", "tender", "rfp", "rfq", "procurement", "expression of interest", "call for proposals", "contract", "innovation challenge", "accelerator", "partnership"];
const SOURCE_GROUPS = [
  { name: "Global aggregators", domains: ["opportunitydesk.org", "devex.com", "developmentaid.org", "fundsforngos.org", "opportunitiesforafricans.com", "youthop.com", "terravivagrants.org", "triple-funds.com", "mangofetch.com", "tendersgo.com", "tendersinfo.com"] },
  { name: "UN & multilateral", domains: ["ungm.org", "unicef.org", "unops.org", "procurement-notices.undp.org", "nspa.nato.int"] },
  { name: "Development banks", domains: ["projects.worldbank.org", "afdb.org", "adb.org", "iadb.org", "ebrd.com", "isdb.org"] },
  { name: "Government & bilateral", domains: ["sam.gov", "ted.europa.eu", "gov.uk", "giz.de", "tenders.gov.au", "gebiz.gov.sg"] },
  { name: "Innovation & impact funds", domains: ["developpp.de", "unicefventurefund.org", "gsma.com", "google.org", "startup.google.com", "gcgh.grandchallenges.org", "usaid.gov", "sgciafrica.org"] },
  { name: "Climate & conservation", domains: ["iucn.org", "worldwildlife.org", "conservation.org", "thegef.org", "greenclimate.fund"] },
  { name: "NGO & humanitarian", domains: ["reliefweb.int", "mercycorps.org", "oxfam.org", "savethechildren.net", "crs.org"] },
  { name: "Public social posts", domains: ["linkedin.com", "x.com", "twitter.com"] },
];
const SEARCH_CAPABILITIES = '(drone OR UAV OR geospatial OR GIS OR mapping OR survey OR "remote sensing" OR "earth observation" OR agriculture OR disaster OR climate OR utility OR inspection OR training OR STEM OR "digital twin")';
const SEARCH_OPPORTUNITIES = '(grant OR funding OR tender OR RFP OR RFQ OR procurement OR "expression of interest" OR "call for proposals" OR contract OR partnership)';
const DEFAULT_SEARCH_FEEDS = SOURCE_GROUPS.map(group => {
  const sites = `(${group.domains.map(domain => `site:${domain}`).join(" OR ")})`;
  const query = `${SEARCH_OPPORTUNITIES} ${SEARCH_CAPABILITIES} ${sites}`;
  return { name: group.name, url: `https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss` };
});
const esc = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const textOf = (block: string, tag: string) => {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return (match?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
};
const linkOf = (block: string) => textOf(block, "link") || block.match(/<link[^>]+href=["']([^"']+)/i)?.[1] || "";
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(b => b.toString(16).padStart(2, "0")).join("");
const hostOf = (value: string) => { try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return "Public web source"; } };
const stripHtml = (value: string) => value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;/g, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();

async function addOfficialPageEvidence<T extends { description: string; link: string }>(item: T) {
  try {
    const response = await fetch(item.link, { headers: { "User-Agent": "Mozilla/5.0 (compatible; CAGE-Opportunity-Monitor/3.1; +https://hub.cagemw.com)" }, redirect: "follow", signal: AbortSignal.timeout(8000) });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !/(html|text|xml|json)/i.test(contentType)) return item;
    const evidence = stripHtml(await response.text()).slice(0, 12000);
    return evidence ? { ...item, description: `Search excerpt: ${item.description}\nOfficial page evidence: ${evidence}` } : item;
  } catch {
    return item;
  }
}

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
    const normalized = haystack.toLowerCase();
    const deadline = extractDeadline(haystack);
    if (!deadline) return null;
    const capabilityCount = CAGE_TERMS.filter(term => normalized.includes(term)).length;
    const matchedCapabilities = CAGE_TERMS.filter(term => normalized.includes(term)).slice(0, 4);
    const hasOpportunityLanguage = OPPORTUNITY_TERMS.some(term => normalized.includes(term));
    const hasEligibleGeography = ELIGIBLE_GEOGRAPHY_TERMS.some(term => normalized.includes(term));
    const privateSectorAllowed = /compan(?:y|ies)|business(?:es)?|private sector|supplier|vendor|consult(?:ant|ancy)|service provider|commercial|for-profit|international bidder/i.test(haystack);
    const restrictedAudience = /individual applicants only|students? only|scholarship|fellowship|nonprofits? only|ngos? only|civil society organizations? only|research institutions? only|universit(?:y|ies) only/i.test(haystack);
    return {
      eligible: fallback >= 60 && capabilityCount > 0 && hasOpportunityLanguage && hasEligibleGeography && (!restrictedAudience || privateSectorAllowed),
      score: fallback,
      reason: `CAGE fits the stated ${matchedCapabilities.join(", ")} requirement${matchedCapabilities.length === 1 ? "" : "s"} and the notice covers an eligible geography; confirm every mandatory bidder condition before proceeding.`,
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
        input: `Act as CAGE's business-development eligibility reviewer. CAGE is a privately owned Malawian technology company with commercial drone operations, GIS/geospatial analysis, photogrammetry, LiDAR, thermal inspection, digital twins, a developing Geoportal, precision-agriculture spraying and mapping, disaster-risk and anticipatory-action delivery, utility inspection, RPL/drone training and youth STEM programmes. Equipment includes enterprise mapping, thermal and agricultural drones. Relevant experience includes Malawi government agencies, utilities, UN/international-development partners, agriculture, mapping and training assignments. CAGE can apply directly as a company, supplier or consultant, or join a clearly eligible consortium as the technical implementation partner.\n\nOnly accept an opportunity when the source describes a currently open application, tender, contract, funded accelerator or genuine partnership; the deadline is more than 48 hours away or explicitly rolling; the geography permits a Malawi/African company or international bidder; and CAGE has a credible delivery role. Reject individual-only scholarships/fellowships, student-only calls, NGO-only calls, research-institution-only calls unless a private technical partner is expressly permitted, unpaid partnerships, country-restricted procurement outside Malawi without international eligibility, irrelevant sectors, and notices whose eligibility cannot be established from the result. Do not reject an otherwise eligible opportunity because the amount is small or unpublished. Return the exact reason CAGE qualifies and two concrete requirements to verify or fulfil.\n\nTitle: ${item.title}\nDescription: ${item.description}\nURL: ${item.link}`,
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
  const configuredFeeds = (Deno.env.get("OPPORTUNITY_FEEDS") || "").split(",").map(v => v.trim()).filter(Boolean).map(url => ({ name: "Configured public feed", url }));
  const feeds = [...DEFAULT_SEARCH_FEEDS, ...configuredFeeds];
  const minimum = Number(Deno.env.get("OPPORTUNITY_MIN_SCORE") || 60);
  const opportunities: any[] = [];
  const feedResults = await Promise.all(feeds.map(async feed => {
    try {
      const response = await fetch(feed.url, { headers: { "User-Agent": "CAGE-Opportunity-Monitor/3.0" }, signal: AbortSignal.timeout(12000) });
      if (!response.ok) return [];
      const xml = await response.text();
      return (xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || []).slice(0, 20).map(block => ({
        title: textOf(block, "title"),
        description: textOf(block, "description") || textOf(block, "summary") || textOf(block, "content"),
        link: linkOf(block),
        publisher: textOf(block, "source"),
        sourceGroup: feed.name,
      }));
    } catch (error) {
      console.error(`Source group failed: ${feed.name}`, error);
      return [];
    }
  }));
  const seen = new Set<string>();
  const candidates = feedResults.flat().filter(item => {
    if (!item.title || !item.link || seen.has(item.link)) return false;
    seen.add(item.link);
    const text = `${item.title} ${item.description}`.toLowerCase();
    return OPPORTUNITY_TERMS.some(term => text.includes(term)) && CAGE_TERMS.some(term => text.includes(term));
  }).map(item => {
    const text = `${item.title} ${item.description}`.toLowerCase();
    const termCount = CAGE_TERMS.filter(term => text.includes(term)).length;
    const fallback = Math.min(95, 20 + termCount * 9 + (text.includes("malawi") ? 18 : 0) + (text.includes("africa") ? 10 : 0) + (text.includes("international") ? 5 : 0));
    return { ...item, fallback };
  }).sort((a, b) => b.fallback - a.fallback).slice(0, 40);

  for (let start = 0; start < candidates.length; start += 5) {
    const evidenceBatch = await Promise.all(candidates.slice(start, start + 5).map(addOfficialPageEvidence));
    const reviewedBatch = await Promise.all(evidenceBatch.map(async item => ({ item, reviewed: await analyse(item, item.fallback) })));
    for (const { item, reviewed } of reviewedBatch) {
      if (!reviewed?.eligible || reviewed.score < minimum || !deadlineIsOpen(reviewed.deadline)) continue;
      opportunities.push({
        id: `scan-${(await hash(item.link)).slice(0, 16)}`, title: item.title, organisation: reviewed.organization === "Organisation shown in source" ? (item.publisher || hostOf(item.link)) : reviewed.organization,
        type: reviewed.opportunityType, source: item.sourceGroup, platform: hostOf(item.link), estimatedValue: reviewed.estimatedValue,
        deadline: reviewed.deadline, url: item.link, match: reviewed.score,
        matchLevel: reviewed.score >= 80 ? "High" : reviewed.score >= 65 ? "Medium" : "Low",
        reason: reviewed.reason, requirements: reviewed.requirements,
      });
    }
  }

  for (const item of opportunities) {
    await supabase.from("opportunity_matches").upsert({
      organization_id: organizationId, external_key: await hash(item.url), title: item.title, organization: item.organisation,
      opportunity_type: item.type === "Tender / RFQ" ? "Tender / RFQ" : "Grant", source_name: item.platform, source_url: item.url,
      deadline: item.deadline === "Rolling" ? null : item.deadline, match_score: item.match, match_reason: item.reason, raw_data: item,
    }, { onConflict: "organization_id,external_key" });
  }

  // Staff email routing is handled by staff-email-dispatch; never broadcast to an environment email list.

  return new Response(JSON.stringify({ ok: true, scannedFeeds: feeds.length, coveredSources: 47, opportunities, nextScan: nextWeekdayAtSevenCAT() }), { headers: { ...cors, "Content-Type": "application/json" } });
});
