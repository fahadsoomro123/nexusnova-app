const listeners = new Set();
let status = {
  configured: typeof window.NexusAndroid?.postMessage === 'function',
  sdkReady: false,
  rewardedReady: false,
  interstitialReady: false,
  // Conservative startup default: never assume TEST mode before native status arrives.
  testMode: false,
  ssvIdentityReady: false
};

function post(action, payload = {}) {
  try {
    if (typeof window.nexusPostNativeAction === 'function') {
      return window.nexusPostNativeAction(action, payload);
    }
    if (typeof window.NexusAndroid?.postMessage !== 'function') return false;
    window.NexusAndroid.postMessage(JSON.stringify({ action, ...payload }));
    return true;
  } catch (error) {
    console.warn('[NexusNova Fresh] native ad post:', error);
    return false;
  }
}

function emit(detail) {
  listeners.forEach(listener => {
    try { listener(detail); } catch (error) { console.error(error); }
  });
}

window.addEventListener('nexusnova:native-ad-event', event => {
  const detail = event?.detail || {};
  if (String(detail.provider || '') !== 'admob') return;
  const type = String(detail.event || '');
  if (type === 'status') {
    status = {
      configured: true,
      sdkReady: detail.sdkReady === true,
      rewardedReady: detail.rewardedReady === true,
      interstitialReady: detail.interstitialReady === true,
      testMode: detail.testMode === true,
      ssvIdentityReady: detail.ssvIdentityReady === true
    };
  } else if (type === 'rewarded-ready') status.rewardedReady = true;
  else if (['rewarded-showing','rewarded-opened'].includes(type)) status.rewardedReady = false;
  else if (type === 'interstitial-ready') status.interstitialReady = true;
  else if (['interstitial-showing','interstitial-opened'].includes(type)) status.interstitialReady = false;
  emit(detail);
});

export const nativeAds = {
  status() { return { ...status }; },

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  requestStatus() {
    status.configured = post('adStatus') || status.configured;
    return status.configured;
  },

  async showRewarded({ purpose, userId = '', timeoutMs = 55_000 } = {}) {
    const rewardPurpose = String(purpose || '').slice(0, 80);
    if (!rewardPurpose) throw new Error('Reward purpose is required.');
    const testOnly = status.testMode === true;
    if (!post('showRewardedAd', { rewardPurpose, userId: String(userId || '').slice(0,128), testOnly })) {
      throw new Error('Rewarded ads require the NexusNova Android app.');
    }

    return new Promise((resolve, reject) => {
      let earned = false;
      let settled = false;
      const finish = result => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        off();
        resolve(result);
      };
      const fail = message => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        off();
        reject(new Error(message));
      };
      const off = this.subscribe(detail => {
        if (String(detail.rewardPurpose || '') !== rewardPurpose) return;
        const type = String(detail.event || '');
        if (type === 'rewarded-earned') {
          earned = true;
          return;
        }
        if (type === 'rewarded-dismissed') {
          finish({ earned, testMode: detail.testMode === true, detail });
          return;
        }
        if (['rewarded-unavailable','rewarded-load-failed','rewarded-failed'].includes(type)) {
          fail(String(detail.message || detail.reason || 'Rewarded ad unavailable.'));
        }
      });
      const timer = setTimeout(() => fail('Rewarded ad timed out. Try again later.'), timeoutMs);
    });
  },

  showInterstitial({ placement = 'natural-transition', feature = '' } = {}) {
    return post('showInterstitialAd', {
      placement: String(placement).slice(0,80),
      feature: String(feature).slice(0,80),
      testOnly: status.testMode === true
    });
  }
};

nativeAds.requestStatus();
