import { pakistanSuiteRenderers } from './pakistan-suite.js';
import { newsSuiteRenderers } from './news-suite.js';
import { articleRenderers } from './articles-suite.js';

function ensureFeedSkin() {
  if (document.getElementById('nx-live-feed-desk-v1')) return;
  const style = document.createElement('style');
  style.id = 'nx-live-feed-desk-v1';
  style.textContent = `
    .nx-feed-desk{--fdx:50%;--fdy:8%;position:relative;isolation:isolate;display:grid;grid-template-rows:auto minmax(0,1fr);gap:6px;max-height:calc(100dvh - 170px);min-height:min(610px,calc(100dvh - 170px));padding:6px;border-radius:29px;overflow:hidden;background:radial-gradient(circle at var(--fdx) var(--fdy),rgba(73,211,255,.13),transparent 25%),radial-gradient(circle at 90% 87%,rgba(91,93,255,.08),transparent 29%),linear-gradient(145deg,#18242e,#0c161f 57%,#080f16);box-shadow:inset 0 1px rgba(255,255,255,.13),inset 0 -2px rgba(0,0,0,.75)}
    .nx-feed-desk::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(108deg,transparent 42%,rgba(255,255,255,.038) 50%,transparent 58%);transform:translateX(-74%);animation:nxFeedSheen 9s ease-in-out infinite}.nx-feed-desk--pk{background:radial-gradient(circle at var(--fdx) var(--fdy),rgba(49,220,156,.105),transparent 25%),radial-gradient(circle at 92% 88%,rgba(68,193,255,.065),transparent 29%),linear-gradient(145deg,#15271f,#0b1914 58%,#07100d)}.nx-feed-desk--articles{background:radial-gradient(circle at var(--fdx) var(--fdy),rgba(96,157,255,.13),transparent 25%),radial-gradient(circle at 91% 88%,rgba(92,222,255,.055),transparent 29%),linear-gradient(145deg,#182336,#0d1523 58%,#080e17)}
    .nx-feed-cockpit{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px 9px;border:1px solid rgba(139,215,240,.13);border-radius:15px;background:linear-gradient(180deg,rgba(20,38,51,.96),rgba(8,18,27,.96));box-shadow:inset 0 1px rgba(255,255,255,.09),inset 0 -2px rgba(0,0,0,.42),0 5px 12px rgba(0,0,0,.14)}.nx-feed-cockpit>div{display:flex;align-items:center;gap:7px;min-width:0}.nx-feed-led{width:8px;height:8px;flex:0 0 auto;border-radius:50%;background:#4cf0a7;box-shadow:0 0 0 3px rgba(76,240,167,.07),0 0 13px rgba(76,240,167,.45);animation:nxFeedLed 2s ease-in-out infinite}.nx-feed-copy{min-width:0}.nx-feed-copy strong{display:block;color:#edfaff;font-size:7.3px!important;letter-spacing:.085em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nx-feed-copy small{display:block;margin-top:2px;color:#71838e;font-size:5.8px;letter-spacing:.045em}.nx-feed-badge{padding:5px 7px;border:1px solid rgba(95,221,255,.12);border-radius:999px;background:rgba(69,205,238,.05);color:#8ee9ff;font-size:5.9px;font-weight:950;letter-spacing:.06em}
    .nx-feed-body{min-height:0;overflow:auto;overscroll-behavior:contain;padding:1px 2px 6px;scrollbar-width:thin}.nx-feed-body::-webkit-scrollbar{width:4px}.nx-feed-body::-webkit-scrollbar-thumb{border-radius:999px;background:rgba(102,204,235,.20)}.nx-feed-body>.nx-app-body{padding:0!important;max-width:none!important}
    .nx-feed-desk .nxn4-hero,.nx-feed-desk .nxa3-head,.nx-feed-desk .nx-pk-hero{margin-bottom:7px!important;border-radius:19px!important;border-color:rgba(102,204,239,.14)!important;box-shadow:inset 0 1px rgba(255,255,255,.08),inset 0 -3px rgba(0,0,0,.35),0 6px 16px rgba(0,0,0,.14)!important}.nx-feed-desk .nxn4-refresh,.nx-feed-desk .nxa3-head button,.nx-feed-desk .nx-pk-tabs button{box-shadow:inset 0 1px rgba(255,255,255,.09),inset 0 -3px rgba(0,0,0,.18),0 3px 0 rgba(2,12,18,.55)!important}.nx-feed-desk .nxn4-refresh:active,.nx-feed-desk .nxa3-head button:active,.nx-feed-desk .nx-pk-tabs button:active{transform:translateY(2px)!important;box-shadow:inset 0 3px 6px rgba(0,0,0,.25),0 1px 0 rgba(2,12,18,.55)!important}
    .nx-feed-desk .nxn4-story,.nx-feed-desk .nxa3-card,.nx-feed-desk .nx-news-story{border-color:rgba(104,181,221,.12)!important;background:linear-gradient(145deg,rgba(255,255,255,.035),transparent 25%),linear-gradient(155deg,#12212c,#07121a 68%,#050c12)!important;box-shadow:inset 0 1px rgba(255,255,255,.07),inset 0 -2px rgba(0,0,0,.40),0 3px 0 rgba(2,8,12,.54),0 8px 15px rgba(0,0,0,.12)!important;transition:transform .08s ease,box-shadow .08s ease}.nx-feed-desk .nxn4-story:active,.nx-feed-desk .nxa3-card:active,.nx-feed-desk .nx-news-story:active{transform:translateY(2px)!important;box-shadow:inset 0 3px 7px rgba(0,0,0,.28),0 1px 0 rgba(2,8,12,.54)!important}.nx-feed-desk .nxn4-story.is-lead,.nx-feed-desk .nxa3-card.is-lead{border-color:rgba(84,205,250,.22)!important;box-shadow:inset 0 1px rgba(255,255,255,.08),inset 0 -2px rgba(0,0,0,.38),0 4px 0 rgba(3,23,32,.62),0 10px 20px rgba(0,0,0,.14),0 0 18px rgba(73,205,255,.045)!important}
    .nx-feed-desk .nxn4-image,.nx-feed-desk .nxa3-thumb,.nx-feed-desk .nxa3-topic,.nx-feed-desk .nx-news-story img{box-shadow:inset 0 1px rgba(255,255,255,.08),0 5px 12px rgba(0,0,0,.18)}.nx-feed-desk .nxn4-source,.nx-feed-desk .nxa3-copy>small{letter-spacing:.10em}.nx-feed-desk .nx-news-reader{border-radius:18px!important;border-color:rgba(102,204,239,.14)!important;background:linear-gradient(155deg,#13232e,#08131b)!important;box-shadow:inset 0 1px rgba(255,255,255,.08),0 8px 20px rgba(0,0,0,.16)!important}.nx-feed-desk--pk .nx-pk-tabs{position:sticky;top:0;z-index:5;padding:4px!important;border:1px solid rgba(86,213,174,.08);border-radius:13px;background:rgba(5,18,14,.92);backdrop-filter:blur(7px)}.nx-feed-desk--pk .nx-pk-tabs button.active{border-color:rgba(72,233,174,.17)!important;background:linear-gradient(180deg,#205b48,#123629)!important;color:#aaf6d8!important}
    @keyframes nxFeedSheen{0%,24%{transform:translateX(-74%)}67%,100%{transform:translateX(74%)}}@keyframes nxFeedLed{0%,100%{opacity:.58}50%{opacity:1}}
    @media(max-width:390px){.nx-feed-desk{padding:5px}.nx-feed-cockpit{padding:7px 8px}.nx-feed-copy small{display:none}.nx-feed-desk .nxn4-story,.nx-feed-desk .nxa3-card{gap:8px!important}}
    @media(max-height:720px){.nx-feed-desk{min-height:0}.nx-feed-cockpit{padding:5px 7px}.nx-feed-copy small{display:none}}
    @media(prefers-reduced-motion:reduce){.nx-feed-desk::before,.nx-feed-led{animation:none!important}}
  `;
  document.head.appendChild(style);
}

