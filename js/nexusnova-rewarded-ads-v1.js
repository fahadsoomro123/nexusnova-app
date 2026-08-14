/* NexusNova Rewarded Ads v1
   Provider-ready ayeT Rewarded Video bridge for the web app.

   Security model:
   - The browser may display an ad and receive a client-side completion signal.
   - The browser NEVER credits NVX and NEVER mutates the user's balance.
   - Final reward fulfillment must come from ayeT Server2Server callbacks after
     HMAC verification and transaction-id deduplication on a trusted backend.
   - No publisher API key or backend secret belongs in this file.
*/
(() => {
  'use strict';
  if (window.__nxRewardedAdsV1) return;
  window.__nxRewardedAdsV1 = true;

  const SDK_SRC = 'https://cdn.ayet.io/offerwall/js/ayetvideosdk.min.js';
  const $ = id => document.getElementById(id);
  let sdkPromise = null;
  let initKey = '';
  let operationPromise = null;
  let activeUid = '';
  let clientGrantSeen = false;

  function meta(name) {
    return String(document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || '').trim();
  }

  function config() {
    const placementRaw = meta('nexusnova-ayet-placement-id');
    const placementId = Number(placementRaw);
    return {
      provider: (meta('nexusnova-rewarded-provider') || 'ayet').toLowerCase(),
      placementId: Number.isInteger(placementId) && placementId > 0 ? placementId : 0,
      adslotName: meta('nexusnova-ayet-adslot-name'),
      rewardLabel: meta('nexusnova-rewarded-reward-label') || '+2.5 NVX'
    };
  }

  function setStatus(text, state = '') {
    const status = $('rewardedAdStatus');
    if (status) {
      status.textContent = text;
      status.dataset.state = state;
    }
    const button = $('rewardedAdBtn') || Array.from(document.querySelectorAll('#tab-tasks button'))
      .find(el => /watch\s*ad/i.test(String(el.textContent || '')));
    if (button) button.dataset.nxRewardState = state || 'idle';
  }

  async function message({title, text, icon = 'spark', buttonText = 'Got it'}) {
    try {
      if (window.NexusNovaUI?.alert) {
        await window.NexusNovaUI.alert({
          eyebrow: 'WATCH AD BONUS', title, text, icon, buttonText
        });
        return;
      }
    } catch (_) {}
    console.info(`Rewarded Ads — ${title}: ${text}`);
  }

  async function getVerifiedUid() {
    // A localhost-only hook exists solely for the CI browser test. It is never
    // honored on deployed hosts.
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && window.__NX_REWARDED_TEST_UID) {
      return String(window.__NX_REWARDED_TEST_UID);
    }

    const [appMod, authMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js')
    ]);
    const apps = appMod.getApps();
    if (!apps.length) throw new Error('Firebase app is not initialized.');
    const auth = authMod.getAuth(apps[0]);
    let user = auth.currentUser;
    if (!user) {
      user = await new Promise(resolve => {
        let done = false;
        const stop = authMod.onAuthStateChanged(auth, value => {
          if (done) return;
          done = true;
          stop();
          resolve(value || null);
        });
        setTimeout(() => {
          if (done) return;
          done = true;
          stop();
          resolve(auth.currentUser || null);
        }, 3000);
      });
    }
    if (!user) throw new Error('Please sign in before watching a rewarded ad.');
    await user.reload();
    user = auth.currentUser || user;
    if (!user.emailVerified) throw new Error('Verify your email before earning rewarded-ad bonuses.');
    return String(user.uid || '');
  }

  function loadSdk() {
    if (window.AyetVideoSdk) return Promise.resolve(window.AyetVideoSdk);
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-nx-ayet-sdk]');
      if (existing) {
        const started = Date.now();
        const timer = setInterval(() => {
          if (window.AyetVideoSdk) {
            clearInterval(timer);
            resolve(window.AyetVideoSdk);
          } else if (Date.now() - started > 12000) {
            clearInterval(timer);
            reject(new Error('Rewarded-ad SDK timed out.'));
          }
        }, 100);
        return;
      }
      const script = document.createElement('script');
      script.src = SDK_SRC;
      script.async = true;
      script.dataset.nxAyetSdk = '1';
      script.onload = () => window.AyetVideoSdk
        ? resolve(window.AyetVideoSdk)
        : reject(new Error('Rewarded-ad SDK did not initialize.'));
      script.onerror = () => reject(new Error('Rewarded-ad SDK could not load. Check connection or ad blocker.'));
      document.head.appendChild(script);
    }).catch(error => {
      sdkPromise = null;
      throw error;
    });
    return sdkPromise;
  }

  function installCallbacks(sdk, uid, rewardLabel) {
    activeUid = uid;
    clientGrantSeen = false;

    sdk.callbackPlaying = function() {
      setStatus('Ad playing • reward only after verified completion', 'playing');
    };

    sdk.callbackProgress = function(remainingSeconds) {
      const seconds = Math.max(0, Math.round(Number(remainingSeconds) || 0));
      setStatus(`Ad playing • ${seconds}s remaining`, 'playing');
    };

    sdk.callbackComplete = function() {
      setStatus('Ad completed • checking reward verification…', 'verifying');
    };

    sdk.callbackRewarded = function(details) {
      const response = details && typeof details === 'object' ? details : {};
      const sameUser = String(response.externalIdentifier || '') === String(activeUid || '');
      const rewarded = response.rewarded === true && String(response.status || '').toLowerCase() === 'success';
      if (!sameUser || !rewarded) {
        console.warn('NexusNova rewarded-ad client callback rejected:', response);
        setStatus('Ad callback could not be matched to this account.', 'error');
        return;
      }

      // IMPORTANT: This signal is intentionally UX-only. Client callbacks are
      // not authoritative. The S2S callback must verify HMAC + transaction ID
      // and credit the user's account from a trusted backend.
      clientGrantSeen = true;
      window.__nexusRewardedLastClientGrant = {
        conversionId: String(response.conversionId || ''),
        receivedAt: Date.now()
      };
      setStatus(`${rewardLabel} pending secure server verification`, 'verifying');
      message({
        title: 'Ad Completed',
        text: `${rewardLabel} is pending secure server verification. Your balance will update automatically after the verified callback arrives.`,
        icon: 'security',
        buttonText: 'OK'
      });
    };

    sdk.callbackError = function(error) {
      console.warn('NexusNova rewarded-ad provider:', error);
      setStatus('Ad could not finish • no reward was issued', 'error');
    };
  }

  function requestAd(sdk, adslotName) {
    return new Promise((resolve, reject) => {
      sdk.requestAd(
        adslotName,
        () => resolve(true),
        message => reject(new Error(String(message || 'No rewarded ad is available right now.')))
      );
    });
  }

  async function show() {
    if (operationPromise) return operationPromise;
    const button = $('rewardedAdBtn') || Array.from(document.querySelectorAll('#tab-tasks button'))
      .find(el => /watch\s*ad/i.test(String(el.textContent || '')));
    if (button) button.disabled = true;

    operationPromise = (async () => {
      const cfg = config();
      if (cfg.provider !== 'ayet') {
        throw new Error('Rewarded-ad provider configuration is not supported.');
      }
      if (!cfg.placementId || !cfg.adslotName) {
        setStatus('Provider setup required • no fake reward will be issued', 'provider-pending');
        await message({
          title: 'Rewarded Ads Setup Pending',
          text: 'The secure rewarded-ad bridge is ready, but the publisher Placement ID and Rewarded Video AdSlot still need to be connected by the app owner.',
          icon: 'security'
        });
        return {shown:false, configured:false};
      }

      const uid = await getVerifiedUid();
      if (!uid || uid.length < 3 || uid.length > 128) throw new Error('Account identifier is invalid for rewarded ads.');

      setStatus('Finding a rewarded video…', 'loading');
      const sdk = await loadSdk();
      installCallbacks(sdk, uid, cfg.rewardLabel);

      const key = `${cfg.placementId}:${uid}`;
      if (initKey !== key) {
        await sdk.init(cfg.placementId, uid, 'nexusnova-web');
        initKey = key;
      }

      if (typeof sdk.setCustomParameter === 'function') {
        sdk.setCustomParameter('custom_1', 'nexusnova_web');
      }

      await requestAd(sdk, cfg.adslotName);
      setStatus('Ad ready • starting…', 'ready');
      sdk.playFullsizeAd();
      return {shown:true, configured:true};
    })().catch(async error => {
      console.warn('NexusNova rewarded ads:', error);
      const raw = String(error?.message || error || 'Rewarded ad unavailable.');
      const friendly = /no fill/i.test(raw)
        ? 'No rewarded video is available for you right now. Try again later; no reward was issued.'
        : /cap reached/i.test(raw)
          ? 'Your rewarded-video limit has been reached for now. Try again later.'
          : raw;
      setStatus('Rewarded ad unavailable • no reward issued', 'error');
      await message({title:'Ad Unavailable', text:friendly, icon:'security'});
      return {shown:false, configured:Boolean(config().placementId && config().adslotName), error:friendly};
    }).finally(() => {
      if (button) button.disabled = false;
      operationPromise = null;
    });

    return operationPromise;
  }

  function status() {
    const cfg = config();
    return {
      provider: cfg.provider,
      configured: Boolean(cfg.placementId && cfg.adslotName),
      placementId: cfg.placementId || null,
      adslotName: cfg.adslotName || '',
      clientGrantSeen
    };
  }

  window.NexusNovaRewardedAds = { show, status };
  window.watchAdReward = show;

  const cfg = config();
  setStatus(
    cfg.placementId && cfg.adslotName
      ? 'Secure rewarded video ready'
      : 'Secure ad bridge ready • publisher setup pending',
    cfg.placementId && cfg.adslotName ? 'ready' : 'provider-pending'
  );

  console.info('NexusNova rewarded ads loaded: ayet-s2s-ready-v1');
})();
