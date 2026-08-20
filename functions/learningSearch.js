const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");

const LEARNING_PROVIDER_CONFIG = defineSecret("NEXUSNOVA_LEARNING_PROVIDERS");
const SEARCH_TIMEOUT_MS = 12000;

function requireUser(req) {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Sign in first.");
}

function cleanText(value, label, max) {
  const text = String(value ?? "").trim();
  if (!text || text.length > max) throw new HttpsError("invalid-argument", `Invalid ${label}.`);
  return text;
}

function optionalText(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function parseSecret() {
  let raw = "";
  try { raw = String(LEARNING_PROVIDER_CONFIG.value() || "").trim(); } catch {}
  let parsed = {};
  if (raw) {
    try { parsed = JSON.parse(raw); }
    catch { throw new HttpsError("internal", "Learning provider secret is invalid JSON."); }
  }
  return {
    googleKey: String(parsed.googleCseApiKey || process.env.GOOGLE_CSE_API_KEY || "").trim(),
    googleCx: String(parsed.googleCseCx || process.env.GOOGLE_CSE_CX || "").trim()
  };
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {headers: {Accept: "application/json"}, signal: controller.signal});
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    if (!response.ok) {
      const message = json?.error?.message || `HTTP ${response.status}`;
      throw new Error(String(message).slice(0, 220));
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

function buildQuery({board, level, subject, year, mode}) {
  const base = [board, level, subject, year, "past paper", "solved paper"].filter(Boolean).join(" ");
  if (mode === "education") return `site:edu.pk ${base}`;
  if (mode === "pdf") return `${base} filetype:pdf`;
  return base;
}

function normalizeItem(item) {
  const url = String(item?.link || "").trim();
  if (!/^https:\/\//i.test(url)) return null;
  let domain = "";
  try { domain = new URL(url).hostname.replace(/^www\./i, ""); } catch {}
  const mime = String(item?.mime || item?.fileFormat || "").trim();
  const isPdf = /pdf/i.test(mime) || /\.pdf(?:$|[?#])/i.test(url);
  return {
    title: String(item?.title || "Untitled result").slice(0, 220),
    snippet: String(item?.snippet || "").replace(/\s+/g, " ").trim().slice(0, 700),
    url,
    domain,
    mime,
    isPdf,
    source: "Google Programmable Search"
  };
}

exports.searchLearningPapers = onCall({
  enforceAppCheck: true,
  timeoutSeconds: 20,
  memory: "256MiB",
  secrets: [LEARNING_PROVIDER_CONFIG]
}, async req => {
  requireUser(req);
  const board = cleanText(req.data?.board, "board/university", 120);
  const level = optionalText(req.data?.level, 80);
  const subject = optionalText(req.data?.subject, 100);
  const yearRaw = optionalText(req.data?.year, 4);
  if (yearRaw && !/^\d{4}$/.test(yearRaw)) throw new HttpsError("invalid-argument", "Invalid year.");
  const mode = ["education", "pdf", "web"].includes(String(req.data?.mode)) ? String(req.data.mode) : "web";
  const config = parseSecret();
  if (!config.googleKey || !config.googleCx) {
    return {
      ok: false,
      reason: "provider-not-configured",
      message: "Secure past-paper search provider is not configured yet.",
      provider: "Google Programmable Search",
      results: []
    };
  }

  const query = buildQuery({board, level, subject, year: yearRaw, mode});
  const params = new URLSearchParams({
    key: config.googleKey,
    cx: config.googleCx,
    q: query,
    num: "10",
    safe: "active"
  });
  const json = await fetchJson(`https://customsearch.googleapis.com/customsearch/v1?${params.toString()}`);
  const results = (Array.isArray(json?.items) ? json.items : []).map(normalizeItem).filter(Boolean);
  return {
    ok: true,
    searchedAt: Date.now(),
    provider: "Google Programmable Search",
    query,
    mode,
    results
  };
});
