const ACTIVE_CLASS = 'nx-batch1-tools-active';
const SCREEN_CLASS = 'nx-batch1-tools-screen';
const PREMIUM_STYLE_ID = 'nx-batch1-premium-layout-v2';
const stage = document.getElementById('nx-stage');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const schemeMeta = document.querySelector('meta[name="color-scheme"]');
const originalTheme = themeMeta?.content || '#07111f';
const originalScheme = schemeMeta?.content || 'dark';
const lightQuery = window.matchMedia?.('(prefers-color-scheme: light)') || null;

let activeScreen = null;
let activeCleanup = null;

// Support both the stable/basic renderers and the premium renderer DOM used by current phone builds.
const APP_DETECTORS = [
  { id:'unit-converter', className:'nx-b1-unit', selectors:['[data-unit-result]'] },
  { id:'expenses', className:'nx-b1-expenses', selectors:['[data-exp-list]'] },
  { id:'pomodoro', className:'nx-b1-focus', selectors:['[data-focus-time]','[data-pomo-time]'] },
  { id:'bmi', className:'nx-b1-bmi', selectors:['[data-bmi-value]','[data-bmi-result]'] }
];

function firstMarker(selectors) {
  for (const selector of selectors) {
    const marker = stage?.querySelector(selector);
    if (marker) return marker;
  }
  return null;
}

function detectApp() {
  for (const config of APP_DETECTORS) {
    const marker = firstMarker(config.selectors);
    if (!marker) continue;
    const screen = marker.closest('.nx-screen');
    const root = marker.closest('.nx-app-body') || screen?.querySelector('[data-app-mount] > *');
    if (screen && root) return { ...config, screen, root };
  }
  return null;
}

