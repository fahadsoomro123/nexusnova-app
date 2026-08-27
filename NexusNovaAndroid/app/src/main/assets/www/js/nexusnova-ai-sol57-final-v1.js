/* NexusNova NOVA 5.7 Sol final integration guardrails v1.
 * Final client-side compatibility pass for Web/PC + Android WebView.
 * - keeps local model naming provider-neutral so any Ollama model can be used
 * - makes the saved gateway diagnostic callable from System Check
 * - prevents duplicate TTS while NOVA Live Voice owns the conversation audio
 * - adds truthful Live Voice readiness details
 * - keeps the floating Live Voice launcher scoped to the AI screen
 */
(() => {
  'use strict';
  if (window.__nxNovaSol57FinalV1) return;
  window.__nxNovaSol57FinalV1 = true;

  const CFG_KEY = 'nexusnova_nova_ai_mobile_v1';
  const $ = id => document.getElementById(id);
  let queued = false;
  let observer = null;
  let lastHealthProbe = 0;

  function readCfg() {
    try { return { endpoint: '', token: '', ...JSON.parse(localStorage.getItem(CFG_KEY) || '{}') }; }
    catch (_) { return { endpoint: '', token: '' }; }
  }

  function saveCfg(patch) {
    const next = { ...readCfg(), ...patch };
    try { localStorage.setItem(CFG_KEY, JSON.stringify(next)); } catch (_) {}
    return next;
  }

  function paired() {
    const c = readCfg();
    return !!(String(c.endpoint || '').trim() && String(c.token || '').trim());
  }

  function liveVoiceOpen() {
    return !!document.querySelector('.nx-sol57-voice-back');
  }

  function replaceStaleModelLabels(root = document) {
    const scopes = [];
    const tab = $('tab-ai');
    if (tab) scopes.push(tab);
    root.querySelectorAll?.('.nx-nova-sheet-backdrop,.nx-v57-ready-back,.nx-sol57-voice-back').forEach(x => scopes.push(x));
    for (const scope of scopes) {
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        const value = String(node.nodeValue || '');
        if (/GPT-OSS/i.test(value)) node.nodeValue = value.replace(/(?:local\s+)?GPT-OSS/gi, 'local Ollama model');
      }
    }
  }

  function patchConnectionTest() {
    const api = window.NexusNovaV6ConnectionTest;
    if (!api || typeof api.run !== 'function' || api.run.__nxSol57SavedConfig) return;
    const original = api.run.bind(api);
    const wrapped = async function(endpointValue, tokenValue) {
      const c = readCfg();
      const endpoint = String(endpointValue || c.endpoint || '').trim();
      const token = String(tokenValue || c.token || '').trim();
      if (!endpoint || !token) {
        $('nxNovaSettings')?.click();
        throw new Error('Pair the NOVA gateway in Settings first.');
      }
      const result = await original(endpoint, token);
      if (result?.model) saveCfg({ localObservedModel: String(result.model).slice(0, 160), localModelVerifiedAt: Date.now() });
      return result;
    };
    Object.defineProperty(wrapped, '__nxSol57SavedConfig', { value: true });
    api.run = wrapped;
  }

  function wrapFunction(name) {
    const current = window[name];
    if (typeof current !== 'function' || current.__nxSol57LiveVoiceSafe) return;
    const wrapped = function(...args) {
      if (liveVoiceOpen()) return false;
      return current.apply(this, args);
    };
    Object.defineProperty(wrapped, '__nxSol57LiveVoiceSafe', { value: true });
    window[name] = wrapped;
  }

  function patchNaturalVoiceOwner() {
    const api = window.NexusNovaVoice;
    if (!api || typeof api.speak !== 'function' || api.speak.__nxSol57LiveVoiceSafe) return;
    const original = api.speak.bind(api);
    const wrapped = function(...args) {
      if (liveVoiceOpen()) return false;
      return original(...args);
    };
    Object.defineProperty(wrapped, '__nxSol57LiveVoiceSafe', { value: true });
    api.speak = wrapped;
  }

  function patchSpeechOwners() {
    wrapFunction('nexusAISpeakV2');
    wrapFunction('speakAIReply');
    patchNaturalVoiceOwner();
  }

  function aiVisible() {
    const tab = $('tab-ai');
    if (!tab) return false;
    const style = getComputedStyle(tab);
    return style.display !== 'none' && style.visibility !== 'hidden' && tab.getClientRects().length > 0;
  }

  function scopeVoiceLauncher() {
    const launch = $('nxSol57VoiceLaunch');
    if (!launch) return;
    if (launch.getAttribute('aria-label') !== 'Open NOVA Live Voice') launch.setAttribute('aria-label', 'Open NOVA Live Voice');
    const wanted = aiVisible() || liveVoiceOpen() ? '' : 'none';
    if (launch.style.display !== wanted) launch.style.display = wanted;
  }

  function makeReadinessRow(label, state, detail) {
    const el = document.createElement('div');
    el.className = 'nx-v57-ready-row';
    const dot = document.createElement('span');
    dot.className = `nx-v57-ready-dot ${state}`;
    const copy = document.createElement('div');
    copy.className = 'nx-v57-ready-copy';
    const strong = document.createElement('strong');
    strong.textContent = label;
    const small = document.createElement('small');
    small.textContent = detail;
    copy.append(strong, small);
    const status = document.createElement('span');
    status.className = 'nx-v57-ready-state';
    status.textContent = state;
    el.append(dot, copy, status);
    return el;
  }

  function augmentReadiness() {
    const host = document.querySelector('.nx-v57-ready-back [data-rows]');
    if (!host || host.querySelector('[data-sol57-livevoice-ready]')) return;
    const api = window.NexusNovaSol57LiveVoice;
    let state = 'unavailable';
    let detail = 'Live Voice module not loaded';
    if (api) {
      const c = api.read?.() || {};
      const p = api.providers?.[c.provider] || null;
      const speechIn = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
      const speechOut = 'speechSynthesis' in window;
      if (p?.kind === 'system') {
        state = speechIn && speechOut ? 'ready' : 'setup';
        detail = speechIn && speechOut
          ? `${p.label} • ${p.tier} • microphone + device speech available`
          : `${p.label} • ${p.tier} • this browser/WebView is missing speech input or output support`;
      } else {
        state = paired() ? 'configured' : 'setup';
        detail = paired()
          ? `${p?.label || 'Gateway voice'} • ${p?.tier || 'provider'} • provider readiness is verified only by real synthesis`
          : `${p?.label || 'Gateway voice'} • pair the NOVA gateway or choose a FREE system voice`;
      }
    }
    const row = makeReadinessRow('Live Voice', state, detail);
    row.dataset.sol57LivevoiceReady = '1';
    host.appendChild(row);
  }

  async function probeHealth() {
    const now = Date.now();
    if (!paired() || !navigator.onLine || now - lastHealthProbe < 30000) return;
    lastHealthProbe = now;
    const c = readCfg();
    const endpoint = String(c.endpoint || '').trim().replace(/\/+$/, '');
    if (!endpoint) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const r = await fetch(endpoint + '/health', { cache: 'no-store', signal: ctrl.signal });
      if (!r.ok) return;
      const d = await r.json().catch(() => ({}));
      if (d?.model) saveCfg({ localObservedModel: String(d.model).slice(0, 160), localModelVerifiedAt: Date.now() });
    } catch (_) {
    } finally {
      clearTimeout(timer);
    }
  }

  function sync() {
    queued = false;
    patchConnectionTest();
    patchSpeechOwners();
    replaceStaleModelLabels();
    scopeVoiceLauncher();
    augmentReadiness();
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(sync);
  }

  function init() {
    document.documentElement.dataset.novaSol57Final = '1';
    sync();
    probeHealth();
    window.addEventListener('online', () => { queue(); probeHealth(); });
    window.addEventListener('focus', () => { queue(); probeHealth(); });
    document.addEventListener('visibilitychange', queue);
    observer = new MutationObserver(queue);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] });
    setInterval(() => { patchSpeechOwners(); scopeVoiceLauncher(); }, 1800);
  }

  window.NexusNovaSol57Final = Object.freeze({
    version: '1.0.1',
    sync,
    paired,
    liveVoiceOpen,
    probeHealth
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();