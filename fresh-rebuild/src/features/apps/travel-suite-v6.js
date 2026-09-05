import { renderTravelSuite as renderTravelSuiteV5 } from './travel-suite-v5.js';

function ensureV6Styles() {
  if (document.getElementById('nn-travel-approved-ref-v6')) return;
  const style = document.createElement('style');
  style.id = 'nn-travel-approved-ref-v6';
  style.textContent = `
    .nn-travel-v6 .nn-ref-canvas{
      width:550px!important;
      height:1032px!important;
      padding:0 8px!important;
      grid-template-rows:96px minmax(0,1fr)!important;
      gap:2px!important;
    }
    .nn-travel-v6 .nn-dock{
      height:96px!important;
      padding:8px 8px 8px 80px!important;
      gap:10px!important;
      border-radius:27px!important;
      border-color:#19577d!important;
      background:linear-gradient(180deg,rgba(7,48,79,.98),rgba(3,27,48,.98))!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 8px 24px rgba(0,0,0,.28)!important;
    }
    .nn-travel-v6 .nn-tab{
      height:78px!important;
      border-radius:18px!important;
      gap:5px!important;
      font-size:14px!important;
      line-height:1!important;
      border-color:#1a5274!important;
      background:linear-gradient(180deg,#103856,#09253e)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 6px 14px rgba(0,0,0,.2)!important;
    }
    .nn-travel-v6 .nn-tab.is-active{
      border-color:#36d7ff!important;
      background:linear-gradient(145deg,#23c7f2,#087ce2)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 0 18px rgba(35,198,255,.72),0 7px 16px rgba(0,0,0,.22)!important;
    }
    .nn-travel-v6 .nn-tab .nn-ref-tab-icon,
    .nn-travel-v6 .nn-tab .nn-ref-tab-icon svg{
      width:29px!important;
      height:29px!important;
    }
    .nn-travel-v6 .nn-api-dot{
      right:9px!important;
      bottom:14px!important;
      width:10px!important;
      height:10px!important;
    }
    .nn-travel-v6 .nn-tab.is-active .nn-api-dot,
    .nn-travel-v6 .nn-api-dot[data-state="live"]{background:#55ef91!important;box-shadow:0 0 9px rgba(85,239,145,.82)!important}
    .nn-travel-v6 .nn-stage{
      height:100%!important;
      min-height:0!important;
      overflow:hidden!important;
      padding:0 5px 0 9px!important;
    }
    .nn-travel-v6 .nn-panel[data-panel="flights"]{
      height:100%!important;
      min-height:0!important;
      display:grid!important;
      grid-template-rows:140px 398px minmax(0,1fr)!important;
      gap:0!important;
      overflow:hidden!important;
      padding:1px 0 0!important;
    }
    .nn-travel-v6 .nn-ref-hero{
      position:relative!important;
      align-self:start!important;
      height:134px!important;
      border-radius:25px!important;
      padding:18px 21px!important;
      border-color:#2a6e93!important;
      background:linear-gradient(105deg,rgba(4,35,57,.99),rgba(2,25,45,.99))!important;
      overflow:hidden!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 8px 20px rgba(0,0,0,.22)!important;
    }
    .nn-travel-v6 .nn-ref-hero:after{display:none!important}
    .nn-travel-v6 .nn-ref-kicker{font-size:14px!important;letter-spacing:.12em!important;color:#26ccff!important;font-weight:900!important}
    .nn-travel-v6 .nn-ref-title{
      position:relative!important;z-index:2!important;
      margin:8px 0 4px!important;
      max-width:390px!important;
      white-space:nowrap!important;
      font-size:25px!important;
      line-height:1.04!important;
      letter-spacing:-.025em!important;
    }
    .nn-travel-v6 .nn-ref-sub{
      position:relative!important;z-index:2!important;
      margin:0!important;
      font-size:13px!important;
      line-height:1.34!important;
      max-width:365px!important;
      color:#9dd1ed!important;
    }
    .nn-travel-v6 .nn-ref-earth{
      position:absolute;z-index:1;right:-24px;top:-35px;width:205px;height:205px;border-radius:50%;overflow:hidden;
      background:
        radial-gradient(circle at 38% 31%,rgba(114,236,255,.92) 0 3%,transparent 4%),
        radial-gradient(ellipse at 52% 47%,rgba(53,181,239,.68) 0 15%,transparent 16%),
        radial-gradient(ellipse at 37% 65%,rgba(27,117,210,.78) 0 20%,transparent 21%),
        radial-gradient(circle at 36% 31%,#28bdf6 0,#087cc5 34%,#073e79 63%,#021e43 79%);
      border:1px solid rgba(95,213,255,.38);
      box-shadow:inset -25px -20px 45px rgba(0,8,34,.72),inset 13px 9px 25px rgba(144,240,255,.25),0 0 35px rgba(28,163,255,.32);
      opacity:.98;pointer-events:none
    }
    .nn-travel-v6 .nn-ref-earth:before{
      content:"";position:absolute;inset:0;border-radius:50%;opacity:.76;
      background:repeating-linear-gradient(0deg,transparent 0 16px,rgba(94,211,255,.08) 17px,transparent 18px),repeating-linear-gradient(90deg,transparent 0 21px,rgba(94,211,255,.06) 22px,transparent 23px)
    }
    .nn-travel-v6 .nn-ref-earth svg{position:absolute;inset:14px 18px 18px 10px;width:168px;height:168px;opacity:.76;filter:drop-shadow(0 0 5px rgba(98,222,255,.45))}
    .nn-travel-v6 .nn-ref-earth path{fill:rgba(101,205,240,.26);stroke:rgba(157,233,255,.36);stroke-width:1.4}
    .nn-travel-v6 .nn-ref-live{
      z-index:4!important;right:15px!important;top:17px!important;padding:7px 12px!important;
      border-color:#1c8b60!important;background:rgba(7,74,61,.74)!important;color:#effff7!important
    }
    .nn-travel-v6 .nn-ref-live-copy{
      z-index:4!important;right:17px!important;top:60px!important;color:#abd5ed!important;font-size:12px!important;line-height:1.35!important
    }
    .nn-travel-v6 .nn-panel[data-panel="flights"]>.nn-card{
      align-self:start!important;
      height:388px!important;
      min-height:388px!important;
      padding:11px 20px 9px!important;
      border-radius:23px!important;
      overflow:hidden!important;
      border-color:#275f80!important;
      background:linear-gradient(145deg,rgba(6,36,58,.98),rgba(3,24,42,.99))!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 8px 20px rgba(0,0,0,.24)!important;
    }
    .nn-travel-v6 .nn-ref-flight-form{
      display:grid!important;
      grid-template-columns:repeat(12,minmax(0,1fr))!important;
      grid-template-rows:82px 74px 74px 63px 22px!important;
      grid-template-areas:none!important;
      grid-auto-flow:row!important;
      column-gap:8px!important;
      row-gap:13px!important;
      align-items:start!important;
      align-content:start!important;
      width:100%!important;
      height:auto!important;
    }
    .nn-travel-v6 .nn-ref-flight-form>.nn-from{grid-area:auto!important;grid-column:1/6!important;grid-row:1!important;width:217px!important;justify-self:start!important}
    .nn-travel-v6 .nn-ref-flight-form>.nn-swap{grid-area:auto!important;grid-column:6/8!important;grid-row:1!important;justify-self:center!important;align-self:end!important}
    .nn-travel-v6 .nn-ref-flight-form>.nn-to{grid-area:auto!important;grid-column:8/13!important;grid-row:1!important;width:207px!important;justify-self:end!important}
    .nn-travel-v6 .nn-ref-flight-form>.nn-depart{grid-area:auto!important;grid-column:1/7!important;grid-row:2!important}
    .nn-travel-v6 .nn-ref-flight-form>.nn-return{grid-area:auto!important;grid-column:7/13!important;grid-row:2!important}
    .nn-travel-v6 .nn-ref-flight-form>.nn-adults{grid-area:auto!important;grid-column:1/4!important;grid-row:3!important;width:128px!important;justify-self:start!important}
    .nn-travel-v6 .nn-ref-flight-form>.nn-cabin{grid-area:auto!important;grid-column:4/9!important;grid-row:3!important;width:178px!important;justify-self:center!important}
    .nn-travel-v6 .nn-ref-flight-form>.nn-currency{grid-area:auto!important;grid-column:9/13!important;grid-row:3!important;width:143px!important;justify-self:end!important}
    .nn-travel-v6 .nn-ref-flight-form>.nn-ref-search{grid-area:auto!important;grid-column:1/13!important;grid-row:4!important}
    .nn-travel-v6 .nn-ref-flight-form>.nn-ref-status{grid-area:auto!important;grid-column:1/13!important;grid-row:5!important}
    .nn-travel-v6 .nn-ref-field{min-width:0!important;gap:7px!important}
    .nn-travel-v6 .nn-ref-field>span{font-size:12px!important;line-height:1!important;min-height:12px!important;color:#d4e8f5!important}
    .nn-travel-v6 .nn-ref-field input,
    .nn-travel-v6 .nn-ref-field select{
      width:100%!important;height:50px!important;min-height:50px!important;padding:0 13px 0 45px!important;
      border-radius:12px!important;border-color:#22658c!important;background:#041725!important;color:#f3f9ff!important;font-size:16px!important;
      box-shadow:inset 0 2px 8px rgba(0,0,0,.34),0 1px 0 rgba(255,255,255,.035)!important
    }
    .nn-travel-v6 .nn-swap{
      width:39px!important;height:47px!important;min-width:39px!important;min-height:47px!important;margin:0 0 1px!important;padding:0!important;border-radius:11px!important;
      border-color:#217aa6!important;background:linear-gradient(180deg,#0c5a84,#074167)!important;color:#2bd8ff!important
    }
    .nn-travel-v6 .nn-ref-search{
      width:100%!important;height:59px!important;min-height:59px!important;border-radius:15px!important;font-size:17px!important;letter-spacing:.035em!important;
      border-color:#4de3ff!important;background:linear-gradient(100deg,#24d0e4,#107fea)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.24),0 0 16px rgba(23,191,255,.28)!important
    }
    .nn-travel-v6 .nn-ref-status{
      height:22px!important;min-height:22px!important;line-height:22px!important;font-size:12px!important;margin:0!important;overflow:hidden!important;white-space:nowrap!important;text-overflow:ellipsis!important;color:#9fd4ed!important
    }
    .nn-travel-v6 .nn-results[data-flight-results]{
      height:100%!important;min-height:0!important;border-radius:23px!important;padding:10px!important;overflow:hidden!important;
      border-color:#24698d!important;background:linear-gradient(145deg,rgba(5,36,58,.98),rgba(3,25,43,.99))!important
    }
    .nn-travel-v6 .nn-ref-results-head{height:61px!important;padding:0 8px 8px!important}
    .nn-travel-v6 .nn-ref-results-title>b:first-child{font-size:34px!important}
    .nn-travel-v6 .nn-ref-results-title strong{font-size:18px!important}
    .nn-travel-v6 .nn-ref-results-list{height:calc(100% - 61px)!important;gap:8px!important;overflow:auto!important;overscroll-behavior:contain!important}
    .nn-travel-v6 .nn-ref-result{
      min-height:94px!important;height:94px!important;grid-template-columns:66px minmax(0,1fr) auto 18px!important;gap:10px!important;padding:9px 10px!important;border-radius:15px!important;
      border-color:#297ca5!important;background:linear-gradient(105deg,rgba(8,52,77,.98),rgba(4,29,49,.99))!important
    }
    .nn-travel-v6 .nn-ref-logo{width:62px!important;height:62px!important;border-radius:10px!important}
    .nn-travel-v6 .nn-ref-route{font-size:14px!important}
    .nn-travel-v6 .nn-ref-meta{font-size:11px!important}
    .nn-travel-v6 .nn-ref-price{min-width:92px!important}
    .nn-travel-v6 .nn-ref-price strong{font-size:14px!important}
    .nn-travel-v6 .nn-ref-live-chip{font-size:10px!important;padding:5px 8px!important;margin-bottom:7px!important}
    .nn-travel-v6 .nn-panel:not([data-panel="flights"]){height:100%!important;min-height:0!important;grid-template-rows:366px minmax(0,1fr)!important;gap:8px!important;overflow:hidden!important}
    .nn-travel-v6 .nn-panel:not([data-panel="flights"])>.nn-card{height:366px!important;min-height:366px!important;padding:15px!important;overflow:hidden!important}
    .nn-travel-v6 .nn-panel:not([data-panel="flights"]) .nn-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;align-items:end!important}
    .nn-travel-v6 .nn-panel:not([data-panel="flights"]) .span2,
    .nn-travel-v6 .nn-panel:not([data-panel="flights"]) .desktop-span2{grid-column:1/-1!important}
    .nn-travel-v6 .nn-panel:not([data-panel="flights"]) input,
    .nn-travel-v6 .nn-panel:not([data-panel="flights"]) select{height:48px!important;min-height:48px!important;font-size:15px!important}
    .nn-travel-v6 .nn-panel:not([data-panel="flights"]) textarea{height:64px!important;min-height:64px!important;font-size:14px!important}
    .nn-travel-v6 .nn-panel:not([data-panel="flights"]) .nn-action{height:50px!important;min-height:50px!important;font-size:14px!important}
  `;
  document.head.appendChild(style);
}

