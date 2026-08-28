// NOVA 5.7 Sol — premium runtime resilience/feel layer.
// Adds draft recovery, measured response feedback and device-aware polish without
// changing provider truth, mining, rewards, wallet or core app behaviour.

const SCREEN = '.nx-app-body.nx57-clean-screen';
const DRAFT_KEY = 'nexus_nova57_draft_v1';
const wired = new WeakSet();

function safeStorageGet(key) {
  try { return String(localStorage.getItem(key) || ''); } catch { return ''; }
}

function safeStorageSet(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {}
}

function msLabel(ms) {
  const n = Math.max(0, Number(ms) || 0);
  if (n < 1000) return `${Math.round(n)} ms`;
  return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)} s`;
}

function connectionIsConstrained() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const type = String(connection?.effectiveType || '').toLowerCase();
  return connection?.saveData === true || type === 'slow-2g' || type === '2g';
}

function deviceIsConstrained() {
  const memory = Number(navigator.deviceMemory || 0);
  return memory > 0 && memory <= 2;
}

function applyPerformanceProfile(screen) {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  const lite = reduced || connectionIsConstrained() || deviceIsConstrained();
  screen.classList.toggle('nx57-performance-lite', lite);
  screen.dataset.nx57Performance = lite ? 'lite' : 'full';
}

function makeToast(screen) {
  let toast = screen.querySelector('[data-nx57-runtime-toast]');
  if (toast) return toast;
  toast = document.createElement('div');
  toast.className = 'nx57-runtime-toast';
  toast.dataset.nx57RuntimeToast = 'true';
  toast.hidden = true;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  screen.appendChild(toast);
  return toast;
}

function showToast(screen, text, duration = 1800) {
  if (!text) return;
  const toast = makeToast(screen);
  clearTimeout(toast.__nx57Timer);
  toast.textContent = text;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  toast.__nx57Timer = setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => { if (!toast.classList.contains('is-visible')) toast.hidden = true; }, 180);
  }, duration);
}

function bindDraftRecovery(screen) {
  const input = screen.querySelector('[data-nx57-input]');
  const send = screen.querySelector('[data-nx57-send]');
  if (!input || !send) return;

  const saved = safeStorageGet(DRAFT_KEY).slice(0, 5000);
  if (!input.value && saved) {
    input.value = saved;
    input.dispatchEvent(new Event('input', {bubbles: true}));
    showToast(screen, 'Draft restored');
  }

  let timer = 0;
  const persist = () => {
    clearTimeout(timer);
    timer = setTimeout(() => safeStorageSet(DRAFT_KEY, input.value.trim() ? input.value.slice(0, 5000) : ''), 120);
  };
  input.addEventListener('input', persist, {passive: true});

  const busyObserver = new MutationObserver(() => {
    if (send.disabled && !input.value.trim()) safeStorageSet(DRAFT_KEY, '');
  });
  busyObserver.observe(send, {attributes: true, attributeFilter: ['disabled']});
  screen.__nx57DraftObserver = busyObserver;

  window.addEventListener('pagehide', () => {
    safeStorageSet(DRAFT_KEY, input.value.trim() ? input.value.slice(0, 5000) : '');
  }, {passive: true});
}

function bindMeasuredFeedback(screen) {
  const send = screen.querySelector('[data-nx57-send]');
  const messages = screen.querySelector('[data-nx57-messages]');
  if (!send || !messages) return;

  let requestStartedAt = 0;
  let wasBusy = send.disabled;
  const busyObserver = new MutationObserver(() => {
    const busy = send.disabled === true;
    if (busy && !wasBusy) requestStartedAt = performance.now();
    wasBusy = busy;
  });
  busyObserver.observe(send, {attributes: true, attributeFilter: ['disabled']});
  screen.__nx57MeasuredBusyObserver = busyObserver;

  const messageObserver = new MutationObserver(records => {
    for (const record of records) {
      for (const added of record.addedNodes) {
        if (!(added instanceof HTMLElement) || !added.classList.contains('nx57-clean-msg') || !added.classList.contains('bot')) continue;
        const elapsed = requestStartedAt ? Math.round(performance.now() - requestStartedAt) : 0;
        requestStartedAt = 0;
        const race = globalThis.__NOVA_FOREGROUND_RACE__ || {};
        const route = String(race.winner || '').replace(/-/g, ' ');
        const measured = elapsed || Number(race.elapsedMs || race.latencyMs || 0);
        if (measured > 0 && route) showToast(screen, `${route} • ${msLabel(measured)}`, 2200);
        else if (measured > 0) showToast(screen, `Response • ${msLabel(measured)}`, 1800);
      }
    }
  });
  messageObserver.observe(messages, {childList: true});
  screen.__nx57MeasuredMessageObserver = messageObserver;
}

function bindConnectivityFeedback(screen) {
  let known = navigator.onLine;
  const sync = () => {
    const online = navigator.onLine !== false;
    applyPerformanceProfile(screen);
    if (online !== known) showToast(screen, online ? 'Back online' : 'Offline — draft stays saved', 2200);
    known = online;
  };
  window.addEventListener('online', sync, {passive: true});
  window.addEventListener('offline', sync, {passive: true});
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  connection?.addEventListener?.('change', sync, {passive: true});
}

function bindComposerReliability(screen) {
  const input = screen.querySelector('[data-nx57-input]');
  if (!input) return;
  input.setAttribute('enterkeyhint', 'send');
  input.setAttribute('autocapitalize', 'sentences');
  input.setAttribute('spellcheck', 'true');

  input.addEventListener('paste', () => {
    requestAnimationFrame(() => {
      if (input.value.length >= 4900) showToast(screen, 'Message is near the 5,000 character limit', 2400);
    });
  });
}

function wire(screen) {
  if (!screen || wired.has(screen)) return;
  wired.add(screen);
  applyPerformanceProfile(screen);
  bindDraftRecovery(screen);
  bindMeasuredFeedback(screen);
  bindConnectivityFeedback(screen);
  bindComposerReliability(screen);
  screen.classList.add('nx57-premium-runtime-ready');
}

function scan() {
  document.querySelectorAll(SCREEN).forEach(wire);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, {once: true});
else scan();

if (typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, {childList: true, subtree: true});
}