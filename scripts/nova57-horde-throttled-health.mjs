const HORDE_BASE = 'https://aihorde.net/api/v2';
const HORDE_ANON_KEY = '0000000000';
const CLIENT_AGENT = 'NexusNova:5.7-pro:horde-health';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchJson(url, init = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const raw = await res.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    if (!res.ok) {
      const e = new Error(String(data?.message || data?.error || data?.errors || raw || `HTTP ${res.status}`).slice(0, 260));
      e.status = res.status;
      throw e;
    }
    return data;
  } finally { clearTimeout(timer); }
}

function classify(e) {
  const msg = String(e?.message || e).toLowerCase();
  const status = Number(e?.status || 0);
  if (status === 429 || /2 per 1 second|rate.?limit/.test(msg)) return 'rate-limit';
  if (/abort|timeout/.test(msg)) return 'timeout';
  return 'failed';
}

const models = await fetchJson(`${HORDE_BASE}/status/models?type=text`, { headers: { 'Client-Agent': CLIENT_AGENT } }, 7000);
const routes = [];
for (const row of Array.isArray(models) ? models : []) {
  const model = String(row?.name || row?.id || row?.model || '').trim();
  const workers = Number(row?.count ?? row?.workers ?? 0) || 0;
  if (!model || workers < 1 || /nsfw|roleplay|erp/i.test(model)) continue;
  const quality = /deepseek|qwen/i.test(model) ? 20 : /llama|gemma|mistral/i.test(model) ? 14 : 0;
  routes.push({ model, workers, score: 65 + quality + Math.min(workers, 10) });
}
routes.sort((a, b) => b.score - a.score);
const selected = routes.slice(0, 24);
console.log(`HORDE_DISCOVERED active=${routes.length} selected=${selected.length}`);

const jobs = [];
for (let i = 0; i < selected.length; i++) {
  const r = selected[i];
  const t0 = Date.now();
  try {
    const submit = await fetchJson(`${HORDE_BASE}/generate/text/async`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: HORDE_ANON_KEY, 'Client-Agent': CLIENT_AGENT },
      body: JSON.stringify({
        prompt: 'Reply with exactly OK\n\nNOVA 5.7 Sol:',
        params: { max_length: 32, max_context_length: 4096, temperature: 0.1, top_p: 0.92, top_k: 40, rep_pen: 1.05 },
        models: [r.model],
        trusted_workers: false,
        slow_workers: true,
        dry_run: false
      })
    }, 6500);
    const id = String(submit?.id || '');
    if (!id) throw new Error('no generation id');
    jobs.push({ ...r, id, submittedAt: Date.now(), submitMs: Date.now() - t0, status: 'submitted' });
    console.log(`[submit ${i + 1}/${selected.length}] ${r.model} => submitted (${Date.now() - t0} ms)`);
  } catch (e) {
    jobs.push({ ...r, id: null, submittedAt: Date.now(), submitMs: Date.now() - t0, status: classify(e), error: String(e?.message || e).slice(0, 220), httpStatus: Number(e?.status || 0) || null });
    console.log(`[submit ${i + 1}/${selected.length}] ${r.model} => ${classify(e)} (${Date.now() - t0} ms)`);
  }
  await sleep(650);
}

async function poll(job) {
  if (!job.id) return job;
  const deadline = job.submittedAt + 26000;
  while (Date.now() < deadline) {
    try {
      const state = await fetchJson(`${HORDE_BASE}/generate/text/status/${encodeURIComponent(job.id)}`, { headers: { 'Client-Agent': CLIENT_AGENT } }, 4500);
      const text = String(state?.generations?.[0]?.text || '').trim();
      if (text) return { ...job, status: 'working', latencyMs: Date.now() - job.submittedAt, sample: text.slice(0, 100) };
      if (state?.faulted || state?.is_possible === false || state?.done === true) return { ...job, status: 'failed', latencyMs: Date.now() - job.submittedAt, error: 'route unavailable/faulted' };
    } catch (e) {
      if (Number(e?.status || 0) !== 429) return { ...job, status: classify(e), latencyMs: Date.now() - job.submittedAt, error: String(e?.message || e).slice(0, 220), httpStatus: Number(e?.status || 0) || null };
    }
    await sleep(900);
  }
  try { await fetch(`${HORDE_BASE}/generate/text/status/${encodeURIComponent(job.id)}`, { method: 'DELETE', headers: { 'Client-Agent': CLIENT_AGENT } }); } catch {}
  return { ...job, status: 'timeout', latencyMs: Date.now() - job.submittedAt, error: 'no generation before deadline' };
}

const results = [];
for (let i = 0; i < jobs.length; i += 4) {
  const batch = await Promise.all(jobs.slice(i, i + 4).map(poll));
  results.push(...batch);
  for (const r of batch) console.log(`[result] ${r.model} => ${r.status}${r.latencyMs ? ` (${r.latencyMs} ms)` : ''}`);
}

const counts = results.reduce((m, r) => { m[r.status] = (m[r.status] || 0) + 1; return m; }, {});
console.log('\n=== HORDE THROTTLED HEALTH SUMMARY ===');
console.log(JSON.stringify({ activeFound: routes.length, tested: selected.length, working: counts.working || 0, counts }, null, 2));
console.log('\nWORKING_HORDE_MODELS');
for (const r of results.filter(x => x.status === 'working')) console.log(`${r.model} | workers=${r.workers} | latencyMs=${r.latencyMs}`);
