import { travelSuiteRenderers } from './travel-suite.js';
import { learningSuiteRenderers } from './learning-suite.js';
import { teacherAIRenderers } from './teacher-ai-suite.js';

function ensureStudyTravelSkin() {
  if (document.getElementById('nx-discover-study-travel-v1')) return;
  const style = document.createElement('style');
  style.id = 'nx-discover-study-travel-v1';
  style.textContent = `
    .nx-study-travel-desk{--stx:50%;--sty:8%;position:relative;isolation:isolate;display:grid;grid-template-rows:auto minmax(0,1fr);gap:6px;max-height:calc(100dvh - 170px);min-height:min(610px,calc(100dvh - 170px));padding:6px;border-radius:29px;overflow:hidden;background:radial-gradient(circle at var(--stx) var(--sty),rgba(81,205,255,.13),transparent 25%),radial-gradient(circle at 90% 88%,rgba(103,91,255,.075),transparent 29%),linear-gradient(145deg,#18242e,#0c161f 57%,#080f16);box-shadow:inset 0 1px rgba(255,255,255,.13),inset 0 -2px rgba(0,0,0,.76)}
    .nx-study-travel-desk--learning{background:radial-gradient(circle at var(--stx) var(--sty),rgba(81,224,191,.10),transparent 25%),radial-gradient(circle at 91% 88%,rgba(74,157,255,.07),transparent 29%),linear-gradient(145deg,#15262a,#0a171c 58%,#071014)}
    .nx-study-travel-desk--teacher{background:radial-gradient(circle at var(--stx) var(--sty),rgba(156,118,255,.115),transparent 25%),radial-gradient(circle at 90% 87%,rgba(79,211,255,.065),transparent 29%),linear-gradient(145deg,#1d2031,#101321 58%,#090d16)}
    .nx-study-travel-desk::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(108deg,transparent 42%,rgba(255,255,255,.038) 50%,transparent 58%);transform:translateX(-74%);animation:nxStudyTravelSheen 9s ease-in-out infinite}
    .nx-study-travel-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px 9px;border:1px solid rgba(140,214,240,.13);border-radius:15px;background:linear-gradient(180deg,rgba(21,39,52,.97),rgba(8,18,27,.97));box-shadow:inset 0 1px rgba(255,255,255,.09),inset 0 -2px rgba(0,0,0,.43),0 5px 12px rgba(0,0,0,.14)}
    .nx-study-travel-head>div{display:flex;align-items:center;gap:7px;min-width:0}.nx-study-travel-led{width:8px;height:8px;flex:0 0 auto;border-radius:50%;background:#54efbd;box-shadow:0 0 0 3px rgba(84,239,189,.07),0 0 13px rgba(84,239,189,.43);animation:nxStudyTravelLed 2s ease-in-out infinite}.nx-study-travel-copy{min-width:0}.nx-study-travel-copy strong{display:block;color:#effaff;font-size:7.3px!important;letter-spacing:.085em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nx-study-travel-copy small{display:block;margin-top:2px;color:#72838f;font-size:5.8px;letter-spacing:.045em}.nx-study-travel-badge{padding:5px 7px;border:1px solid rgba(100,220,255,.12);border-radius:999px;background:rgba(72,203,240,.05);color:#8ee9ff;font-size:5.9px;font-weight:950;letter-spacing:.06em}
    .nx-study-travel-viewport{min-height:0;overflow:auto;overscroll-behavior:contain;padding:1px 2px 7px;scrollbar-width:thin}.nx-study-travel-viewport::-webkit-scrollbar{width:4px}.nx-study-travel-viewport::-webkit-scrollbar-thumb{border-radius:999px;background:rgba(104,204,235,.20)}.nx-study-travel-viewport>.nx-app-body{max-width:none!important;padding:0!important}
    .nx-study-travel-desk .nx-tool-card{margin-bottom:7px!important;padding:11px!important;border:1px solid rgba(108,196,232,.115)!important;border-radius:18px!important;background:linear-gradient(145deg,rgba(255,255,255,.042),transparent 26%),linear-gradient(155deg,#13232e,#08141c 68%,#050c12)!important;box-shadow:inset 0 1px rgba(255,255,255,.075),inset 0 -3px rgba(0,0,0,.37),0 4px 0 rgba(2,9,14,.47),0 9px 17px rgba(0,0,0,.12)!important}
    .nx-study-travel-desk input,.nx-study-travel-desk textarea,.nx-study-travel-desk select{border:1px solid rgba(105,198,232,.12)!important;border-radius:12px!important;background:linear-gradient(180deg,#07141c,#030a0f)!important;color:#eefaff!important;box-shadow:inset 0 3px 8px rgba(0,0,0,.52),inset 0 -1px rgba(255,255,255,.035)!important}.nx-study-travel-desk textarea{resize:none}.nx-study-travel-desk input:focus,.nx-study-travel-desk textarea:focus,.nx-study-travel-desk select:focus{outline:none!important;border-color:rgba(82,224,255,.31)!important;box-shadow:inset 0 3px 8px rgba(0,0,0,.52),0 0 0 2px rgba(82,224,255,.055)!important}
    .nx-study-travel-desk button{border-radius:11px!important;box-shadow:inset 0 1px rgba(255,255,255,.10),inset 0 -4px 6px rgba(0,0,0,.19),0 3px 0 rgba(2,12,18,.60),0 7px 11px rgba(0,0,0,.12)!important}.nx-study-travel-desk button:active{transform:translateY(2px)!important;box-shadow:inset 0 3px 6px rgba(0,0,0,.27),0 1px 0 rgba(2,12,18,.60)!important}
    .nx-study-travel-desk .nx-list-card{border-color:rgba(100,191,225,.10)!important;border-radius:14px!important;background:linear-gradient(155deg,rgba(255,255,255,.032),transparent 28%),linear-gradient(180deg,#10212b,#07131a)!important;box-shadow:inset 0 1px rgba(255,255,255,.06),inset 0 -2px rgba(0,0,0,.33),0 3px 0 rgba(2,9,13,.40),0 7px 13px rgba(0,0,0,.09)!important}
    .nx-study-travel-desk--travel .nx-summary-grid>div{border-radius:13px!important;background:linear-gradient(180deg,#102630,#08161e)!important;box-shadow:inset 0 1px rgba(255,255,255,.06),inset 0 -2px rgba(0,0,0,.34),0 3px 0 rgba(2,10,14,.42)!important}.nx-study-travel-desk--travel [data-flight-summary]{position:sticky;top:0;z-index:5;backdrop-filter:blur(8px);background:linear-gradient(155deg,rgba(18,43,56,.97),rgba(7,19,27,.97))!important}.nx-study-travel-desk--travel [data-flight-results],.nx-study-travel-desk--travel [data-trip-output]{gap:7px!important}.nx-study-travel-desk--travel [data-flight-results] .nx-list-card{border-color:rgba(84,198,239,.14)!important}.nx-study-travel-desk--travel [data-flight-results] .nx-badge.good{box-shadow:0 0 13px rgba(79,236,180,.07)}
    .nx-study-travel-desk--learning .nx-tool-card{border-color:rgba(86,207,187,.10)!important;background:linear-gradient(145deg,rgba(80,232,193,.03),transparent 27%),linear-gradient(155deg,#11272a,#071719 68%,#050e10)!important}.nx-study-travel-desk--learning .nx-list-card{border-color:rgba(83,200,187,.10)!important;background:linear-gradient(155deg,rgba(66,222,188,.025),transparent 28%),linear-gradient(180deg,#102629,#071618)!important}.nx-study-travel-desk--learning [data-learn-output]{max-height:260px;overflow:auto;overscroll-behavior:contain}.nx-study-travel-desk--learning [data-paper-results],.nx-study-travel-desk--learning [data-plan-list],.nx-study-travel-desk--learning [data-card-list]{gap:7px!important}.nx-study-travel-desk--learning [data-card-list] .nx-list-card,.nx-study-travel-desk--learning .nx-flash-card{cursor:pointer}
    .nx-study-travel-desk--teacher .nx-tool-card{border-color:rgba(158,125,238,.115)!important;background:linear-gradient(145deg,rgba(164,121,255,.035),transparent 27%),linear-gradient(155deg,#1c2031,#0d1220 68%,#080c15)!important}.nx-study-travel-desk--teacher .nx-list-card{border-color:rgba(146,124,226,.105)!important;background:linear-gradient(155deg,rgba(157,118,247,.03),transparent 28%),linear-gradient(180deg,#181d2c,#0b101b)!important}.nx-study-travel-desk--teacher [data-ai-teacher-output]{max-height:280px;overflow:auto;overscroll-behavior:contain;gap:7px!important}.nx-study-travel-desk--teacher [data-ai-teacher-output] p{white-space:pre-wrap;line-height:1.5}.nx-study-travel-desk--teacher .nx-primary{border-color:rgba(171,132,255,.18)!important;background:linear-gradient(180deg,#57417c,#302348)!important;box-shadow:inset 0 1px rgba(255,255,255,.12),inset 0 -4px 6px rgba(0,0,0,.20),0 3px 0 #171023,0 7px 12px rgba(0,0,0,.13)!important}
    @keyframes nxStudyTravelSheen{0%,24%{transform:translateX(-74%)}67%,100%{transform:translateX(74%)}}@keyframes nxStudyTravelLed{0%,100%{opacity:.58}50%{opacity:1}}
    @media(max-width:390px){.nx-study-travel-desk{padding:5px}.nx-study-travel-head{padding:7px 8px}.nx-study-travel-copy small{display:none}.nx-study-travel-desk .nx-tool-card{padding:9px!important}.nx-study-travel-desk [data-ai-teacher-output],.nx-study-travel-desk [data-learn-output]{max-height:220px}}
    @media(max-height:720px){.nx-study-travel-desk{min-height:0}.nx-study-travel-head{padding:5px 7px}.nx-study-travel-copy small{display:none}.nx-study-travel-desk .nx-tool-card{padding:8px!important}.nx-study-travel-desk [data-ai-teacher-output],.nx-study-travel-desk [data-learn-output]{max-height:180px}}
    @media(prefers-reduced-motion:reduce){.nx-study-travel-desk::before,.nx-study-travel-led{animation:none!important}}
  `;
  document.head.appendChild(style);
}

