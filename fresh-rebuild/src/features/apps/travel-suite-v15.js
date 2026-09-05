import { renderTravelSuite as renderTravelSuiteV14 } from './travel-suite-v14.js';

function ensureV15Styles() {
  if (document.getElementById('nn-travel-phone-repair-v15')) return;
  const style = document.createElement('style');
  style.id = 'nn-travel-phone-repair-v15';
  style.textContent = `
    /* V6 used display:grid!important on non-flight panels after V4's hidden rule.
       That made hidden Hotel/Rail/Trip panels leak into every tab on phone. */
    .nn-travel-v15 .nn-panel[hidden] { display:none!important; }
    .nn-travel-v15 .nn-panel:not([hidden]) { display:grid!important; }

    /* Locked reference is 550x1215, not 550x1032. Use the full reference canvas
       so the Travel surface reaches the bottom dock instead of leaving a dead gap. */
    .nn-travel-v15 .nn-ref-canvas {
      width:550px!important;
      height:1215px!important;
      grid-template-rows:96px minmax(0,1fr)!important;
      align-content:stretch!important;
    }
    .nn-travel-v15 .nn-stage,
    .nn-travel-v15 .nn-panel { min-height:0!important; height:100%!important; }

    /* Keep results inside the active product panel; never push the whole page. */
    .nn-travel-v15 .nn-results,
    .nn-travel-v15 .nn-ref-results-list {
      min-height:0!important;
      overflow-y:auto!important;
      overscroll-behavior:contain!important;
    }
  `;
  document.head.appendChild(style);
}

function repairRuntimeContracts(root) {
  /* V9 Cloudflare interceptor looks for data-flight-depart while the real V4/V6
     field is data-flight-departure. Alias the same input so live flight search
     reaches Cloudflare instead of failing validation before the request. */
  const departure = root.querySelector('[data-flight-departure]');
  if (departure && !departure.hasAttribute('data-flight-depart')) {
    departure.setAttribute('data-flight-depart', '');
  }

  /* Enforce one visible tab panel immediately and after every tab click. */
  const applyTab = name => {
    const active = ['flights','hotels','ground','plan'].includes(name) ? name : 'flights';
    root.querySelectorAll('[data-panel]').forEach(panel => {
      panel.hidden = panel.dataset.panel !== active;
    });
  };

  const onTabCapture = event => {
    const button = event.target.closest?.('[data-travel-tab]');
    if (!button || !root.contains(button)) return;
    queueMicrotask(() => applyTab(button.dataset.travelTab));
  };

  root.addEventListener('click', onTabCapture, true);
  const selected = root.querySelector('[data-travel-tab].is-active')?.dataset.travelTab || 'flights';
  applyTab(selected);

  const previousCleanup = root.__cleanup;
  root.__cleanup = () => {
    root.removeEventListener('click', onTabCapture, true);
    previousCleanup?.();
  };
}

export function renderTravelSuite() {
  ensureV15Styles();
  const root = renderTravelSuiteV14();
  root.classList.add('nn-travel-v15');
  root.dataset.phoneRepair = 'v15-tabs-search-viewport';
  repairRuntimeContracts(root);
  return root;
}

export const travelSuiteRenderers = Object.freeze({ travel: renderTravelSuite });
