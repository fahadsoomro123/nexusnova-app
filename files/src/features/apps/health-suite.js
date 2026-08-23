import { personalRenderers } from './personal-apps.js';

function openFreshApp(id) {
  if (typeof window.NexusNovaFresh?.openApp !== 'function') return false;
  window.NexusNovaFresh.openApp(id);
  return true;
}

export function renderHealthSuite() {
  const root = personalRenderers.health();

  const tools = document.createElement('section');
  tools.className = 'nx-tool-card';
  tools.innerHTML = `
    <strong>Health & Focus Tools</strong>
    <p class="nx-tool-meta">Simple personal estimates only — not medical diagnosis or treatment advice.</p>

    <label class="nx-field"><span>Water Goal • weight kg</span><input type="number" min="0" step="0.1" inputmode="decimal" data-water-weight placeholder="70"></label>
    <button class="nx-primary" type="button" data-water-calc>CALCULATE WATER GOAL</button>
    <div class="nx-result" data-water-result>~35 ml/kg/day estimate.</div>

    <label class="nx-field"><span>Sleep Planner • wake time</span><input type="time" value="07:00" data-sleep-wake></label>
    <button class="nx-primary" type="button" data-sleep-calc>SUGGEST BEDTIME</button>
    <div class="nx-result" data-sleep-result>—</div>

    <button type="button" data-open-bmi>OPEN BMI CALCULATOR</button>
  `;
  root.appendChild(tools);

  const waterWeight = tools.querySelector('[data-water-weight]');
  const waterResult = tools.querySelector('[data-water-result]');
  tools.querySelector('[data-water-calc]').addEventListener('click', () => {
    const weight = Number(waterWeight.value) || 0;
    waterResult.textContent = weight > 0
      ? `Estimated daily water: ${(weight * 35 / 1000).toFixed(2)} L`
      : 'Enter weight.';
  });

  const wake = tools.querySelector('[data-sleep-wake]');
  const sleepResult = tools.querySelector('[data-sleep-result]');
  tools.querySelector('[data-sleep-calc]').addEventListener('click', () => {
    const value = wake.value || '07:00';
    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      sleepResult.textContent = 'Choose a valid wake time.';
      return;
    }
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    date.setMinutes(date.getMinutes() - 450);
    sleepResult.textContent = `Suggested bedtime: ${date.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}`;
  });

  tools.querySelector('[data-open-bmi]').addEventListener('click', () => {
    if (!openFreshApp('bmi')) sleepResult.textContent = 'Fresh app navigation is unavailable.';
  });

  return root;
}

export const healthSuiteRenderers = Object.freeze({ health: renderHealthSuite });
