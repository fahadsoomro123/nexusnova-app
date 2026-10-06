// NOVA 5.7 — phone conversation guard.
// Keeps simple chat/site flows deterministic, preserves Roman Urdu preference,
// and injects conversation constraints into every supported cloud route.
// This layer intentionally runs before main.js and after the live-site fetch bridge.

const DEFAULT_SITE = 'https://nexusnovatools.com/';
const JINA_READER = 'https://r.jina.ai/';
const LANG_KEY = 'nexus_nova57_language_pref_v2';
const SITE_KEY = 'nexus_nova57_last_site_v2';
const SITE_CACHE_MS = 90_000;
const nextFetch = globalThis.fetch.bind(globalThis);

function stored(key, fallback = '') {
  try { return String(localStorage.getItem(key) || fallback); } catch { return String(fallback); }
}

function remember(key, value) {
  try { localStorage.setItem(key, String(value || '')); } catch {}
}

function lower(value) {
  return String(value || '').toLowerCase();
}

function cleanDomain(value) {
  const raw = String(value || '').trim().replace(/[),.;!?]+$/, '');
  if (!raw) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(url.protocol)) return '';
    return `${url.protocol}//${url.host}/`;
  } catch {
    return '';
  }
}

function explicitDomain(text) {
  const value = String(text || '');
  const url = value.match(/https?:\/\/[^\s)\]}>,"']+/i)?.[0];
  if (url) return cleanDomain(url);
  const domain = value.match(/\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/i)?.[0];
  return domain ? cleanDomain(domain.replace(/^www\./i, '')) : '';
}

function romanUrduSignal(text) {
  const s = lower(text);
  if (/\b(urdu|roman urdu|roman-urdu)\b/.test(s)) return true;
  const tokens = s.match(/\b(bhai|mujhe|mera|meri|mere|mery|tum|tu|aap|ap|kia|kya|he|hai|hain|hen|batao|batana|dekho|dekh|jao|kar|karo|acha|theek|nahe|nahi|angrezi)\b/g) || [];
  return tokens.length >= 2;
}

function explicitRomanUrdu(text) {
  const s = lower(text).trim();
  return /^(?:urdu|roman urdu|roman-urdu)[.!? ]*$/.test(s)
    || /(urdu|roman urdu).{0,28}(baat|bolo|bol|reply|jawab|answer)/i.test(s)
    || /(angrezi|english).{0,24}(nahi|nahe|mat|samajh)/i.test(s);
}

function shortAck(text) {
  return /^(?:acha+|achha+|ok+|okay|theek(?: hai)?|han+|haan+|ji+|hmm+|hmmm+)[.!? 👍👌🙂😊]*$/i.test(String(text || '').trim());
}

function siteWords(text) {
  const s = lower(text);
  return /\b(website|web site|site|homepage)\b/.test(s)
    || /\btools?\b.{0,35}\b(count|kitne|kitni|konse|kaunse|list|available|bata|check|dekho|dekh)\b/i.test(s)
    || /\b(count|kitne|kitni|konse|kaunse|list|available|bata|check|dekho|dekh)\b.{0,35}\btools?\b/i.test(s)
    || /(website|site).{0,40}(jao|jaa|ja|check|dekho|dekh|bata|audit|seo)/i.test(s)
    || /(jao|jaa|ja|check|dekho|dekh).{0,40}(website|site|\.com|\.net|\.org)/i.test(s);
}

function wantsFullInventory(text) {
  const s = lower(text);
  return /\b(full|all|list|konse|kaunse|names?|detail|details|available)\b/.test(s)
    || /(tools?).{0,24}(batao|bata|dikhao|show)/i.test(s);
}

const state = {
  language: stored(LANG_KEY, ''),
  lastSite: stored(SITE_KEY, DEFAULT_SITE) || DEFAULT_SITE,
  siteContext: false,
  active: null,
  serial: 0,
  cache: new Map()
};

