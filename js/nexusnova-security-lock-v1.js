/* NexusNova Security Lock v1
   Genuine browser-side session PIN lock. Android biometric/device credential remains a native upgrade. */
(() => {
  'use strict';
  if (window.__nxSecurityLockV1) return;
  window.__nxSecurityLockV1 = true;

  const KEY = 'nexusnova_browser_app_lock_v1';
  const $ = id => document.getElementById(id);

  function bytesToB64(bytes) {
    let text = '';
    bytes.forEach(b => text += String.fromCharCode(b));
    return btoa(text);
  }
  function b64ToBytes(value) {
    const text = atob(String(value || ''));
    return Uint8Array.from(text, c => c.charCodeAt(0));
  }

  async function pinHash(pin, salt) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({name:'PBKDF2', salt, iterations:140000, hash:'SHA-256'}, material, 256);
    return bytesToB64(new Uint8Array(bits));
  }

  function readConfig() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
    catch (_) { return null; }
  }

  function validPin(pin) { return /^\d{4,12}$/.test(String(pin || '')); }

  async function setup() {
    if (!crypto?.subtle) return alert('Secure browser cryptography is unavailable here.');
    const first = prompt('Set a 4–12 digit NexusNova App Lock PIN:');
    if (first === null) return;
    if (!validPin(first)) return alert('PIN must contain 4–12 digits.');
    const second = prompt('Confirm the same PIN:');
    if (second !== first) return alert('PIN confirmation did not match.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await pinHash(first, salt);
    localStorage.setItem(KEY, JSON.stringify({salt:bytesToB64(salt), hash, createdAt:Date.now()}));
    alert('Browser App Lock enabled. It will lock NexusNova after reload and whenever you choose App Lock.');
    lock();
  }

  async function verify(pin) {
    const config = readConfig();
    if (!config?.salt || !config?.hash) return false;
    try {
      const hash = await pinHash(pin, b64ToBytes(config.salt));
      return hash === config.hash;
    } catch (_) { return false; }
  }

  function ensureOverlay() {
    let overlay = $('nxAppLockOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'nxAppLockOverlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.innerHTML = `
      <div style="width:min(92vw,380px);padding:22px;border-radius:22px;background:#0f172a;border:1px solid rgba(56,189,248,.28);box-shadow:0 22px 70px rgba(0,0,0,.55)">
        <div style="font-size:28px">🔐</div>
        <h2 style="margin:8px 0 4px">NexusNova Locked</h2>
        <p style="margin:0 0 14px;color:#94a3b8;font-size:13px">Enter your device PIN to unlock this browser session.</p>
        <input id="nxAppLockPin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="12" autocomplete="off" placeholder="PIN" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.28);background:#020617;color:#fff">
        <button id="nxAppUnlockBtn" type="button" style="width:100%;margin-top:10px;padding:11px;border:0;border-radius:12px;background:#0284c7;color:white;font-weight:800">Unlock</button>
        <button id="nxAppRemoveLockBtn" type="button" style="width:100%;margin-top:8px;padding:9px;border:1px solid rgba(148,163,184,.25);border-radius:12px;background:transparent;color:#cbd5e1">Remove App Lock</button>
        <div id="nxAppLockStatus" style="margin-top:9px;min-height:18px;color:#f87171;font-size:12px"></div>
      </div>`;
    Object.assign(overlay.style, {
      position:'fixed', inset:'0', zIndex:'2147483646', display:'none', alignItems:'center', justifyContent:'center',
      padding:'20px', background:'rgba(2,6,23,.94)', backdropFilter:'blur(14px)'
    });
    document.body.appendChild(overlay);

    const unlock = async () => {
      const pin = String($('nxAppLockPin')?.value || '');
      const status = $('nxAppLockStatus');
      if (await verify(pin)) {
        if ($('nxAppLockPin')) $('nxAppLockPin').value = '';
        if (status) status.textContent = '';
        overlay.style.display = 'none';
        document.body.style.removeProperty('overflow');
      } else if (status) status.textContent = 'Wrong PIN.';
    };
    $('nxAppUnlockBtn')?.addEventListener('click', unlock);
    $('nxAppLockPin')?.addEventListener('keydown', event => { if (event.key === 'Enter') unlock(); });
    $('nxAppRemoveLockBtn')?.addEventListener('click', async () => {
      const pin = String($('nxAppLockPin')?.value || '');
      const status = $('nxAppLockStatus');
      if (!(await verify(pin))) {
        if (status) status.textContent = 'Enter the correct PIN before removing App Lock.';
        return;
      }
      if (!confirm('Remove NexusNova browser App Lock from this device?')) return;
      localStorage.removeItem(KEY);
      overlay.style.display = 'none';
      document.body.style.removeProperty('overflow');
      if ($('nxAppLockPin')) $('nxAppLockPin').value = '';
    });
    return overlay;
  }

  function lock() {
    if (!readConfig()) return setup();
    const overlay = ensureOverlay();
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('nxAppLockPin')?.focus(), 50);
  }

  function findAppLockButton() {
    return Array.from(document.querySelectorAll('#tab-mega-security button')).find(button =>
      String(button.textContent || '').replace(/\s+/g,' ').trim().toLowerCase() === 'app lock'
    );
  }

  function install() {
    const button = findAppLockButton();
    if (button && button.dataset.nxSecurityLockReady !== '1') {
      button.dataset.nxSecurityLockReady = '1';
      button.id = 'nxSecurityAppLock';
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (readConfig()) lock(); else setup();
      });
    }
  }

  window.nexusLockAppNow = lock;

  const boot = () => {
    install();
    [900,2000,4000,7000].forEach(ms => setTimeout(install, ms));
    if (readConfig()) setTimeout(lock, 1300);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();