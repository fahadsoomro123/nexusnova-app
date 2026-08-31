import { escapeHtml, loadJson, saveJson, uid } from '../../core/local-store.js';

const KEYS = {
  notes: 'nexus_notes_v1',
  todos: 'nexus_todos_v1',
  expenses: 'nexus_expenses_v1',
  calcHistory: 'nexus_calc_history_v2',
  calcMode: 'nexus_calc_angle_mode_v1'
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

function calcTokens(expression) {
  const source = String(expression || '').replace(/×/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi').replace(/\s+/g, '');
  if (!source || source.length > 240) throw new Error('Invalid expression');
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
    if (number) {
      tokens.push({ type:'number', value:Number(number[0]) });
      index += number[0].length;
      continue;
    }
    const identifier = rest.match(/^[a-z]+/i);
    if (identifier) {
      tokens.push({ type:'id', value:identifier[0].toLowerCase() });
      index += identifier[0].length;
      continue;
    }
    const char = source[index];
    if ('+-*/^()%!'.includes(char)) {
      tokens.push({ type:'op', value:char });
      index++;
      continue;
    }
    throw new Error('Invalid symbol');
  }
  return tokens;
}

function calculateScientific(expression, { mode = 'DEG', ans = 0 } = {}) {
  const tokens = calcTokens(expression);
  let index = 0;
  let operations = 0;
  const peek = value => tokens[index]?.value === value;
  const take = () => tokens[index++];
  const count = () => { if (++operations > 256) throw new Error('Expression too complex'); };
  const finite = value => {
    if (!Number.isFinite(value)) throw new Error('Result out of range');
    return value;
  };
  const toRad = value => mode === 'DEG' ? value * Math.PI / 180 : value;
  const fromRad = value => mode === 'DEG' ? value * 180 / Math.PI : value;
  const factorial = value => {
    if (!Number.isInteger(value) || value < 0 || value > 170) throw new Error('Factorial supports integers 0–170');
    let out = 1;
    for (let i = 2; i <= value; i++) out *= i;
    return out;
  };
  const functions = {
    sin:value => Math.sin(toRad(value)), cos:value => Math.cos(toRad(value)), tan:value => Math.tan(toRad(value)),
    asin:value => fromRad(Math.asin(value)), acos:value => fromRad(Math.acos(value)), atan:value => fromRad(Math.atan(value)),
    sqrt:value => { if (value < 0) throw new Error('Square root requires ≥ 0'); return Math.sqrt(value); },
    cbrt:value => Math.cbrt(value),
    log:value => { if (value <= 0) throw new Error('Log requires > 0'); return Math.log10(value); },
    ln:value => { if (value <= 0) throw new Error('Ln requires > 0'); return Math.log(value); },
    abs:value => Math.abs(value), exp:value => Math.exp(value), floor:value => Math.floor(value), ceil:value => Math.ceil(value), round:value => Math.round(value)
  };

  const primary = () => {
    const token = take();
    if (!token) throw new Error('Expected value');
    if (token.type === 'number') return token.value;
    if (token.type === 'id') {
      if (token.value === 'pi') return Math.PI;
      if (token.value === 'e') return Math.E;
      if (token.value === 'ans') return Number(ans) || 0;
      const fn = functions[token.value];
      if (!fn || !peek('(')) throw new Error('Unknown function');
      take();
      const value = expressionParser();
      if (!peek(')')) throw new Error('Missing )');
      take(); count();
      return finite(fn(value));
    }
    if (token.value === '(') {
      const value = expressionParser();
      if (!peek(')')) throw new Error('Missing )');
      take();
      return value;
    }
    throw new Error('Expected value');
  };

  const postfix = () => {
    let value = primary();
    while (peek('%') || peek('!')) {
      const operator = take().value; count();
      value = operator === '%' ? value / 100 : factorial(value);
    }
    return finite(value);
  };
  const unary = () => {
    if (peek('+')) { take(); return unary(); }
    if (peek('-')) { take(); return -unary(); }
    return postfix();
  };
  const power = () => {
    let value = unary();
    if (peek('^')) {
      take(); count();
      value = Math.pow(value, power());
    }
    return finite(value);
  };
  const term = () => {
    let value = power();
    while (peek('*') || peek('/')) {
      const operator = take().value; count();
      const right = power();
      if (operator === '/' && right === 0) throw new Error('Division by zero');
      value = operator === '*' ? value * right : value / right;
      finite(value);
    }
    return value;
  };
  const expressionParser = () => {
    let value = term();
    while (peek('+') || peek('-')) {
      const operator = take().value; count();
      const right = term();
      value = operator === '+' ? value + right : value - right;
      finite(value);
    }
    return value;
  };

  const result = expressionParser();
  if (index !== tokens.length) throw new Error('Invalid expression');
  return finite(result);
}

function calcFormat(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Error';
  if (Object.is(n, -0)) return '0';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e13 || abs < 1e-9)) return n.toExponential(10).replace(/\.0+e/, 'e').replace(/(\.\d*?)0+e/, '$1e');
  return String(Number(n.toPrecision(13)));
}

