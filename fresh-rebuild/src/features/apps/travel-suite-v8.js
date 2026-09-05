import { renderTravelSuite as renderTravelSuiteV7 } from './travel-suite-v7.js';

function ensureV8Styles() {
  if (document.getElementById('nn-travel-approved-ref-v8')) return;
  const style = document.createElement('style');
  style.id = 'nn-travel-approved-ref-v8';
  style.textContent = `
    .nn-travel-v8 .nn-ref-title{margin-top:12px!important}
    .nn-travel-v8 .nn-ref-sub{margin-top:2px!important}
    .nn-travel-v8 .nn-from,.nn-travel-v8 .nn-to{gap:12px!important}
    .nn-travel-v8 .nn-swap{
      align-self:start!important;
      margin-top:29px!important;
      width:39px!important;height:43px!important;min-width:39px!important;min-height:43px!important;
      font-size:23px!important
    }
    .nn-travel-v8 .nn-ref-results-title{gap:12px!important}
    .nn-travel-v8 .nn-ref-results-title small{margin-top:3px!important}
    .nn-travel-v8 .nn-ref-result{box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 5px 12px rgba(0,0,0,.22)!important}
    .nn-travel-v8 .nn-ref-arrow{font-size:25px!important;color:#c7e5f4!important}
    .nn-travel-v8 .nn-ref-price strong{letter-spacing:.01em!important}
  `;
  document.head.appendChild(style);
}

export function renderTravelSuite() {
  ensureV8Styles();
  const root = renderTravelSuiteV7();
  root.classList.add('nn-travel-v8');
  root.dataset.referencePass = 'v8';
  return root;
}

export const travelSuiteRenderers = Object.freeze({ travel: renderTravelSuite });
