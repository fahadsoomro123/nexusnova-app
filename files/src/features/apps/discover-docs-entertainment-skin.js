import { documentsLiveRenderers } from './documents-live-suite.js';
import { entertainmentResilientRenderers } from './entertainment-resilient.js';

function ensureDocsEntertainmentSkin() {
  if (document.getElementById('nx-discover-docs-ent-v1')) return;
  const style = document.createElement('style');
  style.id = 'nx-discover-docs-ent-v1';
  style.textContent = `
    .nx-docent-desk{--dex:50%;--dey:8%;position:relative;isolation:isolate;display:grid;grid-template-rows:auto minmax(0,1fr);gap:6px;max-height:calc(100dvh - 170px);min-height:min(610px,calc(100dvh - 170px));padding:6px;border-radius:29px;overflow:hidden;background:radial-gradient(circle at var(--dex) var(--dey),rgba(75,207,255,.13),transparent 25%),radial-gradient(circle at 90% 88%,rgba(104,91,255,.075),transparent 29%),linear-gradient(145deg,#18242e,#0c161f 57%,#080f16);box-shadow:inset 0 1px rgba(255,255,255,.13),inset 0 -2px rgba(0,0,0,.76)}
    .nx-docent-desk--ent{background:radial-gradient(circle at var(--dex) var(--dey),rgba(177,92,255,.105),transparent 25%),radial-gradient(circle at 90% 88%,rgba(65,188,255,.07),transparent 29%),linear-gradient(145deg,#211d31,#11111f 58%,#090c15)}
    .nx-docent-desk::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(108deg,transparent 42%,rgba(255,255,255,.038) 50%,transparent 58%);transform:translateX(-74%);animation:nxDocEntSheen 9s ease-in-out infinite}
    .nx-docent-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px 9px;border:1px solid rgba(140,214,240,.13);border-radius:15px;background:linear-gradient(180deg,rgba(21,39,52,.97),rgba(8,18,27,.97));box-shadow:inset 0 1px rgba(255,255,255,.09),inset 0 -2px rgba(0,0,0,.43),0 5px 12px rgba(0,0,0,.14)}.nx-docent-head>div{display:flex;align-items:center;gap:7px;min-width:0}.nx-docent-led{width:8px;height:8px;flex:0 0 auto;border-radius:50%;background:#54efbd;box-shadow:0 0 0 3px rgba(84,239,189,.07),0 0 13px rgba(84,239,189,.43);animation:nxDocEntLed 2s ease-in-out infinite}.nx-docent-copy{min-width:0}.nx-docent-copy strong{display:block;color:#effaff;font-size:7.3px!important;letter-spacing:.085em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nx-docent-copy small{display:block;margin-top:2px;color:#72838f;font-size:5.8px;letter-spacing:.045em}.nx-docent-badge{padding:5px 7px;border:1px solid rgba(100,220,255,.12);border-radius:999px;background:rgba(72,203,240,.05);color:#8ee9ff;font-size:5.9px;font-weight:950;letter-spacing:.06em}
    .nx-docent-viewport{min-height:0;overflow:auto;overscroll-behavior:contain;padding:1px 2px 7px;scrollbar-width:thin}.nx-docent-viewport::-webkit-scrollbar{width:4px}.nx-docent-viewport::-webkit-scrollbar-thumb{border-radius:999px;background:rgba(104,204,235,.20)}.nx-docent-viewport>.nx-app-body{max-width:none!important;padding:0!important}
    .nx-docent-desk--docs .nx-tool-card{margin-bottom:7px!important;padding:11px!important;border:1px solid rgba(106,198,232,.115)!important;border-radius:18px!important;background:linear-gradient(145deg,rgba(255,255,255,.04),transparent 27%),linear-gradient(155deg,#13242e,#08151d 68%,#050d13)!important;box-shadow:inset 0 1px rgba(255,255,255,.075),inset 0 -3px rgba(0,0,0,.37),0 4px 0 rgba(2,9,14,.47),0 9px 17px rgba(0,0,0,.12)!important}.nx-docent-desk--docs .nx-file-picker{border:1px dashed rgba(89,213,239,.18)!important;border-radius:14px!important;background:linear-gradient(155deg,rgba(72,215,248,.035),transparent 30%),linear-gradient(180deg,#0b1e28,#06131a)!important;box-shadow:inset 0 2px 7px rgba(0,0,0,.23),0 3px 0 rgba(2,10,14,.36)!important}.nx-docent-desk--docs input,.nx-docent-desk--docs select{border:1px solid rgba(105,198,232,.12)!important;border-radius:12px!important;background:linear-gradient(180deg,#07141c,#030a0f)!important;color:#eefaff!important;box-shadow:inset 0 3px 8px rgba(0,0,0,.52),inset 0 -1px rgba(255,255,255,.035)!important}.nx-docent-desk--docs button{border-radius:11px!important;box-shadow:inset 0 1px rgba(255,255,255,.10),inset 0 -4px 6px rgba(0,0,0,.19),0 3px 0 rgba(2,12,18,.60),0 7px 11px rgba(0,0,0,.12)!important}.nx-docent-desk--docs button:active{transform:translateY(2px)!important;box-shadow:inset 0 3px 6px rgba(0,0,0,.27),0 1px 0 rgba(2,12,18,.60)!important}.nx-docent-desk--docs .nx-doc-row,.nx-docent-desk--docs .nx-list-card{border:1px solid rgba(100,191,225,.10)!important;border-radius:14px!important;background:linear-gradient(155deg,rgba(255,255,255,.03),transparent 28%),linear-gradient(180deg,#10212b,#07131a)!important;box-shadow:inset 0 1px rgba(255,255,255,.06),inset 0 -2px rgba(0,0,0,.33),0 3px 0 rgba(2,9,13,.40)!important}.nx-docent-desk--docs [data-doc-preview]{max-height:260px;overflow:auto;overscroll-behavior:contain;white-space:pre-wrap}.nx-docent-desk--docs [data-doc-preview] img{display:block;max-width:100%;max-height:240px;margin:auto;border-radius:12px;box-shadow:0 7px 16px rgba(0,0,0,.18)}
    .nx-docent-desk--ent .nx-ent-shell{min-height:100%;padding:0!important}.nx-docent-desk--ent .nx-ent-hero{border:1px solid rgba(161,104,238,.14)!important;border-radius:20px!important;background:radial-gradient(circle at 86% 10%,rgba(176,86,255,.08),transparent 27%),linear-gradient(155deg,#211d33,#100f20 68%,#090c16)!important;box-shadow:inset 0 1px rgba(255,255,255,.08),inset 0 -3px rgba(0,0,0,.40),0 8px 19px rgba(0,0,0,.14)!important}.nx-docent-desk--ent .nx-ent-search input{border:1px solid rgba(155,114,229,.16)!important;border-radius:13px!important;background:linear-gradient(180deg,#0c1020,#050812)!important;color:#f2ecff!important;box-shadow:inset 0 4px 10px rgba(0,0,0,.50)!important}.nx-docent-desk--ent .nx-ent-search button,.nx-docent-desk--ent .nx-ent-filters button,.nx-docent-desk--ent [data-ent-play]{border-radius:11px!important;box-shadow:inset 0 1px rgba(255,255,255,.11),inset 0 -4px 6px rgba(0,0,0,.19),0 3px 0 rgba(13,8,25,.68),0 7px 11px rgba(0,0,0,.12)!important}.nx-docent-desk--ent .nx-ent-search button:active,.nx-docent-desk--ent .nx-ent-filters button:active,.nx-docent-desk--ent [data-ent-play]:active{transform:translateY(2px)!important;box-shadow:inset 0 3px 6px rgba(0,0,0,.27),0 1px 0 rgba(13,8,25,.68)!important}.nx-docent-desk--ent .nx-ent-player{border:1px solid rgba(152,113,226,.14)!important;border-radius:18px!important;overflow:hidden;background:#060912!important;box-shadow:inset 0 1px rgba(255,255,255,.06),0 10px 23px rgba(0,0,0,.20)!important}.nx-docent-desk--ent .nx-ent-results{gap:8px!important}.nx-docent-desk--ent .nx-ent-card{border:1px solid rgba(145,112,215,.105)!important;border-radius:16px!important;background:linear-gradient(145deg,rgba(176,112,255,.03),transparent 28%),linear-gradient(155deg,#191a2b,#0b0f19 68%,#070a11)!important;box-shadow:inset 0 1px rgba(255,255,255,.06),inset 0 -2px rgba(0,0,0,.34),0 3px 0 rgba(7,5,13,.46),0 8px 15px rgba(0,0,0,.11)!important;transition:transform .08s ease}.nx-docent-desk--ent .nx-ent-card:active{transform:translateY(2px)}.nx-docent-desk--ent .nx-ent-card__media,.nx-docent-desk--ent .nx-ent-card__poster{overflow:hidden;border-radius:12px!important;box-shadow:inset 0 1px rgba(255,255,255,.06),0 5px 13px rgba(0,0,0,.16)}.nx-docent-desk--ent .nx-ent-safety{border:1px solid rgba(77,208,181,.09)!important;border-radius:14px!important;background:linear-gradient(180deg,#0d211d,#071411)!important;box-shadow:inset 0 1px rgba(255,255,255,.05),0 3px 0 rgba(2,11,9,.37)!important}
    @keyframes nxDocEntSheen{0%,24%{transform:translateX(-74%)}67%,100%{transform:translateX(74%)}}@keyframes nxDocEntLed{0%,100%{opacity:.58}50%{opacity:1}}
    @media(max-width:390px){.nx-docent-desk{padding:5px}.nx-docent-head{padding:7px 8px}.nx-docent-copy small{display:none}.nx-docent-desk--docs .nx-tool-card{padding:9px!important}.nx-docent-desk--docs [data-doc-preview]{max-height:210px}.nx-docent-desk--ent .nx-ent-card{grid-template-columns:96px minmax(0,1fr)!important}}
    @media(max-height:720px){.nx-docent-desk{min-height:0}.nx-docent-head{padding:5px 7px}.nx-docent-copy small{display:none}.nx-docent-desk--docs [data-doc-preview]{max-height:170px}}
    @media(prefers-reduced-motion:reduce){.nx-docent-desk::before,.nx-docent-led{animation:none!important}}
  `;
  document.head.appendChild(style);
}

