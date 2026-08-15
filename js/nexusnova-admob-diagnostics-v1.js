/* NexusNova AdMob diagnostics v1
   Development/test-only visibility for native Google Mobile Ads failures.
   Does not grant rewards and does not alter mining state.
*/
(() => {
  'use strict';
  if (window.__nxAdMobDiagnosticsV1) return;
  window.__nxAdMobDiagnosticsV1 = true;

  const FAILURE_EVENTS = new Set([
    'rewarded-load-failed',
    'rewarded-failed',
    'rewarded-unavailable'
  ]);

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

  async function showDiagnostic(detail) {
    const eventName = clean(detail.event, 80);
    const code = Number.isFinite(Number(detail.code)) ? Number(detail.code) : null;
    const domain = clean(detail.domain, 100);
    const message = clean(detail.message, 220);
    const reason = clean(detail.reason, 100);
    const responseId = clean(detail.responseId, 120);

    const parts = [];
    if (code !== null) parts.push(`Google error code: ${code}`);
    if (message) parts.push(message);
    if (domain) parts.push(`Domain: ${domain}`);
    if (reason) parts.push(`Reason: ${reason}`);
    if (responseId) parts.push(`Response: ${responseId}`);
    if (!parts.length) parts.push('Google Mobile Ads did not return a rewarded test ad before the request timed out.');

    const text = parts.join('\n');
    console.warn('NexusNova AdMob rewarded diagnostic:', { eventName, code, domain, message, reason, responseId });

    try {
      if (window.NexusNovaUI?.alert) {
        await window.NexusNovaUI.alert({
          eyebrow: 'ADMOB TEST DIAGNOSTIC',
          title: code !== null ? `Rewarded Ad Error ${code}` : 'Rewarded Ad Load Failed',
          text,
          icon: 'security',
          buttonText: 'OK'
        });
        return;
      }
    } catch (_) {}

    alert(`AdMob test diagnostic\n\n${text}`);
  }

  // Capture phase intentionally runs before the normal mining-boost listener so
  // test builds display Google's real load failure rather than a generic message.
  // The Daily Reward owner-test keeps its own event handling when it is pending.
  window.addEventListener('nexusnova:native-ad-event', event => {
    const detail = event?.detail || {};
    if (String(detail.provider || '') !== 'admob') return;
    if (detail.testMode === false) return;
    if (!FAILURE_EVENTS.has(String(detail.event || ''))) return;
    if (dailyTestOwnsRequest()) return;

    event.stopImmediatePropagation();
    void showDiagnostic(detail);
  }, true);

  console.info('NexusNova AdMob diagnostics loaded: v1');
})();
