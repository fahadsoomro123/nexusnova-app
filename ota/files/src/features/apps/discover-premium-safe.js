import { smartRenderers } from './smart-apps.js';
import { communityChatRenderers } from './community-chat.js';

function ensureDiscoverSafeSkin() {
  if (document.getElementById('nx-discover-safe-desk-v1')) return;
  const style = document.createElement('style');
  style.id = 'nx-discover-safe-desk-v1';
  style.textContent = `
    .nx-discover-desk{--dsx:50%;--dsy:8%;position:relative;isolation:isolate;display:grid;grid-template-rows:auto minmax(0,1fr);gap:6px;max-height:calc(100dvh - 170px);min-height:min(610px,calc(100dvh - 170px));padding:6px;border-radius:29px;overflow:hidden;background:radial-gradient(circle at var(--dsx) var(--dsy),rgba(92,210,255,.13),transparent 25%),radial-gradient(circle at 90% 88%,rgba(132,91,255,.075),transparent 29%),linear-gradient(145deg,#18232e,#0c151f 57%,#080e16);box-shadow:inset 0 1px rgba(255,255,255,.13),inset 0 -2px rgba(0,0,0,.76)}
    .nx-discover-desk--chat{background:radial-gradient(circle at var(--dsx) var(--dsy),rgba(67,232,193,.10),transparent 25%),radial-gradient(circle at 90% 87%,rgba(62,173,255,.07),transparent 29%),linear-gradient(145deg,#14262b,#0a171c 58%,#071015)}
    .nx-discover-desk::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(108deg,transparent 42%,rgba(255,255,255,.038) 50%,transparent 58%);transform:translateX(-74%);animation:nxDiscoverSheen 9s ease-in-out infinite}
    .nx-discover-cockpit{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px 9px;border:1px solid rgba(141,214,240,.13);border-radius:15px;background:linear-gradient(180deg,rgba(21,39,52,.97),rgba(8,18,27,.97));box-shadow:inset 0 1px rgba(255,255,255,.09),inset 0 -2px rgba(0,0,0,.43),0 5px 12px rgba(0,0,0,.14)}.nx-discover-cockpit>div{display:flex;align-items:center;gap:7px;min-width:0}.nx-discover-led{width:8px;height:8px;flex:0 0 auto;border-radius:50%;background:#55f0c1;box-shadow:0 0 0 3px rgba(85,240,193,.07),0 0 13px rgba(85,240,193,.43);animation:nxDiscoverLed 2s ease-in-out infinite}.nx-discover-copy{min-width:0}.nx-discover-copy strong{display:block;color:#effaff;font-size:7.3px!important;letter-spacing:.085em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nx-discover-copy small{display:block;margin-top:2px;color:#72838f;font-size:5.8px;letter-spacing:.045em}.nx-discover-badge{padding:5px 7px;border:1px solid rgba(100,220,255,.12);border-radius:999px;background:rgba(72,203,240,.05);color:#8ee9ff;font-size:5.9px;font-weight:950;letter-spacing:.06em}
    .nx-discover-viewport{min-height:0;overflow:auto;overscroll-behavior:contain;padding:1px 2px 6px;scrollbar-width:thin}.nx-discover-viewport::-webkit-scrollbar{width:4px}.nx-discover-viewport::-webkit-scrollbar-thumb{border-radius:999px;background:rgba(104,204,235,.20)}.nx-discover-viewport>.nx-app-body{max-width:none!important;padding:0!important}
    .nx-discover-desk--smart .nx-tool-card{margin-bottom:7px!important;padding:11px!important;border-color:rgba(108,195,234,.12)!important;border-radius:18px!important;background:linear-gradient(145deg,rgba(255,255,255,.045),transparent 25%),linear-gradient(155deg,#13222e,#08131c 68%,#050c12)!important;box-shadow:inset 0 1px rgba(255,255,255,.075),inset 0 -3px rgba(0,0,0,.38),0 4px 0 rgba(2,9,14,.48),0 9px 17px rgba(0,0,0,.12)!important}.nx-discover-desk--smart input,.nx-discover-desk--smart textarea{border-color:rgba(105,197,231,.12)!important;border-radius:12px!important;background:linear-gradient(180deg,#07131b,#030a0f)!important;box-shadow:inset 0 3px 8px rgba(0,0,0,.53),inset 0 -1px rgba(255,255,255,.035)!important}.nx-discover-desk--smart button{border-radius:11px!important;box-shadow:inset 0 1px rgba(255,255,255,.11),inset 0 -4px 6px rgba(0,0,0,.19),0 3px 0 rgba(2,12,18,.62),0 7px 11px rgba(0,0,0,.12)!important}.nx-discover-desk--smart button:active{transform:translateY(2px)!important;box-shadow:inset 0 3px 6px rgba(0,0,0,.27),0 1px 0 rgba(2,12,18,.62)!important}.nx-discover-desk--smart [data-smart-file-result],.nx-discover-desk--smart [data-smart-brief-result]{border-color:rgba(109,199,235,.11)!important;background:linear-gradient(155deg,#10222c,#071218)!important;box-shadow:inset 0 1px rgba(255,255,255,.06),0 4px 0 rgba(2,9,13,.42)!important}
    .nx-discover-desk--chat .nx-discover-viewport>.nx-app-body{height:100%;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:7px;overflow:hidden}.nx-discover-desk--chat .nx-tool-card{margin:0!important;padding:10px!important;border-color:rgba(89,211,197,.11)!important;border-radius:17px!important;background:linear-gradient(155deg,rgba(255,255,255,.035),transparent 26%),linear-gradient(180deg,#102329,#071419)!important;box-shadow:inset 0 1px rgba(255,255,255,.07),inset 0 -2px rgba(0,0,0,.36),0 4px 0 rgba(2,10,12,.44)!important}.nx-discover-desk--chat [data-chat-messages]{min-height:0;overflow:auto;overscroll-behavior:contain;display:grid;align-content:start;gap:6px;padding:2px;scrollbar-width:thin}.nx-discover-desk--chat [data-chat-messages]::-webkit-scrollbar{width:4px}.nx-discover-desk--chat [data-chat-messages]::-webkit-scrollbar-thumb{border-radius:999px;background:rgba(85,211,197,.18)}.nx-discover-desk--chat [data-chat-messages] .nx-list-card{margin:0!important;padding:8px 9px!important;border-color:rgba(91,195,191,.095)!important;border-radius:13px!important;background:linear-gradient(155deg,rgba(255,255,255,.03),transparent 27%),linear-gradient(180deg,#102027,#081319)!important;box-shadow:inset 0 1px rgba(255,255,255,.055),inset 0 -2px rgba(0,0,0,.31),0 3px 0 rgba(2,9,11,.38)!important}.nx-discover-desk--chat [data-chat-messages] .nx-chat-mine{border-color:rgba(76,222,183,.16)!important;background:linear-gradient(155deg,rgba(75,226,184,.05),transparent 28%),linear-gradient(180deg,#123029,#091b18)!important}.nx-discover-desk--chat textarea{min-height:54px!important;max-height:68px!important;resize:none;border-radius:12px!important;background:linear-gradient(180deg,#061219,#03090d)!important;box-shadow:inset 0 3px 8px rgba(0,0,0,.52)!important}.nx-discover-desk--chat [data-chat-send]{min-height:33px!important;border-radius:10px!important;box-shadow:inset 0 1px rgba(255,255,255,.11),inset 0 -4px 6px rgba(0,0,0,.18),0 3px 0 #052019!important}.nx-discover-desk--chat [data-chat-send]:active{transform:translateY(2px)!important;box-shadow:inset 0 3px 6px rgba(0,0,0,.26),0 1px 0 #052019!important}
    @keyframes nxDiscoverSheen{0%,24%{transform:translateX(-74%)}67%,100%{transform:translateX(74%)}}@keyframes nxDiscoverLed{0%,100%{opacity:.58}50%{opacity:1}}
    @media(max-width:390px){.nx-discover-desk{padding:5px}.nx-discover-cockpit{padding:7px 8px}.nx-discover-copy small{display:none}.nx-discover-desk--smart .nx-tool-card{padding:9px!important}}
    @media(max-height:720px){.nx-discover-desk{min-height:0}.nx-discover-cockpit{padding:5px 7px}.nx-discover-copy small{display:none}.nx-discover-desk--chat textarea{min-height:44px!important;max-height:52px!important}}
    @media(prefers-reduced-motion:reduce){.nx-discover-desk::before,.nx-discover-led{animation:none!important}}
  `;
  document.head.appendChild(style);
}

