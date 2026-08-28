import fs from 'node:fs/promises';

const KILO_BASE = 'https://api.kilo.ai/api/gateway';
const OVH_BASE = 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1';
const HORDE_BASE = 'https://aihorde.net/api/v2';
const HORDE_ANON_KEY = '0000000000';
const CLIENT_AGENT = 'NexusNova:5.7-pro:health-scan';
const MAX_DYNAMIC_ROUTES = 80;
const CONCURRENCY = 6;

const KILO_SEEDS = [
  'kilo-auto/free',
  'openrouter/free',
  'stepfun/step-3.7-flash:free',
  'poolside/laguna-xs-2.1:free',
  'poolside/laguna-s-2.1:free',
  'tencent/hy3:free'
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const keyOf = r => `${r.provider}::${r.model}`;
const dedupe = rows => {
  const seen = new Set();
  return rows.filter(r => {
    const k = keyOf(r);
    if (!r.model || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

async function fetchJson(url, init = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const raw = await res.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    if (!res.ok) {
      const e = new Error(String(data?.error?.message || data?.message || data?.error || raw || `HTTP ${res.status}`).slice(0, 240));
      e.status = res.status;
      throw e;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function modelRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.models)) return data.models;
  return [];
}

async function discover() {
  const out = KILO_SEEDS.map(model => ({ provider: 'Kilo', model, kind: 'openai', base: KILO_BASE, seed: true }));
  const discovery = { Kilo: null, OVHcloud: null, 'AI Horde': null };

  try {
    const data = await fetchJson(`${KILO_BASE}/models`, {}, 6000);
    let added = 0;
    for (const row of modelRows(data)) {
      const id = String(row?.id || row?.model || row?.name || '').trim();
      if (!id) continue;
      const price = row?.pricing || row?.price || row?.cost || {};
      const zero = Number(price?.input ?? price?.prompt ?? NaN) === 0 && Number(price?.output ?? price?.completion ?? NaN) === 0;
      if (/:free$/i.test(id) || id === 'openrouter/free' || id === 'kilo-auto/free' || zero) {
        out.push({ provider: 'Kilo', model: id, kind: 'openai', base: KILO_BASE });
        added++;
      }
    }
    discovery.Kilo = { ok: true, added };
  } catch (e) {
    discovery.Kilo = { ok: false, error: String(e?.message || e).slice(0, 240) };
  }

  try {
    const data = await fetchJson(`${OVH_BASE}/models`, {}, 6000);
    let added = 0;
    for (const row of modelRows(data)) {
      const id = String(row?.id || row?.model || row?.name || '').trim();
      if (id && !/embed|rerank|guard|moderation/i.test(id)) {
        out.push({ provider: 'OVHcloud', model: id, kind: 'openai', base: OVH_BASE });
        added++;
      }
    }
    discovery.OVHcloud = { ok: true, added };
  } catch (e) {
    discovery.OVHcloud = { ok: false, error: String(e?.message || e).slice(0, 240) };
  }

  try {
    const data = await fetchJson(`${HORDE_BASE}/status/models?type=text`, { headers: { 'Client-Agent': CLIENT_AGENT } }, 6500);
    const horde = [];
    for (const row of Array.isArray(data) ? data : []) {
      const id = String(row?.name || row?.id || row?.model || '').trim();
      const workers = Number(row?.count ?? row?.workers ?? 0) || 0;
      if (!id || workers < 1 || /nsfw|roleplay|erp/i.test(id)) continue;
      const quality = /deepseek|qwen/i.test(id) ? 20 : /llama|gemma|mistral/i.test(id) ? 14 : 0;
      horde.push({ provider: 'AI Horde', model: id, kind: 'horde', workers, score: 65 + quality + Math.min(workers, 10) });
    }
    horde.sort((a, b) => b.score - a.score);
    out.push(...horde.slice(0, 24));
    discovery['AI Horde'] = { ok: true, added: Math.min(horde.length, 24), activeFound: horde.length };
  } catch (e) {
    discovery['AI Horde'] = { ok: false, error: String(e?.message || e).slice(0, 240) };
  }

  return { routes: dedupe(out).slice(0, MAX_DYNAMIC_ROUTES), discovery };
}

function classifyError(e) {
  const msg = String(e?.message || e || '').toLowerCase();
  const status = Number(e?.status || 0);
  if (status === 401 || status === 403 || /unauthor|forbidden|api key|auth/.test(msg)) return 'auth';
  if (status === 429 || /rate.?limit|quota/.test(msg)) return 'rate-limit';
  if (/abort|timeout/.test(msg)) return 'timeout';
  return 'failed';
}

async function testOpenAI(r) {
  const data = await fetchJson(`${r.base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: r.model,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      temperature: 0,
      max_tokens: 8,
      stream: false
    })
  }, 8500);
  const text = String(data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? data?.output_text ?? data?.text ?? '').trim();
  if (!text) throw new Error('empty response');
  return text;
}

async function cancelHorde(id) {
  try {
    await fetch(`${HORDE_BASE}/generate/text/status/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'Client-Agent': CLIENT_AGENT } });
  } catch {}
}

async function testHorde(r) {
  const submit = await fetchJson(`${HORDE_BASE}/generate/text/async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: HORDE_ANON_KEY, 'Client-Agent': CLIENT_AGENT },
    body: JSON.stringify({
      prompt: 'Reply with exactly OK\nNOVA:',
      params: { max_length: 8, max_context_length: 128, temperature: 0.1, top_p: 0.9, top_k: 20, rep_pen: 1.0 },
      models: [r.model],
      trusted_workers: false,
      slow_workers: true,
      dry_run: false
    })
  }, 6000);
  const id = String(submit?.id || '');
  if (!id) throw new Error('AI Horde returned no generation id');
  const started = Date.now();
  try {
    while (Date.now() - started < 16000) {
      await sleep(800);
      const state = await fetchJson(`${HORDE_BASE}/generate/text/status/${encodeURIComponent(id)}`, { headers: { 'Client-Agent': CLIENT_AGENT } }, 3500);
      const text = String(state?.generations?.[0]?.text || '').trim();
      if (text) return text;
      if (state?.faulted || state?.is_possible === false || state?.done === true) throw new Error('AI Horde route unavailable');
    }
    throw new Error('timeout waiting for AI Horde generation');
  } finally {
    if (Date.now() - started >= 16000) await cancelHorde(id);
  }
}

async function testRoute(r) {
  const t0 = Date.now();
  try {
    const text = r.kind === 'horde' ? await testHorde(r) : await testOpenAI(r);
    return { ...r, status: 'working', latencyMs: Date.now() - t0, sample: text.slice(0, 80) };
  } catch (e) {
    return { ...r, status: classifyError(e), latencyMs: Date.now() - t0, error: String(e?.message || e).slice(0, 240), httpStatus: Number(e?.status || 0) || null };
  }
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (true) {
      const i = index++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
      const x = results[i];
      console.log(`[${i + 1}/${items.length}] ${x.provider} :: ${x.model} => ${x.status} (${x.latencyMs} ms)`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const startedAt = new Date().toISOString();
const { routes, discovery } = await discover();
console.log('DISCOVERY', JSON.stringify({ totalRoutes: routes.length, discovery }, null, 2));
const results = await mapLimit(routes, CONCURRENCY, testRoute);
const counts = results.reduce((m, r) => { m[r.status] = (m[r.status] || 0) + 1; return m; }, {});
const providerSummary = {};
for (const r of results) {
  providerSummary[r.provider] ||= { total: 0, working: 0, timeout: 0, auth: 0, 'rate-limit': 0, failed: 0 };
  providerSummary[r.provider].total++;
  providerSummary[r.provider][r.status] = (providerSummary[r.provider][r.status] || 0) + 1;
}
const report = {
  startedAt,
  finishedAt: new Date().toISOString(),
  discovered: routes.length,
  working: counts.working || 0,
  nonWorking: routes.length - (counts.working || 0),
  counts,
  discovery,
  providerSummary,
  results
};
await fs.writeFile('nova57-full-brain-health-results.json', JSON.stringify(report, null, 2) + '\n');
console.log('\n=== FULL BRAIN HEALTH SUMMARY ===');
console.log(JSON.stringify({ discovered: report.discovered, working: report.working, nonWorking: report.nonWorking, counts, providerSummary, discovery }, null, 2));
