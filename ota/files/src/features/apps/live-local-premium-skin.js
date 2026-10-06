import { premiumWeatherRenderers } from './premium-weather.js';
import { qiblaSafeV2Renderers } from './premium-qibla-safe-v2.js';
import { premiumPrayerSafeRenderers } from './premium-prayer-safe.js';
import { sacredZeroScrollRenderers } from './sacred-zero-scroll.js';

function ensureLiveLocalSkin() {
  if (document.getElementById('nx-live-local-cockpit-v1')) return;
  const style = document.createElement('style');
  style.id = 'nx-live-local-cockpit-v1';
  style.textContent = `
    .nx-live-local-pro{--llx:50%;--lly:8%;position:relative;isolation:isolate;max-height:calc(100dvh - 170px);min-height:min(610px,calc(100dvh - 170px));padding:6px;border-radius:29px;overflow:hidden;background:radial-gradient(circle at var(--llx) var(--lly),rgba(65,218,255,.14),transparent 25%),radial-gradient(circle at 90% 88%,rgba(93,109,255,.08),transparent 29%),linear-gradient(145deg,#17242e,#0c161f 56%,#081017);box-shadow:inset 0 1px 0 rgba(255,255,255,.13),inset 0 -2px 0 rgba(0,0,0,.75)}
    .nx-live-local-pro::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(108deg,transparent 42%,rgba(255,255,255,.038) 50%,transparent 58%);transform:translateX(-74%);animation:nxLiveLocalSheen 9s ease-in-out infinite}
    .nx-live-local-cockpit{position:relative;z-index:3;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;margin:0 0 6px;padding:8px 9px;border:1px solid rgba(143,216,241,.13);border-radius:15px;background:linear-gradient(180deg,rgba(21,40,52,.96),rgba(8,19,27,.96));box-shadow:inset 0 1px rgba(255,255,255,.09),inset 0 -2px rgba(0,0,0,.42),0 5px 12px rgba(0,0,0,.14)}
    .nx-live-local-cockpit>div{display:flex;align-items:center;gap:7px;min-width:0}.nx-live-local-led{width:8px;height:8px;flex:0 0 auto;border-radius:50%;background:#50f1c0;box-shadow:0 0 0 3px rgba(80,241,192,.07),0 0 13px rgba(80,241,192,.45);animation:nxLiveLocalLed 2s ease-in-out infinite}.nx-live-local-copy{min-width:0}.nx-live-local-copy strong{display:block;color:#eafaff;font-size:7.3px!important;letter-spacing:.085em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nx-live-local-copy small{display:block;margin-top:2px;color:#71838e;font-size:5.8px;letter-spacing:.045em}.nx-live-local-badge{padding:5px 7px;border:1px solid rgba(91,224,255,.12);border-radius:999px;background:rgba(70,207,240,.05);color:#8ce9ff;font-size:5.9px;font-weight:950;letter-spacing:.06em}
    .nx-live-weather-pro>.nx-weather-premium,.nx-live-prayer-pro>.nx-prayer-premium,.nx-live-qibla-pro>.nx2-qibla{min-height:0!important;max-height:calc(100dvh - 223px)!important;overflow:auto!important;overscroll-behavior:contain;scrollbar-width:thin;border-radius:22px!important;box-shadow:0 12px 28px rgba(0,0,0,.22)}
    .nx-live-weather-pro>.nx-weather-premium::-webkit-scrollbar,.nx-live-prayer-pro>.nx-prayer-premium::-webkit-scrollbar,.nx-live-qibla-pro>.nx2-qibla::-webkit-scrollbar{width:4px}.nx-live-weather-pro>.nx-weather-premium::-webkit-scrollbar-thumb,.nx-live-prayer-pro>.nx-prayer-premium::-webkit-scrollbar-thumb,.nx-live-qibla-pro>.nx2-qibla::-webkit-scrollbar-thumb{border-radius:999px;background:rgba(104,205,235,.20)}
    .nx-live-weather-pro .nxwx-shell{border:1px solid rgba(137,215,239,.14)!important;border-radius:22px!important;background:radial-gradient(circle at 82% 8%,rgba(74,219,255,.07),transparent 25%),linear-gradient(180deg,#0b1b25,#07131b 64%,#050c12)!important;box-shadow:inset 0 1px rgba(255,255,255,.08),inset 0 -3px rgba(0,0,0,.50)!important}
    .nx-live-weather-pro .nxwx-locationbar,.nx-live-weather-pro .nxwx-search,.nx-live-weather-pro .nxwx-forecast-panel,.nx-live-weather-pro .nxwx-radar,.nx-live-weather-pro .nxwx-prayer-strip{border-color:rgba(127,211,238,.11)!important;box-shadow:inset 0 1px rgba(255,255,255,.055),0 6px 15px rgba(0,0,0,.10)!important}
    .nx-live-weather-pro .nxwx-hero{border-radius:22px!important;box-shadow:inset 0 1px rgba(255,255,255,.10),inset 0 -3px rgba(0,0,0,.28),0 8px 20px rgba(0,0,0,.18)!important}.nx-live-weather-pro .nxwx-temp{font-variant-numeric:tabular-nums;text-shadow:0 0 20px rgba(126,231,255,.12),0 2px 0 rgba(0,0,0,.6)}.nx-live-weather-pro .nxwx-metrics article{border-radius:14px!important;background:linear-gradient(160deg,rgba(255,255,255,.045),rgba(3,13,19,.62))!important;box-shadow:inset 0 1px rgba(255,255,255,.07),inset 0 -2px rgba(0,0,0,.36),0 3px 0 rgba(2,8,12,.45)!important}.nx-live-weather-pro button:active{transform:translateY(2px)!important}
    .nx-live-qibla-pro{background:radial-gradient(circle at var(--llx) var(--lly),rgba(48,203,255,.13),transparent 24%),radial-gradient(circle at 86% 84%,rgba(255,195,73,.055),transparent 27%),linear-gradient(145deg,#15242e,#0a141c 58%,#060d13)}.nx-live-qibla-pro .nx2-qb-page{min-height:100%;border:1px solid rgba(82,196,235,.12);border-radius:22px;background:radial-gradient(circle at 50% 31%,rgba(0,174,255,.13),transparent 28%),linear-gradient(180deg,#061823 0%,#030d14 58%,#02080d 100%)!important;box-shadow:inset 0 1px rgba(255,255,255,.07),inset 0 -3px rgba(0,0,0,.55)}.nx-live-qibla-pro .nx2-qb-card,.nx-live-qibla-pro .nx2-qb-ready{border-color:rgba(73,184,225,.14)!important;box-shadow:inset 0 1px rgba(255,255,255,.07),inset 0 -2px rgba(0,0,0,.38),0 4px 0 rgba(1,8,12,.42),0 10px 20px rgba(0,0,0,.15)!important}.nx-live-qibla-pro .nx2-qb-btn{box-shadow:inset 0 1px rgba(255,255,255,.12),inset 0 -4px 7px rgba(0,0,0,.22),0 3px 0 #020b11,0 8px 14px rgba(0,0,0,.16)!important}.nx-live-qibla-pro .nx2-qb-btn:active{transform:translateY(2px);box-shadow:inset 0 3px 7px rgba(0,0,0,.3),0 1px 0 #020b11!important}
    .nx-live-prayer-pro{background:radial-gradient(circle at var(--llx) var(--lly),rgba(88,223,255,.11),transparent 23%),radial-gradient(circle at 87% 85%,rgba(61,221,163,.06),transparent 28%),linear-gradient(145deg,#14262d,#0a171b 58%,#071013)}.nx-live-prayer-pro .nxprayer-console{min-height:100%;border:1px solid rgba(98,215,224,.13)!important;border-radius:22px!important;background:radial-gradient(circle at 86% 7%,rgba(81,227,213,.055),transparent 24%),linear-gradient(180deg,#091c21,#061216 68%,#040b0e)!important;box-shadow:inset 0 1px rgba(255,255,255,.07),inset 0 -3px rgba(0,0,0,.48)!important}.nx-live-prayer-pro .nxprayer-card,.nx-live-prayer-pro .nxprayer-next,.nx-live-prayer-pro .nxprayer-citybox{box-shadow:inset 0 1px rgba(255,255,255,.07),inset 0 -2px rgba(0,0,0,.35),0 4px 0 rgba(2,10,11,.42),0 9px 18px rgba(0,0,0,.13)!important}.nx-live-prayer-pro .nxprayer-card.is-next{filter:brightness(1.08);box-shadow:inset 0 1px rgba(255,255,255,.09),0 4px 0 rgba(4,38,32,.58),0 0 18px rgba(69,238,191,.07)!important}.nx-live-prayer-pro button:active{transform:translateY(2px)!important}
    @keyframes nxLiveLocalSheen{0%,24%{transform:translateX(-74%)}67%,100%{transform:translateX(74%)}}@keyframes nxLiveLocalLed{0%,100%{opacity:.58}50%{opacity:1}}
    @media(max-width:390px){.nx-live-local-pro{padding:5px}.nx-live-local-cockpit{padding:7px 8px}.nx-live-local-copy small{display:none}.nx-live-local-pro>.nx-weather-premium,.nx-live-prayer-pro>.nx-prayer-premium,.nx-live-qibla-pro>.nx2-qibla{max-height:calc(100dvh - 214px)!important}}
    @media(max-height:720px){.nx-live-local-pro{min-height:0}.nx-live-local-cockpit{margin-bottom:4px;padding:5px 7px}.nx-live-local-copy small{display:none}.nx-live-local-pro>.nx-weather-premium,.nx-live-prayer-pro>.nx-prayer-premium,.nx-live-qibla-pro>.nx2-qibla{max-height:calc(100dvh - 202px)!important}}
    .nx-live-qibla-pro,.nx-live-prayer-pro{max-height:none!important;min-height:0!important;overflow:visible!important}
    .nx-live-qibla-pro>.nx2-qibla,.nx-live-prayer-pro>.nx-prayer-premium{max-height:none!important;overflow:visible!important;overscroll-behavior:auto!important;scrollbar-width:auto!important}
    @media(prefers-reduced-motion:reduce){.nx-live-local-pro::before,.nx-live-local-led{animation:none!important}}
  `;
  document.head.appendChild(style);
}

