import { renderTravelGroundPanel } from './travel-ground.js';

function localDateOffset(days = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + Number(days || 0));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function datePlusDays(value, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return localDateOffset(days);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  date.setDate(date.getDate() + Number(days || 0));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeTravelDates(root) {
  const departure = root.querySelector('[data-flight-departure]');
  const returnDate = root.querySelector('[data-flight-return]');
  if (departure) {
    departure.min = localDateOffset(1);
    departure.value = localDateOffset(7);
    if (returnDate) returnDate.min = departure.value;
    departure.addEventListener('change', () => {
      if (!returnDate) return;
      returnDate.min = departure.value || localDateOffset(1);
      if (returnDate.value && returnDate.value < returnDate.min) returnDate.value = '';
    });
  }

  const checkIn = root.querySelector('[data-hotel-checkin]');
  const checkOut = root.querySelector('[data-hotel-checkout]');
  if (checkIn && checkOut) {
    checkIn.min = localDateOffset(1);
    checkIn.value = localDateOffset(7);
    checkOut.min = localDateOffset(2);
    checkOut.value = localDateOffset(10);
    checkIn.addEventListener('change', () => {
      checkOut.min = checkIn.value || localDateOffset(2);
      if (!checkOut.value || checkOut.value <= checkOut.min) {
        checkOut.value = datePlusDays(checkIn.value || localDateOffset(1), 3);
      }
    });
  }

  const groundDate = root.querySelector('[data-ground-date]');
  if (groundDate) {
    groundDate.min = localDateOffset(1);
    groundDate.value = localDateOffset(7);
  }

  const tripStart = root.querySelector('[data-trip-start]');
  const tripStatus = root.querySelector('[data-trip-status]');
  const hasSavedTrip = String(tripStatus?.textContent || '').includes('Saved trip plan loaded');
  if (tripStart && !hasSavedTrip) tripStart.value = localDateOffset(0);
}

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

  normalizeTravelDates(root);
  return root;
}
