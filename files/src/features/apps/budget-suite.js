import { loadJson, saveJson } from '../../core/local-store.js';

const LEGACY_MONEY_EXPENSES = 'nexus_expenses';
const FRESH_EXPENSES = 'nexus_expenses_v1';
const MIGRATION_KEY = 'nexus_fresh_money_expenses_migrated_v1';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

function openFreshApp(id) {
  if (typeof window.NexusNovaFresh?.openApp !== 'function') return false;
  window.NexusNovaFresh.openApp(id);
  return true;
}

function migrateLegacyExpenses() {
  if (localStorage.getItem(MIGRATION_KEY) === '1') return 0;
  const legacy = loadJson(LEGACY_MONEY_EXPENSES, []);
  if (!Array.isArray(legacy) || !legacy.length) {
    localStorage.setItem(MIGRATION_KEY, '1');
    return 0;
  }

  const freshRaw = loadJson(FRESH_EXPENSES, []);
  const fresh = Array.isArray(freshRaw) ? freshRaw : [];
  const existing = new Set(fresh.map(row => String(row?.id || '')));
  let added = 0;

  legacy.forEach((row, index) => {
    const amount = Number(row?.a);
    const name = String(row?.n || '').trim().slice(0, 180);
    if (!(amount > 0) || !name) return;
    const sourceId = String(row?.id || index);
    const id = `legacy-money-${sourceId}`;
    if (existing.has(id)) return;
    fresh.push({
      id,
      amount,
      cat: 'Other',
      note: name,
      at: new Date(Number(row?.id) || Date.now()).toISOString()
    });
    existing.add(id);
    added += 1;
  });

  if (added) saveJson(FRESH_EXPENSES, fresh.slice(-1000).reverse().reverse());
  localStorage.setItem(MIGRATION_KEY, '1');
  return added;
}

export function renderBudgetSuite() {
  const migrated = migrateLegacyExpenses();
  const root = node(`
    <section class="nx-tool-card">
      <strong>Salary Planner</strong>
      <label class="nx-field"><span>Monthly salary</span><input type="number" min="0" step="0.01" inputmode="decimal" data-salary-income placeholder="0"></label>
      <div class="nx-two-col">
        <label class="nx-field"><span>Fixed expenses</span><input type="number" min="0" step="0.01" inputmode="decimal" data-salary-fixed placeholder="0"></label>
        <label class="nx-field"><span>Savings goal</span><input type="number" min="0" step="0.01" inputmode="decimal" data-salary-save placeholder="0"></label>
      </div>
      <button class="nx-primary" type="button" data-salary-calc>CALCULATE PLAN</button>
      <div class="nx-result" data-salary-result>Enter figures.</div>
      <p class="nx-tool-meta">Legacy formula preserved exactly: free amount = salary − fixed expenses − savings goal.</p>
    </section>

    <section class="nx-tool-card">
      <strong>EMI / Loan</strong>
      <div class="nx-two-col">
        <label class="nx-field"><span>Loan amount</span><input type="number" min="0" step="0.01" inputmode="decimal" data-emi-principal placeholder="0"></label>
        <label class="nx-field"><span>Annual interest %</span><input type="number" min="0" step="0.01" inputmode="decimal" data-emi-rate placeholder="0"></label>
      </div>
      <label class="nx-field"><span>Months</span><input type="number" min="1" step="1" inputmode="numeric" data-emi-months placeholder="12"></label>
      <button class="nx-primary" type="button" data-emi-calc>CALCULATE EMI</button>
      <div class="nx-result" data-emi-result>—</div>
      <p class="nx-tool-meta">Uses the same monthly EMI formula as the approved legacy Money tab; 0% loans are principal ÷ months.</p>
    </section>

    <section class="nx-tool-card">
      <strong>Money Tools</strong>
      <div class="nx-two-col">
        <button type="button" data-budget-open="expenses">EXPENSE TRACKER</button>
        <button type="button" data-budget-open="tip">TIP & SPLIT</button>
      </div>
      <div class="nx-two-col">
        <button type="button" data-budget-open="finance">CURRENCY / FINANCE</button>
        <button type="button" data-budget-open="bills">BILL REMINDERS</button>
      </div>
      <p class="nx-tool-meta" data-budget-status>${migrated ? `${migrated} previous Money-tab expense${migrated === 1 ? '' : 's'} migrated into the fresh Expense Tracker.` : 'Fresh money tools are connected without duplicating their data stores.'}</p>
    </section>
  `);

  const income = root.querySelector('[data-salary-income]');
  const fixed = root.querySelector('[data-salary-fixed]');
  const savings = root.querySelector('[data-salary-save]');
  const salaryResult = root.querySelector('[data-salary-result]');

  root.querySelector('[data-salary-calc]').addEventListener('click', () => {
    const i = Number(income.value) || 0;
    const f = Number(fixed.value) || 0;
    const s = Number(savings.value) || 0;
    salaryResult.textContent = i > 0
      ? `Fixed: ${f.toLocaleString()} • Savings: ${s.toLocaleString()} • Free: ${(i - f - s).toLocaleString()}`
      : 'Enter salary.';
  });

  const principal = root.querySelector('[data-emi-principal]');
  const rate = root.querySelector('[data-emi-rate]');
  const months = root.querySelector('[data-emi-months]');
  const emiResult = root.querySelector('[data-emi-result]');

  root.querySelector('[data-emi-calc]').addEventListener('click', () => {
    const p = Number(principal.value) || 0;
    const annual = Number(rate.value) || 0;
    const n = Number(months.value) || 0;
    if (p <= 0 || n <= 0) {
      emiResult.textContent = 'Enter loan amount and months.';
      return;
    }
    const monthlyRate = annual / 1200;
    const power = Math.pow(1 + monthlyRate, n);
    const emi = monthlyRate ? p * monthlyRate * power / (power - 1) : p / n;
    emiResult.textContent = `Monthly EMI: ${emi.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  });

  const status = root.querySelector('[data-budget-status]');
  root.querySelectorAll('[data-budget-open]').forEach(button => button.addEventListener('click', () => {
    if (!openFreshApp(button.dataset.budgetOpen)) status.textContent = 'Fresh app navigation is unavailable.';
  }));

  return root;
}

export const budgetSuiteRenderers = Object.freeze({ budget: renderBudgetSuite });
