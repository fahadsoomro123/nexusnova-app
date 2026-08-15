/* NexusNova Daily Reward Ad Test v1
   Temporary Android-only verification layer.

   Purpose:
   - Let an already-cooled-down Daily Reward button open a real AdMob rewarded
     TEST ad so the owner can verify the placement immediately.
   - Never call the Daily Reward backend while its 24-hour cooldown is active.
   - Intercept the native rewarded-earned event before the mining-boost bridge
     sees it, so this test can never grant an accidental -2h mining boost.
   - Never mint or duplicate NVX. The real Daily Reward security boundary stays
     authoritative and unchanged.
*/
(() => {
  'use strict';
  if (window.__nxDailyRewardAdTestV1) return;
  window.__nxDailyRewardAdTestV1 = true;

  const BUTTON_ID = 'dailyBtn';
  const HINT_ID = 'nxDailyAdTestHint';
  const DEFAULT_HINT = 'TEST MODE • Tap the Daily button to verify the rewarded ad • +5 NVX remains on its real cooldown.';

  let pending = false;
  let noticeText = '';
  let noticeUntil = 0;
  let observedButton = null;
  let observer = null;

  const button = () => document.getElementById(BUTTON_ID);
  const hasNative = () =>
    typeof window.nexusPostNativeAction === 'function' ||
    typeof window.NexusAndroid?.postMessage === 'function';

  function isCooldownButton(btn) {
    return Boolean(btn && /NEXT\s+DAILY\s+BONUS/i.test(String(btn.textContent || '')));
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
      console.warn('NexusNova Daily Ad Test native bridge:', error);
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
    return noticeText && Date.now() < noticeUntil ? noticeText : DEFAULT_HINT;
  }

  function setNotice(text, duration = 8000) {
    noticeText = String(text || '');
    noticeUntil = Date.now() + duration;
    const hint = ensureHint(button());
    if (hint) hint.textContent = currentHint();
    setTimeout(() => {
      if (Date.now() >= noticeUntil) {
        noticeText = '';
        decorate();
      }
    }, duration + 80);
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

    const cooldown = isCooldownButton(btn);
    if (!cooldown || !hasNative()) {
      btn.removeAttribute('data-nx-daily-ad-test');
      const hint = document.getElementById(HINT_ID);
      if (hint) hint.remove();
      return;
    }

    btn.dataset.nxDailyAdTest = '1';
    btn.title = 'Temporary owner test: opens a rewarded test ad only. The +5 NVX Daily Reward remains protected by its real 24-hour cooldown.';
    if (!pending && btn.disabled) btn.disabled = false;

    const hint = ensureHint(btn);
    if (hint) {
      hint.textContent = pending ? 'Opening rewarded test ad…' : currentHint();
      hint.style.color = noticeText && Date.now() < noticeUntil ? '#7ee7c4' : '#8fb8e8';
    }
  }

  async function showDailyAdTest() {
    const btn = button();
    if (!btn || pending) return { shown: false, reason: pending ? 'pending' : 'missing-button' };
    if (!isCooldownButton(btn)) return { shown: false, reason: 'daily-ready' };

    if (!hasNative()) {
      setNotice('Daily rewarded-ad testing is available inside the NexusNova Android app.', 7000);
      return { shown: false, native: false };
    }

    pending = true;
    btn.disabled = true;
    decorate();

    // Ask the native shell to show the existing Google AdMob rewarded TEST ad.
    // The current APK reports its legacy mining-boost reward contract; the
    // capture listener below consumes only the earned event for this Daily test.
    const posted = postNative('showRewardedAd', {
      rewardPurpose: 'daily-reward-test',
      testOnly: true
    });

    if (!posted) {
      pending = false;
      btn.disabled = false;
      setNotice('Rewarded ad bridge is not ready yet. Close and reopen NexusNova, then try again.', 8000);
      decorate();
      return { shown: false, native: false };
    }

    return { shown: true, native: true, testOnly: true };
  }

  // Document capture runs before the button-level secure reward handlers. It is
  // active only while page2-core says the real Daily Reward is still cooling down.
  document.addEventListener('click', event => {
    const btn = event.target?.closest?.(`#${BUTTON_ID}`);
    if (!btn || btn.dataset.nxDailyAdTest !== '1' || !isCooldownButton(btn)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void showDailyAdTest();
  }, true);

  // Native AdMob events are dispatched on window. A capture listener at the
  // target runs before the normal mining-boost listener, allowing this one test
  // to consume rewarded-earned safely without changing the mining bridge itself.
  window.addEventListener('nexusnova:native-ad-event', event => {
    if (!pending) return;
    const detail = event?.detail || {};
    if (String(detail.provider || '') !== 'admob') return;

    const type = String(detail.event || '');
    if (type === 'rewarded-earned') {
      event.stopImmediatePropagation();
      pending = false;
      const btn = button();
      if (btn) btn.disabled = false;
      setNotice('✅ TEST AD COMPLETED • AdMob rewarded ad is working • no extra +5 NVX and no mining boost was applied.', 10000);
      decorate();
      window.dispatchEvent(new CustomEvent('nexusnova:daily-ad-test-complete', {
        detail: { provider: 'admob', ok: true, testOnly: true }
      }));
      return;
    }

    if (type === 'rewarded-unavailable' || type === 'rewarded-load-failed' || type === 'rewarded-failed') {
      event.stopImmediatePropagation();
      pending = false;
      const btn = button();
      if (btn) btn.disabled = false;
      setNotice('Ad is not ready right now. Wait a few seconds and tap the Daily button again; no reward was changed.', 9000);
      decorate();
      return;
    }

    if (type === 'rewarded-dismissed') {
      pending = false;
      const btn = button();
      if (btn) btn.disabled = false;
      setNotice('Test ad closed before a reward completion signal. No NVX or mining value was changed.', 8000);
      decorate();
    }
  }, true);

  window.NexusNovaDailyAdTest = Object.freeze({
    show: showDailyAdTest,
    active: () => Boolean(button()?.dataset.nxDailyAdTest === '1'),
    pending: () => pending
  });

  decorate();
  window.addEventListener('load', decorate, { once: true });
  [250, 700, 1400, 2600, 4500, 7000].forEach(ms => setTimeout(decorate, ms));

  console.info('NexusNova Daily Reward ad test gate loaded: v1');
})();
