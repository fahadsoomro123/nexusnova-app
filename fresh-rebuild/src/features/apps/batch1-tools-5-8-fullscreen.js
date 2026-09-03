const ACTIVE_CLASS = 'nx-batch1-tools-active';
const SCREEN_CLASS = 'nx-batch1-tools-screen';
const stage = document.getElementById('nx-stage');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const schemeMeta = document.querySelector('meta[name="color-scheme"]');
const originalTheme = themeMeta?.content || '#07111f';
const originalScheme = schemeMeta?.content || 'dark';
const lightQuery = window.matchMedia?.('(prefers-color-scheme: light)') || null;

let activeScreen = null;
let activeCleanup = null;

const APP_DETECTORS = [
  { id:'unit-converter', className:'nx-b1-unit', selector:'[data-unit-result]' },
  { id:'expenses', className:'nx-b1-expenses', selector:'[data-exp-list]' },
  { id:'pomodoro', className:'nx-b1-focus', selector:'[data-pomo-time]' },
  { id:'bmi', className:'nx-b1-bmi', selector:'[data-bmi-result]' }
];

function detectApp() {
  for (const config of APP_DETECTORS) {
    const marker = stage?.querySelector(config.selector);
    if (!marker) continue;
    const screen = marker.closest('.nx-screen');
    const root = marker.closest('.nx-app-body') || screen?.querySelector('[data-app-mount] > *');
    if (screen && root) return { ...config, screen, root };
  }
  return null;
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
    const card = deleteButton?.closest('.nx-list-card');
    if (!card) return;
    const strong = card.querySelector('.nx-list-card__head strong');
    const copy = card.querySelector('p');
    if (strong) strong.textContent = `${money(item.amount)} • ${item.cat}`;
    if (copy) copy.textContent = item.note || 'No note';
  };

  const installPencils = () => {
    list.querySelectorAll('[data-delete-expense]').forEach(deleteButton => {
      const id = deleteButton.dataset.deleteExpense || '';
      const head = deleteButton.closest('.nx-list-card__head');
      if (!id || !head || head.querySelector(`[data-edit-expense="${CSS.escape(id)}"]`)) return;
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'nx-icon-button nx-expense-edit';
      edit.dataset.editExpense = id;
      edit.setAttribute('aria-label', 'Edit expense');
      edit.title = 'Edit expense';
      edit.textContent = '✎';
      head.insertBefore(edit, deleteButton);
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
