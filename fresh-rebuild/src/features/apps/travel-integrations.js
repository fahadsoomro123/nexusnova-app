import { renderTravelGroundPanel } from './travel-ground.js';

export function enhanceTravelApp(id, root) {
  if (!(root instanceof HTMLElement) || id !== 'travel') return root;

  const expansion = [...root.querySelectorAll('.nx-tool-card')]
    .find(card => card.textContent?.includes('Worldwide Travel Expansion')) || null;
  const groundPanel = renderTravelGroundPanel();
  if (expansion) {
    expansion.insertAdjacentElement('beforebegin', groundPanel);
    const meta = expansion.querySelector('.nx-tool-meta');
    if (meta) meta.textContent = 'Flights, hotels, rail and coach/bus now use browser-free in-app data engines. Live inventory appears only when an approved secure provider returns it.';
    const railBox = [...expansion.querySelectorAll('.nx-summary-grid > div')]
      .find(item => item.textContent?.includes('Rail / Bus'));
    const state = railBox?.querySelector('strong');
    if (state) state.textContent = 'LIVE SEARCH ENGINE';
  } else {
    root.appendChild(groundPanel);
  }
  return root;
}
