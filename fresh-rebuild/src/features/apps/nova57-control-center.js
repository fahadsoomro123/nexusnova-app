import { getAtomicBackendStatus, getAtomicCapabilityPlan } from '../../nova57-atomic-backend-client.js';

const CAPABILITIES = ['general', 'reasoning', 'coding', 'research', 'multilingual'];

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString() : '—';
}

function milliseconds(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `${Math.round(n)} ms` : '—';
}

function percent(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n * 100)}%` : '—';
}

function metric(label, value, tone = '') {
  return `<article class="nx57-cc-metric ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`;
}

function routeRows(plans) {
  const seen = new Set();
  const rows = [];
  for (const capability of CAPABILITIES) {
    for (const candidate of plans[capability]?.candidates || []) {
      const key = `${candidate.provider}::${candidate.modelId}`;
      if (seen.has(`${capability}:${key}`)) continue;
      seen.add(`${capability}:${key}`);
      rows.push({ ...candidate, capability });
    }
  }
  return rows;
}

function leaderboard(rows) {
  if (!rows.length) return '<p class="nx57-cc-empty">No proven route data available.</p>';
  return rows.slice(0, 8).map((row, index) => `
    <div class="nx57-cc-route">
      <span class="nx57-cc-rank">${index + 1}</span>
      <span class="nx57-cc-route-name"><b>${esc(row.modelId)}</b><small>${esc(row.provider)} · ${esc(row.capability)}</small></span>
      <span class="nx57-cc-score">${row.semanticAttempts ? percent(row.semanticScore) : 'UNEVALUATED'}</span>
    </div>`).join('');
}

function capabilityBars(plans) {
  return CAPABILITIES.map(capability => {
    const rows = plans[capability]?.candidates || [];
    const evaluated = rows.filter(row => Number(row.semanticAttempts || 0) > 0);
    const score = evaluated.length
      ? evaluated.reduce((sum, row) => sum + Number(row.semanticScore || 0), 0) / evaluated.length
      : null;
    const width = score === null ? 0 : Math.max(2, Math.round(score * 100));
    return `<div class="nx57-cc-cap"><span>${esc(capability)}</span><i><b style="width:${width}%"></b></i><strong>${score === null ? '—' : `${Math.round(score * 100)}`}</strong></div>`;
  }).join('');
}

function stageRows(chain) {
  const hops = Array.isArray(chain?.hops) ? chain.hops : [];
  if (!hops.length) return '<p class="nx57-cc-empty">Run an Atomic task to populate live stages.</p>';
  return hops.slice(-9).reverse().map(hop => `
    <div class="nx57-cc-stage-row">
      <i class="is-ok"></i><span><b>${esc(hop.stage)}</b><small>${esc(hop.provider)} · ${esc(hop.model)}</small></span><em>${milliseconds(hop.latencyMs)}</em>
    </div>`).join('');
}