function ensureCalculatorProStyles() {
  if (document.getElementById('nx-calculator-pro-v1')) return;
  const style = document.createElement('style');
  style.id = 'nx-calculator-pro-v1';
  style.textContent = `
    .nx-everyday-calculator{--calc-light-x:50%;--calc-light-y:10%;position:relative;isolation:isolate;min-height:calc(100dvh - 185px);padding:7px;border-radius:30px;overflow:hidden;background:radial-gradient(circle at var(--calc-light-x) var(--calc-light-y),rgba(112,235,255,.16),transparent 24%),radial-gradient(circle at 88% 85%,rgba(120,88,255,.11),transparent 28%),linear-gradient(150deg,#18212b 0%,#0b1119 48%,#06090e 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),inset 0 -2px 0 rgba(0,0,0,.8)}
    .nx-everyday-calculator::before{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(108deg,transparent 43%,rgba(255,255,255,.035) 50%,transparent 57%);transform:translateX(-70%);animation:nxCalcShellSheen 9s ease-in-out infinite}
    .nx-calculator-pro{position:relative;z-index:2;margin:0!important;padding:12px!important;border:1px solid rgba(198,226,244,.16)!important;border-radius:26px!important;background:linear-gradient(135deg,rgba(255,255,255,.055),transparent 18% 82%,rgba(255,255,255,.02)),linear-gradient(155deg,#1b242e 0%,#0c121a 45%,#080b10 100%)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 -3px 0 rgba(0,0,0,.92),inset 12px 0 28px rgba(63,210,255,.025),0 18px 38px rgba(0,0,0,.34),0 0 0 1px rgba(0,0,0,.56)!important}
    .nx-calc-pro-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 2px 9px}.nx-calc-pro-brand{display:flex;align-items:center;gap:8px;min-width:0}.nx-calc-pro-led{width:8px;height:8px;border-radius:50%;background:#57ffd0;box-shadow:0 0 0 3px rgba(87,255,208,.07),0 0 14px rgba(87,255,208,.5);animation:nxCalcLed 2s ease-in-out infinite}.nx-calc-pro-brand strong{font-size:9px!important;letter-spacing:.12em!important;color:#dff8ff!important}.nx-calc-pro-brand small{display:block;margin-top:2px;color:#647484;font-size:6.8px;letter-spacing:.07em}.nx-calc-mode{min-width:64px;min-height:30px;border:1px solid rgba(123,222,255,.16);border-radius:10px;background:linear-gradient(180deg,#163445,#0b1d29);box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 3px 0 #041018;color:#9ceeff;font-size:7px;font-weight:1000;letter-spacing:.11em}
    .nx-calc-screen{position:relative;overflow:hidden;min-height:106px;padding:13px 14px 12px;border:1px solid rgba(104,225,255,.17);border-radius:19px;background:radial-gradient(circle at 85% 12%,rgba(77,223,255,.08),transparent 28%),linear-gradient(180deg,#07151c,#041017 58%,#030a0f);box-shadow:inset 0 5px 16px rgba(0,0,0,.72),inset 0 -1px 0 rgba(255,255,255,.04),0 1px 0 rgba(255,255,255,.045)}
    .nx-calc-screen::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(110deg,transparent 38%,rgba(196,245,255,.055) 48%,transparent 58%);transform:translateX(-65%);animation:nxCalcGlass 7.5s ease-in-out infinite}.nx-calc-expression{position:relative;z-index:2;min-height:25px;overflow:auto hidden;white-space:nowrap;text-align:right;color:#6e91a0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:.02em}.nx-calc-result{position:relative;z-index:2;min-height:48px;display:flex;align-items:flex-end;justify-content:flex-end;overflow:auto hidden;white-space:nowrap;color:#eaffff;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:clamp(30px,9vw,43px);font-weight:850;letter-spacing:-.055em;font-variant-numeric:tabular-nums;text-shadow:0 0 18px rgba(105,235,255,.11)}
    .nx-calc-statusline{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:5px;color:#54717f;font-size:6.5px;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.nx-calc-statusline .hot{color:#72f3ff}.nx-calc-statusline .memory{color:#d6b8ff}
    .nx-calc-history{display:flex;gap:6px;overflow:auto hidden;margin:8px 1px 2px;padding:2px 1px 4px;scrollbar-width:none}.nx-calc-history::-webkit-scrollbar{display:none}.nx-calc-history button{flex:0 0 auto;max-width:170px;min-height:30px;padding:0 9px;border:1px solid rgba(150,190,215,.08);border-radius:10px;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(0,0,0,.12));color:#718491;font-size:6.8px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nx-calc-history button strong{color:#abc6d2;font-size:7px}
    .nx-calc-memory,.nx-calc-science,.nx-calc-main{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}.nx-calc-memory{margin-top:8px}.nx-calc-science{margin-top:6px}.nx-calc-main{margin-top:6px}
    .nx-calculator-pro [data-calc-key]{position:relative;min-width:0;min-height:38px;padding:0 3px;border:1px solid rgba(193,224,241,.10);border-radius:11px;background:linear-gradient(180deg,#263440 0%,#17222c 53%,#0e151c 100%);box-shadow:inset 0 1px 1px rgba(255,255,255,.18),inset 0 -5px 7px rgba(0,0,0,.24),0 3px 0 #05090d,0 6px 10px rgba(0,0,0,.18);color:#e9f3f8;font-size:9px;font-weight:950;letter-spacing:.01em;text-shadow:0 1px 1px rgba(0,0,0,.8);transform:translateY(-1px);transition:transform .08s ease,box-shadow .08s ease,filter .12s linear;touch-action:manipulation}.nx-calculator-pro [data-calc-key]:active{transform:translateY(2px)!important;box-shadow:inset 0 3px 6px rgba(0,0,0,.3),inset 0 -1px 0 rgba(255,255,255,.06),0 1px 0 #05090d,0 2px 5px rgba(0,0,0,.18)!important}.nx-calculator-pro [data-calc-key].memory{min-height:30px;border-color:rgba(176,142,255,.13);background:linear-gradient(180deg,#2c2942,#19172a);color:#d8caff;font-size:7px}.nx-calculator-pro [data-calc-key].science{border-color:rgba(104,216,255,.12);background:linear-gradient(180deg,#173342,#0d202b);color:#aeefff;font-size:7.5px}.nx-calculator-pro [data-calc-key].operator{border-color:rgba(255,192,90,.16);background:linear-gradient(180deg,#59401d,#32230f);color:#ffd68a}.nx-calculator-pro [data-calc-key].danger{border-color:rgba(255,100,125,.16);background:linear-gradient(180deg,#542332,#2c1119);color:#ffadbd}.nx-calculator-pro [data-calc-key].equals{border-color:rgba(92,239,220,.24);background:linear-gradient(180deg,#32cfbb 0%,#159380 52%,#0b594f 100%);box-shadow:inset 0 2px 1px rgba(255,255,255,.28),inset 0 -5px 7px rgba(0,0,0,.2),0 3px 0 #063c35,0 7px 13px rgba(0,0,0,.23),0 0 18px rgba(59,235,211,.08);color:#f4fffd;font-size:13px}.nx-calculator-pro [data-calc-key].zero{grid-column:span 2}
    .nx-calc-pro-note{margin:8px 3px 0;color:#566876;font-size:6.7px;line-height:1.4;text-align:center;letter-spacing:.025em}
    @keyframes nxCalcShellSheen{0%,22%{transform:translateX(-72%)}64%,100%{transform:translateX(72%)}}@keyframes nxCalcGlass{0%,35%{transform:translateX(-68%)}70%,100%{transform:translateX(68%)}}@keyframes nxCalcLed{0%,100%{opacity:.65}50%{opacity:1}}
    @media(max-width:390px){.nx-everyday-calculator{min-height:calc(100dvh - 178px);padding:5px}.nx-calculator-pro{padding:9px!important}.nx-calc-screen{min-height:96px;padding:10px 11px}.nx-calc-result{font-size:clamp(27px,8.5vw,38px)}.nx-calculator-pro [data-calc-key]{min-height:35px;font-size:8.2px}.nx-calculator-pro [data-calc-key].science{font-size:7px}.nx-calc-memory,.nx-calc-science,.nx-calc-main{gap:4px}}
    @media(max-height:720px){.nx-calculator-pro [data-calc-key]{min-height:32px}.nx-calc-screen{min-height:86px}.nx-calc-history{display:none}.nx-calc-pro-note{display:none}}
    @media(prefers-reduced-motion:reduce){.nx-everyday-calculator::before,.nx-calc-screen::after,.nx-calc-pro-led{animation:none!important}}
  `;
  document.head.appendChild(style);
}

