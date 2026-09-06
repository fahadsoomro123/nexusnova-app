export function renderTravelSuite() {
  const root = document.createElement('section');
  root.className = 'nn-travel-clean-slate';
  root.dataset.travelReset = 'locked-reference-rebuild-v1';
  root.style.cssText = 'width:100%;height:100%;min-height:0;overflow:hidden;background:#02070d;';
  return root;
}

export const travelSuiteRenderers = Object.freeze({ travel: renderTravelSuite });
