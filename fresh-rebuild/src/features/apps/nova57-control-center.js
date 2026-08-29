import { getAtomicBackendStatus, getAtomicCapabilityPlan } from '../../nova57-atomic-backend-client.js';

const CAPABILITIES = ['general', 'reasoning', 'coding', 'research', 'multilingual'];
const NAV = [
  ['dashboard', 'Dashboard', 'home'],
  ['ask', 'Ask NOVA', 'chat'],
  ['atomic', 'Atomic Chain', 'atom', 'LIVE'],
  ['brains', '200K Brains', 'brain', '200K'],
  ['learning', 'Learning Center', 'learn'],
  ['route', 'Route Health', 'route'],
  ['benchmarks', 'Benchmarks', 'bench'],
  ['quarantine', 'Quarantine', 'shield'],
  ['analytics', 'Analytics', 'chart'],
  ['settings', 'Settings', 'gear'],
  ['logs', 'Logs', 'logs']
];

const REFRESH_OPTIONS = [15000, 30000, 60000];

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function number(value) {
  const n = num(value);
  return n === null ? '—' : n.toLocaleString();
}

function ms(value) {
  const n = num(value);
  if (n === null || n <= 0) return '—';
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 1 : 2)}s` : `${Math.round(n)}ms`;
}

function pct(value, digits = 0) {
  const n = num(value);
  if (n === null) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

function clamp01(value) {
  const n = num(value);
  return n === null ? null : Math.max(0, Math.min(1, n));
}

function time(value = Date.now()) {
  try { return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  catch { return '—'; }
}

function icon(name) {
  const paths = {
    home: '<path d="M4 11.5 12 5l8 6.5V20h-5v-5H9v5H4z"/>',
    chat: '<path d="M5 5h14v10H9l-4 4z"/><path d="M9 9h6M9 12h4"/>',
    atom: '<circle cx="12" cy="12" r="2.2"/><ellipse cx="12" cy="12" rx="9" ry="3.8"/><ellipse cx="12" cy="12" rx="3.8" ry="9" transform="rotate(45 12 12)"/>',
    brain: '<path d="M10 5a3 3 0 0 0-5 2.2A3 3 0 0 0 6 13v1a3 3 0 0 0 4 2.8V5Zm4 0a3 3 0 0 1 5 2.2A3 3 0 0 1 18 13v1a3 3 0 0 1-4 2.8V5Z"/>',
    learn: '<path d="m12 4 8 4-8 4-8-4z"/><path d="M6 10v5c3 2 9 2 12 0v-5"/>',
    route: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h5a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H9a3 3 0 0 0-3 3"/>',
    bench: '<path d="M5 19V9M10 19V5M15 19v-7M20 19V7"/>',
    shield: '<path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    chart: '<path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 2 5-6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
    logs: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    docs: '<path d="M6 4h9l3 3v13H6z"/><path d="M15 4v4h4M9 11h6M9 15h6"/>',
    support: '<circle cx="12" cy="12" r="9"/><path d="M8 9a4 4 0 0 1 8 0c0 3-4 3-4 6M12 18h.01"/>',
    bell: '<path d="M6 16h12l-1.5-2V10a4.5 4.5 0 0 0-9 0v4z"/><path d="M10 19h4"/>',
    refresh: '<path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 1-2-5"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 4 4"/>',
    arrow: '<path d="m9 6 6 6-6 6"/>',
    close: '<path d="m7 7 10 10M17 7 7 17"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.atom}</svg>`;
}

function flattenRoutes(plans) {
  const map = new Map();
  for (const capability of CAPABILITIES) {
    for (const row of plans?.[capability]?.candidates || []) {
      const provider = String(row?.provider || row?.source || '').trim();
      const modelId = String(row?.modelId || row?.model || '').trim();
      if (!provider || !modelId) continue;
      const key = `${provider}::${modelId}`;
      const current = map.get(key) || { provider, modelId, capabilities: new Set(), healthScore: 0, semanticScore: 0, semanticAttempts: 0, failures: 0, successes: 0, ewmaLatency: 0, wrongAnswers: 0, lastOutcome: '' };
      current.capabilities.add(capability);
      current.healthScore = Math.max(Number(current.healthScore || 0), Number(row.healthScore || row.health_score || 0));
      if (Number(row.semanticAttempts || row.semantic_attempts || 0) >= Number(current.semanticAttempts || 0)) {
        current.semanticScore = Number(row.semanticScore || row.semantic_score || 0);
        current.semanticAttempts = Number(row.semanticAttempts || row.semantic_attempts || 0);
        current.wrongAnswers = Number(row.wrongAnswers || row.wrong_answers || 0);
      }
      current.failures = Math.max(Number(current.failures || 0), Number(row.failures || 0));
      current.successes = Math.max(Number(current.successes || 0), Number(row.successes || 0));
      current.ewmaLatency = Number(row.ewmaLatency || row.ewma_latency || current.ewmaLatency || 0);
      current.lastOutcome = String(row.lastOutcome || row.last_outcome || current.lastOutcome || '');
      map.set(key, current);
    }
  }
  return [...map.values()].map(row => ({ ...row, capabilities: [...row.capabilities] }));
}

function semanticRank(row) {
  return Number(row.semanticAttempts || 0) > 0 ? Number(row.semanticScore || 0) : -1;
}

function routeBand(score) {
  const n = Number(score || 0);
  if (n >= .75) return ['Excellent', 'green'];
  if (n >= .55) return ['Good', 'blue'];
  if (n >= .45) return ['Fair', 'yellow'];
  return ['Poor', 'red'];
}

