/* NexusNova Android offline fallback guard.
 *
 * The Android wrapper normally loads the tested production NexusNova origin,
 * where the single-owner Firestore mining engine runs with production App
 * Check. This bundled page is only an offline utility fallback. Value-bearing
 * mining/reward actions are deliberately disabled here rather than running an
 * obsolete Cloud Functions or local-origin App Check flow.
 */
(() => {
  'use strict';
  const ONLINE_URL = 'https://fahadsoomro123.github.io/nexusnova-app/';

  function renderOfflineMining() {
    const button = document.getElementById('mineBtn');
    const text = document.getElementById('btnText');
    const timer = document.getElementById('timer');
    if (button) {
      button.dataset.state = 'locked';
      button.classList.remove('active');
    }
    if (text) text.textContent = 'ONLINE MINING REQUIRED';
    if (timer) timer.textContent = 'CONNECT TO INTERNET';
  }

  function openOnlineApp() {
    try {
      window.location.assign(ONLINE_URL);
    } catch (_) {}
  }

  async function unavailable() {
    renderOfflineMining();
    const message = 'Secure NVX mining and rewards require the online NexusNova app. Connect to the internet and retry.';
    if (window.NexusNovaUI?.alert) {
      try {
        await window.NexusNovaUI.alert({
          eyebrow:'OFFLINE MODE',
          title:'Online Connection Required',
          text:message,
          icon:'security',
          buttonText:'Open Online App'
        });
      } catch (_) {}
    }
    openOnlineApp();
    throw new Error(message);
  }

  window.nexusSecureStartMining = unavailable;
  window.nexusSecureFinishMining = unavailable;
  window.nexusSecureClaimDaily = unavailable;
  window.nexusSecureCompleteTask = unavailable;
  window.nexusSecureRenderMining = renderOfflineMining;
  window.claimDailyReward = unavailable;
  window.completeTask = unavailable;
  window.nexusMiningEngineVersion = 'android-offline-guard-v1';

  const install = () => {
    renderOfflineMining();
    const button = document.getElementById('mineBtn');
    if (button) button.onclick = unavailable;
  };

  install();
  window.addEventListener('load', install, {once:true});
  console.info('NexusNova Android offline fallback: value-bearing actions disabled.');
})();
