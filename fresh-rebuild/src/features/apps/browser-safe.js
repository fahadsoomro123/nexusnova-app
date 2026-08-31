import { everydayPremiumRenderers } from './everyday-premium-labs.js';
import { everydayFocusHealthRenderers } from './everyday-premium-focus-health.js';
import { everydayTimeQrRenderers } from './everyday-premium-time-qr.js';
import { liveLocalCockpitRenderers } from './live-local-premium-skin.js';
import { liveFeedDeskRenderers } from './live-feed-premium-skin.js';
import { liveLocationDriveRenderers } from './live-location-drive-skin.js';
import { discoverSafeDeskRenderers } from './discover-premium-safe.js';
import { discoverStudyTravelRenderers } from './discover-study-travel-skin.js';

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

function ensureBrowserProStyles() {
  if (document.getElementById('nx-browser-safe-pro-v1')) return;
  const style = document.createElement('style');
  style.id = 'nx-browser-safe-pro-v1';
  style.textContent = `
    .nx-browser-pro{--brx:50%;--bry:8%;position:relative;isolation:isolate;display:grid;grid-template-rows:auto minmax(0,1fr);gap:7px;max-height:calc(100dvh - 170px);min-height:min(560px,calc(100dvh - 170px));padding:7px;border-radius:29px;overflow:hidden;background:radial-gradient(circle at var(--brx) var(--bry),rgba(67,209,255,.14),transparent 25%),radial-gradient(circle at 91% 88%,rgba(106,89,255,.075),transparent 29%),linear-gradient(145deg,#18242e,#0c161f 57%,#080f16);box-shadow:inset 0 1px rgba(255,255,255,.13),inset 0 -2px rgba(0,0,0,.76)}
    .nx-browser-pro::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(108deg,transparent 42%,rgba(255,255,255,.038) 50%,transparent 58%);transform:translateX(-74%);animation:nxBrowserSafeSheen 9s ease-in-out infinite}.nx-browser-pro-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:9px 10px;border:1px solid rgba(134,213,239,.13);border-radius:15px;background:linear-gradient(180deg,rgba(20,39,52,.97),rgba(8,18,27,.97));box-shadow:inset 0 1px rgba(255,255,255,.09),inset 0 -2px rgba(0,0,0,.43),0 5px 12px rgba(0,0,0,.14)}.nx-browser-pro-head>div{display:flex;align-items:center;gap:7px;min-width:0}.nx-browser-pro-led{width:8px;height:8px;border-radius:50%;background:#54f0bd;box-shadow:0 0 0 3px rgba(84,240,189,.07),0 0 13px rgba(84,240,189,.43);animation:nxBrowserSafeLed 2s ease-in-out infinite}.nx-browser-pro-copy{min-width:0}.nx-browser-pro-copy strong{display:block;color:#effaff;font-size:7.4px!important;letter-spacing:.09em}.nx-browser-pro-copy small{display:block;margin-top:2px;color:#72838e;font-size:5.9px;letter-spacing:.045em}.nx-browser-pro-head>b{padding:5px 7px;border:1px solid rgba(95,221,255,.12);border-radius:999px;background:rgba(68,205,239,.05);color:#8de9ff;font-size:5.9px;letter-spacing:.06em}.nx-browser-pro .nx-browser-shell{min-height:0;margin:0!important;padding:14px!important;border-color:rgba(97,197,232,.13)!important;border-radius:21px!important;background:radial-gradient(circle at 85% 10%,rgba(64,213,255,.07),transparent 27%),linear-gradient(155deg,#112631,#07151e 68%,#050e14)!important;box-shadow:inset 0 1px rgba(255,255,255,.075),inset 0 -3px rgba(0,0,0,.4),0 8px 19px rgba(0,0,0,.14)!important}.nx-browser-pro .nx-browser-bar{gap:7px!important}.nx-browser-pro .nx-browser-bar input{height:48px!important;border:1px solid rgba(105,205,237,.14)!important;border-radius:13px!important;background:linear-gradient(180deg,#07151e,#030a0f)!important;box-shadow:inset 0 4px 10px rgba(0,0,0,.55),inset 0 -1px rgba(255,255,255,.035)!important;color:#eefaff!important}.nx-browser-pro .nx-browser-bar button,.nx-browser-pro .nx-browser-grid button{border:1px solid rgba(100,210,240,.13)!important;border-radius:12px!important;background:linear-gradient(180deg,#1b465b,#0d2937)!important;box-shadow:inset 0 1px rgba(255,255,255,.12),inset 0 -4px 6px rgba(0,0,0,.2),0 3px 0 #061720,0 7px 11px rgba(0,0,0,.13)!important;color:#dff9ff!important;font-weight:900}.nx-browser-pro .nx-browser-bar button:active,.nx-browser-pro .nx-browser-grid button:active{transform:translateY(2px)!important;box-shadow:inset 0 3px 6px rgba(0,0,0,.28),0 1px 0 #061720!important}.nx-browser-pro .nx-browser-grid{gap:7px!important;margin-top:10px!important}.nx-browser-pro .nx-browser-grid button{min-height:45px!important}.nx-browser-pro .nx-browser-privacy{margin-top:12px!important;padding:12px!important;border:1px solid rgba(83,214,176,.10)!important;border-radius:14px!important;background:linear-gradient(155deg,rgba(70,228,181,.035),transparent 28%),linear-gradient(180deg,#0d211e,#071411)!important;box-shadow:inset 0 1px rgba(255,255,255,.055),inset 0 -2px rgba(0,0,0,.31),0 3px 0 rgba(2,11,9,.38)!important}.nx-browser-pro [data-browser-status]{margin-top:10px!important;padding:7px 8px;border-radius:10px;background:rgba(3,12,18,.42);color:#7d9aa7!important}.nx-browser-pro input:focus{border-color:rgba(82,225,255,.34)!important;box-shadow:inset 0 4px 10px rgba(0,0,0,.55),0 0 0 2px rgba(82,225,255,.055)!important;outline:none}
    @keyframes nxBrowserSafeSheen{0%,24%{transform:translateX(-74%)}67%,100%{transform:translateX(74%)}}@keyframes nxBrowserSafeLed{0%,100%{opacity:.58}50%{opacity:1}}@media(max-width:390px){.nx-browser-pro{padding:5px}.nx-browser-pro-head{padding:7px 8px}.nx-browser-pro-copy small{display:none}.nx-browser-pro .nx-browser-shell{padding:10px!important}.nx-browser-pro .nx-browser-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-height:720px){.nx-browser-pro{min-height:0}.nx-browser-pro-copy small{display:none}.nx-browser-pro .nx-browser-shell{padding:9px!important}.nx-browser-pro .nx-browser-privacy{margin-top:8px!important;padding:9px!important}}@media(prefers-reduced-motion:reduce){.nx-browser-pro::before,.nx-browser-pro-led{animation:none!important}}
  `;
  document.head.appendChild(style);
}

