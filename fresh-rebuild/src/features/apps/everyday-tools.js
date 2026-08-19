import { escapeHtml, loadJson, saveJson, uid } from '../../core/local-store.js';

const KEYS = {
  notes: 'nexus_notes_v1',
  todos: 'nexus_todos_v1',
  expenses: 'nexus_expenses_v1'
};

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

function money(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function renderNotes() {
  const root = node(`
    <section class="nx-tool-card">
      <label class="nx-field"><span>Title</span><input data-note-title maxlength="100" placeholder="Note title"></label>
      <label class="nx-field"><span>Note</span><textarea data-note-body maxlength="3000" rows="5" placeholder="Write something useful…"></textarea></label>
      <button class="nx-primary" type="button" data-add-note>ADD NOTE</button>
    </section>
    <section class="nx-stack" data-note-list></section>
  `);
  const title = root.querySelector('[data-note-title]');
  const body = root.querySelector('[data-note-body]');
  const list = root.querySelector('[data-note-list]');

  const draw = () => {
    const notes = loadJson(KEYS.notes, []);
    list.innerHTML = notes.length ? notes.map(note => `
      <article class="nx-list-card">
        <div class="nx-list-card__head"><strong>${escapeHtml(note.title || 'Untitled')}</strong><button class="nx-icon-button" type="button" data-delete-note="${escapeHtml(note.id)}" aria-label="Delete note">×</button></div>
        <p>${escapeHtml(note.body || '').replace(/\n/g, '<br>')}</p>
        <small>${new Date(note.at).toLocaleString()}</small>
      </article>
    `).join('') : '<div class="nx-empty">No notes yet.</div>';
    list.querySelectorAll('[data-delete-note]').forEach(button => button.addEventListener('click', () => {
      saveJson(KEYS.notes, loadJson(KEYS.notes, []).filter(item => item.id !== button.dataset.deleteNote));
      draw();
    }));
  };

  root.querySelector('[data-add-note]').addEventListener('click', () => {
    const noteTitle = title.value.trim();
    const noteBody = body.value.trim();
    if (!noteTitle && !noteBody) return;
    const notes = loadJson(KEYS.notes, []);
    notes.unshift({ id: uid('note'), title: noteTitle || 'Untitled', body: noteBody, at: new Date().toISOString() });
    saveJson(KEYS.notes, notes.slice(0, 250));
    title.value = '';
    body.value = '';
    draw();
  });
  draw();
  return root;
}

export function renderTodo() {
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-inline-field"><input data-todo-input maxlength="240" placeholder="Add a task"><button type="button" data-add-todo>ADD</button></div>
      <div class="nx-tool-meta" data-todo-stats></div>
    </section>
    <section class="nx-stack" data-todo-list></section>
  `);
  const input = root.querySelector('[data-todo-input]');
  const list = root.querySelector('[data-todo-list]');
  const stats = root.querySelector('[data-todo-stats]');

  const draw = () => {
    const todos = loadJson(KEYS.todos, []);
    stats.textContent = `${todos.filter(item => !item.done).length} remaining • ${todos.length} total`;
    list.innerHTML = todos.length ? todos.map(todo => `
      <article class="nx-list-card nx-todo-row ${todo.done ? 'done' : ''}">
        <label><input type="checkbox" data-toggle-todo="${escapeHtml(todo.id)}" ${todo.done ? 'checked' : ''}><span>${escapeHtml(todo.text)}</span></label>
        <button class="nx-icon-button" type="button" data-delete-todo="${escapeHtml(todo.id)}" aria-label="Delete task">×</button>
      </article>
    `).join('') : '<div class="nx-empty">No tasks yet.</div>';
    list.querySelectorAll('[data-toggle-todo]').forEach(check => check.addEventListener('change', () => {
      const todos = loadJson(KEYS.todos, []);
      const item = todos.find(todo => todo.id === check.dataset.toggleTodo);
      if (item) item.done = check.checked;
      saveJson(KEYS.todos, todos);
      draw();
    }));
    list.querySelectorAll('[data-delete-todo]').forEach(button => button.addEventListener('click', () => {
      saveJson(KEYS.todos, loadJson(KEYS.todos, []).filter(item => item.id !== button.dataset.deleteTodo));
      draw();
    }));
  };

  const add = () => {
    const text = input.value.trim();
    if (!text) return;
    const todos = loadJson(KEYS.todos, []);
    todos.unshift({ id: uid('todo'), text, done: false, at: new Date().toISOString() });
    saveJson(KEYS.todos, todos.slice(0, 500));
    input.value = '';
    draw();
  };
  root.querySelector('[data-add-todo]').addEventListener('click', add);
  input.addEventListener('keydown', event => { if (event.key === 'Enter') add(); });
  draw();
  return root;
}

function evaluate(expression) {
  const source = String(expression || '').replace(/\s+/g, '');
  if (!source || source.length > 160 || !/^[0-9+\-*/().%]+$/.test(source)) throw new Error('Invalid expression');
  let index = 0, operations = 0, depth = 0;
  const peek = () => source[index] || '';
  const op = () => { if (++operations > 128) throw new Error('Too complex'); };
  const primary = () => {
    if (peek() === '(') {
      if (++depth > 24) throw new Error('Too deep');
      index++;
      const value = expressionParser();
      if (peek() !== ')') throw new Error('Missing )');
      index++; depth--;
      return value;
    }
    const start = index;
    let decimal = false, digit = false;
    while (/[0-9.]/.test(peek())) {
      if (peek() === '.') { if (decimal) break; decimal = true; } else digit = true;
      index++;
    }
    if (!digit) throw new Error('Expected number');
    const value = Number(source.slice(start, index));
    if (!Number.isFinite(value)) throw new Error('Bad number');
    return value;
  };
  const unary = () => {
    if (peek() === '+') { index++; return unary(); }
    if (peek() === '-') { index++; return -unary(); }
    return primary();
  };
  const factor = () => { let value = unary(); while (peek() === '%') { op(); index++; value /= 100; } return value; };
  const term = () => {
    let value = factor();
    while (peek() === '*' || peek() === '/') {
      const operator = peek(); op(); index++;
      const right = factor();
      if (operator === '/' && right === 0) throw new Error('Division by zero');
      value = operator === '*' ? value * right : value / right;
      if (!Number.isFinite(value)) throw new Error('Bad result');
    }
    return value;
  };
  const expressionParser = () => {
    let value = term();
    while (peek() === '+' || peek() === '-') {
      const operator = peek(); op(); index++;
      const right = term();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  };
  const result = expressionParser();
  if (index !== source.length || !Number.isFinite(result)) throw new Error('Invalid expression');
  return result;
}

export function renderCalculator() {
  const root = node(`
    <section class="nx-tool-card nx-calculator">
      <div class="nx-calc-display" data-calc-display>0</div>
      <div class="nx-calc-grid">
        ${['C','(',')','⌫','7','8','9','/','4','5','6','*','1','2','3','-','0','.','%','+'].map(value => `<button type="button" data-calc="${value}">${value}</button>`).join('')}
        <button class="equals" type="button" data-calc="=">=</button>
      </div>
    </section>
  `);
  let expr = '';
  const display = root.querySelector('[data-calc-display]');
  const press = value => {
    if (value === 'C') expr = '';
    else if (value === '⌫') expr = expr.slice(0, -1);
    else if (value === '=') {
      try { expr = String(Number(evaluate(expr).toPrecision(12))); }
      catch { display.textContent = 'Error'; expr = ''; return; }
    } else if (/^[0-9+\-*/().%]$/.test(value) && expr.length < 160) expr += value;
    display.textContent = expr || '0';
  };
  root.querySelectorAll('[data-calc]').forEach(button => button.addEventListener('click', () => press(button.dataset.calc)));
  return root;
}

const UNITS = {
  length: { m: 1, km: .001, cm: 100, mm: 1000, mi: .000621371, yd: 1.09361, ft: 3.28084, in: 39.3701 },
  weight: { kg: 1, g: 1000, mg: 1e6, lb: 2.20462, oz: 35.274, ton: .001 },
  data: { B: 1, KB: 1 / 1024, MB: 1 / (1024 ** 2), GB: 1 / (1024 ** 3), TB: 1 / (1024 ** 4) },
  temp: { C: 'C', F: 'F', K: 'K' }
};

export function renderUnitConverter() {
  const root = node(`
    <section class="nx-tool-card">
      <label class="nx-field"><span>Category</span><select data-unit-cat><option value="length">Length</option><option value="weight">Weight</option><option value="temp">Temperature</option><option value="data">Data</option></select></label>
      <label class="nx-field"><span>Value</span><input type="number" step="any" inputmode="decimal" data-unit-value value="1"></label>
      <div class="nx-two-col"><label class="nx-field"><span>From</span><select data-unit-from></select></label><label class="nx-field"><span>To</span><select data-unit-to></select></label></div>
      <div class="nx-result" data-unit-result>—</div>
    </section>
  `);
  const cat = root.querySelector('[data-unit-cat]');
  const value = root.querySelector('[data-unit-value]');
  const from = root.querySelector('[data-unit-from]');
  const to = root.querySelector('[data-unit-to]');
  const result = root.querySelector('[data-unit-result]');

  const calculate = () => {
    const n = Number(value.value);
    if (!Number.isFinite(n)) { result.textContent = '—'; return; }
    let output;
    if (cat.value === 'temp') {
      let c = n;
      if (from.value === 'F') c = (n - 32) * 5 / 9;
      if (from.value === 'K') c = n - 273.15;
      output = c;
      if (to.value === 'F') output = c * 9 / 5 + 32;
      if (to.value === 'K') output = c + 273.15;
    } else {
      const table = UNITS[cat.value];
      output = (n / table[from.value]) * table[to.value];
    }
    result.textContent = `${Number(output.toPrecision(10))} ${to.value}`;
  };
  const rebuild = () => {
    const keys = Object.keys(UNITS[cat.value]);
    from.innerHTML = keys.map(key => `<option>${key}</option>`).join('');
    to.innerHTML = keys.map(key => `<option>${key}</option>`).join('');
    to.value = keys[1] || keys[0];
    calculate();
  };
  [cat, value, from, to].forEach(element => element.addEventListener('input', element === cat ? rebuild : calculate));
  rebuild();
  return root;
}

export function renderExpenses() {
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-two-col"><label class="nx-field"><span>Amount</span><input type="number" inputmode="decimal" min="0" step="0.01" data-exp-amount placeholder="0.00"></label><label class="nx-field"><span>Category</span><select data-exp-cat><option>Food</option><option>Transport</option><option>Bills</option><option>Shopping</option><option>Education</option><option>Other</option></select></label></div>
      <label class="nx-field"><span>Note</span><input maxlength="180" data-exp-note placeholder="Optional note"></label>
      <button class="nx-primary" type="button" data-add-expense>ADD EXPENSE</button>
    </section>
    <div class="nx-summary-grid"><div><span>All time</span><strong data-exp-total>0</strong></div><div><span>This month</span><strong data-exp-month>0</strong></div></div>
    <section class="nx-stack" data-exp-list></section>
  `);
  const amount = root.querySelector('[data-exp-amount]');
  const cat = root.querySelector('[data-exp-cat]');
  const note = root.querySelector('[data-exp-note]');
  const list = root.querySelector('[data-exp-list]');
  const total = root.querySelector('[data-exp-total]');
  const month = root.querySelector('[data-exp-month]');

  const draw = () => {
    const expenses = loadJson(KEYS.expenses, []);
    const now = new Date();
    const monthTotal = expenses.filter(item => { const d = new Date(item.at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    total.textContent = money(expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0));
    month.textContent = money(monthTotal);
    list.innerHTML = expenses.length ? expenses.slice(0, 100).map(item => `
      <article class="nx-list-card"><div class="nx-list-card__head"><strong>${money(item.amount)} • ${escapeHtml(item.cat)}</strong><button class="nx-icon-button" type="button" data-delete-expense="${escapeHtml(item.id)}">×</button></div><p>${escapeHtml(item.note || 'No note')}</p><small>${new Date(item.at).toLocaleString()}</small></article>
    `).join('') : '<div class="nx-empty">No expenses yet.</div>';
    list.querySelectorAll('[data-delete-expense]').forEach(button => button.addEventListener('click', () => {
      saveJson(KEYS.expenses, loadJson(KEYS.expenses, []).filter(item => item.id !== button.dataset.deleteExpense));
      draw();
    }));
  };
  root.querySelector('[data-add-expense]').addEventListener('click', () => {
    const n = Number(amount.value);
    if (!Number.isFinite(n) || n <= 0) return;
    const expenses = loadJson(KEYS.expenses, []);
    expenses.unshift({ id: uid('expense'), amount: n, cat: cat.value, note: note.value.trim(), at: new Date().toISOString() });
    saveJson(KEYS.expenses, expenses.slice(0, 1000));
    amount.value = ''; note.value = '';
    draw();
  });
  draw();
  return root;
}

export function renderPomodoro() {
  const root = node(`
    <section class="nx-tool-card nx-focus-tool">
      <div class="nx-focus-ring"><div><span data-pomo-label>FOCUS</span><strong data-pomo-time>25:00</strong></div></div>
      <div class="nx-action-row"><button type="button" data-pomo-start>START</button><button type="button" data-pomo-pause>PAUSE</button><button type="button" data-pomo-reset>RESET</button></div>
    </section>
  `);
  let left = 25 * 60, running = false, timer = null, mode = 'focus';
  const display = root.querySelector('[data-pomo-time]');
  const label = root.querySelector('[data-pomo-label]');
  const draw = () => { display.textContent = `${String(Math.floor(left / 60)).padStart(2,'0')}:${String(left % 60).padStart(2,'0')}`; label.textContent = mode.toUpperCase(); };
  const stop = () => { clearInterval(timer); timer = null; running = false; };
  root.querySelector('[data-pomo-start]').addEventListener('click', () => {
    if (running) return;
    running = true;
    timer = setInterval(() => {
      left--;
      if (left <= 0) { stop(); mode = mode === 'focus' ? 'break' : 'focus'; left = mode === 'focus' ? 25 * 60 : 5 * 60; }
      draw();
    }, 1000);
  });
  root.querySelector('[data-pomo-pause]').addEventListener('click', stop);
  root.querySelector('[data-pomo-reset]').addEventListener('click', () => { stop(); mode = 'focus'; left = 25 * 60; draw(); });
  root.__cleanup = stop;
  draw();
  return root;
}

export function renderBMI() {
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-two-col"><label class="nx-field"><span>Height (cm)</span><input type="number" inputmode="decimal" data-bmi-h placeholder="170"></label><label class="nx-field"><span>Weight (kg)</span><input type="number" inputmode="decimal" data-bmi-w placeholder="65"></label></div>
      <button class="nx-primary" type="button" data-bmi-go>CALCULATE BMI</button>
      <div class="nx-result" data-bmi-result>—</div>
      <p class="nx-tool-meta">BMI is a general screening metric, not a diagnosis.</p>
    </section>
  `);
  root.querySelector('[data-bmi-go]').addEventListener('click', () => {
    const h = Number(root.querySelector('[data-bmi-h]').value) / 100;
    const w = Number(root.querySelector('[data-bmi-w]').value);
    const result = root.querySelector('[data-bmi-result]');
    if (!(h > 0) || !(w > 0)) { result.textContent = '—'; return; }
    const bmi = w / (h * h);
    const category = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal range' : bmi < 30 ? 'Overweight' : 'High range';
    result.textContent = `${bmi.toFixed(1)} • ${category}`;
  });
  return root;
}

export function renderTip() {
  const root = node(`
    <section class="nx-tool-card">
      <label class="nx-field"><span>Bill</span><input type="number" inputmode="decimal" min="0" step="0.01" data-tip-bill placeholder="0.00"></label>
      <div class="nx-two-col"><label class="nx-field"><span>Tip %</span><input type="number" inputmode="decimal" min="0" data-tip-pct value="10"></label><label class="nx-field"><span>People</span><input type="number" inputmode="numeric" min="1" data-tip-people value="1"></label></div>
      <div class="nx-result" data-tip-result>Enter a bill amount</div>
    </section>
  `);
  const calculate = () => {
    const bill = Number(root.querySelector('[data-tip-bill]').value) || 0;
    const pct = Number(root.querySelector('[data-tip-pct]').value) || 0;
    const people = Math.max(1, Number(root.querySelector('[data-tip-people]').value) || 1);
    const tip = bill * pct / 100;
    root.querySelector('[data-tip-result]').innerHTML = `Tip <strong>${money(tip)}</strong><br>Total <strong>${money(bill + tip)}</strong><br>Each <strong>${money((bill + tip) / people)}</strong>`;
  };
  root.querySelectorAll('input').forEach(input => input.addEventListener('input', calculate));
  return root;
}

const CITIES = [
  ['Karachi','Asia/Karachi'], ['Dubai','Asia/Dubai'], ['London','Europe/London'], ['New York','America/New_York'], ['Tokyo','Asia/Tokyo'], ['Istanbul','Europe/Istanbul']
];

export function renderWorldClock() {
  const root = node('<section class="nx-stack" data-clock-list></section>');
  const list = root.querySelector('[data-clock-list]');
  const draw = () => {
    const now = new Date();
    list.innerHTML = CITIES.map(([name, timeZone]) => `<article class="nx-world-row"><span>${name}</span><strong>${now.toLocaleTimeString([], { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong></article>`).join('');
  };
  draw();
  const timer = setInterval(draw, 1000);
  root.__cleanup = () => clearInterval(timer);
  return root;
}

export function renderQR() {
  const root = node(`
    <section class="nx-tool-card">
      <label class="nx-field"><span>Text or URL</span><textarea rows="4" maxlength="1500" data-qr-text placeholder="Enter QR content"></textarea></label>
      <div class="nx-action-row"><button type="button" data-qr-generate>GENERATE</button><button type="button" data-qr-scan>SCAN</button><button type="button" data-qr-stop>STOP</button></div>
      <div class="nx-qr-output" data-qr-output></div>
      <video class="nx-qr-video" data-qr-video playsinline hidden></video>
      <p class="nx-tool-meta" data-qr-status>QR generation uses the configured remote QR image service only after confirmation.</p>
    </section>
  `);
  const text = root.querySelector('[data-qr-text]');
  const output = root.querySelector('[data-qr-output]');
  const video = root.querySelector('[data-qr-video]');
  const status = root.querySelector('[data-qr-status]');
  let stream = null;
  let scanning = false;

  const stop = () => {
    scanning = false;
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
    video.hidden = true;
  };

  root.querySelector('[data-qr-generate]').addEventListener('click', () => {
    const value = text.value.trim();
    if (!value) return;
    if (!confirm('Generating this QR sends its text to the configured QR image service. Continue?')) return;
    const image = new Image(220, 220);
    image.alt = 'Generated QR code';
    image.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(value)}`;
    output.replaceChildren(image);
    status.textContent = 'QR generated.';
  });

  root.querySelector('[data-qr-scan]').addEventListener('click', async () => {
    if (!('BarcodeDetector' in window)) { status.textContent = 'Live QR scanning is not supported on this device.'; return; }
    try {
      stop();
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;
      video.hidden = false;
      await video.play();
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      scanning = true;
      status.textContent = 'Point the camera at a QR code.';
      const loop = async () => {
        if (!scanning) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length) {
            text.value = codes[0].rawValue || '';
            status.textContent = 'QR code detected.';
            stop();
            return;
          }
        } catch {}
        requestAnimationFrame(loop);
      };
      loop();
    } catch {
      status.textContent = 'Camera permission denied or unavailable.';
      stop();
    }
  });
  root.querySelector('[data-qr-stop]').addEventListener('click', stop);
  root.__cleanup = stop;
  return root;
}

export const everydayRenderers = Object.freeze({
  notes: renderNotes,
  todo: renderTodo,
  calculator: renderCalculator,
  'unit-converter': renderUnitConverter,
  expenses: renderExpenses,
  pomodoro: renderPomodoro,
  bmi: renderBMI,
  tip: renderTip,
  'world-clock': renderWorldClock,
  qr: renderQR
});