function wrap(renderer, className, title, subtitle, badge) {
  ensureDiscoverSafeSkin();
  const body = renderer?.();
  if (!(body instanceof HTMLElement)) return body;
  const root = document.createElement('div');
  root.className = `nx-app-body nx-discover-desk ${className}`;
  const cockpit = document.createElement('div');
  cockpit.className = 'nx-discover-cockpit';
  cockpit.innerHTML = `<div><i class="nx-discover-led"></i><span class="nx-discover-copy"><strong>${title}</strong><small>${subtitle}</small></span></div><b class="nx-discover-badge">${badge}</b>`;
  const viewport = document.createElement('div');
  viewport.className = 'nx-discover-viewport';
  viewport.append(body);
  root.append(cockpit, viewport);
  const move = event => { const r=root.getBoundingClientRect(); root.style.setProperty('--dsx',`${((event.clientX-r.left)/Math.max(1,r.width))*100}%`); root.style.setProperty('--dsy',`${((event.clientY-r.top)/Math.max(1,r.height))*100}%`); };
  root.addEventListener('pointermove',move,{passive:true});
  const baseCleanup=body.__cleanup;
  root.__cleanup=()=>{root.removeEventListener('pointermove',move);baseCleanup?.();};
  return root;
}

export const discoverSafeDeskRenderers = Object.freeze({
  smart: () => wrap(smartRenderers.smart, 'nx-discover-desk--smart', 'SMART HUB CONTROL DESK', 'FIREBASE AI • FILE ANALYSIS • REAL-DATA BRIEF', 'AI TOOLS'),
  chat: () => wrap(communityChatRenderers.chat, 'nx-discover-desk--chat', 'COMMUNITY LIVE ROOM', 'FIRESTORE LISTENER • VERIFIED SENDERS • 100 LATEST', 'LIVE CHAT')
});
