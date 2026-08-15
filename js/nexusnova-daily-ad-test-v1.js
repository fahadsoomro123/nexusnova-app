/* NexusNova Daily Reward Ad Test v3
   Android-only owner verification layer.

   Safety contract:
   - While the real Daily Reward is on cooldown, the button may open a rewarded
     TEST ad only.
   - No backend Daily Reward call is made by this test layer.
   - No NVX and no mining boost is granted by this test layer.
   - Ad load failures are shown inline only; never as startup/debug popups.
*/
(() => {
  'use strict';
  if (window.__nxDailyRewardAdTestV3) return;
  window.__nxDailyRewardAdTestV3 = true;
  window.__nxDailyRewardAdTestV2 = true;
  window.__nxDailyRewardAdTestV1 = true;

  const BUTTON_ID = 'dailyBtn';
  const HINT_ID = 'nxDailyAdTestHint';
  const DEFAULT_HINT = 'TEST MODE • Tap Daily to verify the rewarded ad • +5 NVX remains on its real cooldown.';

  let pending = false;
  let noticeText = '';
  let noticeUntil = 0;
  let observedButton = null;
  let observer = null;
  let lastDiagnostic = null;

  const button = () => document.getElementById(BUTTON_ID);
  const hasNative = () =>
    typeof window.nexusPostNativeAction === 'function' ||
    typeof window.NexusAndroid?.postMessage === 'function';

  function isCooldownButton(btn) {
    return Boolean(btn && /NEXT\s+DAILY\s+BONUS/i.test(String(btn.textContent || '')));
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
    console.warn('NexusNova Daily rewarded test diagnostic:', diagnostic);
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
      document.getElementById(HINT_ID)?.remove();
      return;
    }

    btn.dataset.nxDailyAdTest = '1';
    btn.title = 'Owner test: opens a rewarded test ad only. The real +5 NVX Daily Reward remains on its normal cooldown.';
    if (!pending && btn.disabled) btn.disabled = false;

    const hint = ensureHint(btn);
    if (hint) {
      hint.textContent = pending ? 'Opening rewarded test ad…' : currentHint();
      if (pending) hint.style.color = '#8fb8e8';
    }
  }

  async function showDailyAdTest() {
    const btn = button();
    if (!btn || pending) return { shown: false, reason: pending ? 'pending' : 'missing-button' };
    if (!isCooldownButton(btn)) return { shown: false, reason: 'daily-ready' };

    if (!hasNative()) {
      setNotice('Rewarded-ad testing is available inside the NexusNova Android app.', 7000);
      return { shown: false, native: false };
    }

    pending = true;
    lastDiagnostic = null;
    btn.disabled = true;
    decorate();

    const posted = postNative('showRewardedAd', {
      rewardPurpose: 'daily-reward-test',
      testOnly: true
    });

    if (!posted) {
      pending = false;
      btn.disabled = false;
      setNotice('Rewarded ad bridge is not ready yet. No reward was changed.', 9000, 'error');
      decorate();
      return { shown: false, native: false };
    }

    return { shown: true, native: true, testOnly: true };
  }

  document.addEventListener('click', event => {
    const btn = event.target?.closest?.(`#${BUTTON_ID}`);
    if (!btn || btn.dataset.nxDailyAdTest !== '1' || !isCooldownButton(btn)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void showDailyAdTest();
  }, true);

  window.addEventListener('nexusnova:native-ad-event', event => {
    if (!pending) return;
    const detail = event?.detail || {};
    if (String(detail.provider || '') !== 'admob') return;

    const type = String(detail.event || '');
    if (type === 'rewarded-retrying') {
      rememberDiagnostic(detail);
      setNotice('Rewarded ad is retrying…', 3500);
      return;
    }

    if (type === 'rewarded-earned') {
      event.stopImmediatePropagation();
      pending = false;
      const btn = button();
      if (btn) btn.disabled = false;
      setNotice('✅ TEST AD COMPLETED • AdMob rewarded ad is working • no extra NVX or mining boost was applied.', 10000, 'success');
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

      const terminal = rememberDiagnostic(detail);
      const useful = terminal.code !== null || terminal.message ? terminal : lastDiagnostic;
      const code = useful?.code !== null && useful?.code !== undefined ? `Google ${useful.code}` : 'AdMob';
      const message = useful?.message || useful?.reason || 'rewarded ad unavailable';
      setNotice(`Ad unavailable • ${code}: ${message} • no NVX or mining value changed.`, 12000, 'error');
      decorate();
      return;
    }

    if (type === 'rewarded-dismissed') {
      pending = false;
      const btn = button();
      if (btn) btn.disabled = false;
      setNotice('Test ad closed before completion. No NVX or mining value was changed.', 8000);
      decorate();
    }
  }, true);

  window.NexusNovaDailyAdTest = Object.freeze({
    show: showDailyAdTest,
    active: () => Boolean(button()?.dataset.nxDailyAdTest === '1'),
    pending: () => pending,
    lastError: () => lastDiagnostic ? { ...lastDiagnostic } : null
  });

  decorate();
  window.addEventListener('load', decorate, { once: true });
  [250, 700, 1400, 2600, 4500, 7000].forEach(ms => setTimeout(decorate, ms));

  console.info('NexusNova Daily Reward ad test gate loaded: v3 inline-only');
})();
