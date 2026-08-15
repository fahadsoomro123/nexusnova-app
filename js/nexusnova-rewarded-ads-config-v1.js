/* NexusNova Rewarded Ads public configuration.
   Public provider identifiers only; no publisher secret belongs in web code. */
(() => {
  'use strict';
  if (window.__nxRewardedAdsConfigV1) return;
  window.__nxRewardedAdsConfigV1 = true;

  const config = {
    provider: 'admob-native',
    placementId: '',
    adslotName: '',
    rewardLabel: '20 min Nexus Pass'
  };

  function setMeta(name, value) {
    let node = document.querySelector(`meta[name="${name}"]`);
    if (!node) {
      node = document.createElement('meta');
      node.setAttribute('name', name);
      document.head.appendChild(node);
    }
    node.setAttribute('content', String(value ?? ''));
  }

  setMeta('nexusnova-rewarded-provider', config.provider);
  // Legacy ayeT slots remain deliberately blank/dormant. NexusNova now routes
  // rewarded ads through the origin-bound native Android AdMob bridge.
  setMeta('nexusnova-ayet-placement-id', config.placementId);
  setMeta('nexusnova-ayet-adslot-name', config.adslotName);
  setMeta('nexusnova-rewarded-reward-label', config.rewardLabel);

  window.NEXUSNOVA_REWARDED_ADS_PUBLIC_CONFIG = Object.freeze({...config});
})();