export function renderCalculator() {
  ensureCalculatorProStyles();
  const memoryKeys = [
    ['MC','mc'], ['MR','mr'], ['M+','mplus'], ['M−','mminus'], ['DEG','mode']
  ];
  const scienceKeys = [
    ['sin','sin('], ['cos','cos('], ['tan','tan('], ['log','log('], ['ln','ln('],
    ['asin','asin('], ['acos','acos('], ['atan','atan('], ['√','sqrt('], ['xʸ','^'],
    ['π','pi'], ['e','e'], ['ANS','ans'], ['x!','!'], ['%','%']
  ];
  const mainKeys = [
    ['C','clear','danger'], ['(', '(', 'science'], [')', ')', 'science'], ['⌫','back','danger'], ['÷','/','operator'],
    ['7','7',''], ['8','8',''], ['9','9',''], ['×','*','operator'], ['x²','^2','science'],
    ['4','4',''], ['5','5',''], ['6','6',''], ['−','-','operator'], ['+','+','operator'],
    ['1','1',''], ['2','2',''], ['3','3',''], ['.','.',''], ['=','equals','equals'],
    ['0','0','zero'], ['00','00',''], ['cbrt','cbrt(','science'], ['abs','abs(','science']
  ];
  const makeKeys = (rows, group) => rows.map(([label,value,extra = '']) => `<button type="button" class="${group} ${extra}" data-calc-key data-calc-value="${escapeHtml(value)}">${escapeHtml(label)}</button>`).join('');
  const root = node(`
    <section class="nx-tool-card nx-calculator nx-calculator-pro">
      <div class="nx-calc-pro-head">
        <div class="nx-calc-pro-brand"><i class="nx-calc-pro-led"></i><div><strong>NEXUS SCIENTIFIC CORE</strong><small>SAFE PARSER • 13 DIGIT PRECISION</small></div></div>
        <button class="nx-calc-mode" type="button" data-calc-mode>DEG</button>
      </div>
      <div class="nx-calc-screen">
        <div class="nx-calc-expression" data-calc-expression>Ready</div>
        <div class="nx-calc-result" data-calc-result>0</div>
        <div class="nx-calc-statusline"><span data-calc-state class="hot">LIVE PREVIEW</span><span data-calc-memory-state>M 0</span></div>
      </div>
      <div class="nx-calc-history" data-calc-history></div>
      <div class="nx-calc-memory">${makeKeys(memoryKeys,'memory')}</div>
      <div class="nx-calc-science">${makeKeys(scienceKeys,'science')}</div>
      <div class="nx-calc-main">${makeKeys(mainKeys,'')}</div>
      <p class="nx-calc-pro-note">Scientific functions, memory, ANS, history, factorial, powers and keyboard input • no JavaScript eval()</p>
    </section>
  `);
  root.classList.add('nx-everyday-calculator');
  const expressionEl = root.querySelector('[data-calc-expression]');
  const resultEl = root.querySelector('[data-calc-result]');
  const stateEl = root.querySelector('[data-calc-state]');
  const memoryEl = root.querySelector('[data-calc-memory-state]');
  const historyEl = root.querySelector('[data-calc-history]');
  const modeButton = root.querySelector('[data-calc-mode]');
  let expr = '';
  let ans = 0;
  let memory = 0;
  let mode = localStorage.getItem(KEYS.calcMode) === 'RAD' ? 'RAD' : 'DEG';
  let disposed = false;

  const readHistory = () => {
    const rows = loadJson(KEYS.calcHistory, []);
    return Array.isArray(rows) ? rows.slice(0, 12) : [];
  };
  const drawHistory = () => {
    const rows = readHistory();
    historyEl.innerHTML = rows.length ? rows.slice(0, 6).map((item,index) => `<button type="button" data-calc-history-index="${index}" title="Reuse result"><span>${escapeHtml(item.expression)}</span> <strong>= ${escapeHtml(item.result)}</strong></button>`).join('') : '<button type="button" disabled>History appears here after =</button>';
    historyEl.querySelectorAll('[data-calc-history-index]').forEach(button => button.addEventListener('click', () => {
      const item = readHistory()[Number(button.dataset.calcHistoryIndex)];
      if (!item) return;
      expr = String(item.result || '');
      ans = Number(item.result) || ans;
      paint();
    }));
  };
  const updateMode = () => {
    modeButton.textContent = mode;
    root.querySelector('[data-calc-value="mode"]').textContent = mode;
    localStorage.setItem(KEYS.calcMode, mode);
  };
  const isValueEnding = value => /(?:\d|\)|!|%)$/.test(value) || /(?:pi|ans|e)$/.test(value);
  const startsValue = value => /^(?:pi|ans|e|sin\(|cos\(|tan\(|asin\(|acos\(|atan\(|sqrt\(|cbrt\(|log\(|ln\(|abs\(|exp\(|floor\(|ceil\(|round\(|\()/.test(value);
  const append = value => {
    if (expr.length >= 240) return;
    if (startsValue(value) && isValueEnding(expr)) expr += '*';
    if (/^(?:\d|\.)/.test(value) && /(?:\)|!|%|pi|ans|e)$/.test(expr)) expr += '*';
    expr += value;
  };
  const preview = () => {
    if (!expr) return { text:'0', ok:true };
    try { return { text:calcFormat(calculateScientific(expr,{ mode, ans })), ok:true }; }
    catch { return { text:ans ? calcFormat(ans) : '0', ok:false }; }
  };
  const paint = (message = '') => {
    const live = preview();
    expressionEl.textContent = expr || 'Ready';
    resultEl.textContent = live.text;
    stateEl.textContent = message || (live.ok && expr ? 'LIVE RESULT' : 'LIVE PREVIEW');
    stateEl.classList.toggle('hot', live.ok);
    memoryEl.textContent = `M ${calcFormat(memory)}`;
    updateMode();
  };
  const currentValue = () => {
    if (!expr) return Number(ans) || 0;
    return calculateScientific(expr,{ mode, ans });
  };
  const solve = () => {
    try {
      const original = expr || '0';
      const value = currentValue();
      const result = calcFormat(value);
      ans = value;
      expr = result;
      const history = readHistory();
      history.unshift({ expression:original, result, at:new Date().toISOString() });
      saveJson(KEYS.calcHistory, history.slice(0, 12));
      drawHistory();
      paint('RESULT LOCKED');
    } catch (error) {
      resultEl.textContent = 'Error';
      stateEl.textContent = error?.message || 'Invalid expression';
      stateEl.classList.remove('hot');
    }
  };
  const handle = value => {
    if (value === 'clear') { expr = ''; paint('CLEARED'); return; }
    if (value === 'back') { expr = expr.slice(0,-1); paint(); return; }
    if (value === 'equals') { solve(); return; }
    if (value === 'mode') { mode = mode === 'DEG' ? 'RAD' : 'DEG'; paint(`${mode} MODE`); return; }
    if (value === 'mc') { memory = 0; paint('MEMORY CLEARED'); return; }
    if (value === 'mr') { append(calcFormat(memory)); paint('MEMORY RECALL'); return; }
    if (value === 'mplus' || value === 'mminus') {
      try { const v = currentValue(); memory += value === 'mplus' ? v : -v; paint(value === 'mplus' ? 'MEMORY +' : 'MEMORY −'); }
      catch (error) { stateEl.textContent = error?.message || 'Memory operation failed'; }
      return;
    }
    append(value);
    paint();
  };

  root.querySelectorAll('[data-calc-key]').forEach(button => button.addEventListener('click', () => handle(button.dataset.calcValue)));
  modeButton.addEventListener('click', () => handle('mode'));
  const keyboard = event => {
    if (disposed || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;
    if (/^[0-9.+\-*/^()%!]$/.test(key)) { event.preventDefault(); handle(key); return; }
    if (key === 'Enter' || key === '=') { event.preventDefault(); handle('equals'); return; }
    if (key === 'Backspace') { event.preventDefault(); handle('back'); return; }
    if (key === 'Escape' || key === 'Delete') { event.preventDefault(); handle('clear'); }
  };
  window.addEventListener('keydown', keyboard);
  const pointerMove = event => {
    const rect = root.getBoundingClientRect();
    root.style.setProperty('--calc-light-x', `${((event.clientX - rect.left) / Math.max(1,rect.width)) * 100}%`);
    root.style.setProperty('--calc-light-y', `${((event.clientY - rect.top) / Math.max(1,rect.height)) * 100}%`);
  };
  root.addEventListener('pointermove', pointerMove,{ passive:true });
  root.__cleanup = () => {
    disposed = true;
    window.removeEventListener('keydown', keyboard);
    root.removeEventListener('pointermove', pointerMove);
  };
  drawHistory();
  paint();
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