function classify(text) {
  const value = String(text || '').trim();
  const domain = explicitDomain(value);
  if (domain) {
    state.lastSite = domain;
    remember(SITE_KEY, domain);
  }

  if (explicitRomanUrdu(value)) {
    state.language = 'roman-urdu';
    remember(LANG_KEY, state.language);
    return { kind: 'local', reply: 'Ji bhai, ab se main sirf Roman Urdu me baat karunga.', text: value };
  }

  if (!state.language && romanUrduSignal(value)) {
    state.language = 'roman-urdu';
    remember(LANG_KEY, state.language);
  }

  if (shortAck(value)) {
    return { kind: 'local', reply: state.language === 'roman-urdu' ? 'Ji bhai 👍' : 'Okay 👍', text: value };
  }

  const exactBareDomain = Boolean(domain) && /^\s*(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\/?\s*$/i.test(value);
  const site = siteWords(value) || (domain && (state.siteContext || exactBareDomain));
  if (site) {
    state.siteContext = true;
    return {
      kind: 'site',
      text: value,
      site: domain || state.lastSite || DEFAULT_SITE,
      full: wantsFullInventory(value)
    };
  }

  return { kind: 'cloud', text: value };
}

function arm(text, reason) {
  const value = String(text || '').trim();
  if (!value) return;
  const active = classify(value);
  active.id = ++state.serial;
  active.reason = reason;
  active.startedAt = Date.now();
  state.active = active;
  if (active.kind === 'site') active.snapshotPromise = siteSnapshot(active.site).catch(error => ({ error: String(error?.message || error || 'site fetch failed') }));
  globalThis.__NOVA_CONVERSATION_GUARD__.lastRequest = { id: active.id, kind: active.kind, text: value.slice(0, 240), site: active.site || null, at: new Date().toISOString() };
}

function activeInput() {
  return document.querySelector('[data-nx57-input]');
}

document.addEventListener('click', event => {
  const button = event.target instanceof Element ? event.target.closest('[data-nx57-send]') : null;
  if (!button) return;
  arm(activeInput()?.value, 'send-click');
}, true);

document.addEventListener('keydown', event => {
  if (!(event.target instanceof HTMLElement) || !event.target.matches('[data-nx57-input]')) return;
  if (event.key === 'Enter' && !event.shiftKey) arm(event.target.value, 'enter-key');
}, true);

function stripMarkdownLabel(value) {
  return String(value || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function headingTools(markdown) {
  const out = [];
  for (const line of String(markdown || '').split(/\r?\n/)) {
    const match = line.match(/^###\s+(.+)$/);
    if (!match) continue;
    const name = stripMarkdownLabel(match[1]);
    if (!name || name.length > 90) continue;
    if (/^(why|important|need|keep going|more|related|explore|legal|result|input|output)/i.test(name)) continue;
    out.push(name);
  }
  return out;
}

function internalLinks(markdown, origin) {
  const rows = [];
  const seen = new Set();
  const pattern = /\[([^\]]{1,120})\]\((https?:\/\/[^)\s]+|\/[^)\s#]+)\)/g;
  for (const match of String(markdown || '').matchAll(pattern)) {
    try {
      const url = new URL(match[2], origin);
      if (url.origin !== origin || seen.has(url.href)) continue;
      seen.add(url.href);
      rows.push({ label: stripMarkdownLabel(match[1]), url: url.href });
    } catch {}
  }
  return rows;
}

function sitemapUrls(text, origin) {
  const rows = [];
  const seen = new Set();
  for (const match of String(text || '').matchAll(/https?:\/\/[^\s<>'"\]]+/ig)) {
    try {
      const url = new URL(match[0].replace(/[),.;]+$/, ''));
      if (url.origin !== origin || seen.has(url.href)) continue;
      seen.add(url.href);
      rows.push(url.href);
    } catch {}
  }
  return rows;
}

function toolLikePath(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    if (!/\.html$/.test(path)) return false;
    if (/\/articles\//.test(path)) return false;
    if (/(?:^|\/)(?:index|tools|developer-tools|guides|about|contact|privacy|terms|disclaimer|faq|help|editorial-policy|tool-methodology|login|signup|account|app|blog|404)\.html$/.test(path)) return false;
    if (/(?:guide|policy|methodology|article|privacy|terms|disclaimer|about|contact|faq)(?:-|\.)/.test(path)) return false;
    return true;
  } catch {
    return false;
  }
}

function slugName(url) {
  try {
    const file = new URL(url).pathname.split('/').pop().replace(/\.html$/i, '');
    return file.split('-').filter(Boolean).map(word => word.length <= 3 && /^[a-z]+$/i.test(word) ? word.toUpperCase() : word[0]?.toUpperCase() + word.slice(1)).join(' ');
  } catch {
    return '';
  }
}

function uniqueNames(names) {
  const out = [];
  const seen = new Set();
  for (const raw of names) {
    const value = stripMarkdownLabel(raw);
    const key = value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

async function readText(url, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await nextFetch(`${JINA_READER}${url}`, {
      headers: { Accept: 'text/plain', 'X-Return-Format': 'markdown' },
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return String(await response.text() || '');
  } finally {
    clearTimeout(timer);
  }
}

async function siteSnapshot(site) {
  const home = new URL(site || DEFAULT_SITE);
  const key = home.origin;
  const cached = state.cache.get(key);
  if (cached && Date.now() - cached.at < SITE_CACHE_MS) return cached.value;

  const targets = {
    home: `${home.origin}/`,
    daily: `${home.origin}/tools.html`,
    developer: `${home.origin}/developer-tools.html`,
    sitemap: `${home.origin}/sitemap.xml`
  };
  const settled = await Promise.allSettled(Object.values(targets).map(url => readText(url)));
  const values = Object.keys(targets).reduce((acc, name, index) => {
    acc[name] = settled[index].status === 'fulfilled' ? settled[index].value : '';
    return acc;
  }, {});
  if (!values.home && !values.daily && !values.developer && !values.sitemap) throw new Error(`live website fetch failed for ${home.origin}`);

  const dailyNames = uniqueNames(headingTools(values.daily));
  const developerNames = uniqueNames(headingTools(values.developer));
  const homeLinks = internalLinks(values.home, home.origin).filter(row => toolLikePath(row.url));
  const mapUrls = sitemapUrls(values.sitemap, home.origin).filter(toolLikePath);
  const linkedNames = homeLinks.map(row => row.label && !/^(open|start|use|try|read|browse|learn)/i.test(row.label) ? row.label : slugName(row.url));
  const sitemapNames = mapUrls.map(slugName);
  const allNames = uniqueNames([...dailyNames, ...developerNames, ...linkedNames, ...sitemapNames]);
  const value = {
    site: `${home.origin}/`,
    fetchedAt: new Date().toISOString(),
    homepageOk: Boolean(values.home),
    dailyOk: Boolean(values.daily),
    developerOk: Boolean(values.developer),
    sitemapOk: Boolean(values.sitemap),
    dailyNames,
    developerNames,
    allNames,
    sitemapToolPages: mapUrls.length,
    homepageToolLinks: homeLinks.length
  };
  state.cache.set(key, { at: Date.now(), value });
  globalThis.__NOVA_CONVERSATION_GUARD__.lastSiteSnapshot = value;
  return value;
}

function siteReply(snapshot, request = {}) {
  const roman = state.language === 'roman-urdu' || romanUrduSignal(request.text);
  if (snapshot?.error) {
    return roman
      ? `Bhai, ${request.site || state.lastSite} ka live fetch abhi fail hua hai. Main tools ka number guess karke nahi bolunga. Dobara try karo.`
      : `The live website fetch failed for ${request.site || state.lastSite}. I will not guess the tool count. Please retry.`;
  }
  const names = Array.isArray(snapshot?.allNames) ? snapshot.allNames : [];
  if (!names.length) {
    return roman
      ? `Bhai, maine ${snapshot.site} live check ki, lekin tool inventory reliably parse nahi hui. Main fake count nahi dunga.`
      : `I checked ${snapshot.site} live, but the tool inventory could not be parsed reliably, so I will not invent a count.`;
  }
  const breakdown = `Daily Tools ${snapshot.dailyNames.length}, Developer Tools ${snapshot.developerNames.length}, sitemap me ${snapshot.sitemapToolPages} dedicated tool-page URLs`;
  if (roman) {
    const list = request.full ? `\n\nTools: ${names.join(', ')}` : '';
    return `Bhai, maine abhi ${snapshot.site} live check ki hai. Live hubs + sitemap ko dedupe karke mujhe ${names.length} distinct tool entries/pages mili hain. Breakdown: ${breakdown}.${list}\n\nYe live scan ka count hai; agar sitemap me koi page missing ho to main usay guess karke total me add nahi karunga.`;
  }
  const list = request.full ? `\n\nTools: ${names.join(', ')}` : '';
  return `I checked ${snapshot.site} live just now. After deduplicating the live tool hubs and sitemap, I found ${names.length} distinct tool entries/pages. Breakdown: ${breakdown}.${list}\n\nThis is the live-scan count; I will not guess pages that are absent from the fetched evidence.`;
}

async function localReply(active) {
  if (!active) return '';
  if (active.kind === 'local') return active.reply;
  if (active.kind === 'site') {
    const snapshot = await (active.snapshotPromise || siteSnapshot(active.site).catch(error => ({ error: String(error?.message || error) })));
    return siteReply(snapshot, active);
  }
  return '';
}

function aiUrl(url) {
  return /nexusnova-brain-router\.[^/]+\.workers\.dev\/v1\/generate(?:\?|$)/i.test(url)
    || /\/chat\/completions(?:\?|$)/i.test(url)
    || /:generateContent(?:\?|$)/i.test(url)
    || /\/generate\/text\/async(?:\?|$)/i.test(url);
}

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function providerLocalResponse(url, text) {
  if (/\/v1\/generate(?:\?|$)/i.test(url)) {
    return jsonResponse({ ok: true, text, provider: 'NOVA Local Guard', model: 'deterministic-conversation', latencyMs: 0 });
  }
  if (/:generateContent(?:\?|$)/i.test(url)) {
    return jsonResponse({
      candidates: [{ index: 0, content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 }
    });
  }
  if (/\/chat\/completions(?:\?|$)/i.test(url)) {
    return jsonResponse({
      id: `nova-local-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'nova-local-guard',
      choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    });
  }
  return null;
}

function conversationRule() {
  const pieces = [
    'NOVA CONVERSATION RULE: Answer the user now; never say you will browse/check later, never say give me a moment, and never claim a website/repository was checked unless live evidence is present.',
    'Do not ask again for a URL, name, language, or other fact that is already present in the conversation context.',
    `Current known website target: ${state.lastSite || DEFAULT_SITE}.`
  ];
  if (state.language === 'roman-urdu') {
    pieces.push('The user selected Roman Urdu. Reply ONLY in Roman Urdu written with the Latin alphabet. Never use Devanagari/Hindi script. Avoid English except unavoidable product names, URLs, code, or technical identifiers. Keep short acknowledgements short.');
  }
  return pieces.join('\n');
}

function appendRuleToBody(url, rawBody) {
  if (typeof rawBody !== 'string' || !rawBody.trim()) return rawBody;
  let body;
  try { body = JSON.parse(rawBody); } catch { return rawBody; }
  const rule = conversationRule();

  if (/\/v1\/generate(?:\?|$)/i.test(url) && typeof body.prompt === 'string') {
    body.prompt = `${body.prompt}\n\n[${rule}]`.slice(0, 12000);
    return JSON.stringify(body);
  }

  if (/\/chat\/completions(?:\?|$)/i.test(url) && Array.isArray(body.messages)) {
    const system = body.messages.find(row => row?.role === 'system');
    if (system) system.content = `${String(system.content || '')}\n${rule}`;
    else body.messages.unshift({ role: 'system', content: rule });
    return JSON.stringify(body);
  }

  if (/:generateContent(?:\?|$)/i.test(url)) {
    const existing = body.systemInstruction && typeof body.systemInstruction === 'object' ? body.systemInstruction : { parts: [] };
    if (!Array.isArray(existing.parts)) existing.parts = [];
    existing.parts.push({ text: rule });
    body.systemInstruction = existing;
    return JSON.stringify(body);
  }

  if (/\/generate\/text\/async(?:\?|$)/i.test(url) && typeof body.prompt === 'string') {
    body.prompt = `${rule}\n\n${body.prompt}`;
    return JSON.stringify(body);
  }

  return rawBody;
}

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : String(input?.url || '');
  const method = String(init?.method || (typeof input === 'object' ? input?.method : '') || 'GET').toUpperCase();
  const active = state.active;

  if (method === 'POST' && active && aiUrl(url)) {
    const local = await localReply(active);
    if (local) {
      const response = providerLocalResponse(url, local);
      if (response) {
        globalThis.__NOVA_CONVERSATION_GUARD__.lastLocalReply = { id: active.id, kind: active.kind, chars: local.length, at: new Date().toISOString() };
        return response;
      }
    }

    if (typeof init?.body === 'string') {
      init = { ...init, body: appendRuleToBody(url, init.body) };
    }
  }

  return nextFetch(input, init);
};

// Keep context current when old history is rendered, without triggering any network work.
const historyObserver = new MutationObserver(records => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      const users = [];
      if (node.matches?.('.nx57-clean-msg.user')) users.push(node);
      node.querySelectorAll?.('.nx57-clean-msg.user').forEach(row => users.push(row));
      for (const row of users) {
        const text = String(row.querySelector('p')?.textContent || '').trim();
        const domain = explicitDomain(text);
        if (domain) {
          state.lastSite = domain;
          remember(SITE_KEY, domain);
        }
        if (siteWords(text)) state.siteContext = true;
        if (explicitRomanUrdu(text)) {
          state.language = 'roman-urdu';
          remember(LANG_KEY, state.language);
        }
      }
    }
  }
});

historyObserver.observe(document.documentElement, { childList: true, subtree: true });

globalThis.__NOVA_CONVERSATION_GUARD__ = {
  active: true,
  mode: 'deterministic-site-language-context-guard',
  defaultSite: DEFAULT_SITE,
  language: () => state.language,
  lastSite: () => state.lastSite,
  lastRequest: null,
  lastLocalReply: null,
  lastSiteSnapshot: null,
  startedAt: new Date().toISOString()
};
