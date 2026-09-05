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
      gap:8px!important;
    }
    .nn-travel-v6 .nn-dock{
      height:96px!important;
      padding:8px 8px 8px 80px!important;
      gap:10px!important;
      border-radius:27px!important;
    }
    .nn-travel-v6 .nn-tab{
      height:78px!important;
      border-radius:18px!important;
      gap:5px!important;
      font-size:14px!important;
      line-height:1!important;
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
    .nn-travel-v6 .nn-stage{
      height:100%!important;
      min-height:0!important;
      overflow:hidden!important;
      padding:0 7px!important;
    }
    .nn-travel-v6 .nn-panel[data-panel="flights"]{
      height:100%!important;
      min-height:0!important;
      display:grid!important;
      grid-template-rows:132px 386px minmax(0,1fr)!important;
      gap:8px!important;
      overflow:hidden!important;
    }
    .nn-travel-v6 .nn-ref-hero{
      height:132px!important;
      border-radius:25px!important;
      padding:18px 21px!important;
    }
    .nn-travel-v6 .nn-ref-title{
      margin:8px 0 4px!important;
      font-size:27px!important;
      line-height:1.03!important;
    }
    .nn-travel-v6 .nn-ref-sub{
      font-size:13px!important;
      line-height:1.35!important;
      max-width:355px!important;
    }
    .nn-travel-v6 .nn-ref-live{
      right:18px!important;
      top:19px!important;
      padding:7px 12px!important;
    }
    .nn-travel-v6 .nn-ref-live-copy{
      right:18px!important;
      top:58px!important;
    }
    .nn-travel-v6 .nn-panel[data-panel="flights"]>.nn-card{
      height:386px!important;
      min-height:386px!important;
      padding:13px 14px 10px!important;
      border-radius:23px!important;
      overflow:hidden!important;
    }
    .nn-travel-v6 .nn-ref-flight-form{
      display:grid!important;
      grid-template-columns:repeat(12,minmax(0,1fr))!important;
      grid-template-areas:none!important;
      grid-auto-flow:row!important;
      column-gap:8px!important;
      row-gap:9px!important;
      align-items:end!important;
      width:100%!important;
      height:100%!important;
    }
    .nn-travel-v6 .nn-ref-flight-form>.nn-from{grid-area:auto!important;grid-column:1/6!important;grid-row:1!important}
    .nn-travel-v6 .nn-ref-flight-form>.nn-swap{grid-area:auto!important;grid-column:6/8!important;grid-row:1!important;justify-self:center!important}
    .nn-travel-v6 .nn-ref-flight-form>.nn-to{grid-area:auto!important;grid-column:8/13!important;grid-row:1!important}
    .nn-travel-v6 .nn-ref-flight-form>.nn-depart{grid-area:auto!important;grid-column:1/7!important;grid-row:2!important}
    .nn-travel-v6 .nn-ref-flight-form>.nn-return{grid-area:auto!important;grid-column:7/13!important;grid-row:2!important}
    .nn-travel-v6 .nn-ref-flight-form>.nn-adults{grid-area:auto!important;grid-column:1/4!important;grid-row:3!important}
    .nn-travel-v6 .nn-ref-flight-form>.nn-cabin{grid-area:auto!important;grid-column:4/9!important;grid-row:3!important}
    .nn-travel-v6 .nn-ref-flight-form>.nn-currency{grid-area:auto!important;grid-column:9/13!important;grid-row:3!important}
    .nn-travel-v6 .nn-ref-flight-form>.nn-ref-search{grid-area:auto!important;grid-column:1/13!important;grid-row:4!important}
    .nn-travel-v6 .nn-ref-flight-form>.nn-ref-status{grid-area:auto!important;grid-column:1/13!important;grid-row:5!important}
    .nn-travel-v6 .nn-ref-field{
      min-width:0!important;
      gap:6px!important;
    }
    .nn-travel-v6 .nn-ref-field>span{
      font-size:12px!important;
      line-height:1!important;
      min-height:12px!important;
    }
    .nn-travel-v6 .nn-ref-field input,
    .nn-travel-v6 .nn-ref-field select{
      width:100%!important;
      height:50px!important;
      min-height:50px!important;
      padding:0 13px 0 45px!important;
      border-radius:12px!important;
      font-size:16px!important;
    }
    .nn-travel-v6 .nn-swap{
      width:39px!important;
      height:47px!important;
      min-width:39px!important;
      min-height:47px!important;
      margin:0 0 1px!important;
      padding:0!important;
      border-radius:11px!important;
    }
    .nn-travel-v6 .nn-ref-search{
      height:59px!important;
      min-height:59px!important;
      border-radius:15px!important;
      font-size:17px!important;
    }
    .nn-travel-v6 .nn-ref-status{
      height:22px!important;
      min-height:22px!important;
      line-height:22px!important;
      font-size:12px!important;
      margin:0!important;
      overflow:hidden!important;
      white-space:nowrap!important;
      text-overflow:ellipsis!important;
    }
    .nn-travel-v6 .nn-results[data-flight-results]{
      height:100%!important;
      min-height:0!important;
      border-radius:23px!important;
      padding:10px!important;
      overflow:hidden!important;
    }
    .nn-travel-v6 .nn-ref-results-head{
      height:55px!important;
      padding:0 8px 8px!important;
    }
    .nn-travel-v6 .nn-ref-results-list{
      height:calc(100% - 55px)!important;
      gap:8px!important;
      overflow:auto!important;
      overscroll-behavior:contain!important;
    }
    .nn-travel-v6 .nn-ref-result{
      min-height:86px!important;
      height:86px!important;
      grid-template-columns:66px minmax(0,1fr) auto 18px!important;
      gap:10px!important;
      padding:9px 10px!important;
      border-radius:15px!important;
    }
    .nn-travel-v6 .nn-ref-logo{
      width:62px!important;
      height:62px!important;
      border-radius:10px!important;
    }
    .nn-travel-v6 .nn-ref-route{font-size:14px!important}
    .nn-travel-v6 .nn-ref-meta{font-size:11px!important}
    .nn-travel-v6 .nn-ref-price{min-width:92px!important}
    .nn-travel-v6 .nn-ref-price strong{font-size:14px!important}
    .nn-travel-v6 .nn-ref-live-chip{font-size:10px!important;padding:5px 8px!important;margin-bottom:7px!important}
    .nn-travel-v6 .nn-panel:not([data-panel="flights"]){
      height:100%!important;
      min-height:0!important;
      grid-template-rows:366px minmax(0,1fr)!important;
      gap:8px!important;
      overflow:hidden!important;
    }
    .nn-travel-v6 .nn-panel:not([data-panel="flights"])>.nn-card{
      height:366px!important;
      min-height:366px!important;
      padding:15px!important;
      overflow:hidden!important;
    }
    .nn-travel-v6 .nn-panel:not([data-panel="flights"]) .nn-grid{
      display:grid!important;
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
      gap:10px!important;
      align-items:end!important;
    }
    .nn-travel-v6 .nn-panel:not([data-panel="flights"]) .span2,
    .nn-travel-v6 .nn-panel:not([data-panel="flights"]) .desktop-span2{grid-column:1/-1!important}
    .nn-travel-v6 .nn-panel:not([data-panel="flights"]) input,
    .nn-travel-v6 .nn-panel:not([data-panel="flights"]) select{
      height:48px!important;
      min-height:48px!important;
      font-size:15px!important;
    }
    .nn-travel-v6 .nn-panel:not([data-panel="flights"]) textarea{
      height:64px!important;
      min-height:64px!important;
      font-size:14px!important;
    }
    .nn-travel-v6 .nn-panel:not([data-panel="flights"]) .nn-action{
      height:50px!important;
      min-height:50px!important;
      font-size:14px!important;
    }
  `;
  document.head.appendChild(style);
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
}

export function renderTravelSuite() {
  ensureV6Styles();
  const root = renderTravelSuiteV5();
  markReferenceContract(root);
  return root;
}

export const travelSuiteRenderers = Object.freeze({ travel: renderTravelSuite });
