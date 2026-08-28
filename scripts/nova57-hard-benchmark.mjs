import { performance } from 'node:perf_hooks';
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend
} from '../fresh-rebuild/src/nova57-pro-tool-router.js';

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
  globalThis.__NOVA_WEB_LAST__ = null;
  globalThis.__NOVA_GITHUB_LAST__ = null;
  globalThis.__NOVA_BRAIN_LAST__ = null;
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
  async text => ({ passed: normalize(text) === '1073', reason: `expected 1073, got ${normalize(text).slice(0, 80)}` })
));

tests.push(await ask(
  'Hard exact reasoning / CRT constraints',
  'Find the smallest positive integer n satisfying all four constraints: n mod 3 = 2, n mod 5 = 3, n mod 7 = 2, n mod 11 = 5. Return only n, no explanation.',
  async text => ({ passed: normalize(text) === '863', reason: `expected 863, got ${normalize(text).slice(0, 80)}` })
));

tests.push(await ask(
  'Hard LLM logic / unique schedule',
  'Six tasks A B C D E F must occupy positions 1 through 6 exactly once. Constraints: C is immediately after A. B is before D. E is neither first nor last. F is before A. D is exactly two positions after B. F is not first. B is adjacent to E. Determine the unique order. Return ONLY the six letters with no spaces or explanation.',
  async text => ({ passed: normalize(text).toUpperCase() === 'BEDFAC', reason: `expected BEDFAC, got ${normalize(text).slice(0, 100)}` })
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
    expectedRepo = { branch: String(repo?.default_branch || ''), sha: String(commits?.[0]?.sha || '').slice(0, 8) };
  }
} catch {}

tests.push(await ask(
  'Hard tool task / live GitHub verification',
  'Live-check the public GitHub repository https://github.com/fahadsoomro123/nexusnova-website . Tell me its default branch and the latest commit short SHA. Keep the answer under 80 words and do not guess.',
  async (text, state) => {
    const value = normalize(text).toLowerCase();
    if (!expectedRepo?.branch || !expectedRepo?.sha) return { passed: false, reason: 'CI could not independently fetch expected GitHub facts.' };
    const toolWorked = state.github?.mode === 'public-read-only' && !state.github?.error;
    const hasBranch = value.includes(expectedRepo.branch.toLowerCase());
    const hasSha = value.includes(expectedRepo.sha.toLowerCase());
    return { passed: toolWorked && hasBranch && hasSha, reason: `expected branch=${expectedRepo.branch}, sha=${expectedRepo.sha}; toolWorked=${toolWorked}; hasBranch=${hasBranch}; hasSha=${hasSha}` };
  }
));

tests.push(await ask(
  'Hard tool task / live web grounding',
  'Research the web live for the current OpenAI API documentation. State one currently documented API capability and name the source/domain you found. Keep it under 100 words. If live search fails, say it failed rather than guessing.',
  async (text, state) => {
    const toolWorked = /live-web-search/.test(String(state.web?.mode || '')) && !state.web?.error;
    const value = normalize(text);
    return { passed: toolWorked && value.length >= 35, reason: `liveWebTool=${toolWorked}; responseChars=${value.length}` };
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
  note: 'elapsedMs is full-response latency. Exact local tools, live tools, and a non-tool LLM logic test are all included.'
};
console.log('\n=== BENCHMARK SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));

await import('node:fs/promises').then(fs => fs.writeFile(
  'nova57-hard-benchmark-results.json',
  JSON.stringify({ generatedAt: new Date().toISOString(), summary, tests }, null, 2) + '\n'
));

if (!tests.every(t => t.passed)) process.exitCode = 1;