export function renderBrowserSafe() {
  ensureBrowserProStyles();
  const root = node(`
    <div class="nx-browser-pro-head"><div><i class="nx-browser-pro-led"></i><span class="nx-browser-pro-copy"><strong>SECURE WEB GATEWAY</strong><small>HTTPS-ONLY HANDOFF • PRIVILEGED BRIDGE ISOLATED</small></span></div><b>SAFE BROWSER</b></div>
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
  root.classList.add('nx-browser-pro');

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
  const move = event => { const r=root.getBoundingClientRect(); root.style.setProperty('--brx',`${((event.clientX-r.left)/Math.max(1,r.width))*100}%`); root.style.setProperty('--bry',`${((event.clientY-r.top)/Math.max(1,r.height))*100}%`); };
  root.addEventListener('pointermove',move,{passive:true});
  root.__cleanup=()=>root.removeEventListener('pointermove',move);
  return root;
}

export const browserSafeRenderers = Object.freeze({
  browser: renderBrowserSafe,
  ...everydayPremiumRenderers,
  ...everydayFocusHealthRenderers,
  ...everydayTimeQrRenderers,
  ...liveLocalCockpitRenderers,
  ...liveFeedDeskRenderers,
  ...liveLocationDriveRenderers,
  ...discoverSafeDeskRenderers,
  ...discoverStudyTravelRenderers
});