export function mountNovaControlCenter(host) {
  let timer = 0;
  let visible = false;
  let events = [];
  let lastState = { status: null, plans: {}, fetchedAt: 0 };

  host.innerHTML = `
    <div class="nx57-cc-shell">
      <div class="nx57-cc-topline"><span>LIVE INTELLIGENCE SYSTEM</span><button type="button" data-nx57-cc-refresh>REFRESH</button></div>
      <section class="nx57-cc-hero">
        <div><small>NEXUSNOVA / ARIM</small><h1>NOVA <span>CONTROL CENTER</span></h1><p>Real routes. Evaluated intelligence. Zero synthetic counters.</p></div>
        <div class="nx57-cc-core" aria-label="Atomic chain core"><i></i><b>NOVA<small>5.7 SOL</small></b></div>
      </section>
      <section class="nx57-cc-grid nx57-cc-metrics" data-nx57-cc-metrics></section>
      <section class="nx57-cc-grid nx57-cc-panels">
        <article class="nx57-cc-panel nx57-cc-wide"><header><span>ATOMIC CHAIN</span><em data-nx57-cc-chain-state>STANDBY</em></header><div data-nx57-cc-stages></div></article>
        <article class="nx57-cc-panel"><header><span>CAPABILITY MATRIX</span><em>SEMANTIC</em></header><div class="nx57-cc-caps" data-nx57-cc-caps></div></article>
        <article class="nx57-cc-panel nx57-cc-wide"><header><span>BRAIN LEADERBOARD</span><em>PROVEN ROUTES</em></header><div data-nx57-cc-leaders></div></article>
        <article class="nx57-cc-panel"><header><span>LEARNING FEED</span><em>LIVE</em></header><div class="nx57-cc-feed" data-nx57-cc-feed></div></article>
      </section>
      <footer><span data-nx57-cc-sync>Waiting for backend telemetry…</span><span>CATALOG ≠ CALLABLE BRAINS</span></footer>
    </div>`;

  const metrics = host.querySelector('[data-nx57-cc-metrics]');
  const leaders = host.querySelector('[data-nx57-cc-leaders]');
  const caps = host.querySelector('[data-nx57-cc-caps]');
  const stages = host.querySelector('[data-nx57-cc-stages]');
  const chainState = host.querySelector('[data-nx57-cc-chain-state]');
  const feed = host.querySelector('[data-nx57-cc-feed]');
  const sync = host.querySelector('[data-nx57-cc-sync]');

  function render() {
    const { status, plans, fetchedAt } = lastState;
    const rows = routeRows(plans);
    const callable = new Set(rows.map(row => `${row.provider}::${row.modelId}`)).size;
    const failures = rows.reduce((sum, row) => sum + Number(row.failures || 0), 0);
    const chain = globalThis.__NOVA_ATOMIC_CHAIN_LAST__ || null;
    metrics.innerHTML = [
      metric('Catalog models', number(status?.catalogRecords)),
      metric('Callable / planned', status ? number(callable) : '—', 'cyan'),
      metric('Healthy routes', number(status?.healthyRoutes), 'green'),
      metric('Evaluated routes', number(status?.semanticallyEvaluatedRoutes), 'violet'),
      metric('Benchmark attempts', number(status?.semanticBenchmarkAttempts)),
      metric('Recorded failures', status ? number(failures) : '—', failures ? 'amber' : '')
    ].join('');
    leaders.innerHTML = leaderboard(rows.sort((a, b) => Number(b.semanticScore || 0) - Number(a.semanticScore || 0)));
    caps.innerHTML = capabilityBars(plans);
    stages.innerHTML = stageRows(chain);
    chainState.textContent = chain ? String(chain.outcome || 'ACTIVE').toUpperCase() : 'STANDBY';
    const liveEvents = events.slice(-7).reverse();
    feed.innerHTML = liveEvents.length ? liveEvents.map(event => `<div><i></i><span>${esc(event.stage)}</span><time>${esc(event.time)}</time></div>`).join('') : '<p class="nx57-cc-empty">No live learning events yet.</p>';
    sync.textContent = fetchedAt ? `Synced ${new Date(fetchedAt).toLocaleTimeString()}` : 'Backend telemetry unavailable';
    host.classList.toggle('is-offline', !status);
  }

  async function refresh() {
    const [status, ...planRows] = await Promise.all([
      getAtomicBackendStatus(),
      ...CAPABILITIES.map(capability => getAtomicCapabilityPlan(capability))
    ]);
    const plans = Object.fromEntries(CAPABILITIES.map((capability, index) => [capability, planRows[index]]));
    lastState = { status, plans, fetchedAt: Date.now() };
    render();
  }

  function onActivity(event) {
    const stage = String(event?.detail?.stage || '').trim();
    if (!stage) return;
    events.push({ stage, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    events = events.slice(-24);
    if (visible) render();
  }

  host.querySelector('[data-nx57-cc-refresh]').addEventListener('click', refresh);
  window.addEventListener('nova57:activity', onActivity);
  render();

  return {
    show() {
      visible = true;
      refresh();
      clearInterval(timer);
      timer = setInterval(refresh, 15000);
    },
    hide() {
      visible = false;
      clearInterval(timer);
      timer = 0;
    },
    destroy() {
      clearInterval(timer);
      window.removeEventListener('nova57:activity', onActivity);
    },
    refresh
  };
}