function wrap(renderer, className, title, subtitle, badge) {
  ensureDocsEntertainmentSkin();
  const body = renderer?.();
  if (!(body instanceof HTMLElement)) return body;
  const root = document.createElement('div');
  root.className = `nx-app-body nx-docent-desk ${className}`;
  const head = document.createElement('div');
  head.className = 'nx-docent-head';
  head.innerHTML = `<div><i class="nx-docent-led"></i><span class="nx-docent-copy"><strong>${title}</strong><small>${subtitle}</small></span></div><b class="nx-docent-badge">${badge}</b>`;
  const viewport = document.createElement('div');
  viewport.className = 'nx-docent-viewport';
  viewport.append(body);
  root.append(head, viewport);
  const move = event => {
    const rect = root.getBoundingClientRect();
    root.style.setProperty('--dex', `${((event.clientX - rect.left) / Math.max(1, rect.width)) * 100}%`);
    root.style.setProperty('--dey', `${((event.clientY - rect.top) / Math.max(1, rect.height)) * 100}%`);
  };
  root.addEventListener('pointermove', move, { passive:true });
  const baseCleanup = body.__cleanup;
  root.__cleanup = () => { root.removeEventListener('pointermove', move); baseCleanup?.(); };
  return root;
}

export const discoverDocsEntertainmentRenderers = Object.freeze({
  documents: () => wrap(documentsLiveRenderers.documents, 'nx-docent-desk--docs', 'DOCUMENT WORKSTATION', 'LOCAL VIEWER • RECEIPT AI • PDF MAKER • EXPIRY REMINDERS', 'PRIVATE FILES'),
  entertainment: () => wrap(entertainmentResilientRenderers.entertainment, 'nx-docent-desk--ent', 'ENTERTAINMENT DISCOVERY DECK', 'REAL PROVIDERS • SAFE EMBEDS • PEERTUBE FALLBACK', 'REAL SOURCES')
});