function sparkline(points, key, height = 86) {
  const values = points.map(row => Number(row?.[key])).filter(Number.isFinite);
  if (values.length < 2) return '<div class="nx57-dash-empty">Trend appears after two live refreshes.</div>';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(.0001, max - min);
  const width = 420;
  const coords = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * width},${height - 6 - ((value - min) / span) * (height - 14)}`).join(' ');
  return `<svg class="nx57-dash-spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${coords}"/></svg>`;
}

function meter(label, value, suffix = '') {
  const n = clamp01(value);
  const width = n === null ? 0 : Math.round(n * 100);
  return `<div class="nx57-dash-meter"><span>${esc(label)}</span><i><b style="width:${width}%"></b></i><strong>${n === null ? '—' : `${Math.round(n * 100)}${suffix}`}</strong></div>`;
}

function deviceSnapshot() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  const memory = performance?.memory || null;
  return {
    cpuThreads: Number(navigator.hardwareConcurrency || 0) || null,
    deviceMemoryGb: Number(navigator.deviceMemory || 0) || null,
    heapUsed: memory?.usedJSHeapSize ? Number(memory.usedJSHeapSize) : null,
    heapLimit: memory?.jsHeapSizeLimit ? Number(memory.jsHeapSizeLimit) : null,
    downlink: Number(connection?.downlink || 0) || null,
    effectiveType: String(connection?.effectiveType || ''),
    online: navigator.onLine
  };
}

function bytes(n) {
  if (!Number.isFinite(Number(n)) || Number(n) <= 0) return '—';
  const value = Number(n);
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

function sectionTitle(title, action = '') {
  return `<header class="nx57-dash-section-head"><h2>${esc(title)}</h2>${action}</header>`;
}

function routeTable(rows, limit = 30) {
  const list = rows.slice(0, limit);
  if (!list.length) return '<div class="nx57-dash-empty">No callable route telemetry is available right now.</div>';
  return `<div class="nx57-dash-table-wrap"><table class="nx57-dash-table"><thead><tr><th>#</th><th>Model</th><th>Provider</th><th>Capability</th><th>Health</th><th>Semantic</th><th>Speed</th><th>Failures</th></tr></thead><tbody>${list.map((row, index) => {
    const [band, tone] = routeBand(row.healthScore);
    return `<tr><td>${index + 1}</td><td><b>${esc(row.modelId)}</b></td><td>${esc(row.provider)}</td><td>${esc(row.capabilities.join(', '))}</td><td><span class="nx57-pill ${tone}">${pct(row.healthScore)}</span><small>${band}</small></td><td>${row.semanticAttempts ? pct(row.semanticScore, 1) : 'UNEVALUATED'}</td><td>${ms(row.ewmaLatency)}</td><td>${number(row.failures)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function capabilityRows(plans) {
  return CAPABILITIES.map(capability => {
    const rows = plans?.[capability]?.candidates || [];
    const evaluated = rows.filter(row => Number(row.semanticAttempts || row.semantic_attempts || 0) > 0);
    const semantic = evaluated.length ? evaluated.reduce((sum, row) => sum + Number(row.semanticScore || row.semantic_score || 0), 0) / evaluated.length : null;
    const health = rows.length ? rows.reduce((sum, row) => sum + Number(row.healthScore || row.health_score || 0), 0) / rows.length : null;
    return { capability, candidates: rows.length, evaluated: evaluated.length, semantic, health };
  });
}

function stageCards(chain) {
  const hops = Array.isArray(chain?.hops) ? chain.hops : [];
  if (!hops.length) return '<div class="nx57-dash-empty nx57-dash-chain-empty">Run a reasoning/coding task in Ask NOVA to populate the live Atomic Chain.</div>';
  return `<div class="nx57-stage-scroll">${hops.map((hop, index) => `<article class="nx57-stage-card"><small>Stage ${index + 1}</small><strong>${esc(hop.stage || 'brain')}</strong><span>${esc(hop.provider || 'NOVA')}</span><em>${esc(hop.model || 'route')}</em><time>${ms(hop.latencyMs)}</time><b>✓ Success</b></article>${index < hops.length - 1 ? '<i class="nx57-stage-arrow">→</i>' : ''}`).join('')}</div>`;
}

export function mountNovaControlCenter(host) {
  let timer = 0;
  let visible = false;
  let activeView = 'dashboard';
  let status = null;
  let plans = {};
  let fetchedAt = 0;
  let events = [];
  let snapshots = [];
  let refreshMs = 15000;
  let compact = false;
  let reduceMotion = false;
  let search = '';
  let profileOpen = false;
  let refreshBusy = false;

  host.innerHTML = `
    <div class="nx57-atomic-ui" data-nx57-atomic-ui>
      <aside class="nx57-atomic-side">
        <div class="nx57-brand"><span class="nx57-brand-atom">${icon('atom')}</span><div><b>NOVA</b><small>ATOMIC INTELLIGENCE SYSTEM</small></div></div>
        <nav class="nx57-atomic-nav" data-nx57-atomic-nav>${NAV.map(([id, label, glyph, badge]) => `<button type="button" data-nx57-nav="${id}">${icon(glyph)}<span>${label}</span>${badge ? `<em>${badge}</em>` : ''}</button>`).join('')}</nav>
        <section class="nx57-side-status" data-nx57-side-status></section>
        <footer><span>NOVA v5.7 Sol</span><small>Built for NexusNova</small></footer>
      </aside>
      <section class="nx57-atomic-stage">
        <header class="nx57-atomic-topbar">
          <button class="nx57-mobile-menu" type="button" data-nx57-mobile-menu aria-label="Toggle dashboard menu">☰</button>
          <div class="nx57-top-actions">
            <button type="button" data-nx57-top="docs">${icon('docs')}<span>Documentation</span></button>
            <button type="button" data-nx57-top="support">${icon('support')}<span>Support</span></button>
            <button type="button" data-nx57-top="refresh" aria-label="Refresh">${icon('refresh')}</button>
            <button class="nx57-bell" type="button" data-nx57-top="bell" aria-label="Activity notifications">${icon('bell')}<i data-nx57-event-count></i></button>
            <div class="nx57-profile-wrap"><button class="nx57-profile" type="button" data-nx57-top="profile"><span>N</span><b>NOVA</b>⌄</button><div class="nx57-profile-menu" data-nx57-profile-menu hidden><b>NOVA 5.7 Sol</b><span>ARIM intelligence mesh</span><button type="button" data-nx57-nav="settings">Dashboard settings</button></div></div>
          </div>
        </header>
        <main class="nx57-atomic-content" data-nx57-dashboard-content></main>
        <footer class="nx57-atomic-footer"><span>© NexusNova • Live telemetry only</span><span data-nx57-footer-sync>Waiting for backend telemetry…</span></footer>
      </section>
    </div>`;

  const shell = host.querySelector('[data-nx57-atomic-ui]');
  const content = host.querySelector('[data-nx57-dashboard-content]');
  const sideStatus = host.querySelector('[data-nx57-side-status]');
  const profileMenu = host.querySelector('[data-nx57-profile-menu]');
  const eventCount = host.querySelector('[data-nx57-event-count]');
  const footerSync = host.querySelector('[data-nx57-footer-sync]');

  function routes() {
    return flattenRoutes(plans);
  }

  function healthRatio() {
    const active = num(status?.activeRoutes);
    const healthy = num(status?.healthyRoutes);
    return active && healthy !== null ? healthy / active : null;
  }

  function catalogRatio() {
    const catalog = num(status?.catalogRecords);
    const target = num(status?.targetCatalog) || 200000;
    return catalog === null ? null : Math.min(1, catalog / target);
  }

  function renderSide() {
    host.querySelectorAll('[data-nx57-nav]').forEach(button => button.classList.toggle('is-active', button.dataset.nx57Nav === activeView));
    const chain = globalThis.__NOVA_ATOMIC_CHAIN_LAST__ || null;
    const ratio = healthRatio();
    sideStatus.innerHTML = `<header>SYSTEM STATUS <i></i></header>
      <strong><span class="nx57-dot ${status ? 'green' : 'amber'}"></span>${status ? 'OPERATIONAL' : 'TELEMETRY OFFLINE'}</strong>
      <dl><div><dt>Last Atomic Run</dt><dd>${chain?.at ? esc(time(chain.at)) : '—'}</dd></div><div><dt>Active Routes</dt><dd>${number(status?.activeRoutes)}</dd></div><div><dt>Success Health</dt><dd>${ratio === null ? '—' : pct(ratio, 1)}</dd></div><div><dt>Avg Response</dt><dd>${ms(chain?.wallMs)}</dd></div><div><dt>Catalog</dt><dd>${number(status?.catalogRecords)}</dd></div><div><dt>Learning Mode</dt><dd class="green-text">${status ? 'ACTIVE' : 'WAITING'}</dd></div></dl>`;
    eventCount.textContent = events.length ? String(Math.min(99, events.length)) : '';
    eventCount.hidden = !events.length;
    footerSync.textContent = fetchedAt ? `UTC sync: ${new Date(fetchedAt).toISOString().replace('T', ' ').slice(0, 19)}Z` : 'Backend telemetry unavailable';
  }

  function dashboardView() {
    const routeRows = routes().sort((a, b) => semanticRank(b) - semanticRank(a) || Number(b.healthScore) - Number(a.healthScore));
    const chain = globalThis.__NOVA_ATOMIC_CHAIN_LAST__ || null;
    const active = num(status?.activeRoutes);
    const healthy = num(status?.healthyRoutes);
    const health = healthRatio();
    const catalog = num(status?.catalogRecords);
    const target = num(status?.targetCatalog) || 200000;
    const offlineCatalog = catalog === null || active === null ? null : Math.max(0, catalog - active);
    const attention = active === null || healthy === null ? null : Math.max(0, active - healthy);
    const evaluated = num(status?.semanticallyEvaluatedRoutes);
    const attempts = num(status?.semanticBenchmarkAttempts);
    const agreement = clamp01(chain?.agreement);
    const chainOutcome = chain ? String(chain.outcome || 'active').toUpperCase() : 'STANDBY';
    const device = deviceSnapshot();
    const heapRatio = device.heapUsed && device.heapLimit ? device.heapUsed / device.heapLimit : null;
    const topRows = routeRows.slice(0, 5);
    const capRows = capabilityRows(plans);
    const atRisk = routeRows.filter(row => row.wrongAnswers > 0 || row.failures > 0).sort((a, b) => b.wrongAnswers - a.wrongAnswers || b.failures - a.failures);
    return `
      <section class="nx57-summary-grid">
        <article class="nx57-summary-card nx57-chain-status"><header>ATOMIC CHAIN STATUS <span class="${chain ? 'green' : ''}">${chainOutcome}</span></header><div class="nx57-chain-orb">${icon('atom')}</div><small>Active Chain</small><b>${chain?.hops?.length ? esc(chain.hops.map(h => h.stage).slice(0, 5).join(' → ')) : 'Solver → Critic → Judge → Synthesizer → Verifier'}</b><em>Avg. Time <strong>${ms(chain?.wallMs)}</strong></em></article>
        <article class="nx57-summary-card"><header>TOTAL BRAINS</header><strong class="nx57-big-number">${number(catalog)}</strong><span class="nx57-subline green-text">⊙ Registry target: ${number(target)}</span><div class="nx57-card-icon violet">${icon('brain')}</div></article>
        <article class="nx57-summary-card"><header>LEARNING MODE</header><strong class="nx57-big-state green-text">${status ? 'ACTIVE' : 'WAITING'}</strong><span class="nx57-subline">Continuous Improvement</span><div class="nx57-card-icon cyan">${icon('brain')}</div></article>
        <article class="nx57-summary-card"><header>SYSTEM HEALTH</header><strong class="nx57-big-number">${health === null ? '—' : pct(health, 1)}</strong><span class="nx57-subline ${health !== null && health >= .8 ? 'green-text' : ''}">${health === null ? 'Unavailable' : routeBand(health)[0]}</span><div class="nx57-pulse">⌁</div></article>
      </section>

      <section class="nx57-primary-grid">
        <article class="nx57-panel nx57-chain-panel">
          ${sectionTitle('ATOMIC CHAIN LIVE EXECUTION', '<span class="nx57-live-badge">LIVE</span>')}
          <div class="nx57-query-row"><small>Latest capability</small><p>${chain ? `${esc(chain.capability || 'general')} • complexity ${number(chain.complexity)} • ${number(chain.executedBranches)} branches` : 'No Atomic task has run in this app session yet.'}</p></div>
          ${stageCards(chain)}
          <div class="nx57-chain-bottom">
            <article class="nx57-quality-ring"><small>FINAL ANSWER QUALITY</small><div style="--q:${agreement === null ? 0 : Math.round(agreement * 100)}"><strong>${agreement === null ? '—' : (agreement * 100).toFixed(1)}</strong><span>/100</span></div><b>${agreement === null ? 'JUDGE DATA REQUIRED' : 'AGREEMENT SIGNAL'}</b></article>
            <article class="nx57-agreement"><small>AGREEMENT SCORE</small><strong>${agreement === null ? '—' : pct(agreement)}</strong>${meter('Confidence', agreement)}${meter('Hallucination safety', null)}</article>
            <article class="nx57-token-card"><small>BRANCHES</small><b>Executed: ${number(chain?.executedBranches)}</b><b>Distinct: ${number(chain?.distinctBrains)}</b><strong>${number(chain?.maxBrains)} max</strong></article>
            <article class="nx57-time-card"><small>TOTAL TIME</small><strong>${ms(chain?.wallMs)}</strong><b>${chain ? 'LIVE TELEMETRY' : 'STANDBY'}</b></article>
          </div>
        </article>

        <div class="nx57-right-stack">
          <article class="nx57-panel nx57-brains-overview">${sectionTitle('200K BRAINS OVERVIEW', '<button data-nx57-nav="brains">View All →</button>')}<div class="nx57-donut-row"><div class="nx57-donut" style="--online:${catalog && active ? Math.max(.5, active / catalog * 100) : 0};--healthy:${active && healthy ? healthy / active * 100 : 0}"><strong>${number(catalog)}</strong><span>TOTAL MODELS</span></div><dl><div><dt><i class="green"></i>Healthy Routes</dt><dd>${number(healthy)}</dd></div><div><dt><i class="yellow"></i>Attention</dt><dd>${number(attention)}</dd></div><div><dt><i class="blue"></i>Callable/Active</dt><dd>${number(active)}</dd></div><div><dt><i class="red"></i>Catalog Only</dt><dd>${number(offlineCatalog)}</dd></div></dl></div></article>
          <article class="nx57-panel">${sectionTitle('TOP PERFORMING BRAINS (Live)', '<button data-nx57-nav="brains">View Leaderboard →</button>')}<div class="nx57-mini-table"><header><span>Model</span><span>Quality</span><span>Speed</span><span>Health</span></header>${topRows.length ? topRows.map((row, index) => `<div><b>${index + 1}</b><span>${esc(row.modelId)}</span><em>${row.semanticAttempts ? pct(row.semanticScore, 1) : '—'}</em><em>${ms(row.ewmaLatency)}</em><em>${pct(row.healthScore)}</em></div>`).join('') : '<p class="nx57-dash-empty">No route data.</p>'}</div></article>
        </div>
      </section>

      <section class="nx57-mid-grid">
        <article class="nx57-panel">${sectionTitle('LEARNING INSIGHTS', '<span>Live</span>')}<div class="nx57-chart-legend"><i class="violet"></i>Quality improvement <i class="blue"></i>Success rate <i class="green"></i>Evaluation coverage</div>${sparkline(snapshots, 'health')}<div class="nx57-cap-inline">${capRows.map(row => `<span><b>${esc(row.capability)}</b>${row.semantic === null ? '—' : pct(row.semantic, 1)}</span>`).join('')}</div></article>
        <article class="nx57-panel">${sectionTitle('RECENT LEARNING UPDATES', '<button data-nx57-nav="learning">View All →</button>')}<div class="nx57-feed-list">${events.length ? events.slice(-6).reverse().map(event => `<div><i></i><span>${esc(event.stage)}</span><b>${esc(event.detail || 'Atomic activity')}</b><time>${esc(event.time)}</time></div>`).join('') : '<p class="nx57-dash-empty">Live learning events will appear here.</p>'}</div></article>
        <article class="nx57-panel">${sectionTitle('ROUTE HEALTH', '<button data-nx57-nav="route">View All →</button>')}<div class="nx57-route-health"><div class="nx57-small-donut" style="--health:${health === null ? 0 : Math.round(health * 100)}"><strong>${number(healthy)}</strong><span>HEALTHY</span></div><dl><div><dt><i class="green"></i>Healthy</dt><dd>${number(healthy)}</dd></div><div><dt><i class="yellow"></i>Attention</dt><dd>${number(attention)}</dd></div><div><dt><i class="violet"></i>Evaluated</dt><dd>${number(evaluated)}</dd></div></dl></div></article>
        <article class="nx57-panel nx57-quarantine-card">${sectionTitle('QUARANTINE', '<button data-nx57-nav="quarantine">View All →</button>')}<strong>${atRisk.length ? number(atRisk.length) : '—'}</strong><span>AT-RISK CALLABLE ROUTES</span><div class="nx57-quarantine-reasons"><small>Auto-quarantine triggers</small><p>3 semantic wrong answers → 24h</p><p>Auth/rate-limit/timeout → cooldown</p></div></article>
      </section>

      <section class="nx57-bottom-grid">
        <article class="nx57-panel">${sectionTitle('LIVE ACTIVITY FEED')}<div class="nx57-activity-list">${events.length ? events.slice(-8).reverse().map(event => `<div><i class="${event.tone || 'blue'}"></i><span>${esc(event.stage)}</span><em>${esc(event.detail || '')}</em><time>${esc(event.time)}</time></div>`).join('') : '<p class="nx57-dash-empty">No activity recorded in this dashboard session.</p>'}</div></article>
        <article class="nx57-panel">${sectionTitle('BENCHMARK RESULTS (Latest)', '<button data-nx57-nav="benchmarks">View All →</button>')}<div class="nx57-benchmark-list"><header><span>Capability</span><span>Evaluated</span><span>Score</span></header>${capRows.map(row => `<div><b>${esc(row.capability)}</b><span>${number(row.evaluated)}</span><strong>${row.semantic === null ? '—' : pct(row.semantic, 1)}</strong></div>`).join('')}<footer>Total benchmark attempts: ${number(attempts)}</footer></div></article>
        <article class="nx57-panel">${sectionTitle('SYSTEM RESOURCES')}<div class="nx57-resource-list">${meter('Route health', health)}${meter('Catalog sync', catalogRatio())}${meter('JS heap', heapRatio)}<div class="nx57-resource-row"><span>CPU threads</span><strong>${number(device.cpuThreads)}</strong></div><div class="nx57-resource-row"><span>Device memory</span><strong>${device.deviceMemoryGb ? `${device.deviceMemoryGb} GB` : '—'}</strong></div><div class="nx57-resource-row"><span>Network</span><strong>${device.downlink ? `${device.downlink} Mbps` : (device.effectiveType || '—')}</strong></div></div></article>
      </section>`;
  }

  function atomicView() {
    const chain = globalThis.__NOVA_ATOMIC_CHAIN_LAST__ || null;
    const hops = Array.isArray(chain?.hops) ? chain.hops : [];
    return `<div class="nx57-page-head"><div><small>LIVE EXECUTION</small><h1>Atomic Chain</h1><p>Real ARIM branches from the latest qualifying NOVA task.</p></div><button data-nx57-action="open-chat">Ask NOVA →</button></div>
      <section class="nx57-detail-grid"><article class="nx57-panel nx57-detail-wide">${sectionTitle('Latest Atomic Execution')} ${stageCards(chain)}</article><article class="nx57-panel">${sectionTitle('Run Summary')}<dl class="nx57-stat-list"><div><dt>Outcome</dt><dd>${esc(chain?.outcome || 'STANDBY')}</dd></div><div><dt>Capability</dt><dd>${esc(chain?.capability || '—')}</dd></div><div><dt>Complexity</dt><dd>${number(chain?.complexity)}</dd></div><div><dt>Wall time</dt><dd>${ms(chain?.wallMs)}</dd></div><div><dt>Branches</dt><dd>${number(chain?.executedBranches)}</dd></div><div><dt>Distinct brains</dt><dd>${number(chain?.distinctBrains)}</dd></div><div><dt>Agreement</dt><dd>${chain ? pct(chain.agreement, 1) : '—'}</dd></div></dl></article></section>
      <article class="nx57-panel">${sectionTitle('Execution Log')}<div class="nx57-dash-table-wrap"><table class="nx57-dash-table"><thead><tr><th>#</th><th>Stage</th><th>Provider</th><th>Model</th><th>Latency</th><th>Generation</th></tr></thead><tbody>${hops.length ? hops.map((hop, i) => `<tr><td>${i + 1}</td><td>${esc(hop.stage)}</td><td>${esc(hop.provider)}</td><td><b>${esc(hop.model)}</b></td><td>${ms(hop.latencyMs)}</td><td>${number(hop.generation)}</td></tr>`).join('') : '<tr><td colspan="6">No Atomic run in this session.</td></tr>'}</tbody></table></div></article>`;
  }

  function brainsView() {
    let rows = routes().sort((a, b) => semanticRank(b) - semanticRank(a) || Number(b.healthScore) - Number(a.healthScore));
    if (search) rows = rows.filter(row => `${row.provider} ${row.modelId} ${row.capabilities.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
    return `<div class="nx57-page-head"><div><small>REGISTRY + CALLABLE ROUTES</small><h1>200K Brains</h1><p>The 200K registry is a catalog. Only proven callable routes are used for live inference.</p></div><label class="nx57-search">${icon('search')}<input data-nx57-route-search value="${esc(search)}" placeholder="Search live routes"></label></div>
      <section class="nx57-metric-strip"><article><small>Catalog models</small><strong>${number(status?.catalogRecords)}</strong></article><article><small>Target</small><strong>${number(status?.targetCatalog || 200000)}</strong></article><article><small>Active routes</small><strong>${number(status?.activeRoutes)}</strong></article><article><small>Healthy routes</small><strong>${number(status?.healthyRoutes)}</strong></article><article><small>Evaluated routes</small><strong>${number(status?.semanticallyEvaluatedRoutes)}</strong></article></section>
      <article class="nx57-panel">${sectionTitle('Live Brain Leaderboard')} ${routeTable(rows, 80)}</article>`;
  }

  function learningView() {
    const caps = capabilityRows(plans);
    return `<div class="nx57-page-head"><div><small>CONTINUOUS IMPROVEMENT</small><h1>Learning Center</h1><p>Semantic judge feedback, deterministic benchmarks and route health learning.</p></div></div>
      <section class="nx57-detail-grid"><article class="nx57-panel nx57-detail-wide">${sectionTitle('Capability Matrix')}<div class="nx57-learning-bars">${caps.map(row => `<div><span>${esc(row.capability)}</span><i><b style="width:${row.semantic === null ? 0 : Math.round(row.semantic * 100)}%"></b></i><strong>${row.semantic === null ? '—' : pct(row.semantic, 1)}</strong><small>${row.evaluated}/${row.candidates} evaluated</small></div>`).join('')}</div></article><article class="nx57-panel">${sectionTitle('Learning Totals')}<dl class="nx57-stat-list"><div><dt>Benchmark attempts</dt><dd>${number(status?.semanticBenchmarkAttempts)}</dd></div><div><dt>Evaluated routes</dt><dd>${number(status?.semanticallyEvaluatedRoutes)}</dd></div><div><dt>Wrong answers recorded</dt><dd>${number(status?.semanticWrongAnswers)}</dd></div><div><dt>Dimension records</dt><dd>${number(status?.semanticDimensionRecords)}</dd></div></dl></article></section>
      <article class="nx57-panel">${sectionTitle('Live Learning Feed')}<div class="nx57-activity-list">${events.length ? events.slice().reverse().map(event => `<div><i class="${event.tone || 'violet'}"></i><span>${esc(event.stage)}</span><em>${esc(event.detail || '')}</em><time>${esc(event.time)}</time></div>`).join('') : '<p class="nx57-dash-empty">No learning events captured in this dashboard session.</p>'}</div></article>`;
  }

  function routeView() {
    const rows = routes().sort((a, b) => Number(b.healthScore) - Number(a.healthScore));
    return `<div class="nx57-page-head"><div><small>ROUTER OBSERVABILITY</small><h1>Route Health</h1><p>Health, semantic quality, latency and failures from live planner candidates.</p></div></div><section class="nx57-metric-strip"><article><small>Active</small><strong>${number(status?.activeRoutes)}</strong></article><article><small>Healthy</small><strong>${number(status?.healthyRoutes)}</strong></article><article><small>Health ratio</small><strong>${healthRatio() === null ? '—' : pct(healthRatio(), 1)}</strong></article><article><small>Evaluated</small><strong>${number(status?.semanticallyEvaluatedRoutes)}</strong></article></section><article class="nx57-panel">${routeTable(rows, 80)}</article>`;
  }

  function benchmarkView() {
    const caps = capabilityRows(plans);
    const evaluated = routes().filter(row => row.semanticAttempts > 0).sort((a, b) => b.semanticScore - a.semanticScore);
    return `<div class="nx57-page-head"><div><small>SEMANTIC QUALITY GATES</small><h1>Benchmarks</h1><p>Only explicit evaluators can write semantic quality. Transport success alone is not treated as correctness.</p></div></div><section class="nx57-metric-strip"><article><small>Total attempts</small><strong>${number(status?.semanticBenchmarkAttempts)}</strong></article><article><small>Evaluated routes</small><strong>${number(status?.semanticallyEvaluatedRoutes)}</strong></article><article><small>Wrong answers</small><strong>${number(status?.semanticWrongAnswers)}</strong></article></section><section class="nx57-detail-grid"><article class="nx57-panel">${sectionTitle('Capability Results')}<div class="nx57-benchmark-list"><header><span>Capability</span><span>Evaluated</span><span>Score</span></header>${caps.map(row => `<div><b>${esc(row.capability)}</b><span>${number(row.evaluated)}</span><strong>${row.semantic === null ? '—' : pct(row.semantic, 1)}</strong></div>`).join('')}</div></article><article class="nx57-panel nx57-detail-wide">${sectionTitle('Evaluated Route Results')}${routeTable(evaluated, 50)}</article></section>`;
  }

  function quarantineView() {
    const rows = routes();
    const atRisk = rows.filter(row => row.wrongAnswers > 0 || row.failures > 0).sort((a, b) => b.wrongAnswers - a.wrongAnswers || b.failures - a.failures);
    return `<div class="nx57-page-head"><div><small>AUTOMATIC SAFETY ISOLATION</small><h1>Quarantine</h1><p>The planner excludes routes while their backend quarantine is active. Public planning intentionally does not expose quarantined route identities.</p></div></div><section class="nx57-metric-strip"><article><small>At-risk visible routes</small><strong>${number(atRisk.length)}</strong></article><article><small>Semantic threshold</small><strong>3 wrong</strong></article><article><small>Semantic quarantine</small><strong>24h</strong></article><article><small>Rate-limit cooldown</small><strong>5m</strong></article></section><section class="nx57-detail-grid"><article class="nx57-panel">${sectionTitle('Automatic Policy')}<dl class="nx57-stat-list"><div><dt>Auth failure</dt><dd>30 min</dd></div><div><dt>Rate limit</dt><dd>5 min</dd></div><div><dt>Timeout</dt><dd>1 min</dd></div><div><dt>3 semantic wrong answers</dt><dd>24 hours</dd></div></dl></article><article class="nx57-panel nx57-detail-wide">${sectionTitle('At-risk Callable Routes')}${routeTable(atRisk, 50)}</article></section>`;
  }

  function analyticsView() {
    return `<div class="nx57-page-head"><div><small>SESSION TELEMETRY</small><h1>Analytics</h1><p>Live dashboard snapshots collected while this Control Center is open. No synthetic history is generated.</p></div></div><section class="nx57-detail-grid"><article class="nx57-panel nx57-detail-wide">${sectionTitle('Health Trend')}${sparkline(snapshots, 'health', 180)}</article><article class="nx57-panel">${sectionTitle('Current Snapshot')}<dl class="nx57-stat-list"><div><dt>Health ratio</dt><dd>${healthRatio() === null ? '—' : pct(healthRatio(), 1)}</dd></div><div><dt>Catalog</dt><dd>${number(status?.catalogRecords)}</dd></div><div><dt>Active routes</dt><dd>${number(status?.activeRoutes)}</dd></div><div><dt>Evaluated</dt><dd>${number(status?.semanticallyEvaluatedRoutes)}</dd></div><div><dt>Attempts</dt><dd>${number(status?.semanticBenchmarkAttempts)}</dd></div></dl></article></section><article class="nx57-panel">${sectionTitle('Session Samples')}<div class="nx57-dash-table-wrap"><table class="nx57-dash-table"><thead><tr><th>Time</th><th>Health</th><th>Catalog</th><th>Active</th><th>Healthy</th><th>Evaluated</th><th>Attempts</th></tr></thead><tbody>${snapshots.slice().reverse().map(row => `<tr><td>${esc(row.time)}</td><td>${row.health === null ? '—' : pct(row.health, 1)}</td><td>${number(row.catalog)}</td><td>${number(row.active)}</td><td>${number(row.healthy)}</td><td>${number(row.evaluated)}</td><td>${number(row.attempts)}</td></tr>`).join('') || '<tr><td colspan="7">No samples yet.</td></tr>'}</tbody></table></div></article>`;
  }

  function settingsView() {
    return `<div class="nx57-page-head"><div><small>CONTROL CENTER</small><h1>Settings</h1><p>Dashboard-only preferences. They do not alter model routing or account data.</p></div></div><section class="nx57-settings-grid"><article class="nx57-panel"><h3>Refresh interval</h3><p>How often live backend telemetry is refreshed while Control is visible.</p><div class="nx57-choice-row">${REFRESH_OPTIONS.map(value => `<button type="button" data-nx57-refresh-ms="${value}" class="${refreshMs === value ? 'is-selected' : ''}">${value / 1000}s</button>`).join('')}</div></article><article class="nx57-panel"><h3>Compact density</h3><p>Reduce panel padding for smaller screens.</p><button class="nx57-toggle ${compact ? 'is-on' : ''}" type="button" data-nx57-setting="compact"><i></i><span>${compact ? 'On' : 'Off'}</span></button></article><article class="nx57-panel"><h3>Reduce dashboard motion</h3><p>Disables decorative orbital animation.</p><button class="nx57-toggle ${reduceMotion ? 'is-on' : ''}" type="button" data-nx57-setting="motion"><i></i><span>${reduceMotion ? 'On' : 'Off'}</span></button></article><article class="nx57-panel"><h3>Manual refresh</h3><p>Fetch status and all capability plans now.</p><button class="nx57-primary-button" data-nx57-top="refresh">Refresh telemetry</button></article></section>`;
  }

  function logsView() {
    return `<div class="nx57-page-head"><div><small>LOCAL SESSION EVENTS</small><h1>Logs</h1><p>Atomic activity observed by this Control Center. Raw user prompts and hidden reasoning are not logged here.</p></div></div><article class="nx57-panel">${events.length ? `<div class="nx57-log-list">${events.slice().reverse().map((event, index) => `<div><b>${String(events.length - index).padStart(3, '0')}</b><time>${esc(event.time)}</time><span>${esc(event.stage)}</span><em>${esc(event.detail || '')}</em></div>`).join('')}</div>` : '<div class="nx57-dash-empty">No events captured yet.</div>'}</article>`;
  }

  function docsView() {
    return `<div class="nx57-page-head"><div><small>NOVA 5.7 SOL</small><h1>Documentation</h1><p>What each Control Center module represents.</p></div></div><section class="nx57-doc-grid"><article class="nx57-panel"><h3>Atomic Chain</h3><p>ARIM can branch hard reasoning/coding tasks across solver, critic, specialist and finalizer roles. The dashboard reads the latest real chain telemetry.</p></article><article class="nx57-panel"><h3>200K Brains</h3><p>The catalog is discovery storage, not 200K simultaneously callable models. Live routing uses a smaller proven set of callable provider/model routes.</p></article><article class="nx57-panel"><h3>Learning Center</h3><p>Semantic quality is written only by approved evaluators such as deterministic benchmarks and judge cross-checks.</p></article><article class="nx57-panel"><h3>Quarantine</h3><p>Bad transport outcomes trigger cooldowns. Repeated semantic wrong answers trigger a longer automatic quarantine.</p></article></section>`;
  }

  function supportView() {
    const device = deviceSnapshot();
    return `<div class="nx57-page-head"><div><small>DIAGNOSTICS</small><h1>Support</h1><p>Use this live state to identify whether a problem is the device, registry or route mesh.</p></div></div><section class="nx57-detail-grid"><article class="nx57-panel"><h3>Connection</h3><dl class="nx57-stat-list"><div><dt>Browser online</dt><dd>${device.online ? 'Yes' : 'No'}</dd></div><div><dt>Backend status</dt><dd>${status ? 'Connected' : 'Unavailable'}</dd></div><div><dt>Last sync</dt><dd>${fetchedAt ? esc(time(fetchedAt)) : '—'}</dd></div><div><dt>Effective network</dt><dd>${esc(device.effectiveType || '—')}</dd></div></dl></article><article class="nx57-panel nx57-detail-wide"><h3>NOVA Router</h3><dl class="nx57-stat-list"><div><dt>Catalog</dt><dd>${number(status?.catalogRecords)}</dd></div><div><dt>Active routes</dt><dd>${number(status?.activeRoutes)}</dd></div><div><dt>Healthy routes</dt><dd>${number(status?.healthyRoutes)}</dd></div><div><dt>Evaluated routes</dt><dd>${number(status?.semanticallyEvaluatedRoutes)}</dd></div><div><dt>Benchmark attempts</dt><dd>${number(status?.semanticBenchmarkAttempts)}</dd></div></dl></article></section><button class="nx57-primary-button" data-nx57-action="open-chat">Open Ask NOVA for help</button>`;
  }

  function renderContent() {
    shell.classList.toggle('is-compact', compact);
    shell.classList.toggle('reduce-motion', reduceMotion);
    renderSide();
    const views = { dashboard: dashboardView, atomic: atomicView, brains: brainsView, learning: learningView, route: routeView, benchmarks: benchmarkView, quarantine: quarantineView, analytics: analyticsView, settings: settingsView, logs: logsView, docs: docsView, support: supportView };
    content.innerHTML = (views[activeView] || dashboardView)();
  }

  function openChat() {
    const app = host.closest('.nx57-clean-screen');
    const chat = app?.querySelector('[data-nx57-mode="chat"]');
    if (chat) chat.click();
  }

  function schedule() {
    clearInterval(timer);
    if (visible) timer = setInterval(refresh, refreshMs);
  }

  async function refresh() {
    if (refreshBusy) return;
    refreshBusy = true;
    shell.classList.add('is-refreshing');
    try {
      // Mobile WebViews are more reliable when the authoritative status request
    // gets the Worker connection first. Preserve the last good snapshot if one refresh
    // is transiently unavailable instead of replacing real telemetry with fake zeros.
    const nextStatus = await getAtomicBackendStatus();
    if (nextStatus) status = nextStatus;

    const planRows = await Promise.all(
      CAPABILITIES.map(capability => getAtomicCapabilityPlan(capability))
    );
    plans = Object.fromEntries(CAPABILITIES.map((capability, index) => [capability, planRows[index] || plans[capability] || null]));
      fetchedAt = Date.now();
      const active = num(status?.activeRoutes);
      const healthy = num(status?.healthyRoutes);
      snapshots.push({
        time: time(fetchedAt),
        health: active && healthy !== null ? healthy / active : null,
        catalog: num(status?.catalogRecords),
        active,
        healthy,
        evaluated: num(status?.semanticallyEvaluatedRoutes),
        attempts: num(status?.semanticBenchmarkAttempts)
      });
      snapshots = snapshots.slice(-48);
    } catch (error) {
      status = null;
      events.push({ stage: 'Telemetry refresh failed', detail: String(error?.message || 'Backend unavailable').slice(0, 100), time: time(), tone: 'red' });
      events = events.slice(-80);
    } finally {
      refreshBusy = false;
      shell.classList.remove('is-refreshing');
      if (visible) renderContent();
    }
  }

  function onActivity(event) {
    const detail = event?.detail || {};
    const stage = String(detail.stage || '').trim();
    if (!stage) return;
    const info = [detail.provider, detail.model, detail.outcome].filter(Boolean).join(' • ');
    events.push({ stage, detail: info, time: time(), tone: /fail|error|quarantine/i.test(stage + info) ? 'red' : /judge|final|success/i.test(stage + info) ? 'green' : 'blue' });
    events = events.slice(-80);
    if (visible && ['dashboard', 'learning', 'logs', 'atomic'].includes(activeView)) renderContent();
  }

  host.addEventListener('click', event => {
    const nav = event.target.closest('[data-nx57-nav]');
    if (nav) {
      const next = nav.dataset.nx57Nav;
      if (next === 'ask') { openChat(); return; }
      activeView = next;
      search = next === 'brains' ? search : '';
      shell.classList.remove('mobile-open');
      renderContent();
      return;
    }
    const top = event.target.closest('[data-nx57-top]');
    if (top) {
      const action = top.dataset.nx57Top;
      if (action === 'refresh') refresh();
      if (action === 'docs') { activeView = 'docs'; renderContent(); }
      if (action === 'support') { activeView = 'support'; renderContent(); }
      if (action === 'bell') { activeView = 'logs'; renderContent(); }
      if (action === 'profile') {
        profileOpen = !profileOpen;
        profileMenu.hidden = !profileOpen;
      }
      return;
    }
    if (event.target.closest('[data-nx57-mobile-menu]')) {
      shell.classList.toggle('mobile-open');
      return;
    }
    if (event.target.closest('[data-nx57-action="open-chat"]')) { openChat(); return; }
    const refreshChoice = event.target.closest('[data-nx57-refresh-ms]');
    if (refreshChoice) {
      refreshMs = Number(refreshChoice.dataset.nx57RefreshMs) || 15000;
      schedule();
      renderContent();
      return;
    }
    const setting = event.target.closest('[data-nx57-setting]');
    if (setting) {
      if (setting.dataset.nx57Setting === 'compact') compact = !compact;
      if (setting.dataset.nx57Setting === 'motion') reduceMotion = !reduceMotion;
      renderContent();
    }
  });

  host.addEventListener('input', event => {
    if (event.target.matches('[data-nx57-route-search]')) {
      search = event.target.value;
      const cursor = event.target.selectionStart;
      content.innerHTML = brainsView();
      const next = content.querySelector('[data-nx57-route-search]');
      next?.focus();
      try { next?.setSelectionRange(cursor, cursor); } catch {}
    }
  });

  window.addEventListener('nova57:activity', onActivity);
  renderContent();

  return {
    show() {
      visible = true;
      activeView = 'dashboard';
      renderContent();
      refresh();
      schedule();
    },
    hide() {
      visible = false;
      clearInterval(timer);
      timer = 0;
      shell.classList.remove('mobile-open');
    },
    destroy() {
      clearInterval(timer);
      window.removeEventListener('nova57:activity', onActivity);
    },
    refresh
  };
}