function wrap(renderer, className, title, subtitle, badge) {
  ensureFeedSkin();
  const body = renderer?.();
  if (!(body instanceof HTMLElement)) return body;
  const root = document.createElement('div');
  root.className = `nx-app-body nx-feed-desk ${className}`;
  const cockpit = document.createElement('div');
  cockpit.className = 'nx-feed-cockpit';
  cockpit.innerHTML = `<div><i class="nx-feed-led"></i><span class="nx-feed-copy"><strong>${title}</strong><small>${subtitle}</small></span></div><b class="nx-feed-badge">${badge}</b>`;
  const viewport = document.createElement('div');
  viewport.className = 'nx-feed-body';
  viewport.append(body);
  root.append(cockpit, viewport);
  const move = event => { const r=root.getBoundingClientRect(); root.style.setProperty('--fdx',`${((event.clientX-r.left)/Math.max(1,r.width))*100}%`); root.style.setProperty('--fdy',`${((event.clientY-r.top)/Math.max(1,r.height))*100}%`); };
  root.addEventListener('pointermove',move,{passive:true});
  const baseCleanup=body.__cleanup;
  root.__cleanup=()=>{root.removeEventListener('pointermove',move);baseCleanup?.();};
  return root;
}

export const liveFeedDeskRenderers = Object.freeze({
  pakistan: () => wrap(pakistanSuiteRenderers.pakistan, 'nx-feed-desk--pk', 'PAKISTAN NEWS DESK', 'GDELT LIVE COVERAGE • URDU/SINDHI/REGIONAL', 'LIVE FEED'),
  news: () => wrap(newsSuiteRenderers.news, 'nx-feed-desk--news', 'GLOBAL NEWS TERMINAL', 'NATIVE BRIDGE + LIVE PUBLISHER FALLBACK', 'CURRENT'),
  articles: () => articleRenderers.articles()
});
