/* NexusNova Daily Reward Ad Gate v4
   Production-flow wiring on top of the proven Android rewarded-ad owner.

   Contract:
   - A ready Daily Reward can only continue after a completed rewarded ad.
   - The existing secure Firestore +5 NVX transaction remains the only reward writer.
   - Cooldown buttons stay on cooldown; this layer no longer re-enables them for testing.
   - Mining Boost events are ignored by this gate.
   - Ad failures remain inline only; no startup/debug popups.

   NOTE: Android v60 currently uses Google's direct-sold TEST creative so this
   proves the reward flow without risking accidental live-ad traffic. Production
   ad IDs can be enabled later without changing this Daily Reward logic.
*/
(() => {
  'use strict';
  if (window.__nxDailyRewardAdGateV4) return;
  window.__nxDailyRewardAdGateV4 = true;
  window.__nxDailyRewardAdTestV3 = true;
  window.__nxDailyRewardAdTestV2 = true;
  window.__nxDailyRewardAdTestV1 = true;

  const BUTTON_ID = 'dailyBtn';
  const HINT_ID = 'nxDailyAdTestHint';
  const REWARD_PURPOSE = 'daily-reward-test';
  const READY_HINT = 'Watch one rewarded ad to unlock today\'s +5 NVX Daily Reward.';

  let pending = false;
  let earned = false;
  let claimPromise = null;
  let noticeText = '';
  let noticeUntil = 0;
  let observedButton = null;
  let observer = null;
  let lastDiagnostic = null;

  const button = () => document.getElementById(BUTTON_ID);
  const hasNative = () =>
    typeof window.nexusPostNativeAction === 'function' ||
    typeof window.NexusAndroid?.postMessage === 'function';

  function textOf(btn) {
    return String(btn?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function isCooldownButton(btn) {
    return Boolean(btn && /NEXT\s+DAILY\s+BONUS/i.test(textOf(btn)));
  }

  function isReadyButton(btn) {
    const text = textOf(btn);
    return Boolean(
      btn &&
      !isCooldownButton(btn) &&
      (/CLAIM\s+(?:DAILY\s+)?BONUS/i.test(text) || /CLAIM.*5\s*NVX/i.test(text) || /DAILY\s+REWARD.*CLAIM/i.test(text))
    );
  }

  function clean(value, limit = 180) {
    return String(value ?? '').trim().slice(0, limit);
  }

  function rememberDiagnostic(detail = {}) {
    const codeRaw = Number(detail.code);
    const diagnostic = {
      event: clean(detail.event, 80),
      code: Number.isFinite(codeRaw) ? codeRaw : null,
      domain: clean(detail.domain, 100),
      message: clean(detail.message, 180),
      reason: clean(detail.reason, 100),
      responseId: clean(detail.responseId, 120),
      at: Date.now()
    };
    lastDiagnostic = diagnostic;
    window.__nxLastDailyAdDiagnostic = diagnostic;
    console.warn('NexusNova Daily rewarded diagnostic:', diagnostic);
    return diagnostic;
  }

  function postNative(action, payload = {}) {
    try {
      if (typeof window.nexusPostNativeAction === 'function') {
        return window.nexusPostNativeAction(action, payload) !== false;
      }
      if (typeof window.NexusAndroid?.postMessage !== 'function') return false;
      window.NexusAndroid.postMessage(JSON.stringify({ action, ...payload }));
      return true;
    } catch (error) {
      console.warn('NexusNova Daily Reward native bridge:', error);
      return false;
    }
  }

  function ensureHint(btn) {
    let hint = document.getElementById(HINT_ID);
    if (!hint && btn) {
      hint = document.createElement('div');
      hint.id = HINT_ID;
      hint.setAttribute('role', 'status');
      hint.style.marginTop = '8px';
      hint.style.fontSize = '11px';
      hint.style.lineHeight = '1.45';
      hint.style.textAlign = 'center';
      hint.style.color = '#8fb8e8';
      btn.insertAdjacentElement('afterend', hint);
    }
    return hint;
  }

  function currentHint() {
    return noticeText && Date.now() < noticeUntil ? noticeText : READY_HINT;
  }

  function setNotice(text, duration = 9000, tone = 'normal') {
    noticeText = String(text || '');
    noticeUntil = Date.now() + duration;
    const hint = ensureHint(button());
    if (hint) {
      hint.textContent = currentHint();
      hint.style.color = tone === 'error' ? '#ffb4b4' : tone === 'success' ? '#7ee7c4' : '#8fb8e8';
    }
    setTimeout(() => {
      if (Date.now() >= noticeUntil) {
        noticeText = '';
        decorate();
      }
    }, duration + 80);
  }

  function clearGateUi(btn) {
    btn?.removeAttribute('data-nx-daily-ad-gate');
    btn?.removeAttribute('data-nx-daily-ad-test');
    document.getElementById(HINT_ID)?.remove();
  }

  function decorate() {
    const btn = button();
    if (!btn) return;

    if (observedButton !== btn) {
      try { observer?.disconnect(); } catch (_) {}
      observedButton = btn;
      observer = new MutationObserver(() => queueMicrotask(decorate));
      observer.observe(btn, {
        attributes: true,
        attributeFilter: ['disabled'],
        childList: true,
        characterData: true,
        subtree: true
      });
    }

    if (isCooldownButton(btn)) {
      clearGateUi(btn);
      return;
    }

    if (!isReadyButton(btn)) {
      clearGateUi(btn);
      return;
    }

    btn.dataset.nxDailyAdGate = '1';
    btn.dataset.nxDailyAdTest = '1';
    btn.title = 'Complete one rewarded ad, then NexusNova securely claims today\'s +5 NVX Daily Reward.';

    if (!pending && !claimPromise && btn.disabled) btn.disabled = false;

    const hint = ensureHint(btn);
    if (hint) {
      hint.textContent = pending
        ? 'Preparing rewarded ad…'
        : claimPromise
          ? 'Ad completed • adding +5 NVX securely…'
          : currentHint();
      hint.style.color = earned || claimPromise ? '#7ee7c4' : '#8fb8e8';
    }
  }

  async function beginDailyRewardAd() {
    const btn = button();
    if (!btn || pending || claimPromise) {
      return { shown:false, reason: pending ? 'pending' : claimPromise ? 'claiming' : 'missing-button' };
    }
    if (isCooldownButton(btn)) return { shown:false, reason:'daily-cooldown' };
    if (!isReadyButton(btn)) return { shown:false, reason:'daily-not-ready' };

    if (!hasNative()) {
      setNotice('Daily +5 NVX requires the NexusNova Android app because the rewarded ad must complete first.', 9000, 'error');
      return { shown:false, native:false };
    }

    pending = true;
    earned = false;
    lastDiagnostic = null;
    btn.disabled = true;
    decorate();

    const posted = postNative('showRewardedAd', {
      rewardPurpose: REWARD_PURPOSE,
      testOnly: true
    });

    if (!posted) {
      pending = false;
      btn.disabled = false;
      setNotice('Rewarded ad bridge is not ready yet. +5 NVX was not claimed.', 9000, 'error');
      decorate();
      return { shown:false, native:false };
    }

    return { shown:true, native:true, rewardPurpose:REWARD_PURPOSE };
  }

  async function claimAfterEarnedAd() {
    if (claimPromise) return claimPromise;
    if (!earned) throw new Error('Daily Reward ad proof is missing.');

    claimPromise = (async () => {
      const btn = button();
      try {
        setNotice('✅ Ad completed • securely adding +5 NVX…', 12000, 'success');
        if (typeof window.nexusSecureClaimDaily !== 'function') {
          throw new Error('Secure Daily Reward engine is still loading.');
        }

        const result = await window.nexusSecureClaimDaily();
        earned = false;
        setNotice('✅ Daily Reward complete • +5 NVX added securely.', 10000, 'success');
        window.dispatchEvent(new CustomEvent('nexusnova:daily-reward-ad-claimed', {
          detail: { provider:'admob', ok:true, reward:Number(result?.reward || 5) }
        }));
        return result;
      } catch (error) {
        earned = false;
        console.warn('NexusNova ad-gated Daily Reward claim:', error);
        setNotice(`Ad completed, but Daily Reward was not added: ${clean(error?.message || error, 160)}`, 12000, 'error');
        throw error;
      } finally {
        claimPromise = null;
        if (btn && !isCooldownButton(btn)) btn.disabled = false;
        decorate();
      }
    })();

    return claimPromise;
  }

  document.addEventListener('click', event => {
    const btn = event.target?.closest?.(`#${BUTTON_ID}`);
    if (!btn || btn.dataset.nxDailyAdGate !== '1' || !isReadyButton(btn)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void beginDailyRewardAd();
  }, true);

  window.addEventListener('nexusnova:native-ad-event', event => {
    if (!pending) return;
    const detail = event?.detail || {};
    if (String(detail.provider || '') !== 'admob') return;

    const purpose = String(detail.rewardPurpose || '');
    const type = String(detail.event || '');

    // Never consume Mining Boost ad events.
    if (purpose && purpose !== REWARD_PURPOSE) return;

    if (type === 'rewarded-retrying') {
      rememberDiagnostic(detail);
      setNotice('Rewarded ad is retrying…', 3500);
      return;
    }

    if (type === 'rewarded-earned') {
      event.stopImmediatePropagation();
      pending = false;
      earned = true;
      const btn = button();
      if (btn) btn.disabled = true;
      void claimAfterEarnedAd();
      return;
    }

    if (type === 'rewarded-unavailable' || type === 'rewarded-load-failed' || type === 'rewarded-failed') {
      event.stopImmediatePropagation();
      pending = false;
      earned = false;
      const btn = button();
      if (btn) btn.disabled = false;

      const terminal = rememberDiagnostic(detail);
      const useful = terminal.code !== null || terminal.message ? terminal : lastDiagnostic;
      const code = useful?.code !== null && useful?.code !== undefined ? `Google ${useful.code}` : 'Ad provider';
      const message = useful?.message || useful?.reason || 'rewarded ad unavailable';
      setNotice(`Ad unavailable • ${code}: ${message} • +5 NVX was not claimed.`, 12000, 'error');
      decorate();
      return;
    }

    if (type === 'rewarded-dismissed') {
      pending = false;
      earned = false;
      const btn = button();
      if (btn) btn.disabled = false;
      setNotice('Ad closed before the reward completed. +5 NVX was not claimed.', 8000);
      decorate();
    }
  }, true);

  window.NexusNovaDailyRewardAds = Object.freeze({
    show: beginDailyRewardAd,
    active: () => Boolean(button()?.dataset.nxDailyAdGate === '1'),
    pending: () => pending,
    claiming: () => Boolean(claimPromise),
    lastError: () => lastDiagnostic ? { ...lastDiagnostic } : null
  });

  // Compatibility alias retained for older diagnostics only.
  window.NexusNovaDailyAdTest = window.NexusNovaDailyRewardAds;

  decorate();
  window.addEventListener('load', decorate, { once:true });
  [250,700,1400,2600,4500,7000].forEach(ms => setTimeout(decorate, ms));

  console.info('NexusNova Daily Reward ad gate loaded: v4');
})();