function attachLight(root) {
  const move = event => {
    const rect = root.getBoundingClientRect();
    root.style.setProperty('--llx', `${((event.clientX - rect.left) / Math.max(1,rect.width))*100}%`);
    root.style.setProperty('--lly', `${((event.clientY - rect.top) / Math.max(1,rect.height))*100}%`);
  };
  root.addEventListener('pointermove', move, { passive:true });
  return () => root.removeEventListener('pointermove', move);
}

function wrap(renderer, className, title, subtitle, badge) {
  ensureLiveLocalSkin();
  const body = renderer?.();
  if (!(body instanceof HTMLElement)) return body;
  const shell = document.createElement('div');
  shell.className = `nx-app-body nx-live-local-pro ${className}`;
  const cockpit = document.createElement('div');
  cockpit.className = 'nx-live-local-cockpit';
  cockpit.innerHTML = `<div><i class="nx-live-local-led"></i><span class="nx-live-local-copy"><strong>${title}</strong><small>${subtitle}</small></span></div><b class="nx-live-local-badge">${badge}</b>`;
  shell.append(cockpit, body);
  const detach = attachLight(shell);
  const baseCleanup = body.__cleanup;
  shell.__cleanup = () => { detach(); baseCleanup?.(); };
  return shell;
}

export function renderWeatherCockpit() {
  return wrap(premiumWeatherRenderers.weather, 'nx-live-weather-pro', 'ATMOSPHERIC LIVE DESK', 'OPEN-METEO • GPS/SEARCH • RADAR LAYERS', 'LIVE DATA');
}

export function renderQiblaCockpit() {
  return sacredZeroScrollRenderers.qibla();
}

export function renderPrayerCockpit() {
  return sacredZeroScrollRenderers['prayer-times']();
}

export const liveLocalCockpitRenderers = Object.freeze({
  weather: renderWeatherCockpit,
  qibla: renderQiblaCockpit,
  'prayer-times': renderPrayerCockpit
});
