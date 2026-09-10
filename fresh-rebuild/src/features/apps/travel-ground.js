// Fresh Travel owns Rail/Bus inside travel-suite.js.
// This compatibility bridge exists only so older integration imports remain resolvable
// while legacy Travel DOM injection stays disabled for the locked fresh renderer.
export function renderTravelGroundPanel() {
  const panel = document.createElement('section');
  panel.hidden = true;
  panel.dataset.travelGroundBridge = 'fresh-travel-only';
  panel.setAttribute('aria-hidden', 'true');
  return panel;
}