function ensurePremiumLayoutStyles() {
  if (document.getElementById(PREMIUM_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PREMIUM_STYLE_ID;
  style.textContent = `
    /* Current premium Unit Converter: result owns the released vertical space. */
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-unit-root.nx-converter-pro {
      width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;
      padding:calc(env(safe-area-inset-top,0px) + 6px) 7px calc(env(safe-area-inset-bottom,0px) + 6px)!important;
      border-radius:0!important;box-sizing:border-box!important;
    }
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-unit-root.nx-converter-pro>.nx-tool-card {
      width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:10px!important;
      display:grid!important;grid-template-rows:auto auto auto minmax(0,1fr) auto auto!important;gap:9px!important;
      border-radius:22px!important;overflow:hidden!important;
    }
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-unit-root .nx-lab-head {margin:0!important;padding-right:46px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-unit-root .nx-convert-grid,
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-unit-root .nx-unit-pair,
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-unit-root .nx-convert-controls {margin:0!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-unit-root .nx-lab-input,
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-unit-root .nx-lab-select {min-height:48px!important;font-size:12px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-unit-root .nx-swap-key {height:48px!important;width:46px!important;font-size:19px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-unit-root .nx-unit-pair {grid-template-columns:minmax(0,1fr) 46px minmax(0,1fr)!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-unit-root .nx-convert-display {
      min-height:0!important;height:100%!important;margin:0!important;padding:18px!important;display:grid!important;
      grid-template-rows:auto minmax(0,1fr) auto!important;align-items:center!important;
    }
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-unit-root .nx-convert-display strong {font-size:clamp(38px,11vw,66px)!important;align-self:center!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-unit-root .nx-lab-key,
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-unit-root .nx-convert-controls .nx-lab-select {min-height:46px!important;font-size:10px!important;}

    /* Current premium Expenses: compact entry + summary, transaction deck gets remaining height. */
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-expenses-root.nx-expenses-pro {
      width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;
      padding:calc(env(safe-area-inset-top,0px) + 6px) 7px calc(env(safe-area-inset-bottom,0px) + 6px)!important;
      border-radius:0!important;box-sizing:border-box!important;display:grid!important;
      grid-template-rows:auto auto minmax(0,1fr)!important;gap:8px!important;
    }
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-expenses-root>.nx-tool-card {margin:0!important;min-height:0!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-expenses-root>.nx-tool-card:first-child {padding:10px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-expenses-root .nx-lab-head {margin:0 0 7px!important;padding-right:46px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-expenses-root .nx-lab-input,
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-expenses-root .nx-lab-select {min-height:42px!important;font-size:11px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-expenses-root .nx-expense-add {min-height:44px!important;font-size:9px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-expenses-root .nx-fin-summary>div {min-height:66px!important;padding:9px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-expenses-root .nx-fin-summary strong {font-size:clamp(15px,4.3vw,22px)!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-expenses-root .nx-finance-deck {height:100%!important;min-height:0!important;padding:10px!important;overflow:hidden!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-expenses-root .nx-finance-list {height:100%!important;min-height:0!important;overflow:auto!important;overscroll-behavior:contain!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-expenses-root .nx-expense-card {min-height:64px!important;padding:10px 11px!important;grid-template-columns:minmax(0,1fr) auto!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-expenses-root .nx-expense-card strong {font-size:11px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-expenses-root .nx-expense-card p {font-size:9px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-expenses-root .nx-expense-card small {font-size:8px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-expenses-root .nx-expense-actions {display:flex!important;align-items:center!important;gap:5px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-expenses-root .nx-expense-edit,
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-expenses-root .nx-expense-delete {width:36px!important;height:36px!important;min-height:36px!important;border-radius:10px!important;font-size:16px!important;padding:0!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-expenses-root .nx-expense-edit {border:1px solid rgba(93,213,255,.14)!important;background:linear-gradient(180deg,#174657,#0b2934)!important;color:#aeeeff!important;}

    /* Current premium Focus: five functional zones fill the phone; stats sit at the bottom, not above a dead void. */
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root.nx-focus-pro {
      width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;
      padding:calc(env(safe-area-inset-top,0px) + 6px) 7px calc(env(safe-area-inset-bottom,0px) + 6px)!important;
      border-radius:0!important;box-sizing:border-box!important;
    }
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root.nx-focus-pro>.nx-tool-card {
      width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:10px!important;
      display:grid!important;grid-template-rows:auto auto minmax(0,1fr) auto auto!important;gap:9px!important;
      border-radius:22px!important;overflow:hidden!important;
    }
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-pro-head {margin:0!important;padding-right:46px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-seg {margin:0!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-seg button {min-height:44px!important;font-size:9px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-focus-console {
      height:100%!important;min-height:0!important;margin:0!important;display:grid!important;
      grid-template-columns:minmax(0,1fr) clamp(112px,29vw,145px)!important;gap:10px!important;align-items:center!important;
    }
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-focus-ring-pro {
      width:min(60vw,44dvh,300px)!important;max-width:100%!important;min-width:0!important;margin:auto!important;
    }
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-focus-center strong {font-size:clamp(42px,12vw,64px)!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-focus-settings {gap:9px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-focus-settings span {font-size:9px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-pro-input,
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-pro-select {min-height:50px!important;font-size:13px!important;padding:10px 12px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-focus-actions {margin:0!important;gap:7px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-focus-actions .nx-pro-key {min-height:54px!important;font-size:10px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-focus-stats {margin:0!important;gap:7px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-focus-stats>div {min-height:64px!important;padding:10px!important;display:grid!important;align-content:center!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-focus-stats span {font-size:8px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-focus-stats strong {font-size:15px!important;}

    /* Current premium BMI: the live result/gauge expands into the free space instead of leaving an empty lower panel. */
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root.nx-bmi-pro {
      width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;
      padding:calc(env(safe-area-inset-top,0px) + 6px) 7px calc(env(safe-area-inset-bottom,0px) + 6px)!important;
      border-radius:0!important;box-sizing:border-box!important;
    }
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root.nx-bmi-pro>.nx-tool-card {
      width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:10px!important;
      display:grid!important;grid-template-rows:auto auto auto minmax(0,1fr) auto auto!important;gap:9px!important;
      border-radius:22px!important;overflow:hidden!important;
    }
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-pro-head {margin:0!important;padding-right:46px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-seg {margin:0!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-seg button {min-height:44px!important;font-size:9px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-bmi-fields {margin:0!important;gap:8px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-bmi-label {font-size:8px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-pro-input {min-height:50px!important;font-size:13px!important;padding:10px 12px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-bmi-result {
      min-height:0!important;height:100%!important;margin:0!important;padding:18px!important;display:grid!important;
      grid-template-rows:minmax(0,1fr) auto!important;align-content:stretch!important;
    }
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-bmi-result-grid {align-self:center!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-bmi-result strong {font-size:clamp(52px,15vw,82px)!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-bmi-result b {font-size:12px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-bmi-range {font-size:9px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-bmi-range span {font-size:12px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-bmi-gauge {height:14px!important;margin-top:16px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-bmi-gauge i {width:20px!important;height:20px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-bmi-metrics {margin:0!important;gap:7px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-bmi-metrics>div {min-height:68px!important;padding:10px!important;display:grid!important;align-content:center!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-bmi-metrics span {font-size:8px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-bmi-metrics strong {font-size:15px!important;}
    html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-bmi-note {margin:0!important;padding:0 6px!important;font-size:9px!important;line-height:1.4!important;text-align:center!important;}

    @media (max-height:720px) {
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root.nx-focus-pro>.nx-tool-card,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root.nx-bmi-pro>.nx-tool-card {gap:5px!important;padding:7px!important;}
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-seg button,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-seg button {min-height:34px!important;}
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-pro-input,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-pro-select,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-pro-input {min-height:40px!important;}
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-focus-actions .nx-pro-key {min-height:44px!important;}
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-focus-stats>div,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-bmi-metrics>div {min-height:52px!important;padding:7px!important;}
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-bmi-result {padding:12px!important;}
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-bmi-result strong {font-size:clamp(42px,13vw,64px)!important;}
    }

    @media (max-width:390px) {
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-focus-console {grid-template-columns:minmax(0,1fr) 108px!important;gap:7px!important;}
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-focus-root .nx-focus-ring-pro {width:min(58vw,42dvh,245px)!important;}
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-b1-bmi-root .nx-bmi-result {padding:14px!important;}
    }

    @media (prefers-color-scheme:light) {
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-converter-pro,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-expenses-pro,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-focus-pro,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-bmi-pro {background:#eef3f6!important;color:#172033!important;}
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-converter-pro>.nx-tool-card,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-expenses-pro>.nx-tool-card,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-focus-pro>.nx-tool-card,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-bmi-pro>.nx-tool-card {background:#fff!important;border-color:#d5dee6!important;color:#172033!important;box-shadow:0 6px 20px rgba(28,42,58,.08)!important;}
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-pro-brand strong,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-lab-brand strong {color:#172033!important;}
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-pro-brand small,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-lab-brand small,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-focus-setting span,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-bmi-label,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-lab-label {color:#66758a!important;}
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-pro-input,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-pro-select,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-lab-input,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-lab-select {background:#f5f8fa!important;color:#172033!important;border-color:#cdd8e1!important;box-shadow:inset 0 1px 3px rgba(27,39,56,.07)!important;}
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-bmi-result,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-convert-display {background:#f2f7f6!important;border-color:#cbded8!important;box-shadow:inset 0 2px 6px rgba(27,39,56,.06)!important;}
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-bmi-result strong,
      html.${ACTIVE_CLASS} .${SCREEN_CLASS} .nx-convert-display strong {color:#16362d!important;text-shadow:none!important;}
    }
  `;
  document.head.appendChild(style);
}

function applyTheme() {
  if (!activeScreen) return;
  const light = Boolean(lightQuery?.matches);
  document.documentElement.dataset.nxBatch1Theme = light ? 'light' : 'dark';
  if (themeMeta) themeMeta.content = light ? '#f4f6f8' : '#07111f';
  if (schemeMeta) schemeMeta.content = light ? 'light' : 'dark';
}

function restoreTheme() {
  delete document.documentElement.dataset.nxBatch1Theme;
  if (themeMeta) themeMeta.content = originalTheme;
  if (schemeMeta) schemeMeta.content = originalScheme;
}

function readExpenses() {
  try {
    const rows = JSON.parse(localStorage.getItem('nexus_expenses_v1') || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function writeExpenses(rows) {
  localStorage.setItem('nexus_expenses_v1', JSON.stringify(Array.isArray(rows) ? rows : []));
}

function money(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function enhanceExpenseEditing(root) {
  const amount = root.querySelector('[data-exp-amount]');
  const cat = root.querySelector('[data-exp-cat]');
  const note = root.querySelector('[data-exp-note]');
  const add = root.querySelector('[data-add-expense]');
  const list = root.querySelector('[data-exp-list]');
  const total = root.querySelector('[data-exp-total]');
  const month = root.querySelector('[data-exp-month]');
  if (!amount || !cat || !note || !add || !list) return () => {};

  let editingId = '';

  const updateSummary = () => {
    const rows = readExpenses();
    const now = new Date();
    const all = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const monthValue = rows.filter(item => {
      const d = new Date(item.at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    if (total) total.textContent = money(all);
    if (month) month.textContent = money(monthValue);
  };

  const paintCard = (id, item) => {
    const deleteButton = [...list.querySelectorAll('[data-delete-expense]')].find(button => button.dataset.deleteExpense === id);
    const card = deleteButton?.closest('.nx-expense-card, .nx-list-card');
    if (!card) return;
    const strong = card.querySelector('strong');
    const copy = card.querySelector('p');
    if (strong) strong.textContent = `${money(item.amount)} • ${item.cat}`;
    if (copy) {
      if (card.classList.contains('nx-expense-card')) copy.textContent = `${item.note || 'No note'} • ${item.payment || 'Unspecified'}`;
      else copy.textContent = item.note || 'No note';
    }
  };

  const installPencils = () => {
    list.querySelectorAll('[data-delete-expense]').forEach(deleteButton => {
      const id = deleteButton.dataset.deleteExpense || '';
      if (!id) return;
      const card = deleteButton.closest('.nx-expense-card, .nx-list-card');
      if (!card || card.querySelector(`[data-edit-expense="${CSS.escape(id)}"]`)) return;

      let actions = card.querySelector('.nx-expense-actions');
      if (!actions && card.classList.contains('nx-expense-card')) {
        actions = document.createElement('div');
        actions.className = 'nx-expense-actions';
        deleteButton.before(actions);
        actions.appendChild(deleteButton);
      }

      const host = actions || deleteButton.closest('.nx-list-card__head') || card;
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'nx-icon-button nx-expense-edit';
      edit.dataset.editExpense = id;
      edit.setAttribute('aria-label', 'Edit expense');
      edit.title = 'Edit expense';
      edit.textContent = '✎';
      if (actions) actions.insertBefore(edit, deleteButton);
      else host.insertBefore(edit, deleteButton);

      edit.addEventListener('click', () => {
        const item = readExpenses().find(row => row.id === id);
        if (!item) return;
        editingId = id;
        amount.value = String(item.amount ?? '');
        cat.value = item.cat || cat.value;
        note.value = item.note || '';
        add.textContent = 'UPDATE EXPENSE';
        root.classList.add('is-expense-editing');
        amount.focus({ preventScroll:true });
        amount.select?.();
      });
    });
  };

  const onUpdate = event => {
    if (!editingId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const value = Number(amount.value);
    if (!Number.isFinite(value) || value <= 0) return;
    const rows = readExpenses();
    const index = rows.findIndex(item => item.id === editingId);
    if (index < 0) return;
    const current = rows[index];
    const updated = {
      ...current,
      amount:value,
      cat:cat.value,
      note:note.value.trim(),
      updatedAt:new Date().toISOString()
    };
    rows[index] = updated;
    writeExpenses(rows);
    paintCard(editingId, updated);
    updateSummary();
    editingId = '';
    amount.value = '';
    note.value = '';
    add.textContent = 'ADD EXPENSE';
    root.classList.remove('is-expense-editing');
  };

  add.addEventListener('click', onUpdate, true);
  const observer = new MutationObserver(installPencils);
  observer.observe(list, { childList:true, subtree:true });
  installPencils();

  return () => {
    observer.disconnect();
    add.removeEventListener('click', onUpdate, true);
  };
}

function enhance(found) {
  const { id, className, screen, root } = found;
  if (screen.dataset.batch1Fullscreen === id) return () => {};
  ensurePremiumLayoutStyles();
  screen.dataset.batch1Fullscreen = id;
  screen.classList.add(SCREEN_CLASS, className);
  root.classList.add(`${className}-root`);
  document.documentElement.classList.add(ACTIVE_CLASS);
  document.body.classList.add(ACTIVE_CLASS);
  document.documentElement.dataset.nxBatch1App = id;
  activeScreen = screen;
  applyTheme();

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'nx-batch1-hub-back';
  back.setAttribute('aria-label', 'Back to Nova Hub');
  back.textContent = '‹';
  screen.appendChild(back);
  const openHub = () => window.NexusNovaFresh?.openHub?.();
  back.addEventListener('click', openHub);

  const appCleanup = id === 'expenses' ? enhanceExpenseEditing(root) : () => {};
  const onTheme = () => applyTheme();
  lightQuery?.addEventListener?.('change', onTheme);

  return () => {
    appCleanup();
    lightQuery?.removeEventListener?.('change', onTheme);
    back.remove();
    root.classList.remove(`${className}-root`);
    screen.classList.remove(SCREEN_CLASS, className);
    delete screen.dataset.batch1Fullscreen;
    document.documentElement.classList.remove(ACTIVE_CLASS);
    document.body.classList.remove(ACTIVE_CLASS);
    delete document.documentElement.dataset.nxBatch1App;
    activeScreen = null;
    restoreTheme();
  };
}

function sync() {
  const found = detectApp();
  if (!found) {
    if (activeCleanup) {
      const cleanup = activeCleanup;
      activeCleanup = null;
      cleanup();
    }
    return;
  }
  if (activeScreen === found.screen && activeCleanup) return;
  if (activeCleanup) {
    const cleanup = activeCleanup;
    activeCleanup = null;
    cleanup();
  }
  try {
    activeCleanup = enhance(found);
  } catch (error) {
    console.error('[NexusNova Batch 1] fullscreen enhancement:', error);
    document.documentElement.classList.remove(ACTIVE_CLASS);
    document.body.classList.remove(ACTIVE_CLASS);
    activeScreen = null;
    restoreTheme();
  }
}

if (stage) {
  const observer = new MutationObserver(() => queueMicrotask(sync));
  observer.observe(stage, { childList:true, subtree:true });
  sync();
}
