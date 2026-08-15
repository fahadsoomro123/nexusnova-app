/* NexusNova Daily Reward Ad Test v2
   Temporary Android-only verification layer.

   Purpose:
   - Let an already-cooled-down Daily Reward button open a real AdMob rewarded
     TEST ad so the owner can verify the placement immediately.
   - Never call the Daily Reward backend while its 24-hour cooldown is active.
   - Intercept the native rewarded-earned event before the mining-boost bridge
     sees it, so this test can never grant an accidental -2h mining boost.
   - Never mint or duplicate NVX. The real Daily Reward security boundary stays
     authoritative and unchanged.
   - Surface the exact native Google Mobile Ads failure details after an explicit
     owner test instead of hiding them behind a generic "not ready" message.
*/
(() => {
  'use strict';
  if (window.__nxDailyRewardAdTestV2) return;
  window.__nxDailyRewardAdTestV2 = true;
  // Keep the legacy marker so already-loaded guards still recognize this layer.
  window.__nxDailyRewardAdTestV1 = true;

  const BUTTON_ID = 'dailyBtn';
  const HINT_ID = 'nxDailyAdTestHint';
  const DEFAULT_HINT = 'TEST MODE • Tap the Daily button to verify the rewarded ad • +5 NVX remains on its real cooldown.';

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
      hint.style.whiteSpace = 'pre-line';
      btn.insertAdjacentElement('afterend', hint);
    }
    return hint;
  }

  function currentHint() {
    return noticeText && Date.now() < noticeUntil ? noticeText : DEFAULT_HINT;
  }

  function setNotice(text, duration = 8000, tone = 'normal') {
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

  function clean(value, limit = 220) {
    return String(value ?? '').trim().slice(0, limit);
  }

  function captureDiagnostic(detail = {}) {
    const codeRaw = Number(detail.code);
    const diagnostic = {
      event: clean(detail.event, 80),
      code: Number.isFinite(codeRaw) ? codeRaw : null,
      domain: clean(detail.domain, 100),
      message: clean(detail.message, 220),
      reason: clean(detail.reason, 100),
      responseId: clean(detail.responseId, 120),
      testMode: detail.testMode !== false,
      at: Date.now()
    };
    lastDiagnostic = diagnostic;
    window.__nxLastDailyAdDiagnostic = diagnostic;
    console.warn('NexusNova Daily rewarded test diagnostic:', diagnostic);
    return diagnostic;
  }

  function diagnosticText(detail = {}) {
    const d = captureDiagnostic(detail);
    const lines = ['AdMob test failed'];
    if (d.code !== null) lines.push(`Google error code: ${d.code}`);
    if (d.message) lines.push(`Message: ${d.message}`);
    if (d.domain) lines.push(`Domain: ${d.domain}`);
    if (d.reason) lines.push(`Reason: ${d.reason}`);
    if (d.responseId) lines.push(`Response: ${d.responseId}`);
    if (lines.length === 1) lines.push('Google Mobile Ads did not return a rewarded test ad before the request timed out.');
    lines.push('No NVX or mining value was changed.');
    return lines.join('\n');
  }

  async function showDiagnosticPopup(detail = {}) {
    const text = diagnosticText(detail);
    try {
      if (window.NexusNovaUI?.alert) {
        await window.NexusNovaUI.alert({
          eyebrow: 'ADMOB TEST DIAGNOSTIC',
          title: Number.isFinite(Number(detail.code)) ? `Rewarded Ad Error ${Number(detail.code)}` : 'Rewarded Ad Load Failed',
          text,
          icon: 'security',
          buttonText: 'OK'
        });
      }
    } catch (_) {}
    return text;
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
      if (pending) hint.style.color = '#8fb8e8';
      else if (noticeText && Date.now() < noticeUntil) {
        hint.style.color = /failed|error|unavailable|timeout/i.test(noticeText) ? '#ffb4b4' : '#7ee7c4';
      } else hint.style.color = '#8fb8e8';
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
    lastDiagnostic = null;
    btn.disabled = true;
    decorate();

    // Ask the native shell to show the existing Google AdMob rewarded TEST ad.
    // The capture listener below consumes only the earned event for this Daily test.
    const posted = postNative('showRewardedAd', {
      rewardPurpose: 'daily-reward-test',
      testOnly: true
    });

    if (!posted) {
      pending = false;
      btn.disabled = false;
      setNotice('Rewarded ad bridge is not ready yet. Close and reopen NexusNova, then try again.', 10000, 'error');
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

  // Native AdMob events are dispatched on window. This test consumes them before
  // the mining-boost listener so a Daily verification can never alter mining.
  window.addEventListener('nexusnova:native-ad-event', event => {
    if (!pending) return;
    const detail = event?.detail || {};
    if (String(detail.provider || '') !== 'admob') return;

    const type = String(detail.event || '');

    // Keep the request alive during native retries, but retain the latest Google
    // error so it remains inspectable if the terminal attempt times out.
    if (type === 'rewarded-retrying') {
      captureDiagnostic(detail);
      return;
    }

    if (type === 'rewarded-earned') {
      event.stopImmediatePropagation();
      pending = false;
      const btn = button();
      if (btn) btn.disabled = false;
      setNotice('✅ TEST AD COMPLETED • AdMob rewarded ad is working • no extra +5 NVX and no mining boost was applied.', 10000, 'success');
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

      // If the terminal event is only a timeout, combine it with the most recent
      // retry's real Google error so the owner still sees the useful root cause.
      const terminal = { ...detail };
      if ((!Number.isFinite(Number(terminal.code)) || !terminal.message) && lastDiagnostic) {
        if (!Number.isFinite(Number(terminal.code)) && lastDiagnostic.code !== null) terminal.code = lastDiagnostic.code;
        if (!terminal.message && lastDiagnostic.message) terminal.message = lastDiagnostic.message;
        if (!terminal.domain && lastDiagnostic.domain) terminal.domain = lastDiagnostic.domain;
        if (!terminal.responseId && lastDiagnostic.responseId) terminal.responseId = lastDiagnostic.responseId;
      }

      void showDiagnosticPopup(terminal).then(text => {
        setNotice(text, 18000, 'error');
        decorate();
      });
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
    pending: () => pending,
    lastError: () => lastDiagnostic ? { ...lastDiagnostic } : null
  });

  decorate();
  window.addEventListener('load', decorate, { once: true });
  [250, 700, 1400, 2600, 4500, 7000].forEach(ms => setTimeout(decorate, ms));

  console.info('NexusNova Daily Reward ad test gate loaded: v2 diagnostics');
})();
