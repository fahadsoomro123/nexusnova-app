/* NexusNova Security Lock v3
   Genuine browser-side NexusNova PIN lock using Web Crypto PBKDF2.
   - No raw PIN is stored.
   - No browser prompt() setup flow.
   - Existing v1/v2 PIN records remain compatible with the legacy KDF.
   - New locks use a stronger KDF, retry backoff and background auto re-lock.
   Android biometric/device credential remains a native upgrade. */
(() => {
  'use strict';
  if (window.__nxSecurityLockV2) return;
  window.__nxSecurityLockV2 = true;
  window.__nxSecurityLockV1 = true;
  window.nexusSecurityLockVersion = 'browser-pin-v3';

  const KEY = 'nexusnova_browser_app_lock_v1';
  const LEGACY_KDF_ITERATIONS = 140000;
  const CURRENT_KDF_ITERATIONS = 600000;
  const AUTO_RELOCK_AFTER_HIDDEN_MS = 60 * 1000;
  const MAX_BACKOFF_MS = 60 * 1000;
  const $ = id => document.getElementById(id);
  let setupPromise = null;
  let failedAttempts = 0;
  let blockedUntil = 0;
  let hiddenAt = 0;

  function bytesToB64(bytes) {
    let text = '';
    bytes.forEach(b => { text += String.fromCharCode(b); });
    return btoa(text);
  }

  function b64ToBytes(value) {
    const text = atob(String(value || ''));
    return Uint8Array.from(text, c => c.charCodeAt(0));
  }

  async function pinHash(pin, salt, iterations) {
    const rounds = Number(iterations);
    if (![LEGACY_KDF_ITERATIONS, CURRENT_KDF_ITERATIONS].includes(rounds)) {
      throw new Error('Unsupported App Lock security parameters.');
    }
    const material = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(pin),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name:'PBKDF2', salt, iterations:rounds, hash:'SHA-256' },
      material,
      256
    );
    return bytesToB64(new Uint8Array(bits));
  }

  function readConfig() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!value || typeof value !== 'object' || !value.salt || !value.hash) return null;
      return value;
    } catch (_) {
      return null;
    }
  }

  function validLegacyPin(pin) {
    return /^\d{4,12}$/.test(String(pin || ''));
  }

  function validNewPin(pin) {
    return /^\d{6,12}$/.test(String(pin || ''));
  }

  function remainingBackoffMs() {
    return Math.max(0, blockedUntil - Date.now());
  }

  function recordFailedAttempt() {
    failedAttempts += 1;
    if (failedAttempts < 3) return;
    const exponent = Math.min(5, failedAttempts - 3);
    const delay = Math.min(MAX_BACKOFF_MS, 2000 * (2 ** exponent));
    blockedUntil = Date.now() + delay;
  }

  function resetAttemptState() {
    failedAttempts = 0;
    blockedUntil = 0;
  }

  async function verify(pin) {
    if (remainingBackoffMs() > 0) return false;
    const config = readConfig();
    if (!config || !validLegacyPin(pin) || !crypto?.subtle) {
      recordFailedAttempt();
      return false;
    }
    try {
      const salt = b64ToBytes(config.salt);
      if (salt.length !== 16) throw new Error('Invalid App Lock salt.');
      const iterations = config.kdfIterations == null
        ? LEGACY_KDF_ITERATIONS
        : Number(config.kdfIterations);
      const hash = await pinHash(pin, salt, iterations);
      const ok = hash === config.hash;
      if (ok) resetAttemptState();
      else recordFailedAttempt();
      return ok;
    } catch (_) {
      recordFailedAttempt();
      return false;
    }
  }

  function installStyles() {
    if ($('nxSecurityLockStyles')) return;
    const style = document.createElement('style');
    style.id = 'nxSecurityLockStyles';
    style.textContent = `
      .nx-lock-backdrop{position:fixed;inset:0;z-index:2147483646;display:none;align-items:center;justify-content:center;padding:18px;background:radial-gradient(circle at 50% 14%,rgba(32,121,255,.18),transparent 38%),rgba(2,6,23,.95);backdrop-filter:blur(16px)}
      .nx-lock-card{width:min(94vw,410px);padding:22px;border-radius:25px;background:linear-gradient(145deg,#0f1f38,#071225);border:1px solid rgba(91,173,255,.25);box-shadow:0 28px 80px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,255,255,.06);color:#f8fbff}
      .nx-lock-orb{width:58px;height:58px;border-radius:18px;display:grid;place-items:center;font-size:28px;background:linear-gradient(145deg,#176eff,#48c2ff);box-shadow:0 12px 28px rgba(20,120,255,.3)}
      .nx-lock-card h2{margin:12px 0 5px;font-size:22px}.nx-lock-card p{margin:0 0 14px;color:#8ea7c1;font-size:12px;line-height:1.55}
      .nx-lock-input{width:100%;box-sizing:border-box;margin-top:9px;padding:12px 13px;border-radius:13px;border:1px solid rgba(123,171,226,.22);outline:0;background:#020b18;color:#fff;font:inherit}.nx-lock-input:focus{border-color:#4ca7ff;box-shadow:0 0 0 3px rgba(38,134,255,.14)}
      .nx-lock-actions{display:flex;gap:8px;margin-top:12px}.nx-lock-btn{flex:1;padding:11px 10px;border-radius:13px;border:1px solid rgba(148,163,184,.22);background:#0b1930;color:#dcecff;font-weight:900;cursor:pointer}.nx-lock-btn.primary{border:0;background:linear-gradient(135deg,#126dff,#3eb8ff);color:#fff}.nx-lock-status{min-height:18px;margin-top:9px;color:#ff95a6;font-size:11px;font-weight:700}.nx-lock-note{margin-top:10px;color:#7089a4;font-size:10px;line-height:1.5}
    `;
    document.head.appendChild(style);
  }

  function showOverlay(node) {
    installStyles();
    node.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function hideOverlay(node) {
    if (!node) return;
    node.style.display = 'none';
    document.body.style.removeProperty('overflow');
  }

  function ensureSetupOverlay() {
    let overlay = $('nxAppLockSetupOverlay');
    if (overlay) return overlay;
    installStyles();
    overlay = document.createElement('div');
    overlay.id = 'nxAppLockSetupOverlay';
    overlay.className = 'nx-lock-backdrop';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.innerHTML = `
      <div class="nx-lock-card">
        <div class="nx-lock-orb">🔐</div>
        <h2>Enable NexusNova App Lock</h2>
        <p>Create a 6–12 digit PIN for this browser. The raw PIN is never stored; only a PBKDF2 hash and random salt are saved locally.</p>
        <input id="nxAppLockSetupPin" class="nx-lock-input" type="password" inputmode="numeric" pattern="[0-9]*" minlength="6" maxlength="12" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="New 6–12 digit PIN">
        <input id="nxAppLockSetupConfirm" class="nx-lock-input" type="password" inputmode="numeric" pattern="[0-9]*" minlength="6" maxlength="12" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Confirm PIN">
        <div class="nx-lock-actions"><button id="nxAppLockSetupCancel" class="nx-lock-btn" type="button">Cancel</button><button id="nxAppLockSetupSave" class="nx-lock-btn primary" type="button">Enable Lock</button></div>
        <div id="nxAppLockSetupStatus" class="nx-lock-status"></div>
        <div class="nx-lock-note">Keep this PIN safe. NexusNova cannot recover it. This is a browser-side app lock, not your phone's device PIN or biometric credential.</div>
      </div>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function setup() {
    if (readConfig()) {
      lock();
      return Promise.resolve(true);
    }
    if (!crypto?.subtle) {
      window.NexusNovaUI?.toast?.('Secure browser cryptography is unavailable here.');
      return Promise.resolve(false);
    }
    if (setupPromise) return setupPromise;

    const overlay = ensureSetupOverlay();
    const pinInput = $('nxAppLockSetupPin');
    const confirmInput = $('nxAppLockSetupConfirm');
    const status = $('nxAppLockSetupStatus');
    const save = $('nxAppLockSetupSave');
    const cancel = $('nxAppLockSetupCancel');
    if (pinInput) pinInput.value = '';
    if (confirmInput) confirmInput.value = '';
    if (status) status.textContent = '';
    showOverlay(overlay);
    setTimeout(() => pinInput?.focus(), 60);

    setupPromise = new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        save?.removeEventListener('click', submit);
        cancel?.removeEventListener('click', cancelSetup);
        pinInput?.removeEventListener('keydown', onKey);
        confirmInput?.removeEventListener('keydown', onKey);
        hideOverlay(overlay);
        setupPromise = null;
        resolve(value);
      };
      const cancelSetup = () => finish(false);
      const onKey = event => {
        if (event.key === 'Escape') cancelSetup();
        if (event.key === 'Enter') submit();
      };
      const submit = async () => {
        const first = String(pinInput?.value || '');
        const second = String(confirmInput?.value || '');
        if (!validNewPin(first)) {
          if (status) status.textContent = 'New PIN must contain 6–12 digits.';
          return;
        }
        if (second !== first) {
          if (status) status.textContent = 'PIN confirmation does not match.';
          return;
        }
        if (save) save.disabled = true;
        try {
          const salt = crypto.getRandomValues(new Uint8Array(16));
          const hash = await pinHash(first, salt, CURRENT_KDF_ITERATIONS);
          localStorage.setItem(KEY, JSON.stringify({
            salt:bytesToB64(salt),
            hash,
            kdfIterations:CURRENT_KDF_ITERATIONS,
            createdAt:Date.now(),
            version:3
          }));
          if (pinInput) pinInput.value = '';
          if (confirmInput) confirmInput.value = '';
          finish(true);
          lock();
        } catch (error) {
          console.warn('NexusNova App Lock setup:', error);
          if (status) status.textContent = 'Could not enable App Lock in this browser.';
        } finally {
          if (save) save.disabled = false;
        }
      };
      save?.addEventListener('click', submit);
      cancel?.addEventListener('click', cancelSetup);
      pinInput?.addEventListener('keydown', onKey);
      confirmInput?.addEventListener('keydown', onKey);
    });
    return setupPromise;
  }

  function ensureLockOverlay() {
    let overlay = $('nxAppLockOverlay');
    if (overlay) return overlay;
    installStyles();
    overlay = document.createElement('div');
    overlay.id = 'nxAppLockOverlay';
    overlay.className = 'nx-lock-backdrop';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.innerHTML = `
      <div class="nx-lock-card">
        <div class="nx-lock-orb">🔐</div>
        <h2>NexusNova Locked</h2>
        <p>Enter your NexusNova browser App Lock PIN to unlock this session.</p>
        <input id="nxAppLockPin" class="nx-lock-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="12" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="NexusNova PIN">
        <button id="nxAppUnlockBtn" class="nx-lock-btn primary" type="button" style="width:100%;margin-top:10px">Unlock</button>
        <button id="nxAppRemoveLockBtn" class="nx-lock-btn" type="button" style="width:100%;margin-top:8px">Remove App Lock</button>
        <div id="nxAppLockStatus" class="nx-lock-status"></div>
        <div class="nx-lock-note">This PIN is local to NexusNova in this browser. Android biometric/device credential support is a separate native feature.</div>
      </div>`;
    document.body.appendChild(overlay);

    const unlock = async () => {
      const pinInput = $('nxAppLockPin');
      const pin = String(pinInput?.value || '');
      const status = $('nxAppLockStatus');
      if (await verify(pin)) {
        if (pinInput) pinInput.value = '';
        if (status) status.textContent = '';
        delete overlay.dataset.removeConfirmUntil;
        hideOverlay(overlay);
      } else {
        if (pinInput) pinInput.value = '';
        const waitMs = remainingBackoffMs();
        if (status) {
          status.textContent = waitMs > 0
            ? `Too many attempts. Try again in ${Math.ceil(waitMs / 1000)} seconds.`
            : 'Wrong NexusNova PIN.';
        }
      }
    };

    $('nxAppUnlockBtn')?.addEventListener('click', unlock);
    $('nxAppLockPin')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') unlock();
    });
    $('nxAppRemoveLockBtn')?.addEventListener('click', async () => {
      const pin = String($('nxAppLockPin')?.value || '');
      const status = $('nxAppLockStatus');
      if (!(await verify(pin))) {
        if ($('nxAppLockPin')) $('nxAppLockPin').value = '';
        const waitMs = remainingBackoffMs();
        if (status) {
          status.textContent = waitMs > 0
            ? `Too many attempts. Try again in ${Math.ceil(waitMs / 1000)} seconds.`
            : 'Enter the correct NexusNova PIN before removing App Lock.';
        }
        return;
      }
      const current = Date.now();
      const confirmUntil = Number(overlay.dataset.removeConfirmUntil || 0);
      if (confirmUntil < current) {
        overlay.dataset.removeConfirmUntil = String(current + 6000);
        if (status) status.textContent = 'PIN verified. Tap “Remove App Lock” again within 6 seconds to confirm.';
        return;
      }
      localStorage.removeItem(KEY);
      delete overlay.dataset.removeConfirmUntil;
      if ($('nxAppLockPin')) $('nxAppLockPin').value = '';
      if (status) status.textContent = '';
      hideOverlay(overlay);
      window.NexusNovaUI?.toast?.('NexusNova browser App Lock removed.');
    });
    return overlay;
  }

  function lock() {
    if (!readConfig()) return setup();
    const overlay = ensureLockOverlay();
    showOverlay(overlay);
    if ($('nxAppLockPin')) $('nxAppLockPin').value = '';
    if ($('nxAppLockStatus')) $('nxAppLockStatus').textContent = '';
    delete overlay.dataset.removeConfirmUntil;
    setTimeout(() => $('nxAppLockPin')?.focus(), 50);
    return true;
  }

  function findAppLockButton() {
    return Array.from(document.querySelectorAll('#tab-mega-security button')).find(button =>
      String(button.textContent || '').replace(/\s+/g,' ').trim().toLowerCase() === 'app lock'
    );
  }

  function install() {
    const button = findAppLockButton();
    if (button && button.dataset.nxSecurityLockReady !== '1') {
      button.onclick = null;
      button.dataset.nxSecurityLockReady = '1';
      button.id = 'nxSecurityAppLock';
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (readConfig()) lock();
        else setup();
      });
    }
    return Boolean(button);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      return;
    }
    const wasHiddenAt = hiddenAt;
    hiddenAt = 0;
    if (
      readConfig() &&
      wasHiddenAt > 0 &&
      Date.now() - wasHiddenAt >= AUTO_RELOCK_AFTER_HIDDEN_MS
    ) {
      lock();
    }
  });

  window.nexusLockAppNow = lock;
  window.nexusSecurityLock = Object.freeze({
    version:'browser-pin-v3',
    install,
    setup,
    lock,
    configured:() => Boolean(readConfig())
  });

  const boot = () => {
    install();
    [900,2000,4000,7000].forEach(ms => setTimeout(install, ms));
    if (readConfig()) setTimeout(lock, 1300);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();