import { locationSuiteRenderers } from './location-suite.js';
import { driveNativeV2Renderers } from './premium-drive-native-v2.js';

function ensureMotionSkin() {
  if (document.getElementById('nx-location-drive-track-desk-v1')) return;
  const style = document.createElement('style');
  style.id = 'nx-location-drive-track-desk-v1';
  style.textContent = `
    .nx-motion-desk{--mdx:50%;--mdy:8%;position:relative;isolation:isolate;display:grid;grid-template-rows:auto minmax(0,1fr);gap:6px;max-height:calc(100dvh - 170px);min-height:min(610px,calc(100dvh - 170px));padding:6px;border-radius:29px;overflow:hidden;background:radial-gradient(circle at var(--mdx) var(--mdy),rgba(65,215,255,.13),transparent 25%),radial-gradient(circle at 90% 88%,rgba(88,103,255,.075),transparent 29%),linear-gradient(145deg,#17242d,#0c161e 57%,#080f15);box-shadow:inset 0 1px rgba(255,255,255,.13),inset 0 -2px rgba(0,0,0,.76)}
    .nx-motion-desk--drive{background:radial-gradient(circle at 50% 7%,rgba(54,186,255,.105),transparent 24%),radial-gradient(circle at 88% 87%,rgba(34,104,165,.08),transparent 30%),linear-gradient(145deg,#18232c,#0b141c 58%,#070d12)}.nx-motion-desk--track{background:radial-gradient(circle at var(--mdx) var(--mdy),rgba(80,223,199,.09),transparent 25%),radial-gradient(circle at 89% 86%,rgba(63,171,255,.07),transparent 29%),linear-gradient(145deg,#14252a,#0a161b 58%,#071014)}
    .nx-motion-desk::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(108deg,transparent 42%,rgba(255,255,255,.037) 50%,transparent 58%);transform:translateX(-74%);animation:nxMotionSheen 9s ease-in-out infinite}.nx-motion-desk--drive::before{animation:none;opacity:.45;transform:none;background:linear-gradient(135deg,rgba(255,255,255,.025),transparent 32%)}
    .nx-motion-cockpit{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px 9px;border:1px solid rgba(137,214,239,.13);border-radius:15px;background:linear-gradient(180deg,rgba(20,38,50,.97),rgba(8,18,26,.97));box-shadow:inset 0 1px rgba(255,255,255,.09),inset 0 -2px rgba(0,0,0,.44),0 5px 12px rgba(0,0,0,.14)}.nx-motion-cockpit>div{display:flex;align-items:center;gap:7px;min-width:0}.nx-motion-led{width:8px;height:8px;flex:0 0 auto;border-radius:50%;background:#50efbd;box-shadow:0 0 0 3px rgba(80,239,189,.07),0 0 13px rgba(80,239,189,.43);animation:nxMotionLed 2s ease-in-out infinite}.nx-motion-desk--drive .nx-motion-led{background:#58d9ff;box-shadow:0 0 0 3px rgba(88,217,255,.07),0 0 12px rgba(88,217,255,.34);animation:none}.nx-motion-copy{min-width:0}.nx-motion-copy strong{display:block;color:#edfaff;font-size:7.3px!important;letter-spacing:.085em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nx-motion-copy small{display:block;margin-top:2px;color:#71838d;font-size:5.8px;letter-spacing:.045em}.nx-motion-badge{padding:5px 7px;border:1px solid rgba(96,221,255,.12);border-radius:999px;background:rgba(69,205,238,.05);color:#8ce9ff;font-size:5.9px;font-weight:950;letter-spacing:.06em}.nx-motion-desk--drive .nx-motion-badge{border-color:rgba(89,196,255,.14);background:rgba(54,155,219,.055);color:#9ddfff}
    .nx-motion-viewport{min-height:0;overflow:auto;overscroll-behavior:contain;padding:1px 2px 6px;scrollbar-width:thin}.nx-motion-viewport::-webkit-scrollbar{width:4px}.nx-motion-viewport::-webkit-scrollbar-thumb{border-radius:999px;background:rgba(103,205,235,.20)}.nx-motion-viewport>.nx-app-body{max-width:none!important}
    .nx-motion-desk--location .nx-location-suite{padding:0!important}.nx-motion-desk--location .nx-location-hero{margin:0 0 7px!important;border:1px solid rgba(87,205,241,.14)!important;border-radius:20px!important;background:radial-gradient(circle at 88% 12%,rgba(65,217,255,.075),transparent 27%),linear-gradient(155deg,#112632,#081720 68%,#061017)!important;box-shadow:inset 0 1px rgba(255,255,255,.08),inset 0 -3px rgba(0,0,0,.38),0 7px 17px rgba(0,0,0,.14)!important}.nx-motion-desk--location .nx-location-stats{gap:6px!important}.nx-motion-desk--location .nx-location-stats article{border:1px solid rgba(100,202,233,.11)!important;border-radius:14px!important;background:linear-gradient(155deg,rgba(255,255,255,.04),transparent 26%),linear-gradient(180deg,#12232d,#08141c)!important;box-shadow:inset 0 1px rgba(255,255,255,.07),inset 0 -2px rgba(0,0,0,.38),0 3px 0 rgba(2,9,13,.48),0 7px 13px rgba(0,0,0,.11)!important}.nx-motion-desk--location .nx-location-stats strong{font-variant-numeric:tabular-nums;text-shadow:0 0 13px rgba(89,220,255,.07)}.nx-motion-desk--location .nx-location-actions button{border-radius:12px!important;box-shadow:inset 0 1px rgba(255,255,255,.11),inset 0 -4px rgba(0,0,0,.18),0 3px 0 rgba(2,14,20,.62),0 7px 11px rgba(0,0,0,.13)!important}.nx-motion-desk--location .nx-location-actions button:active{transform:translateY(2px)!important;box-shadow:inset 0 3px 6px rgba(0,0,0,.25),0 1px 0 rgba(2,14,20,.62)!important}.nx-motion-desk--location .nx-location-map{border:1px solid rgba(91,200,236,.12)!important;border-radius:18px!important;overflow:hidden;background:linear-gradient(180deg,#0b1c25,#071219)!important;box-shadow:inset 0 1px rgba(255,255,255,.06),0 8px 19px rgba(0,0,0,.15)!important}.nx-motion-desk--location .nx-location-map__frame{border-radius:13px!important;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(120,220,244,.07),0 5px 14px rgba(0,0,0,.16)}
    .nx-motion-desk--drive .nx2-drive{padding:0 0 8px!important}.nx-motion-desk--drive .nx2-dr-page{padding:11px 9px 13px!important;border:1px solid rgba(71,173,227,.13);border-radius:21px;background:radial-gradient(circle at 50% 25%,rgba(0,104,172,.12),transparent 33%),linear-gradient(180deg,#071725,#030c13)!important;box-shadow:inset 0 1px rgba(255,255,255,.065),inset 0 -3px rgba(0,0,0,.5)}.nx-motion-desk--drive .nx2-dr-meter{width:min(100%,470px)!important;margin-top:4px!important;filter:drop-shadow(0 15px 18px rgba(0,0,0,.19))}.nx-motion-desk--drive .nx2-dr-panel{margin-top:9px!important;border-color:rgba(69,162,218,.13)!important;border-radius:19px!important;background:linear-gradient(155deg,#091925,#040d14)!important;box-shadow:inset 0 1px rgba(255,255,255,.06),inset 0 -3px rgba(0,0,0,.38),0 6px 15px rgba(0,0,0,.13)!important}.nx-motion-desk--drive .nx2-dr-readout{box-shadow:inset 0 2px 7px rgba(0,0,0,.45),0 5px 16px rgba(0,0,0,.24)!important}.nx-motion-desk--drive [data-dr-main],.nx-motion-desk--drive [data-dr-stop]{box-shadow:inset 0 1px rgba(255,255,255,.12),inset 0 -4px 6px rgba(0,0,0,.20),0 3px 0 rgba(2,12,18,.72),0 7px 12px rgba(0,0,0,.14)!important}.nx-motion-desk--drive [data-dr-main]:active,.nx-motion-desk--drive [data-dr-stop]:active{transform:translateY(2px)!important;box-shadow:inset 0 3px 7px rgba(0,0,0,.28),0 1px 0 rgba(2,12,18,.72)!important}
    .nx-motion-desk--track .nx-track-premium{padding:0!important}.nx-motion-desk--track .nxtrack-console,.nx-motion-desk--track .nxtrack-trips{border-color:rgba(84,207,202,.11)!important;border-radius:19px!important;background:linear-gradient(155deg,rgba(255,255,255,.03),transparent 24%),linear-gradient(180deg,#10242a,#071418)!important;box-shadow:inset 0 1px rgba(255,255,255,.07),inset 0 -3px rgba(0,0,0,.39),0 7px 17px rgba(0,0,0,.13)!important}.nx-motion-desk--track .nxtrack-summary article{border-color:rgba(87,205,205,.10)!important;border-radius:13px!important;background:linear-gradient(180deg,#12282d,#09171b)!important;box-shadow:inset 0 1px rgba(255,255,255,.065),inset 0 -2px rgba(0,0,0,.35),0 3px 0 rgba(2,12,14,.48)!important}.nx-motion-desk--track .nxtrack-summary strong{font-variant-numeric:tabular-nums}.nx-motion-desk--track .nxtrack-chart{border-radius:15px!important;background:linear-gradient(180deg,rgba(4,16,19,.63),rgba(3,10,13,.72))!important;box-shadow:inset 0 3px 9px rgba(0,0,0,.28),inset 0 -1px rgba(255,255,255,.035)}.nx-motion-desk--track .nxtrack-trip{border-color:rgba(92,199,203,.09)!important;border-radius:13px!important;background:linear-gradient(155deg,rgba(255,255,255,.035),transparent 28%),linear-gradient(180deg,#102128,#081318)!important;box-shadow:inset 0 1px rgba(255,255,255,.06),inset 0 -2px rgba(0,0,0,.34),0 3px 0 rgba(2,10,12,.44)!important}
    @keyframes nxMotionSheen{0%,24%{transform:translateX(-74%)}67%,100%{transform:translateX(74%)}}@keyframes nxMotionLed{0%,100%{opacity:.6}50%{opacity:1}}
    @media(max-width:390px){.nx-motion-desk{padding:5px}.nx-motion-cockpit{padding:7px 8px}.nx-motion-copy small{display:none}.nx-motion-desk--drive .nx2-dr-page{padding:8px 6px 10px!important}.nx-motion-desk--drive .nx2-dr-meter{width:min(100%,410px)!important}}
    @media(max-height:720px){.nx-motion-desk{min-height:0}.nx-motion-cockpit{padding:5px 7px}.nx-motion-copy small{display:none}.nx-motion-desk--drive .nx2-dr-meter{width:min(100%,385px)!important}}
    @media(prefers-reduced-motion:reduce){.nx-motion-desk::before,.nx-motion-led{animation:none!important}}
  `;
  document.head.appendChild(style);
}

