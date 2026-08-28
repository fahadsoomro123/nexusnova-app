import { performance } from 'node:perf_hooks';
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend
} from '../fresh-rebuild/src/nova57-web-research-router-compat.js';

const startedSuite = Date.now();
const fakeFirebaseApp = { name: 'nova57-ci-benchmark' };
const ai = getAI(fakeFirebaseApp, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, {
  model: 'gemini-3.6-flash',
  systemInstruction: {
    parts: [{
      text: 'You are NOVA 5.7 Sol under a production benchmark. Be concise, obey exact output constraints, use connected live tools when requested, and never invent tool results.'
    }]
  },
  generationConfig: {
    temperature: 0.2,
    maxOutputTokens: 700
  }
});

function normalize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

async function ask(name, prompt, verify) {
  const t0 = performance.now();
  let text = '';
  let error = null;
  try {
    const result = await model.generateContent(prompt);
    text = String(result?.response?.text?.() || '').trim();
  } catch (e) {
    error = e;
  }
  const elapsedMs = Math.round(performance.now() - t0);
  const route = globalThis.__NOVA_BRAIN_LAST__ ? { ...globalThis.__NOVA_BRAIN_LAST__ } : null;
  const web = globalThis.__NOVA_WEB_LAST__ ? { ...globalThis.__NOVA_WEB_LAST__ } : null;
  const github = globalThis.__NOVA_GITHUB_LAST__ ? { ...globalThis.__NOVA_GITHUB_LAST__ } : null;
  let passed = false;
  let reason = '';
  if (!error) {
    try {
      const verdict = await verify(text, { route, web, github, elapsedMs });
      passed = Boolean(verdict?.passed);
      reason = String(verdict?.reason || '');
    } catch (e) {
      reason = `verifier error: ${e?.message || e}`;
    }
  } else {
    reason = String(error?.message || error).slice(0, 600);
  }
  const item = {
    name,
    passed,
    elapsedMs,
    providerLatencyMs: Number(route?.latencyMs || 0) || null,
    provider: route?.provider || null,
    model: route?.model || null,
    attempts: route?.attempts || null,
    reason,
    response: normalize(text).slice(0, 1200),
    web,
    github
  };
  console.log(`\n=== ${name} ===`);
  console.log(JSON.stringify(item, null, 2));
  return item;
}

const tests = [];

tests.push(await ask(
  'Quick QA / exact arithmetic',
  'Answer only with the integer result, no words: 37 × 29',
  async text => ({
    passed: normalize(text) === '1073',
    reason: `expected 1073, got ${normalize(text).slice(0, 80)}`
  })
));

tests.push(await ask(
  'Hard reasoning / CRT constraints',
  'Find the smallest positive integer n satisfying all four constraints: n mod 3 = 2, n mod 5 = 3, n mod 7 = 2, n mod 11 = 5. Return only n, no explanation.',
  async text => ({
    passed: normalize(text) === '863',
    reason: `expected 863, got ${normalize(text).slice(0, 80)}`
  })
));

let expectedRepo = null;
try {
  const [repoRes, commitsRes] = await Promise.all([
    fetch('https://api.github.com/repos/fahadsoomro123/nexusnova-website', { headers: { Accept: 'application/vnd.github+json' } }),
    fetch('https://api.github.com/repos/fahadsoomro123/nexusnova-website/commits?per_page=1', { headers: { Accept: 'application/vnd.github+json' } })
  ]);
  if (repoRes.ok && commitsRes.ok) {
    const repo = await repoRes.json();
    const commits = await commitsRes.json();
    expectedRepo = {
      branch: String(repo?.default_branch || ''),
      sha: String(commits?.[0]?.sha || '').slice(0, 8)
    };
  }
} catch {}

tests.push(await ask(
  'Hard tool task / live GitHub verification',
  'Live-check the public GitHub repository https://github.com/fahadsoomro123/nexusnova-website . Tell me its default branch and the latest commit short SHA. Keep the answer under 80 words and do not guess.',
  async (text, state) => {
    const value = normalize(text).toLowerCase();
    if (!expectedRepo?.branch || !expectedRepo?.sha) {
      return { passed: false, reason: 'CI could not independently fetch expected GitHub facts.' };
    }
    const toolWorked = state.github?.mode === 'public-read-only' && !state.github?.error;
    const hasBranch = value.includes(expectedRepo.branch.toLowerCase());
    const hasSha = value.includes(expectedRepo.sha.toLowerCase());
    return {
      passed: toolWorked && hasBranch && hasSha,
      reason: `expected branch=${expectedRepo.branch}, sha=${expectedRepo.sha}; toolWorked=${toolWorked}; hasBranch=${hasBranch}; hasSha=${hasSha}`
    };
  }
));

tests.push(await ask(
  'Hard tool task / live web grounding',
  'Research the web live for the current OpenAI API documentation. State one currently documented API capability and name the source/domain you found. Keep it under 100 words. If live search fails, say it failed rather than guessing.',
  async (text, state) => {
    const toolWorked = state.web?.mode === 'live-web-search' && !state.web?.error;
    const value = normalize(text);
    return {
      passed: toolWorked && value.length >= 35,
      reason: `liveWebTool=${toolWorked}; responseChars=${value.length}`
    };
  }
));

const passed = tests.filter(t => t.passed).length;
const latencies = tests.map(t => t.elapsedMs).filter(Number.isFinite).sort((a, b) => a - b);
const avgMs = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
const p95Ms = latencies.length ? latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.95) - 1)] : null;
const summary = {
  passed,
  total: tests.length,
  avgMs,
  p95Ms,
  suiteMs: Date.now() - startedSuite,
  note: 'elapsedMs is full-response latency. Current NOVA route is non-streaming, so true first-token latency is not yet measurable in this harness.'
};
console.log('\n=== BENCHMARK SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));

await import('node:fs/promises').then(fs => fs.writeFile(
  'nova57-hard-benchmark-results.json',
  JSON.stringify({ generatedAt: new Date().toISOString(), summary, tests }, null, 2) + '\n'
));

// Hard gate: core exact QA + hard reasoning + GitHub live tool must pass.
// Web search is recorded as a quality signal because third-party search can be transient.
const required = tests.slice(0, 3);
if (!required.every(t => t.passed)) process.exitCode = 1;
