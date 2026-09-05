import { renderTravelSuite as renderTravelSuiteV11 } from './travel-suite-v11.js';

function ensureV12Styles() {
  if (document.getElementById('nn-travel-reference-v12')) return;
  const style = document.createElement('style');
  style.id = 'nn-travel-reference-v12';
  style.textContent = `
    .nn-travel-v12 .nn-ref-canvas{top:1px!important}

    .nn-travel-v12 .nn-dock{
      grid-template-columns:91px 101px 100px 120px!important;
      padding:5px 8px 5px 80px!important;
      gap:10px!important;
    }
    .nn-travel-v12 .nn-tab{height:78px!important;min-height:78px!important}
    .nn-travel-v12 .nn-travel-back{
      left:6px!important;top:15px!important;
      width:58px!important;height:58px!important;
      min-width:58px!important;min-height:58px!important;
      border-radius:18px!important;font-size:34px!important;
    }

    .nn-travel-v12 .nn-stage{padding-top:0!important}
    .nn-travel-v12 .nn-panel[data-panel="flights"]{
      grid-template-rows:140px 397px minmax(0,1fr)!important;
      padding-top:0!important;
    }
    .nn-travel-v12 .nn-ref-hero{
      height:140px!important;min-height:140px!important;
      padding:19px 21px!important;
      border-radius:25px!important;
      border-color:#236486!important;
      background:
        radial-gradient(circle at 68% 18%,rgba(17,69,107,.24),transparent 36%),
        linear-gradient(105deg,rgba(5,30,51,.995),rgba(2,20,37,.995))!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 8px 20px rgba(0,0,0,.24)!important;
    }
    .nn-travel-v12 .nn-ref-earth{display:none!important}
    .nn-travel-v12 .nn-ref-hero:after{
      display:block!important;
      right:-2px!important;top:-11px!important;
      width:185px!important;height:185px!important;
      opacity:.98!important;
      filter:drop-shadow(0 0 20px rgba(38,158,255,.28))!important;
      pointer-events:none!important;z-index:1!important;
    }
    .nn-travel-v12 .nn-ref-kicker{
      font-size:14px!important;line-height:21px!important;
      letter-spacing:.095em!important;gap:8px!important;
    }
    .nn-travel-v12 .nn-ref-kicker:before{display:none!important}
    .nn-travel-v12 .nn-ref-kicker-globe{
      width:21px;height:21px;display:inline-grid;place-items:center;
      flex:0 0 21px;color:#24d5ff;
      filter:drop-shadow(0 0 5px rgba(36,213,255,.22));
    }
    .nn-travel-v12 .nn-ref-kicker-globe svg{width:21px;height:21px;display:block}
    .nn-travel-v12 .nn-ref-title{
      margin:24px 0 7px!important;
      font-size:25px!important;line-height:1.04!important;
      letter-spacing:-.025em!important;
    }
    .nn-travel-v12 .nn-ref-sub{
      font-size:13px!important;line-height:1.34!important;color:#9fc9e2!important;
    }
    .nn-travel-v12 .nn-ref-live{top:20px!important;right:15px!important}
    .nn-travel-v12 .nn-ref-live-copy{top:64px!important;right:17px!important}

    .nn-travel-v12 .nn-panel[data-panel="flights"]>.nn-card{
      background:
        radial-gradient(circle at 24% 0,rgba(37,85,105,.10),transparent 38%),
        linear-gradient(145deg,rgba(11,38,56,.985),rgba(5,24,39,.995))!important;
      border-color:#245f7d!important;
    }
    .nn-travel-v12 .nn-ref-flight-form{
      grid-template-rows:78px 78px 74px 63px 22px!important;
      column-gap:8px!important;row-gap:13px!important;
    }
    .nn-travel-v12 .nn-ref-field{gap:10px!important}
    .nn-travel-v12 .nn-adults,
    .nn-travel-v12 .nn-cabin,
    .nn-travel-v12 .nn-currency{gap:6px!important}
    .nn-travel-v12 .nn-ref-field input,
    .nn-travel-v12 .nn-ref-field select{
      background:linear-gradient(180deg,#07131f,#030b13)!important;
      border-color:#225d7d!important;
      box-shadow:inset 0 2px 8px rgba(0,0,0,.44),0 1px 0 rgba(255,255,255,.03)!important;
    }
    .nn-travel-v12 .nn-swap{transform:translateX(5px)!important}
    .nn-travel-v12 .nn-depart{width:calc(100% - 4px)!important;justify-self:start!important}
    .nn-travel-v12 .nn-return{width:calc(100% - 4px)!important;justify-self:end!important}
    .nn-travel-v12 .nn-cabin{transform:translateX(13px)!important}
    .nn-travel-v12 .nn-ref-search{
      transform:translateY(-1px)!important;
      background:linear-gradient(100deg,#20d7ee 0,#129df4 49%,#106fe9 100%)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.34),0 0 20px rgba(23,191,255,.30),0 8px 17px rgba(0,0,0,.28)!important;
    }
    .nn-travel-v12 .nn-ref-status{transform:translateY(-7px)!important}

    .nn-travel-v12 .nn-results[data-flight-results]{
      height:calc(100% - 4px)!important;align-self:start!important;
      background:
        radial-gradient(circle at 18% 0,rgba(24,74,103,.12),transparent 36%),
        linear-gradient(145deg,rgba(7,30,48,.99),rgba(3,20,34,.995))!important;
      border-color:#246587!important;
    }
    .nn-travel-v12 .nn-ref-results-head{transform:translateY(-4px)!important}
    .nn-travel-v12 .nn-ref-results-title{gap:25px!important}
    .nn-travel-v12 .nn-ref-results-list{
      gap:6px!important;margin-left:-2px!important;margin-right:-2px!important;
    }
    .nn-travel-v12 .nn-ref-result{
      min-height:98px!important;height:98px!important;
      padding:9px 10px 9px 12px!important;
      border-color:#28779d!important;
      background:linear-gradient(105deg,rgba(9,37,57,.985),rgba(4,24,39,.995))!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 5px 12px rgba(0,0,0,.23)!important;
    }
    .nn-travel-v12 .nn-ref-logo{
      width:63px!important;height:63px!important;border-radius:10px!important;
    }
    .nn-travel-v12 .nn-ref-price{min-width:82px!important}
    .nn-travel-v12 .nn-ref-live-chip{padding:5px 10px!important}
    .nn-travel-v12 .nn-ref-arrow{font-size:25px!important;color:#c7e5f4!important}
  `;
  document.head.appendChild(style);
}

function installReferenceKicker(root) {
  const kicker = root.querySelector('[data-panel="flights"] .nn-ref-kicker');
  if (!kicker || kicker.querySelector('.nn-ref-kicker-globe')) return;
  const label = kicker.textContent?.trim() || 'WORLDWIDE TRAVEL';
  kicker.innerHTML = `<span class="nn-ref-kicker-globe" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.25 2.3 3.4 5.3 3.4 9S14.25 18.7 12 21C9.75 18.7 8.6 15.7 8.6 12S9.75 5.3 12 3Z"/></svg></span><span>${label.toUpperCase()}</span>`;
}

function lockPlanStatus(root) {
  const dot = root.querySelector('[data-travel-tab="plan"] .nn-api-dot');
  if (dot) dot.dataset.state = 'standby';
}

export function renderTravelSuite() {
  ensureV12Styles();
  const root = renderTravelSuiteV11();
  root.classList.add('nn-travel-v12');
  root.dataset.referenceVisual = 'v12';
  installReferenceKicker(root);
  lockPlanStatus(root);
  return root;
}

export const travelSuiteRenderers = Object.freeze({ travel: renderTravelSuite });