function wrap(renderer, className, title, subtitle, badge, interactiveLight = true) {
  ensureMotionSkin();
  const body = renderer?.();
  if (!(body instanceof HTMLElement)) return body;
  const root = document.createElement('div');
  root.className = `nx-app-body nx-motion-desk ${className}`;
  const cockpit = document.createElement('div');
  cockpit.className = 'nx-motion-cockpit';
  cockpit.innerHTML = `<div><i class="nx-motion-led"></i><span class="nx-motion-copy"><strong>${title}</strong><small>${subtitle}</small></span></div><b class="nx-motion-badge">${badge}</b>`;
  const viewport = document.createElement('div');
  viewport.className = 'nx-motion-viewport';
  viewport.append(body);
  root.append(cockpit, viewport);
  let move = null;
  if (interactiveLight) {
    move = event => {
      const rect = root.getBoundingClientRect();
      root.style.setProperty('--mdx', `${((event.clientX - rect.left) / Math.max(1, rect.width)) * 100}%`);
      root.style.setProperty('--mdy', `${((event.clientY - rect.top) / Math.max(1, rect.height)) * 100}%`);
    };
    root.addEventListener('pointermove', move, { passive:true });
  }
  const baseCleanup = body.__cleanup;
  root.__cleanup = () => {
    if (move) root.removeEventListener('pointermove', move);
    baseCleanup?.();
  };
  return root;
}

export const liveLocationDriveRenderers = Object.freeze({
  location: () => wrap(locationSuiteRenderers.location, 'nx-motion-desk--location', 'PRIVATE LOCATION DESK', 'ON-DEMAND GPS • NO SCREEN STORAGE • OSM MAP', 'GPS ON TAP'),
  'nova-drive': () => wrap(driveNativeV2Renderers['nova-drive'], 'nx-motion-desk--drive', 'NOVA DRIVE COCKPIT', 'NATIVE BACKGROUND ENGINE • PRECISE GPS • TRIP SAFE', 'NATIVE GPS', false),
  'nova-track': () => wrap(driveNativeV2Renderers['nova-track'], 'nx-motion-desk--track', 'NOVA TRACK ANALYTICS', 'ACCOUNT-AWARE HISTORY • DAY/WEEK/MONTH AGGREGATES', 'PRIVATE DATA')
});
