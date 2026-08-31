import { everydayPremiumRenderers } from './everyday-premium-labs.js';
import { everydayFocusHealthRenderers } from './everyday-premium-focus-health.js';
import { everydayTimeQrRenderers } from './everyday-premium-time-qr.js';
import { liveLocalCockpitRenderers } from './live-local-premium-skin.js';
import { liveFeedDeskRenderers } from './live-feed-premium-skin.js';
import { liveLocationDriveRenderers } from './live-location-drive-skin.js';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

function safeHttpsUrl(raw) {
  const input = String(raw || '').trim();
  if (!input) return '';
  try {
    const value = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
}

function openSecure(url) {
  const safe = safeHttpsUrl(url);
  if (!safe) return false;
  try {
    if (typeof window.NexusBrowserAndroid?.postMessage === 'function') {
      window.NexusBrowserAndroid.postMessage(JSON.stringify({ action:'open', url:safe }));
      return true;
    }
    if (typeof window.nexusPostNativeAction === 'function' && window.nexusPostNativeAction('openExternal', { url:safe })) return true;
    window.open(safe, '_blank', 'noopener,noreferrer');
    return true;
  } catch { return false; }
}

export function renderBrowserSafe() {
  const root = node(`
    <section class="nx-browser-shell nx-panel">
      <div class="nx-browser-bar"><input data-browser-input inputmode="url" autocomplete="off" placeholder="Search or enter HTTPS URL"><button type="button" data-browser-go>GO</button></div>
      <div class="nx-browser-grid">
        <button type="button" data-browser-site="https://www.google.com">Google</button>
        <button type="button" data-browser-site="https://www.wikipedia.org">Wikipedia</button>
        <button type="button" data-browser-site="https://www.youtube.com">YouTube</button>
        <button type="button" data-browser-site="https://github.com">GitHub</button>
      </div>
      <div class="nx-browser-privacy"><strong>Secure handoff</strong><p>Only HTTPS pages are opened. Android uses NexusNova's dedicated browser activity, and remote pages do not receive NexusNova's privileged native bridge.</p></div>
      <p class="nx-tool-meta" data-browser-status>Ready.</p>
    </section>`);

  const input = root.querySelector('[data-browser-input]');
  const status = root.querySelector('[data-browser-status]');
  const go = value => {
    const raw = String(value || input.value).trim();
    if (!raw) { status.textContent = 'Type a search or HTTPS address first.'; return; }
    let url = safeHttpsUrl(raw);
    if (!url || (!raw.includes('.') && !/^https?:/i.test(raw))) {
      if (/^http:\/\//i.test(raw)) {
        status.textContent = 'Insecure HTTP pages are blocked. Use HTTPS instead.';
        return;
      }
      url = `https://www.google.com/search?q=${encodeURIComponent(raw)}`;
    }
    if (!openSecure(url)) status.textContent = 'Could not open that secure address.';
    else status.textContent = 'Opening secure browser…';
  };

  root.querySelector('[data-browser-go]').addEventListener('click', () => go());
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); go(); } });
  root.querySelectorAll('[data-browser-site]').forEach(button => button.addEventListener('click', () => go(button.dataset.browserSite)));
  return root;
}

export const browserSafeRenderers = Object.freeze({
  browser: renderBrowserSafe,
  ...everydayPremiumRenderers,
  ...everydayFocusHealthRenderers,
  ...everydayTimeQrRenderers,
  ...liveLocalCockpitRenderers,
  ...liveFeedDeskRenderers,
  ...liveLocationDriveRenderers
});
