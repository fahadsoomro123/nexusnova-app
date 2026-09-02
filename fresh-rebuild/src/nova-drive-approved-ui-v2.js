import {
  createNovaVehiclePairing,
  loadNovaVehicleDashboard,
  revokeNovaVehicle,
  setNovaVehiclePaused
} from './core/nova-vehicle-premium-store.js';

const attached = new WeakSet();
const POLL_MS = 10_000;
const DOMAIN = 'https://nexusnovatools.com/';
const DRIVE_ASSET = './assets/visuals/nova-drive-approved-v7.png';
const TRACKER_ASSET = './assets/visuals/nova-vehicle-tracking-approved-v2.png';

function ago(ms) {
  const at = Number(ms) || 0;
  if (!at) return 'Never';
  const age = Math.max(0, Date.now() - at);
  if (age < 15_000) return 'Now';
  if (age < 60_000) return `${Math.floor(age / 1000)}s ago`;
  if (age < 3_600_000) return `${Math.floor(age / 60_000)}m ago`;
  return `${Math.floor(age / 3_600_000)}h ago`;
}

function compass(degrees) {
  const names = ['N','NE','E','SE','S','SW','W','NW'];
  const value = (((Number(degrees) || 0) % 360) + 360) % 360;
  return `${names[Math.round(value / 45) % 8]} ${Math.round(value)}°`;
}

function internalBrowser(url) {
  try {
    if (typeof window.NexusBrowserAndroid?.postMessage === 'function') {
      window.NexusBrowserAndroid.postMessage(JSON.stringify({ action:'open', url }));
      return true;
    }
  } catch {}
  try { window.open(url, '_blank', 'noopener,noreferrer'); return true; }
  catch { return false; }
}

