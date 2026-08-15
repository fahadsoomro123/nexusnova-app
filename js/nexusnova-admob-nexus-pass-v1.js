/* NexusNova AdMob + Nexus Pass bridge v1
   Native Android rewarded ads unlock a non-transferable in-app Nexus Pass.
   Advertiser clicks/installs are never required for the reward.
*/
(() => {
  'use strict';
  if (window.__nxAdMobNexusPassV1) return;
  window.__nxAdMobNexusPassV1 = true;

  const PASS_MINUTES = 20;
  let passExpiresAt = 0;
  let rewardedReady = false;
  let interstitialReady = false;
  let testMode = true;
  let ticker = null;

  const findButton = () => document.getElementById('rewardedAdBtn') ||
    Array.from(document.querySelectorAll('#tab-tasks button'))
      .find(button => /watch\s*ad/i.test(String(button.textContent || '')));

  const hasNative = () => typeof window.NexusAndroid?.postMessage === 'function';

  function post(action, payload = {}) {
    try {
      if (typeof window.nexusPostNativeAction === 'function') {
        return window.nexusPostNativeAction(action, payload);
      }
      if (!hasNative()) return false;
      window.NexusAndroid.postMessage(JSON.stringify({action, ...payload}));
      return true;
    } catch (error) {
      console.warn('NexusNova AdMob native bridge:', error);
      return false;
    }
  }

  function statusNode() {
    let node = document.getElementById('rewardedAdStatus');
    const button = findButton();
    if (!node && button) {
      node = document.createElement('div');
      node.id = 'rewardedAdStatus';
      node.className = 'status';
      node.style.marginTop = '8px';
      node.style.fontSize = '11px';
      button.insertAdjacentElement('afterend', node);
    }
    return node;
  }

  function relabelButton() {
    const button = findButton();
    if (!button) return null;
    button.id = 'rewardedAdBtn';
    const icon = button.querySelector('.mi-icon');
    Array.from(button.childNodes).forEach(node => {
      if (node !== icon) node.remove();
    });
    if (icon) button.appendChild(icon);
    button.appendChild(document.createTextNode(' WATCH AD — UNLOCK 20 MIN NEXUS PASS'));
    button.title = 'Watch an optional rewarded ad to unlock Nexus Pass. Advertiser clicks or installs are not required.';
    return button;
  }

  function remainingText() {
    const ms = Math.max(0, passExpiresAt - Date.now());
    if (!ms) return '';
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function passActive() {
    return passExpiresAt > Date.now();
  }

  function render() {
    relabelButton();
    const node = statusNode();
    if (!node) return;

    if (passActive()) {
      node.textContent = `Nexus Pass ACTIVE • ${remainingText()} remaining`;
      node.dataset.state = 'pass-active';
      return;
    }
    if (!hasNative()) {
      node.textContent = 'Rewarded ads are available inside the NexusNova Android app.';
      node.dataset.state = 'android-only';
      return;
    }
    node.textContent = rewardedReady
      ? `Rewarded ad ready${testMode ? ' • TEST MODE' : ''}`
      : `Preparing rewarded ad…${testMode ? ' • TEST MODE' : ''}`;
    node.dataset.state = rewardedReady ? 'ready' : 'loading';
  }

  async function premiumMessage(title, text, icon = 'spark') {
    try {
      if (window.NexusNovaUI?.alert) {
        await window.NexusNovaUI.alert({
          eyebrow: 'NEXUS PASS', title, text, icon, buttonText: 'OK'
        });
        return;
      }
    } catch (_) {}
    console.info(`Nexus Pass — ${title}: ${text}`);
  }

  async function showRewarded() {
    relabelButton();
    if (!post('showRewardedAd')) {
      await premiumMessage(
        'Android App Required',
        'Rewarded ads run through the secure native NexusNova Android app. No fake reward was issued.',
        'security'
      );
      return {shown:false, native:false};
    }
    const node = statusNode();
    if (node) {
      node.textContent = rewardedReady ? 'Opening rewarded ad…' : 'Rewarded ad is still preparing…';
      node.dataset.state = 'opening';
    }
    return {shown:true, native:true};
  }

  function showInterstitial(reason = 'natural-transition') {
    if (!post('showInterstitialAd', {reason:String(reason).slice(0,80)})) {
      return {shown:false, native:false};
    }
    return {shown:true, native:true};
  }

  function dispatchPassChanged(source = 'native') {
    window.dispatchEvent(new CustomEvent('nexusnova:pass-changed', {
      detail: {
        active: passActive(),
        expiresAt: passExpiresAt,
        remainingMs: Math.max(0, passExpiresAt - Date.now()),
        source
      }
    }));
  }

  function handleNativeEvent(event) {
    const detail = event?.detail || {};
    if (String(detail.provider || '') !== 'admob') return;
    testMode = detail.testMode !== false;

    if (Number.isFinite(Number(detail.passExpiresAt))) {
      passExpiresAt = Math.max(0, Number(detail.passExpiresAt));
    }

    switch (String(detail.event || '')) {
      case 'status':
        rewardedReady = detail.rewardedReady === true;
        interstitialReady = detail.interstitialReady === true;
        dispatchPassChanged('status');
        break;
      case 'rewarded-ready':
        rewardedReady = true;
        break;
      case 'rewarded-showing':
      case 'rewarded-opened':
        rewardedReady = false;
        break;
      case 'rewarded-earned':
        rewardedReady = false;
        dispatchPassChanged('rewarded-ad');
        premiumMessage(
          'Nexus Pass Unlocked',
          `${Number(detail.passMinutes || PASS_MINUTES)} minutes of Nexus Pass access is now active. No advertiser click or install was required.`,
          'spark'
        );
        break;
      case 'rewarded-unavailable':
      case 'rewarded-load-failed':
      case 'rewarded-failed':
        rewardedReady = false;
        premiumMessage(
          'Ad Not Ready',
          'A rewarded ad is not available right now. Try again shortly; no reward was issued.',
          'security'
        );
        break;
      case 'interstitial-ready':
        interstitialReady = true;
        break;
      case 'interstitial-showing':
      case 'interstitial-opened':
        interstitialReady = false;
        break;
      default:
        break;
    }
    render();
  }

  function status() {
    return {
      provider: 'admob-native',
      configured: hasNative(),
      rewardedReady,
      interstitialReady,
      testMode,
      passActive: passActive(),
      passExpiresAt,
      passRemainingMs: Math.max(0, passExpiresAt - Date.now())
    };
  }

  window.addEventListener('nexusnova:native-ad-event', handleNativeEvent);

  window.NexusNovaRewardedAds = {
    show: showRewarded,
    status,
    configured: hasNative
  };
  window.NexusNovaInterstitialAds = {
    show: showInterstitial,
    status
  };
  window.NexusNovaAccessPass = {
    active: passActive,
    expiresAt: () => passExpiresAt,
    remainingMs: () => Math.max(0, passExpiresAt - Date.now())
  };
  window.watchAdReward = showRewarded;

  function install() {
    relabelButton();
    render();
    if (hasNative()) post('adStatus');
    if (!ticker) ticker = setInterval(() => {
      const wasActive = passActive();
      render();
      if (!wasActive && passExpiresAt) {
        passExpiresAt = 0;
        dispatchPassChanged('expired');
      }
    }, 1000);
  }

  install();
  window.addEventListener('load', install, {once:true});
  [250,700,1500,3000].forEach(ms => setTimeout(install, ms));
  console.info('NexusNova ads loaded: admob-native-nexus-pass-v1');
})();
