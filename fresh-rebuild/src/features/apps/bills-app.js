import { escapeHtml, loadJson, saveJson, uid } from '../../core/local-store.js';

const BILL_KEY = 'nexus_bills_v1';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

function readBills() {
  const rows = loadJson(BILL_KEY, []);
  if (!Array.isArray(rows)) return [];
  return rows.map(row => ({
    id: String(row?.id || uid('bill')),
    title: String(row?.title || '').trim().slice(0, 120),
    amount: Math.max(0, Number(row?.amount) || 0),
    due: /^\d{4}-\d{2}-\d{2}$/.test(String(row?.due || '')) ? String(row.due) : '',
    done: row?.done === true
  })).filter(row => row.title && row.due);
}

function writeBills(rows) {
  saveJson(BILL_KEY, rows.slice(-500));
  window.dispatchEvent(new Event('nexusnova:bills-updated'));
}

function dueState(due, done) {
  if (done) return 'Paid / done';
  const today = new Date();
  today.setHours(0,0,0,0);
  const target = new Date(`${due}T00:00:00`);
  const days = Math.round((target - today) / 86_400_000);
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

export function renderBills() {
  const root = node(`
    <section class="nx-tool-card">
      <strong>Bill Reminder</strong>
      <label class="nx-field"><span>Bill name</span><input maxlength="120" data-bill-title placeholder="Electricity, internet, school fee…"></label>
      <div class="nx-two-col">
        <label class="nx-field"><span>Amount</span><input type="number" min="0" step="0.01" inputmode="decimal" data-bill-amount placeholder="0"></label>
        <label class="nx-field"><span>Due date</span><input type="date" data-bill-due></label>
      </div>
      <button class="nx-primary" type="button" data-bill-add>ADD BILL</button>
      <p class="nx-tool-meta" data-bill-status>Bills are saved locally using the existing NexusNova bill-reminder store.</p>
    </section>
    <section class="nx-stack" data-bill-list></section>
  `);

  const title = root.querySelector('[data-bill-title]');
  const amount = root.querySelector('[data-bill-amount]');
  const due = root.querySelector('[data-bill-due]');
  const status = root.querySelector('[data-bill-status]');
  const list = root.querySelector('[data-bill-list]');
  const notified = new Set();
  let timer = null;

  const draw = () => {
    const rows = readBills().sort((a,b) => a.due.localeCompare(b.due));
    list.innerHTML = rows.length ? rows.map(row => `
      <article class="nx-list-card ${row.done ? 'done' : ''}">
        <div class="nx-list-card__head">
          <label><input type="checkbox" data-bill-toggle="${escapeHtml(row.id)}" ${row.done ? 'checked' : ''}> <strong>${escapeHtml(row.title)}</strong></label>
          <button class="nx-icon-button" type="button" data-bill-delete="${escapeHtml(row.id)}">×</button>
        </div>
        <p>${row.amount > 0 ? `Amount: ${row.amount.toLocaleString(undefined,{maximumFractionDigits:2})} • ` : ''}${escapeHtml(row.due)} • ${escapeHtml(dueState(row.due,row.done))}</p>
      </article>
    `).join('') : '<div class="nx-empty">No bill reminders yet.</div>';

    list.querySelectorAll('[data-bill-toggle]').forEach(box => box.addEventListener('change', () => {
      const rows = readBills();
      const row = rows.find(item => item.id === box.dataset.billToggle);
      if (row) row.done = box.checked;
      writeBills(rows);
      draw();
    }));
    list.querySelectorAll('[data-bill-delete]').forEach(button => button.addEventListener('click', () => {
      writeBills(readBills().filter(row => row.id !== button.dataset.billDelete));
      draw();
    }));
  };

  const checkDue = () => {
    const today = new Date().toISOString().slice(0,10);
    const dueRows = readBills().filter(row => !row.done && row.due <= today);
    if (dueRows.length) status.textContent = `${dueRows.length} bill${dueRows.length === 1 ? '' : 's'} due or overdue.`;
    dueRows.forEach(row => {
      if (notified.has(row.id) || !('Notification' in window) || Notification.permission !== 'granted') return;
      notified.add(row.id);
      try {
        new Notification('NexusNova Bill Reminder', {
          body: `${row.title}${row.amount > 0 ? ` • ${row.amount.toLocaleString()}` : ''} • ${dueState(row.due,false)}`
        });
      } catch {}
    });
  };

  root.querySelector('[data-bill-add]').addEventListener('click', async () => {
    const cleanTitle = title.value.trim().slice(0,120);
    const cleanDue = due.value;
    const cleanAmount = Math.max(0, Number(amount.value) || 0);
    if (!cleanTitle || !/^\d{4}-\d{2}-\d{2}$/.test(cleanDue)) {
      status.textContent = 'Enter a bill name and due date.';
      return;
    }
    const rows = readBills();
    rows.push({ id: uid('bill'), title: cleanTitle, amount: cleanAmount, due: cleanDue, done:false });
    writeBills(rows);
    title.value = '';
    amount.value = '';
    due.value = '';
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch {}
    }
    status.textContent = 'Bill reminder saved.';
    draw();
    checkDue();
  });

  draw();
  checkDue();
  timer = setInterval(checkDue, 60_000);
  const onUpdate = () => { draw(); checkDue(); };
  window.addEventListener('nexusnova:bills-updated', onUpdate);
  root.__cleanup = () => {
    clearInterval(timer);
    window.removeEventListener('nexusnova:bills-updated', onUpdate);
  };
  return root;
}

export const billRenderers = Object.freeze({ bills: renderBills });