function openMap(vehicle) {
  const lat = Number(vehicle?.live?.latitude);
  const lng = Number(vehicle?.live?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return internalBrowser(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`);
}

function styles() {
  return `<style data-nx-approved-drive-style>
  html.nx-approved-drive-active,html.nx-approved-drive-active body{width:100%!important;height:100dvh!important;min-height:0!important;max-height:100dvh!important;overflow:hidden!important}
  html.nx-approved-drive-active .nx-stage{position:absolute!important;inset:0!important;width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;padding:0!important;overflow:visible!important}
  html.nx-approved-drive-active .nx-stage>.nx-drive-v3-screen{position:absolute!important;inset:0!important;width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;animation:none!important;transform:none!important}
  html.nx-approved-drive-active .nx-dock,html.nx-approved-drive-active #nxEmergencySosButton,html.nx-approved-drive-active #nxEmergencySosEdit{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}
  .nxdr3{position:absolute!important;inset:0!important;width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;padding:0!important;overflow:visible!important;background:#01050a!important}
  .nxdr3>.nx-approved-drive{visibility:visible!important}
  .nxdr3>:not(style):not(.nx-approved-drive){visibility:hidden!important}
  .nx-approved-drive,.nx-approved-drive *{box-sizing:border-box}
  .nx-approved-drive{position:fixed!important;top:0!important;left:0!important;right:auto!important;bottom:auto!important;width:var(--nx-approved-vw,100vw)!important;height:var(--nx-approved-vh,100dvh)!important;z-index:120;overflow:hidden;background:#01050a;color:#f5fbff;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;isolation:isolate}
  .nx-approved-view{position:absolute;top:50%;left:50%;width:var(--nx-approved-canvas-w);height:var(--nx-approved-canvas-h);display:none;overflow:hidden;transform:translate(-50%,-50%);transform-origin:center}.nx-approved-view.is-active{display:block}
  .nx-approved-view[data-approved-drive-view]{--nx-approved-canvas-w:var(--nx-approved-drive-cover-w,100vw);--nx-approved-canvas-h:var(--nx-approved-drive-cover-h,max(100dvh,170.370371vw));aspect-ratio:864/1472}
  .nx-approved-view[data-approved-tracker-view]{--nx-approved-canvas-w:var(--nx-approved-tracker-cover-w,100vw);--nx-approved-canvas-h:var(--nx-approved-tracker-cover-h,max(100dvh,177.683316vw));aspect-ratio:941/1672}
  .nx-approved-art{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center;display:block;user-select:none;pointer-events:none}
  .nx-approved-hit{position:absolute;z-index:15;border:0!important;background:transparent!important;color:transparent!important;padding:0!important;margin:0!important;cursor:pointer;-webkit-tap-highlight-color:transparent}
  .nx-approved-value{position:absolute;z-index:18;display:grid;place-items:center;text-align:center;background:#061522;color:#f7fbff;font-weight:900;line-height:1;pointer-events:none;overflow:hidden}
  .nx-approved-value small{display:block;margin-top:3px;color:#8cb2cc;font-size:.54em;font-weight:800}
  .nx-approved-drive-speed{left:39.7%;top:30.7%;width:20.7%;height:10.0%;border-radius:46%;background:radial-gradient(circle,#020b14 0 74%,rgba(2,11,20,.94) 75%,transparent 77%);font-size:clamp(35px,11vw,72px)}
  .nx-approved-drive-speed small{color:#24d8ff;font-size:clamp(9px,2.6vw,17px)}
  .nx-approved-metric{top:52.25%;height:5.45%;border-radius:5px;font-size:clamp(13px,3.8vw,27px);background:linear-gradient(180deg,#071725,#06131f);box-shadow:0 0 5px 3px #06131f}
  .nx-approved-metric.m1{left:8.2%;width:11.2%}.nx-approved-metric.m2{left:29.45%;width:10.8%}.nx-approved-metric.m3{left:51.65%;width:10.3%}.nx-approved-metric.m4{left:73.05%;width:13.8%}
  .nx-approved-heading{left:79.5%;top:43.25%;width:14.4%;height:3.15%;font-size:clamp(10px,2.9vw,20px);border-radius:5px;background:#06131f;box-shadow:0 0 4px 3px #06131f}
  .nx-approved-cloud{left:80.5%;top:29.15%;width:13.1%;height:3.05%;font-size:clamp(10px,2.9vw,20px);border-radius:5px;background:#06131f;box-shadow:0 0 4px 3px #06131f}
  .nx-approved-activity{left:5.8%;top:34.35%;width:16.9%;height:10.9%;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;padding:5% 6%;text-align:left;font-size:clamp(9px,2.55vw,17px);line-height:1.18;border-radius:9px;background:linear-gradient(180deg,#071827,#06131f);box-shadow:0 0 6px 4px #06131f}.nx-approved-activity small{margin:0 0 8%;color:#4ed8ff;font-size:.62em}.nx-approved-activity b{font-size:1em}.nx-approved-activity span{display:block;margin-top:11%;color:#8da9bd;font-size:.58em;line-height:1.35}
  .nx-approved-analytics{top:65.35%;height:4.55%;border-radius:5px;font-size:clamp(10px,2.75vw,20px);background:linear-gradient(180deg,#071625,#05111d);box-shadow:0 0 5px 3px #06131f}
  .nx-approved-analytics.a1{left:8.2%;width:13.0%}.nx-approved-analytics.a2{left:29.0%;width:12.2%}.nx-approved-analytics.a3{left:51.5%;width:12.1%}.nx-approved-analytics.a4{left:73.0%;width:19.0%}
  .nx-approved-track-toggle{left:56.25%;top:9.62%;width:37.25%;height:8.18%;z-index:22;border-radius:26px!important;border:1.6px solid rgba(29,211,255,.86)!important;background:linear-gradient(180deg,#071d2c,#041421 45%,#020d17)!important;display:grid!important;grid-template-columns:10px minmax(0,1fr);align-items:center;gap:6px;padding:0 10px!important;color:#51e4ff!important;font-weight:950!important;font-size:clamp(13px,3.45vw,26px)!important;letter-spacing:.035em;box-shadow:0 0 0 3px #03101a,inset 0 1px 0 rgba(255,255,255,.11)}
  .nx-approved-track-toggle i{width:10px;height:10px;border-radius:50%;background:#38ff8d;box-shadow:0 0 10px #38ff8d}.nx-approved-track-toggle.is-off{color:#ff6f79!important}.nx-approved-track-toggle.is-off i{background:#ff4f5c;box-shadow:0 0 10px #ff4f5c}
  .nx-approved-back{position:absolute;z-index:42;left:var(--nx-approved-crop-x,0px);top:3.15%;width:max(6%,42px);height:max(4.6%,42px);border:1px solid rgba(91,218,255,.42);border-left:0;border-radius:0 12px 12px 0;background:linear-gradient(180deg,rgba(30,53,70,.98),rgba(6,22,35,.98) 30%,rgba(2,12,21,.99));color:#8cecff;font-weight:900;font-size:clamp(18px,5vw,34px);display:grid;place-items:center;padding:0;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.22),inset 0 -2px 0 rgba(0,0,0,.8),0 5px 12px rgba(0,0,0,.45)}
  .nx-approved-domain-strip{position:absolute;z-index:40;left:calc(var(--nx-approved-crop-x,0px) + 3.75vw);width:92.5vw;height:6.55%;border-radius:22px;overflow:hidden;display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(41,209,255,.5);background:radial-gradient(circle at 50% 50%,rgba(0,205,255,.13),transparent 42%),linear-gradient(180deg,#0b293b,#061725 46%,#020c15);color:#f2fbff;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),inset 0 -2px 0 rgba(0,0,0,.78),inset 0 0 26px rgba(0,183,255,.08),0 7px 18px rgba(0,0,0,.52);cursor:pointer}.nx-approved-domain-strip.drive{top:84.45%}.nx-approved-domain-strip.tracker{top:79.0%}.nx-approved-domain-strip span{position:relative;font-weight:950;font-size:clamp(15px,4.1vw,30px);letter-spacing:.035em;white-space:nowrap;text-shadow:0 2px 5px rgba(0,0,0,.9),0 0 10px rgba(0,191,255,.16)}
  .nx-approved-mode-tab{position:absolute;z-index:60;bottom:1.1%;width:37.5vw;height:6.15%;border:1px solid rgba(123,202,237,.38);color:#eafaff;cursor:pointer;display:grid;grid-template-columns:38px minmax(0,1fr);gap:8px;align-items:center;padding:0 11px;background:linear-gradient(180deg,#253847,#0c1e2d 17%,#04111d 66%,#0b2030);box-shadow:inset 0 1px 0 rgba(255,255,255,.25),inset 0 -2px 0 rgba(0,0,0,.82),0 7px 14px rgba(0,0,0,.55)}
  .nx-approved-mode-tab:after{content:'';position:absolute;inset:3px;border:1px solid rgba(49,202,255,.14);pointer-events:none}.nx-approved-mode-tab.drive{left:calc(var(--nx-approved-crop-x,0px) + 4.2vw);clip-path:polygon(0 18%,7% 0,100% 0,100% 100%,7% 100%,0 82%)}.nx-approved-mode-tab.vehicle{right:calc(var(--nx-approved-crop-x,0px) + 4.2vw);clip-path:polygon(0 0,93% 0,100% 18%,100% 82%,93% 100%,0 100%)}.nx-approved-mode-tab.is-active{border-color:rgba(67,225,255,.84);background:linear-gradient(180deg,#28546d,#0c3149 22%,#041827 70%,#0d354d);box-shadow:inset 0 1px 0 rgba(255,255,255,.32),inset 0 -2px 0 rgba(0,0,0,.86),inset 0 0 18px rgba(0,194,255,.1),0 0 13px rgba(0,200,255,.13)}
  .nx-approved-tab-icon{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(155deg,#17374c,#071622 65%,#020810);border:1px solid rgba(86,218,255,.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.18)}.nx-approved-tab-icon svg{width:25px;height:25px}.nx-approved-tab-copy{min-width:0;line-height:1;text-align:left}.nx-approved-tab-copy b{display:block;white-space:nowrap;font-size:clamp(10px,2.45vw,19px);letter-spacing:.025em}.nx-approved-tab-copy small{display:block;margin-top:5px;color:#61dfff;font-weight:900;letter-spacing:.12em;font-size:clamp(6px,1.45vw,11px);white-space:nowrap}.nx-approved-mode-tab.vehicle .nx-approved-tab-copy b{font-size:clamp(8px,2.05vw,16px)}.nx-approved-mode-tab.vehicle .nx-approved-tab-copy small{font-size:clamp(5.5px,1.35vw,10px)}
  .nx-approved-premium-cover{position:absolute;z-index:25;display:none;background:linear-gradient(180deg,#071522,#030b13);border:1px solid rgba(91,176,221,.14);box-shadow:inset 0 0 18px rgba(0,145,210,.05)}
  .nx-approved-premium-cover.card{left:5.0%;top:70.7%;width:52.4%;height:7.5%;border-radius:18px}.nx-approved-premium-cover.tab{right:calc(var(--nx-approved-crop-x,0px) + 4.1vw);bottom:1%;width:39vw;height:6.5%;border-radius:14px;z-index:65}
  .nx-approved-drive.is-locked .nx-approved-premium-cover{display:block}
  .nx-approved-drive.is-locked [data-approved-vehicle-hit],.nx-approved-drive.is-locked [data-approved-premium-hit]{pointer-events:none}
  .nx-approved-tracker-status{left:69%;top:12.3%;width:22%;height:3.4%;background:#061522;color:#49ff8f;font-size:clamp(10px,2.8vw,19px);border-radius:10px;display:flex;align-items:center;justify-content:center;gap:7px}.nx-approved-tracker-status:before{content:'';width:9px;height:9px;flex:0 0 9px;border-radius:50%;background:currentColor;box-shadow:0 0 10px currentColor}
  .nx-approved-tracker-stat{background:#061522;border-radius:5px;font-size:clamp(10px,2.8vw,20px);box-shadow:0 0 5px 3px #061522}
  .nx-approved-tracker-stat.speed{left:4.8%;top:23.1%;width:13.2%;height:5.7%;font-size:clamp(13px,3.7vw,25px)}.nx-approved-tracker-stat.battery{left:4.8%;top:39.05%;width:14%;height:3.1%}.nx-approved-tracker-stat.power{left:4.0%;top:52.1%;width:21%;height:2.65%;font-size:clamp(8px,2.5vw,17px)}.nx-approved-tracker-stat.heading{left:81.3%;top:27.5%;width:12.0%;height:2.8%}.nx-approved-tracker-stat.seen{left:85.0%;top:39.2%;width:9.5%;height:3.05%;color:#47ff82}.nx-approved-tracker-stat.gps{left:82.9%;top:52.0%;width:9.0%;height:2.8%}.nx-approved-tracker-stat.geofence{left:20.0%;top:61.8%;width:12.0%;height:2.8%;color:#8ca8bb}.nx-approved-tracker-stat.cloud{left:69.8%;top:61.8%;width:10.0%;height:2.8%}
  .nx-approved-action-row{position:absolute;z-index:30;left:calc(var(--nx-approved-crop-x,0px) + 3vw);top:67.2%;width:94vw;height:10.3%;display:grid;grid-template-columns:repeat(3,1fr);gap:1.8vw}.nx-approved-action{min-width:0;border-radius:20px;border:1.4px solid rgba(60,189,248,.34);background:linear-gradient(180deg,rgba(17,45,67,.995),rgba(5,20,33,.998) 56%,rgba(2,10,18,.999));box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 -2px 0 rgba(0,0,0,.8),inset 0 0 22px rgba(0,170,255,.045),0 7px 15px rgba(0,0,0,.42);color:#dcefff;display:grid;grid-template-rows:1fr auto;align-items:center;justify-items:center;padding:8% 5% 9%;cursor:pointer}.nx-approved-action-icon{width:clamp(40px,10vw,76px);aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 36% 28%,rgba(56,221,255,.16),transparent 37%),linear-gradient(160deg,#0c2a40,#051522 65%,#020811);border:1.5px solid rgba(41,210,255,.7);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 0 18px rgba(0,197,255,.14)}.nx-approved-action-icon svg{width:62%;height:62%}.nx-approved-action b{font-size:clamp(8px,2.2vw,19px);letter-spacing:.02em;white-space:nowrap}.nx-approved-action.security{border-color:rgba(128,105,255,.48);background:linear-gradient(180deg,rgba(28,30,65,.995),rgba(9,18,35,.998) 58%,rgba(3,9,17,.999))}.nx-approved-action.security .nx-approved-action-icon{border-color:rgba(155,111,255,.78);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 0 18px rgba(126,70,255,.18)}
  .nx-approved-paired-mask{position:absolute;z-index:32;left:calc(var(--nx-approved-crop-x,0px) + 3vw);top:67.2%;width:30.3vw;height:10.3%;display:none;place-items:end center;padding-bottom:11px;border-radius:20px;background:linear-gradient(180deg,rgba(9,34,50,.98),rgba(3,14,24,.99));border:1px solid rgba(65,219,255,.42);color:#83f4ff;font-size:clamp(9px,2.4vw,17px);font-weight:950;letter-spacing:.04em;pointer-events:none}.nx-approved-paired-mask.is-visible{display:grid}
  .nx-approved-paired-mask:before{content:'✓';position:absolute;top:16%;left:50%;transform:translateX(-50%);width:44px;height:44px;border-radius:50%;display:grid;place-items:center;color:#70ffae;border:1px solid rgba(76,255,164,.45);background:#08231d;font-size:24px;box-shadow:0 0 16px rgba(46,255,153,.14)}
  .nx-approved-sweep{position:absolute;z-index:12;left:16.4%;top:19.6%;width:66.9%;aspect-ratio:1;border-radius:50%;pointer-events:none;background:conic-gradient(from 0deg,transparent 0 80%,rgba(60,228,255,.02) 87%,rgba(60,228,255,.12) 99%,transparent);mask:radial-gradient(circle,transparent 0 10%,#000 11%);-webkit-mask:radial-gradient(circle,transparent 0 10%,#000 11%);animation:nxApprovedSweep 7s linear infinite}
  .nx-approved-pulse{position:absolute;z-index:13;left:47.1%;top:36.2%;width:6.2%;aspect-ratio:1;border:2px solid rgba(67,255,151,.76);border-radius:50%;pointer-events:none;animation:nxApprovedPulse 1.8s ease-out infinite}
  @keyframes nxApprovedSweep{to{transform:rotate(360deg)}}@keyframes nxApprovedPulse{0%{transform:scale(.55);opacity:.85}100%{transform:scale(1.9);opacity:0}}
  .nx-approved-modal{position:absolute;inset:0;z-index:80;display:none;align-items:flex-end;background:rgba(0,5,10,.64);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}.nx-approved-modal.is-open{display:flex}
  .nx-approved-sheet{width:calc(100% - 14px);margin:7px;padding:14px;border:1px solid rgba(102,199,245,.28);border-radius:23px;background:radial-gradient(circle at 80% 0,rgba(126,76,255,.13),transparent 30%),linear-gradient(180deg,#0a2134,#04111d 62%,#020811);box-shadow:0 -18px 55px rgba(0,0,0,.72),inset 0 1px 0 rgba(255,255,255,.1)}
  .nx-approved-sheet-head{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center}.nx-approved-sheet-head small{display:block;color:#62ddff;font-size:8px;font-weight:950;letter-spacing:.12em}.nx-approved-sheet-head strong{display:block;margin-top:3px;font-size:21px}.nx-approved-close{width:38px;height:38px;border:1px solid rgba(111,190,232,.2);border-radius:12px;background:#0b263b;color:#d9f5ff;font-size:20px}
  .nx-approved-protect{margin-top:10px;padding:9px;border-radius:13px;background:rgba(18,75,55,.26);border:1px solid rgba(54,255,151,.14);color:#72ffb3;font-size:9px;font-weight:950;display:flex;justify-content:space-between;gap:8px}
  .nx-approved-security-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.nx-approved-sec-card{padding:10px;border:1px solid rgba(79,188,240,.16);border-radius:15px;background:linear-gradient(180deg,#0a263b,#051522)}.nx-approved-sec-card small{display:block;color:#789bb4;font-size:7px;font-weight:950}.nx-approved-sec-card strong{display:block;margin-top:4px;font-size:14px}.nx-approved-sec-card p{margin:6px 0 0;color:#90a9bb;font-size:8px;line-height:1.35}.nx-approved-sec-card.pause strong{color:#ffd27c}.nx-approved-sec-card.unpair strong{color:#ff9aa8}
  .nx-approved-sec-actions,.nx-approved-confirm-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.nx-approved-sec-actions button,.nx-approved-confirm-actions button{min-height:42px;border:1px solid rgba(80,198,249,.2);border-radius:13px;background:#082a40;color:#a5edff;font-size:9px;font-weight:950}.nx-approved-sec-actions .danger,.nx-approved-confirm-actions .danger{background:#3a141f;color:#ffc2cb;border-color:rgba(255,96,120,.2)}
  .nx-approved-hold{position:relative;overflow:hidden}.nx-approved-hold-fill{position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(255,63,88,.2);pointer-events:none}.nx-approved-hold span{position:relative;z-index:2}
  .nx-approved-confirm{display:none;margin-top:9px;padding:10px;border:1px solid rgba(255,93,116,.18);border-radius:14px;background:#210d14}.nx-approved-confirm.is-open{display:block}.nx-approved-confirm strong{color:#ffb5c0;font-size:13px}.nx-approved-confirm p{margin:5px 0 0;color:#a98e97;font-size:8px;line-height:1.35}
  .nx-approved-code{font-size:24px!important;letter-spacing:.13em;text-align:center;margin:10px 0!important;color:#fff!important}.nx-approved-code-note{text-align:center;color:#8aa4b8;font-size:8px;line-height:1.4}
  .nx-approved-toast{position:absolute;z-index:100;left:50%;bottom:9%;transform:translateX(-50%) translateY(16px);opacity:0;pointer-events:none;padding:9px 13px;border-radius:999px;border:1px solid rgba(75,199,251,.22);background:#071c2b;color:#bdefff;font-size:9px;font-weight:950;transition:.2s}.nx-approved-toast.is-show{opacity:1;transform:translateX(-50%) translateY(0)}
  @media(max-width:520px){.nx-approved-activity{align-items:center;text-align:center;padding-left:2%;padding-right:2%}}
  @media(max-width:355px){.nx-approved-sheet{padding:11px}.nx-approved-security-grid{gap:5px}.nx-approved-track-toggle{font-size:12px!important}.nx-approved-paired-mask:before{width:38px;height:38px;font-size:21px}.nx-approved-mode-tab{grid-template-columns:32px minmax(0,1fr);gap:5px;padding:0 7px}.nx-approved-tab-icon{width:31px;height:31px}.nx-approved-tab-icon svg{width:22px;height:22px}.nx-approved-action b{font-size:7px}}
  @media(prefers-reduced-motion:reduce){.nx-approved-sweep,.nx-approved-pulse{animation:none!important}}
  </style>`;
}

function markup() {
  return `<div class="nx-approved-drive is-locked" data-nx-approved>
    <section class="nx-approved-view is-active" data-approved-drive-view>
      <img class="nx-approved-art" src="${DRIVE_ASSET}" alt="Nova Drive cockpit">
      <button class="nx-approved-back" type="button" data-approved-hub-back aria-label="Back to Nova Hub">←</button>
      <button class="nx-approved-track-toggle" data-approved-tracking><i></i><span>TRACKING ON</span></button>
      <div class="nx-approved-value nx-approved-drive-speed" data-approved-speed>0<small>km/h</small></div>
      <div class="nx-approved-value nx-approved-activity" data-approved-activity><small>LIVE DETECTION</small><b>SMART GPS</b></div>
      <div class="nx-approved-value nx-approved-cloud" data-approved-cloud>LOCAL</div>
      <div class="nx-approved-value nx-approved-heading" data-approved-heading>—</div>
      <div class="nx-approved-value nx-approved-metric m1" data-approved-distance>0.00<small>km</small></div>
      <div class="nx-approved-value nx-approved-metric m2" data-approved-average>0<small>km/h</small></div>
      <div class="nx-approved-value nx-approved-metric m3" data-approved-top>0<small>km/h</small></div>
      <div class="nx-approved-value nx-approved-metric m4" data-approved-duration>00:00<small>hh:mm</small></div>
      <div class="nx-approved-value nx-approved-analytics a1" data-approved-today>0.00 km<small>0 trips</small></div>
      <div class="nx-approved-value nx-approved-analytics a2" data-approved-week>0.00 km<small>analytics</small></div>
      <div class="nx-approved-value nx-approved-analytics a3" data-approved-month>0.00 km<small>analytics</small></div>
      <div class="nx-approved-value nx-approved-analytics a4" data-approved-history>0 trips<small>Nova Track merged</small></div>
      <button class="nx-approved-hit" data-approved-premium-hit style="left:5%;top:70%;width:53%;height:9%" aria-label="Open Vehicle Tracking"></button>
      <button class="nx-approved-hit" data-approved-recover style="left:59%;top:70%;width:36%;height:9%" aria-label="Recover Drive data"></button>
      <button class="nx-approved-domain-strip drive" type="button" data-approved-domain aria-label="Open nexusnovatools.com"><span>www.nexusnovatools.com</span></button>
      <button class="nx-approved-mode-tab drive is-active" type="button" data-approved-drive-hit aria-label="Drive">
        <span class="nx-approved-tab-icon"><svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="11" stroke="#75edff" stroke-width="2"/><circle cx="16" cy="16" r="3" fill="#eaffff"/><path d="M6 15h20M16 16l-7 7M16 16l7 7" stroke="#75edff" stroke-width="2" stroke-linecap="round"/></svg></span>
        <span class="nx-approved-tab-copy"><b>DRIVE</b><small>COCKPIT</small></span>
      </button>
      <button class="nx-approved-mode-tab vehicle" type="button" data-approved-vehicle-hit aria-label="Vehicle Tracking">
        <span class="nx-approved-tab-icon"><svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="13" r="9" stroke="#a378ff" stroke-width="2"/><circle cx="16" cy="13" r="4" stroke="#66ebff" stroke-width="2"/><circle cx="16" cy="13" r="1.7" fill="#efffff"/><path d="M16 22v7M11 28h10" stroke="#66ebff" stroke-width="2" stroke-linecap="round"/></svg></span>
        <span class="nx-approved-tab-copy"><b>VEHICLE TRACKING</b><small>LIVE TRACKER</small></span>
      </button>
      <i class="nx-approved-premium-cover card"></i><i class="nx-approved-premium-cover tab"></i>
    </section>
    <section class="nx-approved-view" data-approved-tracker-view>
      <img class="nx-approved-art" src="${TRACKER_ASSET}" alt="Vehicle Tracking">
      <i class="nx-approved-sweep"></i><i class="nx-approved-pulse"></i>
      <button class="nx-approved-back" type="button" data-approved-tracker-hub-back aria-label="Back to Nova Hub">←</button>
      <div class="nx-approved-value nx-approved-tracker-status" data-tracker-status>OFFLINE</div>
      <div class="nx-approved-value nx-approved-tracker-stat speed" data-tracker-speed>0<small>km/h</small></div>
      <div class="nx-approved-value nx-approved-tracker-stat battery" data-tracker-battery>—</div>
      <div class="nx-approved-value nx-approved-tracker-stat power" data-tracker-power>—</div>
      <div class="nx-approved-value nx-approved-tracker-stat heading" data-tracker-heading>—</div>
      <div class="nx-approved-value nx-approved-tracker-stat seen" data-tracker-seen>Never</div>
      <div class="nx-approved-value nx-approved-tracker-stat gps" data-tracker-gps>—</div>
      <div class="nx-approved-value nx-approved-tracker-stat geofence">NOT SET</div>
      <div class="nx-approved-value nx-approved-tracker-stat cloud">LOCAL</div>
      <div class="nx-approved-action-row">
        <button class="nx-approved-action" type="button" data-tracker-pair aria-label="Pair tracker"><span class="nx-approved-action-icon"><svg viewBox="0 0 32 32" fill="none"><path d="M12 19l-3 3a5 5 0 007 7l4-4M20 13l3-3a5 5 0 10-7-7l-4 4M11 21l10-10" stroke="#6beaff" stroke-width="2.5" stroke-linecap="round"/></svg></span><b>PAIR TRACKER</b></button>
        <button class="nx-approved-action" type="button" data-tracker-map aria-label="Open map"><span class="nx-approved-action-icon"><svg viewBox="0 0 32 32" fill="none"><path d="M4 7l8-3 8 3 8-3v21l-8 3-8-3-8 3z" stroke="#60b7ff" stroke-width="2"/><path d="M12 4v21M20 7v21" stroke="#60b7ff" stroke-width="2"/><circle cx="21" cy="16" r="3" stroke="#7eeaff" stroke-width="2"/></svg></span><b>OPEN MAP</b></button>
        <button class="nx-approved-action security" type="button" data-tracker-security aria-label="Tracker security"><span class="nx-approved-action-icon"><svg viewBox="0 0 32 32" fill="none"><path d="M16 3l10 4v8c0 7-4 11-10 14C10 26 6 22 6 15V7z" stroke="#a47cff" stroke-width="2.3"/><rect x="11" y="13" width="10" height="8" rx="2" stroke="#72edff" stroke-width="2"/><path d="M13 13v-2a3 3 0 016 0v2" stroke="#72edff" stroke-width="2"/></svg></span><b>TRACKER SECURITY</b></button>
      </div>
      <div class="nx-approved-paired-mask" data-tracker-paired>TRACKER PAIRED ✓</div>
      <button class="nx-approved-domain-strip tracker" type="button" data-approved-domain aria-label="Open nexusnovatools.com"><span>www.nexusnovatools.com</span></button>
      <button class="nx-approved-mode-tab drive" type="button" data-approved-drive-hit aria-label="Drive">
        <span class="nx-approved-tab-icon"><svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="11" stroke="#75edff" stroke-width="2"/><circle cx="16" cy="16" r="3" fill="#eaffff"/><path d="M6 15h20M16 16l-7 7M16 16l7 7" stroke="#75edff" stroke-width="2" stroke-linecap="round"/></svg></span>
        <span class="nx-approved-tab-copy"><b>DRIVE</b><small>COCKPIT</small></span>
      </button>
      <button class="nx-approved-mode-tab vehicle is-active" type="button" data-approved-vehicle-hit aria-label="Vehicle Tracking">
        <span class="nx-approved-tab-icon"><svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="13" r="9" stroke="#a378ff" stroke-width="2"/><circle cx="16" cy="13" r="4" stroke="#66ebff" stroke-width="2"/><circle cx="16" cy="13" r="1.7" fill="#efffff"/><path d="M16 22v7M11 28h10" stroke="#66ebff" stroke-width="2" stroke-linecap="round"/></svg></span>
        <span class="nx-approved-tab-copy"><b>VEHICLE TRACKING</b><small>LIVE TRACKER</small></span>
      </button>
    </section>
    <section class="nx-approved-modal" data-security-modal>
      <div class="nx-approved-sheet">
        <div class="nx-approved-sheet-head"><div><small>OWNER-ONLY SAFETY CONTROLS</small><strong>Tracker Security</strong></div><button class="nx-approved-close" type="button" data-security-close>×</button></div>
        <div class="nx-approved-protect"><span>● PAIRING PROTECTED</span><span>Hidden tracker stays paired</span></div>
        <div class="nx-approved-security-grid">
          <article class="nx-approved-sec-card pause"><small>SAFE TEMPORARY ACTION</small><strong>Pause Tracking</strong><p>Telemetry stops temporarily. Pairing remains safe and can resume remotely.</p></article>
          <article class="nx-approved-sec-card unpair"><small>PROTECTED PERMANENT ACTION</small><strong>Unpair Tracker</strong><p>Requires a 3-second hold plus final confirmation.</p></article>
        </div>
        <div class="nx-approved-sec-actions"><button type="button" data-pause-tracker>PAUSE TRACKING</button><button class="danger nx-approved-hold" type="button" data-hold-unpair><i class="nx-approved-hold-fill" data-hold-fill></i><span>HOLD 3s TO UNPAIR</span></button></div>
        <div class="nx-approved-confirm" data-unpair-confirm><strong>Confirm permanent unpair?</strong><p>The hidden tracker will need a fresh pairing code before it can send telemetry again.</p><div class="nx-approved-confirm-actions"><button type="button" data-unpair-cancel>CANCEL</button><button class="danger" type="button" data-unpair-confirm>CONFIRM UNPAIR</button></div></div>
      </div>
    </section>
    <section class="nx-approved-modal" data-code-modal>
      <div class="nx-approved-sheet">
        <div class="nx-approved-sheet-head"><div><small>ONE-TIME PAIRING CODE</small><strong>Pair NexusNova Tracker</strong></div><button class="nx-approved-close" type="button" data-code-close>×</button></div>
        <strong class="nx-approved-code" data-pair-code>—</strong><p class="nx-approved-code-note">Enter this code once in the hidden NexusNova Tracker phone. It expires in 10 minutes.</p>
        <div class="nx-approved-sec-actions"><button type="button" data-code-copy>COPY CODE</button><button type="button" data-code-done>DONE</button></div>
      </div>
    </section>
    <div class="nx-approved-toast" data-approved-toast></div>
  </div>`;
}

function text(root, selector, fallback = '') {
  return String(root.querySelector(selector)?.textContent || fallback).trim();
}

function splitMetric(value, fallbackUnit = '') {
  const match = String(value || '').trim().match(/^([^\s]+)(?:\s+(.+))?$/);
  return { value:match?.[1] || '0', unit:match?.[2] || fallbackUnit };
}

function setValue(el, value, unit = '') {
  if (!el) return;
  el.innerHTML = `${value}${unit ? `<small>${unit}</small>` : ''}`;
}

function attach(root) {
  if (!(root instanceof HTMLElement) || attached.has(root)) return;
  attached.add(root);
  root.insertAdjacentHTML('beforeend', `${styles()}${markup()}`);
  document.documentElement.classList.add('nx-approved-drive-active');
  const ui = root.querySelector('[data-nx-approved]');
  if (!ui) return;

  const q = selector => ui.querySelector(selector);
  const driveView = q('[data-approved-drive-view]');
  const trackerView = q('[data-approved-tracker-view]');
  const visualViewport = window.visualViewport;
  function syncApprovedViewport() {
    const viewportWidth = Math.max(1, Math.round(window.innerWidth || visualViewport?.width || document.documentElement.clientWidth || 1));
    const viewportHeight = Math.max(1, Math.round(window.innerHeight || visualViewport?.height || document.documentElement.clientHeight || 1));
    const driveHeight = Math.max(viewportHeight, viewportWidth * (1472 / 864));
    const driveWidth = driveHeight * (864 / 1472);
    const trackerHeight = Math.max(viewportHeight, viewportWidth * (1672 / 941));
    const trackerWidth = trackerHeight * (941 / 1672);
    ui.style.setProperty('--nx-approved-vw', `${viewportWidth}px`);
    ui.style.setProperty('--nx-approved-vh', `${viewportHeight}px`);
    ui.style.setProperty('--nx-approved-drive-cover-w', `${driveWidth.toFixed(3)}px`);
    ui.style.setProperty('--nx-approved-drive-cover-h', `${driveHeight.toFixed(3)}px`);
    ui.style.setProperty('--nx-approved-tracker-cover-w', `${trackerWidth.toFixed(3)}px`);
    ui.style.setProperty('--nx-approved-tracker-cover-h', `${trackerHeight.toFixed(3)}px`);
    driveView?.style.setProperty('--nx-approved-crop-x', `${Math.max(0, (driveWidth - viewportWidth) / 2).toFixed(3)}px`);
    trackerView?.style.setProperty('--nx-approved-crop-x', `${Math.max(0, (trackerWidth - viewportWidth) / 2).toFixed(3)}px`);
  }
  syncApprovedViewport();
  window.addEventListener('resize', syncApprovedViewport, { passive:true });
  window.addEventListener('orientationchange', syncApprovedViewport, { passive:true });
  visualViewport?.addEventListener('resize', syncApprovedViewport, { passive:true });
  const toast = q('[data-approved-toast]');
  const trackingBtn = q('[data-approved-tracking]');
  const underlyingToggle = root.querySelector('[data-dr-toggle]');
  const underlyingRecover = root.querySelector('[data-dr-recover]');
  const securityModal = q('[data-security-modal]');
  const codeModal = q('[data-code-modal]');
  const confirmBox = q('[data-unpair-confirm]');
  const holdBtn = q('[data-hold-unpair]');
  const holdFill = q('[data-hold-fill]');
  const pauseBtn = q('[data-pause-tracker]');
  const pairedMask = q('[data-tracker-paired]');
  const pairHit = q('[data-tracker-pair]');
  const mapHit = q('[data-tracker-map]');
  let entitled = false;
  let dashboard = null;
  let current = null;
  let polling = null;
  let holdTimer = null;
  let holdFrame = null;
  let holdStarted = 0;
  let pairCode = '';
  let disposed = false;

  function notify(message) {
    if (!toast) return;
    toast.textContent = String(message || '');
    toast.classList.add('is-show');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.remove('is-show'), 1700);
  }

  function setMode(mode) {
    const vehicle = mode === 'vehicle';
    if (vehicle && !entitled) { notify('Vehicle Tracking is private-owner only.'); return; }
    driveView?.classList.toggle('is-active', !vehicle);
    trackerView?.classList.toggle('is-active', vehicle);
    if (vehicle) refreshVehicle(true);
  }

  function paintDrive() {
    const off = underlyingToggle?.classList.contains('is-off') || /OFF/i.test(text(root,'[data-dr-toggle]'));
    trackingBtn?.classList.toggle('is-off', off);
    const tspan = trackingBtn?.querySelector('span');
    if (tspan) tspan.textContent = off ? 'TRACKING OFF' : 'TRACKING ON';
    const speed = splitMetric(text(root,'[data-dr-value]','0'),'km/h');
    setValue(q('[data-approved-speed]'), speed.value, 'km/h');
    const distance = splitMetric(text(root,'[data-dr-distance]','0.00 km'),'km');
    const average = splitMetric(text(root,'[data-dr-average]','0 km/h'),'km/h');
    const top = splitMetric(text(root,'[data-dr-top]','0 km/h'),'km/h');
    const duration = splitMetric(text(root,'[data-dr-duration]','00:00'),'hh:mm');
    setValue(q('[data-approved-distance]'), distance.value, distance.unit || 'km');
    setValue(q('[data-approved-average]'), average.value, average.unit || 'km/h');
    setValue(q('[data-approved-top]'), top.value, top.unit || 'km/h');
    setValue(q('[data-approved-duration]'), duration.value, 'hh:mm');
    const heading = text(root,'[data-dr-heading]','—');
    if (q('[data-approved-heading]')) q('[data-approved-heading]').textContent = heading;
    const cloud = text(root,'[data-dr-cloud]','LOCAL');
    if (q('[data-approved-cloud]')) q('[data-approved-cloud]').textContent = cloud;
    const activity = text(root,'[data-dr-activity]','SMART GPS');
    const confidence = text(root,'[data-dr-confidence]','GPS detection ready');
    const activityEl = q('[data-approved-activity]');
    if (activityEl) activityEl.innerHTML = `<small>LIVE DETECTION</small><b>${activity}</b><span>${confidence}</span>`;
    setValue(q('[data-approved-today]'), text(root,'[data-dr-today]','0.00 km'), text(root,'[data-dr-today-trips]','0 trips'));
    setValue(q('[data-approved-week]'), text(root,'[data-dr-week]','0.00 km'), 'analytics');
    setValue(q('[data-approved-month]'), text(root,'[data-dr-month]','0.00 km'), 'analytics');
    setValue(q('[data-approved-history]'), text(root,'[data-dr-count]','0 trips'), 'Nova Track merged');
  }

  function chooseVehicle(payload) {
    const vehicles = Array.isArray(payload?.vehicles) ? payload.vehicles : [];
    current = vehicles.find(v => v?.trackerBound) || vehicles[0] || null;
    return current;
  }

  function paintVehicle() {
    const vehicle = chooseVehicle(dashboard);
    const live = vehicle?.live || null;
    const statusEl = q('[data-tracker-status]');
    if (statusEl) {
      statusEl.textContent = vehicle?.trackingPaused ? 'PAUSED' : vehicle?.trackerOnline ? 'TRACKER LIVE' : vehicle?.trackerBound ? 'OFFLINE' : 'UNPAIRED';
      statusEl.style.color = vehicle?.trackingPaused ? '#ffd27c' : vehicle?.trackerOnline ? '#49ff8f' : '#ffbe7b';
    }
    setValue(q('[data-tracker-speed]'), String(Math.round(live?.speedKmh || 0)), 'km/h');
    if (q('[data-tracker-battery]')) q('[data-tracker-battery]').textContent = live ? `${Math.round(live.batteryPct || 0)}%` : '—';
    if (q('[data-tracker-power]')) q('[data-tracker-power]').textContent = live ? (live.externalPower || live.charging ? 'CONNECTED' : 'BATTERY') : '—';
    if (q('[data-tracker-heading]')) q('[data-tracker-heading]').textContent = live ? compass(live.heading) : '—';
    if (q('[data-tracker-seen]')) q('[data-tracker-seen]').textContent = vehicle ? ago(vehicle.lastSeenAt || live?.receivedAt) : 'Never';
    if (q('[data-tracker-gps]')) q('[data-tracker-gps]').textContent = live ? `±${Math.round(live.accuracyM || 0)}m` : '—';
    const paired = vehicle?.trackerBound === true;
    pairedMask?.classList.toggle('is-visible', paired);
    if (pairHit) pairHit.setAttribute('aria-label', paired ? 'Tracker paired' : 'Pair tracker');
    if (mapHit) mapHit.toggleAttribute('disabled', !live);
    if (pauseBtn) {
      pauseBtn.textContent = vehicle?.trackingPaused ? 'RESUME TRACKING' : 'PAUSE TRACKING';
      pauseBtn.disabled = !paired;
    }
  }

  async function refreshVehicle(silent = false) {
    if (!entitled || disposed) return;
    try {
      dashboard = await loadNovaVehicleDashboard();
      paintVehicle();
    } catch (error) {
      if (!silent) notify(error?.message || 'Vehicle telemetry unavailable.');
    }
  }

  async function checkEntitlement() {
    try {
      const payload = await loadNovaVehicleDashboard();
      entitled = payload?.entitled === true;
      dashboard = payload;
      ui.classList.toggle('is-locked', !entitled);
      if (entitled) {
        paintVehicle();
        polling = setInterval(() => refreshVehicle(true), POLL_MS);
      }
    } catch {
      entitled = false;
      ui.classList.add('is-locked');
    }
  }

  trackingBtn?.addEventListener('click', () => underlyingToggle?.click());
  q('[data-approved-recover]')?.addEventListener('click', () => underlyingRecover?.click());
  q('[data-approved-premium-hit]')?.addEventListener('click', () => setMode('vehicle'));
  ui.querySelectorAll('[data-approved-drive-hit]').forEach(btn => btn.addEventListener('click', () => setMode('drive')));
  ui.querySelectorAll('[data-approved-vehicle-hit]').forEach(btn => btn.addEventListener('click', () => setMode('vehicle')));
  ui.querySelectorAll('[data-approved-domain]').forEach(btn => btn.addEventListener('click', () => internalBrowser(DOMAIN)));
  ui.querySelectorAll('[data-approved-hub-back],[data-approved-tracker-hub-back]').forEach(btn => btn.addEventListener('click', () => window.NexusNovaFresh?.openHub?.()));

  pairHit?.addEventListener('click', async () => {
    const vehicle = chooseVehicle(dashboard);
    if (vehicle?.trackerBound) { notify(`Tracker paired: ${vehicle.displayName || 'Vehicle'}`); return; }
    try {
      const result = await createNovaVehiclePairing('NexusNova Vehicle');
      pairCode = result.pairingCode;
      const codeEl = q('[data-pair-code]');
      if (codeEl) codeEl.textContent = pairCode;
      codeModal?.classList.add('is-open');
      await refreshVehicle(true);
    } catch (error) { notify(error?.message || 'Pairing code could not be created.'); }
  });

  mapHit?.addEventListener('click', () => {
    if (!openMap(chooseVehicle(dashboard))) notify('Live vehicle location is not available yet.');
  });

  q('[data-tracker-security]')?.addEventListener('click', () => {
    const vehicle = chooseVehicle(dashboard);
    if (!vehicle?.trackerBound) { notify('Pair a tracker first.'); return; }
    securityModal?.classList.add('is-open');
  });
  q('[data-security-close]')?.addEventListener('click', () => { securityModal?.classList.remove('is-open'); resetHold(); confirmBox?.classList.remove('is-open'); });
  q('[data-code-close]')?.addEventListener('click', () => codeModal?.classList.remove('is-open'));
  q('[data-code-done]')?.addEventListener('click', () => codeModal?.classList.remove('is-open'));
  q('[data-code-copy]')?.addEventListener('click', async () => {
    if (!pairCode) return;
    try { await navigator.clipboard.writeText(pairCode); notify('Pairing code copied.'); }
    catch { notify('Copy is unavailable on this device.'); }
  });

  pauseBtn?.addEventListener('click', async () => {
    const vehicle = chooseVehicle(dashboard);
    if (!vehicle?.trackerBound) return;
    pauseBtn.disabled = true;
    try {
      await setNovaVehiclePaused(vehicle.vehicleId, !vehicle.trackingPaused);
      const wasPaused = vehicle.trackingPaused === true;
      await refreshVehicle(true);
      notify(wasPaused ? 'Tracking resumed.' : 'Tracking paused. Pairing stays safe.');
    } catch (error) { notify(error?.message || 'Tracking state could not be changed.'); }
    finally { pauseBtn.disabled = false; }
  });

  function resetHold() {
    clearTimeout(holdTimer); cancelAnimationFrame(holdFrame); holdTimer = null; holdStarted = 0;
    if (holdFill) holdFill.style.width = '0%';
  }
  function animateHold() {
    if (!holdStarted || !holdFill) return;
    const pct = Math.min(100, ((performance.now() - holdStarted) / 3000) * 100);
    holdFill.style.width = `${pct}%`;
    if (pct < 100) holdFrame = requestAnimationFrame(animateHold);
  }
  function beginHold(event) {
    event.preventDefault(); resetHold(); holdStarted = performance.now(); animateHold();
    holdTimer = setTimeout(() => { if (holdFill) holdFill.style.width = '100%'; confirmBox?.classList.add('is-open'); holdStarted = 0; }, 3000);
  }
  function endHold() { if (!confirmBox?.classList.contains('is-open')) resetHold(); }
  ['pointerdown','touchstart'].forEach(name => holdBtn?.addEventListener(name, beginHold, { passive:false }));
  ['pointerup','pointerleave','pointercancel','touchend'].forEach(name => holdBtn?.addEventListener(name, endHold));
  q('[data-unpair-cancel]')?.addEventListener('click', () => { confirmBox?.classList.remove('is-open'); resetHold(); });
  q('[data-unpair-confirm]')?.addEventListener('click', async () => {
    const vehicle = chooseVehicle(dashboard);
    if (!vehicle?.trackerBound) return;
    try {
      await revokeNovaVehicle(vehicle.vehicleId);
      confirmBox?.classList.remove('is-open'); securityModal?.classList.remove('is-open'); resetHold();
      notify('Tracker unpaired.');
      await refreshVehicle(true);
    } catch (error) { notify(error?.message || 'Tracker could not be unpaired.'); }
  });

  paintDrive();
  const drivePoll = setInterval(paintDrive, 250);
  checkEntitlement();

  const cleanupTimer = setInterval(() => {
    if (root.isConnected) return;
    disposed = true;
    clearInterval(cleanupTimer); clearInterval(drivePoll); clearInterval(polling); clearTimeout(notify.timer); resetHold();
    window.removeEventListener('resize', syncApprovedViewport);
    window.removeEventListener('orientationchange', syncApprovedViewport);
    visualViewport?.removeEventListener('resize', syncApprovedViewport);
    document.documentElement.classList.remove('nx-approved-drive-active');
  }, 800);
}

function scan(node = document) {
  if (node instanceof HTMLElement && node.matches('.nxdr3')) attach(node);
  node.querySelectorAll?.('.nxdr3').forEach(attach);
}

scan();
new MutationObserver(mutations => mutations.forEach(mutation => mutation.addedNodes.forEach(node => node instanceof HTMLElement && scan(node))))
  .observe(document.documentElement, { childList:true, subtree:true });
