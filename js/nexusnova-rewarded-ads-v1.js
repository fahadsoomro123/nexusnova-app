/* NexusNova Rewarded Ads compatibility loader v2.
   The active Android provider is native AdMob + Nexus Pass.
   Legacy ayeT server code remains dormant for historical compatibility only.
*/
(() => {
  'use strict';
  if (window.__nxRewardedAdsV2Loader) return;
  window.__nxRewardedAdsV2Loader = true;

  let loaderPromise = null;

  function loadNativeBridge() {
    if (window.__nxAdMobNexusPassV1 && window.NexusNovaRewardedAds?.show) {
      return Promise.resolve(window.NexusNovaRewardedAds);
    }
    if (loaderPromise) return loaderPromise;

    loaderPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-nx-admob-nexus-pass-v1]');
      if (existing) {
        const started = Date.now();
        const timer = setInterval(() => {
          if (window.__nxAdMobNexusPassV1 && window.NexusNovaRewardedAds?.show) {
            clearInterval(timer);
            resolve(window.NexusNovaRewardedAds);
          } else if (Date.now() - started > 8000) {
            clearInterval(timer);
            reject(new Error('Native AdMob bridge timed out.'));
          }
        }, 50);
        return;
      }

      const script = document.createElement('script');
      script.src = './js/nexusnova-admob-nexus-pass-v1.js?v=1';
      script.dataset.nxAdmobNexusPassV1 = '1';
      script.onload = () => window.NexusNovaRewardedAds?.show
        ? resolve(window.NexusNovaRewardedAds)
        : reject(new Error('Native AdMob bridge did not initialize.'));
      script.onerror = () => reject(new Error('Native AdMob bridge could not load.'));
      document.body.appendChild(script);
    }).catch(error => {
      loaderPromise = null;
      throw error;
    });

    return loaderPromise;
  }

  async function show() {
    try {
      const bridge = await loadNativeBridge();
      return bridge.show();
    } catch (error) {
      console.warn('NexusNova rewarded ads:', error);
      return {shown:false, native:false, error:String(error?.message || error)};
    }
  }

  // Temporary surface used only while the same-origin native bridge script is
  // loading. The bridge replaces this object as soon as it initializes.
  window.NexusNovaRewardedAds = {
    show,
    status: () => ({provider:'admob-native', configured:false, loading:true}),
    configured: () => false
  };
  window.watchAdReward = show;

  loadNativeBridge().catch(error => console.warn('NexusNova AdMob preload:', error));
  console.info('NexusNova rewarded ads loader: admob-native-v2');
})();
