/* NexusNova Network Guardian v1
   Visual connectivity truth only. No network fetches, no mining/reward/wallet/auth
   writes, and no Firebase interaction. Uses browser online/offline events only. */
(() => {
  'use strict';
  if (window.__nxNetworkGuardianV1) return;
  window.__nxNetworkGuardianV1 = true;

  const CSS_MARKER = 'data-nx-network-guardian-v1';
  const TOAST_ID = 'nxNetworkGuardianToast';
  let lastOnline = typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
  let hideTimer = null;

  function ensureCss() {
    if (document.querySelector(`link[${CSS_MARKER}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './css/nexusnova-network-guardian-v1.css?v=20260817-final-audit';
    link.setAttribute(CSS_MARKER, '1');
    document.head.appendChild(link);
  }

  function headerStatusHost() {
    const dot = document.querySelector('.top-header .online-dot');
    return dot?.parentElement || null;
  }

  function ensureHeaderText() {
    const host = headerStatusHost();
    if (!host) return null;
    let label = document.getElementById('nxNetworkStateText');
    if (label) return label;

    Array.from(host.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && String(node.textContent || '').trim()) {
        node.textContent = '';
      }
    });

    label = document.createElement('span');
    label.id = 'nxNetworkStateText';
    label.className = 'nx-network-state-text';
    host.appendChild(label);
    return label;
  }

  function ensureToast() {
    let toast = document.getElementById(TOAST_ID);
    if (toast) return toast;
    toast = document.createElement('div');
    toast.id = TOAST_ID;
    toast.className = 'nx-network-guardian-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = '<span class="nx-network-guardian-mark">N</span><span class="nx-network-guardian-copy"><b>NEXUSNOVA</b><small id="nxNetworkGuardianMessage">Network status</small></span>';
    document.body.appendChild(toast);
    return toast;
  }

  function setToast(message, mode, persistent = false) {
    const toast = ensureToast();
    const text = document.getElementById('nxNetworkGuardianMessage');
    if (text) text.textContent = message;
    toast.dataset.mode = mode;
    toast.classList.add('show');
    clearTimeout(hideTimer);
    hideTimer = null;
    if (!persistent) {
      hideTimer = setTimeout(() => toast.classList.remove('show'), 1800);
    }
  }

  function applyStatus({ announce = false } = {}) {
    ensureCss();
    const online = typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
    const host = headerStatusHost();
    const label = ensureHeaderText();
    const dot = host?.querySelector('.online-dot');

    document.body?.classList.toggle('nx-network-offline', !online);
    document.body?.classList.toggle('nx-network-online', online);
    if (host) host.dataset.networkState = online ? 'online' : 'offline';
    if (dot) dot.classList.toggle('nx-offline-dot', !online);
    if (label) label.textContent = online ? 'Online' : 'Offline';

    if (!online) {
      setToast('Offline • live features will resume when internet returns', 'offline', true);
    } else if (announce && lastOnline === false) {
      setToast('Back online • live NexusNova services resumed', 'online', false);
    } else {
      document.getElementById(TOAST_ID)?.classList.remove('show');
    }

    lastOnline = online;
    return online;
  }

  function onOnline() { applyStatus({ announce: true }); }
  function onOffline() { applyStatus({ announce: true }); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyStatus(), { once: true });
  } else {
    applyStatus();
  }

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') applyStatus();
  });

  window.NexusNovaNetworkGuardian = Object.freeze({
    version: '1.0.0',
    refresh: applyStatus,
    isOnline: () => (typeof navigator.onLine === 'boolean' ? navigator.onLine : true)
  });
})();