function wrap(renderer, className, title, subtitle, badge) {
  ensureStudyTravelSkin();
  const body = renderer?.();
  if (!(body instanceof HTMLElement)) return body;
  const root = document.createElement('div');
  root.className = `nx-app-body nx-study-travel-desk ${className}`;
  const head = document.createElement('div');
  head.className = 'nx-study-travel-head';
  head.innerHTML = `<div><i class="nx-study-travel-led"></i><span class="nx-study-travel-copy"><strong>${title}</strong><small>${subtitle}</small></span></div><b class="nx-study-travel-badge">${badge}</b>`;
  const viewport = document.createElement('div');
  viewport.className = 'nx-study-travel-viewport';
  viewport.append(body);
  root.append(head, viewport);
  const move = event => {
    const rect = root.getBoundingClientRect();
    root.style.setProperty('--stx', `${((event.clientX - rect.left) / Math.max(1, rect.width)) * 100}%`);
    root.style.setProperty('--sty', `${((event.clientY - rect.top) / Math.max(1, rect.height)) * 100}%`);
  };
  root.addEventListener('pointermove', move, { passive:true });
  const baseCleanup = body.__cleanup;
  root.__cleanup = () => { root.removeEventListener('pointermove', move); baseCleanup?.(); };
  return root;
}

export const discoverStudyTravelRenderers = Object.freeze({
  travel: () => wrap(travelSuiteRenderers.travel, 'nx-study-travel-desk--travel', 'TRAVEL OPERATIONS DESK', 'SECURE LIVE FARES • HOTELS • PRIVATE ITINERARY', 'LIVE ROUTES'),
  learning: () => wrap(learningSuiteRenderers.learning, 'nx-study-travel-desk--learning', 'LEARNING RESEARCH LAB', 'WIKIPEDIA LIVE • PAPERS • PLANNER • FLASHCARDS', 'STUDY MODE'),
  teacher: () => wrap(teacherAIRenderers.teacher, 'nx-study-travel-desk--teacher', 'TEACHER STUDIO', 'GEMINI CLASSROOM TOOLS • LESSONS • QUIZZES • WORKSHEETS', 'AI TEACHER')
});
