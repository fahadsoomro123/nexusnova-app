/* NexusNova fast dashboard launcher v3
   Keep only the Firebase/Auth core on the page-load critical path. This preserves
   the original secure-mining dependency order while optional modules continue
   asynchronously after the document can finish loading.
*/
(() => {
  'use strict';
  if (window.__nxFastDashboardLauncherV3) return;
  window.__nxFastDashboardLauncherV3 = true;

  const SHIELD_ID = 'nxSecureStartupShieldV3';
  const STYLE_ID = 'nxSecureStartupShieldStyleV3';
  let released = false;
  let pollTimer = 0;

  function installShield() {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        #${SHIELD_ID}{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(900px 520px at 50% 15%,rgba(25,105,255,.22),transparent 62%),#020711;color:#eef7ff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;transition:opacity .28s ease,visibility .28s ease}
        #${SHIELD_ID}.nx-release{opacity:0;visibility:hidden;pointer-events:none}
        #${SHIELD_ID} .nx-start-box{text-align:center;max-width:360px;width:100%}
        #${SHIELD_ID} .nx-start-logo{width:72px;height:72px;margin:0 auto 16px;border-radius:22px;display:grid;place-items:center;font-size:34px;font-weight:950;color:#fff;background:linear-gradient(145deg,#1687ff,#4fc8ff);box-shadow:0 0 0 1px rgba(151,222,255,.58),0 18px 45px rgba(0,112,255,.32),inset 0 1px 0 rgba(255,255,255,.45)}
        #${SHIELD_ID} .nx-start-name{font-size:25px;font-weight:900;letter-spacing:-.03em}
        #${SHIELD_ID} .nx-start-name span{color:#55a8ff}
        #${SHIELD_ID} .nx-start-status{margin-top:9px;color:#9fb4cc;font-size:12px;font-weight:700;letter-spacing:.04em}
        #${SHIELD_ID} .nx-start-line{width:150px;height:3px;margin:18px auto 0;border-radius:999px;background:rgba(91,168,255,.14);overflow:hidden}
        #${SHIELD_ID} .nx-start-line i{display:block;width:45%;height:100%;border-radius:inherit;background:linear-gradient(90deg,#238cff,#61d8ff);animation:nxSecureStartupMoveV3 1.2s ease-in-out infinite alternate}
        #${SHIELD_ID} .nx-start-retry{display:none;width:100%;margin-top:18px;padding:12px 14px;border-radius:13px;border:1px solid rgba(94,177,255,.34);background:rgba(11,49,89,.88);color:#fff;font-weight:850}
        #${SHIELD_ID}.nx-delayed .nx-start-retry{display:block}
        @keyframes nxSecureStartupMoveV3{from{transform:translateX(-15%)}to{transform:translateX(135%)}}
      `;
      document.head.appendChild(style);
    }

    if (document.getElementById(SHIELD_ID)) return;
    const shield = document.createElement('div');
    shield.id = SHIELD_ID;
    shield.innerHTML = `
      <div class="nx-start-box">
        <div class="nx-start-logo">N</div>
        <div class="nx-start-name">Nexus<span>Nova</span></div>
        <div class="nx-start-status" id="nxSecureStartupStatusV3">Restoring your secure mining session…</div>
        <div class="nx-start-line"><i></i></div>
        <button type="button" class="nx-start-retry" id="nxSecureStartupRetryV3">RETRY CONNECTION</button>
      </div>`;
    document.body.appendChild(shield);
    shield.querySelector('#nxSecureStartupRetryV3')?.addEventListener('click', () => window.location.reload());
  }

  function miningIsAuthoritative() {
    const button = document.getElementById('mineBtn');
    const text = String(document.getElementById('btnText')?.textContent || '').trim().toUpperCase();
    const timer = String(document.getElementById('timer')?.textContent || '').trim().toUpperCase();

    if (window.__nxPage2AfterCoreReadyV2 !== true) return false;
    if (window.__nexusSecureRewardsSingleOwner !== true) return false;
    if (!button?.classList.contains('nx-future-miner')) return false;
    if (!text) return false;
    if (text.includes('SYNCING MINING')) return false;
    if (timer.includes('CHECKING SECURE SESSION')) return false;
    return true;
  }

  function releaseShield() {
    if (released) return;
    released = true;
    if (pollTimer) clearInterval(pollTimer);
    const shield = document.getElementById(SHIELD_ID);
    if (!shield) return;
    shield.classList.add('nx-release');
    setTimeout(() => shield.remove(), 360);
  }

  function checkReady() {
    if (!released && miningIsAuthoritative()) releaseShield();
  }

  function showDelayed(message) {
    if (released) return;
    const shield = document.getElementById(SHIELD_ID);
    const status = document.getElementById('nxSecureStartupStatusV3');
    if (status) status.textContent = message || 'Secure session is taking longer than expected.';
    shield?.classList.add('nx-delayed');
  }

  function bootShield() {
    installShield();
    checkReady();
    pollTimer = window.setInterval(checkReady, 140);
    window.setTimeout(() => showDelayed('Still connecting securely… your mining data has not been replaced.'), 12000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootShield, { once: true });
  else bootShield();

  window.addEventListener('nexusaccountready', checkReady);
  window.addEventListener('nexusnova:after-core-ready', checkReady);
  window.addEventListener('nexusnova:dashboard-bootstrap-failed', event => {
    showDelayed(String(event?.detail?.message || 'Secure dashboard could not finish loading.'));
  });

  window.NexusNovaStartupV3 = { checkReady, showDelayed };
})();

// CRITICAL: await only the bounded Firebase/Auth core. The secure mining module
// is the next static module in page2.html, so Firebase must exist before this
// module completes. Optional modules are intentionally excluded from this wait.
try {
  await import('./nexusnova-page2-core-launch-v2.js?v=1');
} catch (error) {
  console.error('NexusNova core dashboard bootstrap:', error);
  window.NexusNovaStartupV3?.showDelayed('Secure account initialization failed. Tap Retry Connection.');
}

// Detached optional stack. Starting it before page2.js returns preserves the
// approved module order without keeping Android's main-frame watchdog waiting.
void import('./nexusnova-page2-after-core-v2.js?v=1').catch(error => {
  console.error('NexusNova detached after-core bootstrap:', error);
  window.NexusNovaStartupV3?.showDelayed('Dashboard extras could not finish loading. Tap Retry Connection.');
});
