/* NexusNova Profile Display Guard v1
   Preserves a real referral value already rendered by the final Firestore profile layer. */
(() => {
  'use strict';
  if (window.__nxProfileDisplayGuardV1) return;
  window.__nxProfileDisplayGuardV1 = true;

  const bad = value => {
    const text = String(value || '').trim();
    if (!text) return true;
    return /^(?:loading|---|not available|unavailable)/i.test(text);
  };

  function storageKey() {
    const uid = String(window.nexusAccountId || '').trim();
    return uid ? `nexusnova_verified_referral_display:${uid}` : '';
  }

  function install() {
    const el = document.getElementById('refCodeDisplay');
    if (!el || el.__nxReferralGuard) return;
    el.__nxReferralGuard = true;

    let trusted = '';
    const key = storageKey();
    if (key) {
      try {
        const saved = String(localStorage.getItem(key) || '').trim();
        if (!bad(saved)) trusted = saved;
      } catch (_) {}
    }

    function check() {
      const value = String(el.textContent || '').trim();
      if (!bad(value)) {
        trusted = value;
        const currentKey = storageKey();
        if (currentKey) {
          try { localStorage.setItem(currentKey, trusted); } catch (_) {}
        }
        return;
      }
      if (trusted && /unavailable/i.test(value)) el.textContent = trusted;
    }

    new MutationObserver(check).observe(el, {childList:true,subtree:true,characterData:true});
    check();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install,600), {once:true});
  else setTimeout(install,600);
  window.addEventListener('nexusaccountready', () => setTimeout(install,100));
})();