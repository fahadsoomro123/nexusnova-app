/* NexusNova Automatic Local Health Monitor v1
   Privacy-first reliability layer:
   - Local-only diagnostics by default; no automatic raw error upload.
   - Never stores error messages, URLs, query strings, account identifiers,
     wallet addresses, search text, contacts, messages or exact location.
   - Records only generic issue codes and coarse module/service health states.
   - Existing Bug Report Center remains the explicit user-controlled path for
     sending optional sanitized diagnostics.
*/
(() => {
  'use strict';
  if (window.__nxHealthMonitorV1) return;
  window.__nxHealthMonitorV1 = true;
  window.nexusHealthMonitorVersion = 'local-health-v1';

  const STORAGE_KEY = 'nexusnova_health_v1';
  const MAX_ISSUES = 24;
  const ISSUE_TTL_MS = 24 * 60 * 60 * 1000;
  const ACTIVE_ISSUE_MS = 30 * 60 * 1000;
  const CHECK_INTERVAL_MS = 60 * 1000;
  const ORIGIN_TIMEOUT_MS = 4500;
  const PROD_HOST = 'fahadsoomro123.github.io';
  const ISSUE_KINDS = new Set(['runtime','resource','network']);
  const ISSUE_CODES = new Set([
    'runtime_error','promise_rejection','script_load','stylesheet_load',
    'offline_event','origin_unreachable'
  ]);
  const CHECK_STATES = new Set(['pass','fail','booting','n-a']);

  let issues = readIssues();
  let currentSnapshot = null;
  let running = null;
  let cardsReady = false;
  let intervalId = 0;

  function now() { return Date.now(); }
  function safeIssue(row) {
    if (!row || typeof row !== 'object') return null;
    const kind = ISSUE_KINDS.has(row.kind) ? row.kind : '';
    const code = ISSUE_CODES.has(row.code) ? row.code : '';
    const at = Number(row.at) || 0;
    if (!kind || !code || !at || now() - at > ISSUE_TTL_MS) return null;
    return { kind, code, at };
  }
  function readIssues() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      const rows = Array.isArray(parsed?.issues) ? parsed.issues : [];
      return rows.map(safeIssue).filter(Boolean).slice(-MAX_ISSUES);
    } catch (_) {
      return [];
    }
  }
  function persist() {
    try {
      const clean = issues.map(safeIssue).filter(Boolean).slice(-MAX_ISSUES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version:1, issues:clean }));
    } catch (_) {}
  }
  function recordIssue(kind, code) {
    if (!ISSUE_KINDS.has(kind) || !ISSUE_CODES.has(code)) return;
    issues.push({ kind, code, at:now() });
    issues = issues.map(safeIssue).filter(Boolean).slice(-MAX_ISSUES);
    persist();
    scheduleRun(80);
  }
  function isExtensionSource(value) {
    const text = String(value || '').trim();
    return /^(?:chrome|moz|safari-web)-extension:\/\//i.test(text) || /\bextension:\/\//i.test(text);
  }
  function looksLikeInjectedWalletConflict(value) {
    const text = String(value || '');
    return /(?:cannot\s+(?:set|redefine|assign)|read\s+only).{0,80}\b(?:ethereum|keplr)\b/i.test(text);
  }
  function isSameOrigin(value) {
    try {
      const url = new URL(String(value || ''), location.href);
      return url.origin === location.origin;
    } catch (_) {
      return false;
    }
  }

  function onWindowError(event) {
    const target = event?.target;
    if (target && target !== window && target.nodeType === 1) {
      const tag = String(target.tagName || '').toUpperCase();
      const source = tag === 'SCRIPT' ? target.src : tag === 'LINK' ? target.href : '';
      if (!source || isExtensionSource(source) || !isSameOrigin(source)) return;
      if (tag === 'SCRIPT') recordIssue('resource','script_load');
      else if (tag === 'LINK') recordIssue('resource','stylesheet_load');
      return;
    }

    const filename = String(event?.filename || '');
    const message = String(event?.message || event?.error?.message || '');
    if (isExtensionSource(filename) || looksLikeInjectedWalletConflict(message)) return;
    recordIssue('runtime','runtime_error');
  }

  function onUnhandledRejection(event) {
    const reason = event?.reason;
    const transient = String(reason?.stack || reason?.message || reason || '');
    if (isExtensionSource(transient) || looksLikeInjectedWalletConflict(transient)) return;
    recordIssue('runtime','promise_rejection');
  }

  function issueCounts() {
    const out = { runtime:0, resource:0, network:0, active:0 };
    const cutoff = now() - ACTIVE_ISSUE_MS;
    issues = issues.map(safeIssue).filter(Boolean).slice(-MAX_ISSUES);
    for (const row of issues) {
      if (row.kind in out) out[row.kind] += 1;
      if (row.at >= cutoff && (row.kind === 'runtime' || row.kind === 'resource')) out.active += 1;
    }
    return out;
  }

  function storageHealth() {
    const key = STORAGE_KEY + '_probe';
    try {
      localStorage.setItem(key, '1');
      const ok = localStorage.getItem(key) === '1';
      localStorage.removeItem(key);
      return ok ? 'pass' : 'fail';
    } catch (_) {
      return 'fail';
    }
  }

  async function originHealth() {
    if (navigator.onLine === false) return 'n-a';
    if (location.protocol === 'file:') return 'n-a';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ORIGIN_TIMEOUT_MS);
    try {
      const response = await fetch('./manifest.webmanifest', {
        cache:'no-store',
        signal:controller.signal,
        headers:{'Accept':'application/manifest+json,application/json;q=0.9,*/*;q=0.1'}
      });
      return response.ok ? 'pass' : 'fail';
    } catch (_) {
      return 'fail';
    } finally {
      clearTimeout(timer);
    }
  }

  async function appCheckHealth() {
    const ready = window.nexusAppCheckReady;
    if (!ready || typeof ready.then !== 'function') return 'booting';
    try {
      const status = await Promise.race([
        ready,
        new Promise(resolve => setTimeout(() => resolve(null), 1800))
      ]);
      if (!status) return 'booting';
      return status.ready === true ? 'pass' : 'fail';
    } catch (_) {
      return 'fail';
    }
  }

  async function serviceWorkerHealth() {
    if (!('serviceWorker' in navigator)) return location.hostname === PROD_HOST ? 'fail' : 'n-a';
    if (location.hostname !== PROD_HOST) return 'n-a';
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) return 'pass';
      return performance.now() < 8000 ? 'booting' : 'fail';
    } catch (_) {
      return 'fail';
    }
  }

  function moduleChecks() {
    return [
      ['navigation', typeof window.switchTab === 'function'],
      ['mining', window.__nexusSecureRewardsSingleOwner === true],
      ['daily-reward', window.__nxRewardsSparkV1 === true],
      ['wallet', window.__nxWalletActionsV3 === true],
      ['market', Boolean(window.__nexusTop100LiveFix) || window.nexusMarketIntegrityVersion === 'live-v4'],
      ['smart-search', window.__nxAllAppsSmartSearchV2 === true || window.__nxAllAppsSmartSearchV1 === true],
      ['profile', window.__nxCompleteProfileV1 === true],
      ['growth', window.__nxGrowthCenterV1 === true],
      ['onboarding', window.__nxOnboardingInsightsV1 === true],
      ['analytics', window.__nxAnalyticsV1 === true],
      ['bug-report', window.__nxBugReportV1 === true]
    ].map(([id, ok]) => ({ id, status:ok ? 'pass' : 'fail' }));
  }

  function cleanCheck(id, status) {
    const cleanId = String(id || '').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,32);
    return { id:cleanId || 'unknown', status:CHECK_STATES.has(status) ? status : 'fail' };
  }

  async function buildSnapshot() {
    const online = navigator.onLine !== false;
    const [origin, appCheck, serviceWorker] = await Promise.all([
      originHealth(), appCheckHealth(), serviceWorkerHealth()
    ]);
    if (online && origin === 'fail') recordIssue('network','origin_unreachable');

    const checks = [
      ...moduleChecks(),
      ['local-storage', storageHealth()],
      ['origin', origin],
      ['app-check', appCheck],
      ['service-worker', serviceWorker]
    ].map(row => Array.isArray(row) ? cleanCheck(row[0], row[1]) : cleanCheck(row.id, row.status));

    const counts = issueCounts();
    const hasFail = checks.some(row => row.status === 'fail');
    const hasBooting = checks.some(row => row.status === 'booting');
    let status = 'healthy';
    if (!online) status = 'offline';
    else if (hasFail || counts.active > 0) status = 'attention';
    else if (hasBooting) status = 'booting';

    return Object.freeze({
      version:'local-health-v1',
      status,
      online,
      checkedAt:now(),
      counts:Object.freeze({
        runtime:counts.runtime,
        resource:counts.resource,
        network:counts.network,
        active:counts.active
      }),
      checks:Object.freeze(checks.map(row => Object.freeze({ id:row.id, status:row.status })))
    });
  }

  function snapshotCopy() {
    if (!currentSnapshot) return null;
    return JSON.parse(JSON.stringify(currentSnapshot));
  }

  function statusMeta(status) {
    if (status === 'healthy') return ['HEALTHY','All monitored core systems look ready.'];
    if (status === 'offline') return ['OFFLINE','Internet connection is offline. Local tools may still work.'];
    if (status === 'booting') return ['BOOTING','Core services are still finishing startup checks.'];
    return ['ATTENTION','One or more monitored systems need attention.'];
  }

  function ensureStyle() {
    if (document.getElementById('nxHealthStyle')) return;
    const style = document.createElement('style');
    style.id = 'nxHealthStyle';
    style.textContent = `
      .nx-health-card{margin-top:12px;padding:15px;border-radius:18px;border:1px solid rgba(56,189,248,.16);background:linear-gradient(155deg,rgba(7,25,42,.94),rgba(8,18,31,.94));color:#e9f7ff}.nx-health-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.nx-health-title{font-size:12px;font-weight:950;letter-spacing:.04em}.nx-health-sub{font-size:9px;line-height:1.5;color:#8098ab;margin-top:5px}.nx-health-pill{font-size:8px;font-weight:950;padding:5px 8px;border-radius:999px;border:1px solid rgba(56,189,248,.22);color:#8de8ff}.nx-health-pill[data-state="healthy"]{color:#86efac;border-color:rgba(74,222,128,.3)}.nx-health-pill[data-state="attention"]{color:#fbbf24;border-color:rgba(251,191,36,.3)}.nx-health-pill[data-state="offline"]{color:#fda4af;border-color:rgba(251,113,133,.3)}.nx-health-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:11px}.nx-health-stat{padding:9px;border-radius:12px;background:rgba(15,23,42,.62);border:1px solid rgba(148,163,184,.09)}.nx-health-stat small{display:block;font-size:7px;color:#73889b;text-transform:uppercase}.nx-health-stat b{display:block;margin-top:4px;font-size:14px}.nx-health-checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin-top:10px}.nx-health-check{display:flex;justify-content:space-between;gap:7px;padding:7px 8px;border-radius:9px;background:rgba(15,23,42,.42);font-size:8px;color:#9db0c1}.nx-health-check b{font-size:7px}.nx-health-check b[data-state="pass"]{color:#86efac}.nx-health-check b[data-state="fail"]{color:#fda4af}.nx-health-check b[data-state="booting"]{color:#fbbf24}.nx-health-check b[data-state="n-a"]{color:#64748b}.nx-health-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.nx-health-btn{border:1px solid rgba(148,163,184,.18);border-radius:10px;padding:8px 10px;background:#0f172a;color:#dbeafe;font-size:8px;font-weight:900;cursor:pointer}.nx-health-btn.primary{border-color:transparent;background:linear-gradient(135deg,#0369a1,#6d28d9);color:#fff}@media(max-width:520px){.nx-health-checks{grid-template-columns:1fr}.nx-health-grid{grid-template-columns:repeat(3,1fr)}}
    `;
    document.head.appendChild(style);
  }

  function cardHtml(snapshot) {
    const s = snapshot || { status:'booting', counts:{runtime:0,resource:0,network:0,active:0}, checks:[] };
    const [label, copy] = statusMeta(s.status);
    const checks = s.checks.map(row => `<div class="nx-health-check"><span>${row.id.toUpperCase()}</span><b data-state="${row.status}">${row.status.toUpperCase()}</b></div>`).join('');
    return `<div class="nx-health-head"><div><div class="nx-health-title">🛡️ APP HEALTH CENTER</div><div class="nx-health-sub">${copy} Diagnostics stay on this device unless you explicitly send a Bug Report.</div></div><span class="nx-health-pill" data-state="${s.status}">${label}</span></div>
      <div class="nx-health-grid"><div class="nx-health-stat"><small>Runtime</small><b>${Number(s.counts.runtime)||0}</b></div><div class="nx-health-stat"><small>Resources</small><b>${Number(s.counts.resource)||0}</b></div><div class="nx-health-stat"><small>Active issues</small><b>${Number(s.counts.active)||0}</b></div></div>
      <div class="nx-health-checks">${checks || '<div class="nx-health-check"><span>STARTUP</span><b data-state="booting">BOOTING</b></div>'}</div>
      <div class="nx-health-actions"><button type="button" class="nx-health-btn primary" data-nx-health-run>RUN HEALTH CHECK</button><button type="button" class="nx-health-btn" data-nx-health-report>REPORT A PROBLEM</button><button type="button" class="nx-health-btn" data-nx-health-clear>CLEAR LOCAL DIAGNOSTICS</button></div>`;
  }

  function renderCards(snapshot = currentSnapshot) {
    document.querySelectorAll('[data-nx-health-card]').forEach(card => {
      card.innerHTML = cardHtml(snapshot);
      card.querySelector('[data-nx-health-run]')?.addEventListener('click', () => runHealthCheck());
      card.querySelector('[data-nx-health-report]')?.addEventListener('click', () => {
        if (typeof window.nexusOpenBugReport === 'function') window.nexusOpenBugReport();
        else alert('Bug Report Center is still loading. Please try again in a moment.');
      });
      card.querySelector('[data-nx-health-clear]')?.addEventListener('click', () => {
        clearLocalDiagnostics();
        runHealthCheck();
      });
    });
  }

  function ensureCards() {
    if (!document.body) return;
    ensureStyle();
    const targets = [document.getElementById('tab-profile'), document.getElementById('tab-about')].filter(Boolean);
    targets.forEach((target,index) => {
      const id = `nxHealthCard-${index}`;
      if (document.getElementById(id)) return;
      const card = document.createElement('section');
      card.id = id;
      card.className = 'nx-health-card';
      card.setAttribute('data-nx-health-card','1');
      target.appendChild(card);
    });
    cardsReady = targets.length > 0;
    renderCards();
  }

  async function runHealthCheck() {
    if (running) return running;
    running = (async () => {
      currentSnapshot = await buildSnapshot();
      renderCards(currentSnapshot);
      window.dispatchEvent(new CustomEvent('nexusnova:health', { detail:snapshotCopy() }));
      return snapshotCopy();
    })().finally(() => { running = null; });
    return running;
  }

  function clearLocalDiagnostics() {
    issues = [];
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    currentSnapshot = null;
    renderCards();
    return true;
  }

  let scheduled = 0;
  function scheduleRun(delay = 0) {
    clearTimeout(scheduled);
    scheduled = setTimeout(() => runHealthCheck().catch(() => {}), delay);
  }

  function boot() {
    ensureCards();
    [600,1600,3200,6500].forEach(ms => setTimeout(ensureCards, ms));
    scheduleRun(2800);
    clearInterval(intervalId);
    intervalId = setInterval(() => runHealthCheck().catch(() => {}), CHECK_INTERVAL_MS);
  }

  window.addEventListener('error', onWindowError, true);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
  window.addEventListener('offline', () => { recordIssue('network','offline_event'); scheduleRun(20); });
  window.addEventListener('online', () => scheduleRun(120));

  window.nexusHealth = Object.freeze({
    version:'local-health-v1',
    run:runHealthCheck,
    snapshot:snapshotCopy,
    clear:clearLocalDiagnostics,
    issues:() => issues.map(row => ({ kind:row.kind, code:row.code, at:row.at }))
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();