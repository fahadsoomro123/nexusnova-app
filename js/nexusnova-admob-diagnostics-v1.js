/* NexusNova AdMob diagnostics v2
   Development/test-only visibility for native Google Mobile Ads failures.
   Background/preload failures are silent; diagnostics are shown only after an
   explicit rewarded-ad request. Never grants rewards or alters mining state.
*/
(() => {
  'use strict';
  if (window.__nxAdMobDiagnosticsV2) return;
  window.__nxAdMobDiagnosticsV2 = true;

  const FAILURE_EVENTS = new Set([
    'rewarded-load-failed',
    'rewarded-failed',
    'rewarded-unavailable'
  ]);

  let explicitRequestActive = false;
  let explicitRequestStartedAt = 0;
  const REQUEST_WINDOW_MS = 20_000;

  function dailyTestOwnsRequest() {
    try {
      return window.NexusNovaDailyAdTest?.pending?.() === true;
    } catch (_) {
      return false;
    }
  }

  function clean(value, limit = 220) {
    return String(value ?? '').trim().slice(0, limit);
  }

  function normalize(detail = {}) {
    return {
      eventName: clean(detail.event, 80),
      code: Number.isFinite(Number(detail.code)) ? Number(detail.code) : null,
      domain: clean(detail.domain, 100),
      message: clean(detail.message, 220),
      reason: clean(detail.reason, 100),
      responseId: clean(detail.responseId, 120),
      at: Date.now()
    };
  }

  function remember(detail = {}) {
    const diagnostic = normalize(detail);
    window.__nxLastAdMobDiagnostic = diagnostic;
    console.warn('NexusNova AdMob rewarded diagnostic:', diagnostic);
    return diagnostic;
  }

  function requestIsRecent() {
    return explicitRequestActive &&
      explicitRequestStartedAt > 0 &&
      Date.now() - explicitRequestStartedAt <= REQUEST_WINDOW_MS;
  }

  function clearExplicitRequest() {
    explicitRequestActive = false;
    explicitRequestStartedAt = 0;
  }

  async function showDiagnostic(detail) {
    const diagnostic = remember(detail);
    const parts = [];
    if (diagnostic.code !== null) parts.push(`Google error code: ${diagnostic.code}`);
    if (diagnostic.message) parts.push(diagnostic.message);
    if (diagnostic.domain) parts.push(`Domain: ${diagnostic.domain}`);
    if (diagnostic.reason) parts.push(`Reason: ${diagnostic.reason}`);
    if (diagnostic.responseId) parts.push(`Response: ${diagnostic.responseId}`);
    if (!parts.length) parts.push('Google Mobile Ads did not return a rewarded test ad before the request timed out.');

    const text = parts.join('\n');
    try {
      if (window.NexusNovaUI?.alert) {
        await window.NexusNovaUI.alert({
          eyebrow: 'ADMOB TEST DIAGNOSTIC',
          title: diagnostic.code !== null ? `Rewarded Ad Error ${diagnostic.code}` : 'Rewarded Ad Load Failed',
          text,
          icon: 'security',
          buttonText: 'OK'
        });
        return;
      }
    } catch (_) {}

    alert(`AdMob test diagnostic\n\n${text}`);
  }

  // Capture native ad lifecycle before the normal mining-boost listener.
  // A preload failure at app startup is recorded silently. Only a failure that
  // follows rewarded-preparing/showing (which occurs after an explicit request)
  // may surface a diagnostic popup.
  window.addEventListener('nexusnova:native-ad-event', event => {
    const detail = event?.detail || {};
    if (String(detail.provider || '') !== 'admob') return;
    if (detail.testMode === false) return;

    const type = String(detail.event || '');
    if (type === 'rewarded-preparing' || type === 'rewarded-showing' || type === 'rewarded-opened') {
      explicitRequestActive = true;
      explicitRequestStartedAt = Date.now();
      return;
    }

    if (type === 'rewarded-earned' || type === 'rewarded-dismissed') {
      clearExplicitRequest();
      return;
    }

    if (!FAILURE_EVENTS.has(type)) return;
    if (dailyTestOwnsRequest()) return;

    const shouldShow = requestIsRecent();
    clearExplicitRequest();

    // Prevent the legacy mining listener from producing an unsolicited generic
    // popup for background preload failures.
    event.stopImmediatePropagation();

    if (shouldShow) {
      void showDiagnostic(detail);
    } else {
      remember(detail);
    }
  }, true);

  console.info('NexusNova AdMob diagnostics loaded: v2 (silent preload failures)');
})();
