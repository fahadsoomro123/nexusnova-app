/* NexusNova Rewarded Ads compatibility loader v3.1.
   Native AdMob rewarded ads are TEST/value-free until server ad proof is live.
   Real -2H Booster/Rain value comes only from server-owned Nova Vault inventory.
   Legacy ayeT server code remains dormant for historical compatibility only.
*/
(() => {
  'use strict';
  if (window.__nxRewardedAdsV3Loader) return;
  window.__nxRewardedAdsV3Loader = true;

  let loaderPromise = null;

  function bridgeReady() {
    return window.__nxAdMobMiningBoostV1 === true &&
      typeof window.NexusNovaRewardedAds?.show === 'function';
  }

  function loadNativeBridge() {
    if (bridgeReady()) return Promise.resolve(window.NexusNovaRewardedAds);
    if (loaderPromise) return loaderPromise;

    loaderPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-nx-admob-mining-boost-v1]') ||
        document.querySelector('script[data-nx-admob-nexus-pass-v1]');
      if (existing) {
        const started = Date.now();
        const timer = setInterval(() => {
          if (bridgeReady()) {
            clearInterval(timer);
            resolve(window.NexusNovaRewardedAds);
          } else if (Date.now() - started > 8000) {
            clearInterval(timer);
            reject(new Error('Native AdMob mining-boost bridge timed out.'));
          }
        }, 50);
        return;
      }

      const script = document.createElement('script');
      // Compatibility filename retained; its implementation is Mining Boost v1.
      script.src = './js/nexusnova-admob-nexus-pass-v1.js?v=mining-boost-1';
      script.dataset.nxAdmobMiningBoostV1 = '1';
      script.onload = () => bridgeReady()
        ? resolve(window.NexusNovaRewardedAds)
        : reject(new Error('Native AdMob mining-boost bridge did not initialize.'));
      script.onerror = () => reject(new Error('Native AdMob mining-boost bridge could not load.'));
      document.body.appendChild(script);
    }).catch(error => {
      loaderPromise = null;
      throw error;
    });

    return loaderPromise;
  }

  async function show(kind) {
    try {
      const bridge = await loadNativeBridge();
      return bridge.show(kind);
    } catch (error) {
      console.warn('NexusNova rewarded ads:', error);
      return {shown:false, native:false, error:String(error?.message || error)};
    }
  }

  // Temporary surface while the same-origin bridge script loads.
  window.NexusNovaRewardedAds = {
    show,
    status: () => ({provider:'admob-native', configured:false, loading:true, rewardPurpose:'mining-boost'}),
    configured: () => false
  };
  window.watchAdReward = () => show();

  loadNativeBridge().catch(error => console.warn('NexusNova AdMob preload:', error));
  console.info('NexusNova rewarded ads loader: admob-native-mining-boost-v3.1');
})();