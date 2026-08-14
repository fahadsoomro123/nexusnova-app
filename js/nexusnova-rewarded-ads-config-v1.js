/* NexusNova Rewarded Ads public configuration.
   These values are public placement identifiers, NOT secrets.
   Publisher API keys / HMAC secrets must never be placed here or committed. */
(() => {
  'use strict';
  if (window.__nxRewardedAdsConfigV1) return;
  window.__nxRewardedAdsConfigV1 = true;

  const config = {
    provider: 'ayet',
    placementId: '',
    adslotName: '',
    rewardLabel: '+2.5 NVX'
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
  setMeta('nexusnova-ayet-placement-id', config.placementId);
  setMeta('nexusnova-ayet-adslot-name', config.adslotName);
  setMeta('nexusnova-rewarded-reward-label', config.rewardLabel);

  window.NEXUSNOVA_REWARDED_ADS_PUBLIC_CONFIG = Object.freeze({...config});
})();