function installReferenceEarth(root) {
  const hero = root.querySelector('[data-panel="flights"] .nn-ref-hero');
  if (!hero || hero.querySelector('.nn-ref-earth')) return;
  const earth = document.createElement('div');
  earth.className = 'nn-ref-earth';
  earth.setAttribute('aria-hidden','true');
  earth.innerHTML = `<svg viewBox="0 0 180 180" focusable="false"><path d="M28 50l14-13 22-6 13 8 15-3 13 10-4 12-12 5-9 13-13-2-7 9-12-6-6-12-15-4z"/><path d="M92 91l17-8 22 6 13 14-6 14-12 4-7 18-13 9-8-9 4-16-10-13z"/><path d="M123 46l15-8 19 9 10 13-9 6-9-6-8 7-13-5z"/><path d="M48 106l14 7 7 15-7 25-11-8-2-19-10-8z"/></svg>`;
  hero.appendChild(earth);
}

function markReferenceContract(root) {
  root.classList.add('nn-travel-v6');
  root.dataset.referenceWidth = '550';
  root.dataset.referenceHeight = '1032';
  root.dataset.referenceLocked = 'true';
  root.querySelector('.nn-dock')?.setAttribute('data-reference-zone','tabs');
  root.querySelector('[data-panel="flights"] .nn-ref-hero')?.setAttribute('data-reference-zone','hero');
  root.querySelector('[data-panel="flights"] .nn-card')?.setAttribute('data-reference-zone','flight-form');
  root.querySelector('[data-flight-results]')?.setAttribute('data-reference-zone','flight-results');
  installReferenceEarth(root);
}

export function renderTravelSuite() {
  ensureV6Styles();
  const root = renderTravelSuiteV5();
  markReferenceContract(root);
  return root;
}

export const travelSuiteRenderers = Object.freeze({ travel: renderTravelSuite });
