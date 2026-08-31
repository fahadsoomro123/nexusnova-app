import { escapeHtml, loadJson, saveJson, uid } from '../../core/local-store.js';

const KEYS = {
  notes: 'nexus_notes_v1',
  todos: 'nexus_todos_v1',
  expenses: 'nexus_expenses_v1',
  calcHistory: 'nexus_calc_history_v2',
  calcMode: 'nexus_calc_angle_mode_v1',
  calcProfile: 'nexus_calc_profile_v1'
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
    sinh:value => Math.sinh(value), cosh:value => Math.cosh(value), tanh:value => Math.tanh(value),
    asinh:value => Math.asinh(value),
    acosh:value => { if (value < 1) throw new Error('acosh requires ≥ 1'); return Math.acosh(value); },
    atanh:value => { if (Math.abs(value) >= 1) throw new Error('atanh requires |x| < 1'); return Math.atanh(value); },
    sqrt:value => { if (value < 0) throw new Error('Square root requires ≥ 0'); return Math.sqrt(value); },
    cbrt:value => Math.cbrt(value),
    log:value => { if (value <= 0) throw new Error('Log requires > 0'); return Math.log10(value); },
    ln:value => { if (value <= 0) throw new Error('Ln requires > 0'); return Math.log(value); },
    abs:value => Math.abs(value),
    exp:value => Math.exp(value),
    inv:value => { if (value === 0) throw new Error('Cannot divide by zero'); return 1 / value; },
    sq:value => value * value,
    cube:value => value * value * value,
    floor:value => Math.floor(value), ceil:value => Math.ceil(value), round:value => Math.round(value), trunc:value => Math.trunc(value)
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
  if (document.getElementById('nx-calculator-pro-v2')) return;
  const style = document.createElement('style');
  style.id = 'nx-calculator-pro-v2';
  style.textContent = `
    .nx-everyday-calculator{--calc-light-x:50%;--calc-light-y:10%;position:relative;isolation:isolate;min-height:calc(100dvh - 185px);padding:7px;border-radius:30px;overflow:hidden;background:radial-gradient(circle at var(--calc-light-x) var(--calc-light-y),rgba(112,235,255,.16),transparent 24%),radial-gradient(circle at 88% 85%,rgba(120,88,255,.11),transparent 28%),linear-gradient(150deg,#18212b 0%,#0b1119 48%,#06090e 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),inset 0 -2px 0 rgba(0,0,0,.8)}
    .nx-everyday-calculator::before{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(108deg,transparent 43%,rgba(255,255,255,.035) 50%,transparent 57%);transform:translateX(-70%);animation:nxCalcShellSheen 9s ease-in-out infinite}
    .nx-calculator-pro{position:relative;z-index:2;margin:0!important;padding:11px!important;border:1px solid rgba(198,226,244,.16)!important;border-radius:26px!important;background:linear-gradient(135deg,rgba(255,255,255,.055),transparent 18% 82%,rgba(255,255,255,.02)),linear-gradient(155deg,#1b242e 0%,#0c121a 45%,#080b10 100%)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 -3px 0 rgba(0,0,0,.92),inset 12px 0 28px rgba(63,210,255,.025),0 18px 38px rgba(0,0,0,.34),0 0 0 1px rgba(0,0,0,.56)!important}
    .nx-calc-pro-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 2px 8px}.nx-calc-pro-brand{display:flex;align-items:center;gap:8px;min-width:0}.nx-calc-pro-led{width:8px;height:8px;border-radius:50%;background:#57ffd0;box-shadow:0 0 0 3px rgba(87,255,208,.07),0 0 14px rgba(87,255,208,.5);animation:nxCalcLed 2s ease-in-out infinite}.nx-calc-pro-brand strong{font-size:9px!important;letter-spacing:.12em!important;color:#dff8ff!important}.nx-calc-pro-brand small{display:block;margin-top:2px;color:#647484;font-size:6.6px;letter-spacing:.07em}.nx-calc-mode{min-width:58px;min-height:29px;border:1px solid rgba(123,222,255,.16);border-radius:10px;background:linear-gradient(180deg,#163445,#0b1d29);box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 3px 0 #041018;color:#9ceeff;font-size:7px;font-weight:1000;letter-spacing:.11em}
    .nx-calc-profile{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin:0 1px 7px;padding:4px;border:1px solid rgba(139,202,231,.10);border-radius:13px;background:linear-gradient(180deg,rgba(2,8,13,.78),rgba(5,13,20,.62));box-shadow:inset 0 3px 8px rgba(0,0,0,.52),0 1px 0 rgba(255,255,255,.035)}
    .nx-calc-profile button{min-height:31px;border:1px solid transparent;border-radius:9px;background:transparent;color:#627481;font-size:6.8px;font-weight:1000;letter-spacing:.08em;transition:transform .09s ease,background .15s ease,color .15s ease,box-shadow .15s ease}.nx-calc-profile button.is-active{border-color:rgba(111,226,255,.16);background:linear-gradient(180deg,#1d4659,#102a38);box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 3px 0 #06151d,0 0 16px rgba(68,220,255,.055);color:#bff5ff}.nx-calc-profile button[data-calc-profile="pro"].is-active{border-color:rgba(192,139,255,.20);background:linear-gradient(180deg,#49366a,#271c3c);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 3px 0 #160e25,0 0 18px rgba(177,102,255,.07);color:#eadbff}
    .nx-calc-screen{position:relative;overflow:hidden;min-height:100px;padding:11px 13px 10px;border:1px solid rgba(104,225,255,.17);border-radius:18px;background:radial-gradient(circle at 85% 12%,rgba(77,223,255,.08),transparent 28%),linear-gradient(180deg,#07151c,#041017 58%,#030a0f);box-shadow:inset 0 5px 16px rgba(0,0,0,.72),inset 0 -1px 0 rgba(255,255,255,.04),0 1px 0 rgba(255,255,255,.045)}
    .nx-calc-screen::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(110deg,transparent 38%,rgba(196,245,255,.055) 48%,transparent 58%);transform:translateX(-65%);animation:nxCalcGlass 7.5s ease-in-out infinite}.nx-calc-expression{position:relative;z-index:2;min-height:23px;overflow:auto hidden;white-space:nowrap;text-align:right;color:#6e91a0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:.02em}.nx-calc-result{position:relative;z-index:2;min-height:45px;display:flex;align-items:flex-end;justify-content:flex-end;overflow:auto hidden;white-space:nowrap;color:#eaffff;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:clamp(29px,8.7vw,41px);font-weight:850;letter-spacing:-.055em;font-variant-numeric:tabular-nums;text-shadow:0 0 18px rgba(105,235,255,.11)}
    .nx-calc-statusline{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px;color:#54717f;font-size:6.2px;font-weight:850;letter-spacing:.075em;text-transform:uppercase}.nx-calc-statusline .hot{color:#72f3ff}.nx-calc-statusline .memory{color:#d6b8ff}
    .nx-calc-history{display:flex;gap:5px;overflow:auto hidden;margin:6px 1px 1px;padding:2px 1px 3px;scrollbar-width:none}.nx-calc-history::-webkit-scrollbar{display:none}.nx-calc-history button{flex:0 0 auto;max-width:160px;min-height:27px;padding:0 8px;border:1px solid rgba(150,190,215,.08);border-radius:9px;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(0,0,0,.12));color:#718491;font-size:6.4px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nx-calc-history button strong{color:#abc6d2;font-size:6.6px}
    .nx-calc-memory,.nx-calc-bank{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px}.nx-calc-memory{margin-top:6px}.nx-calc-bank{margin-top:5px}.nx-calc-bank.six{grid-template-columns:repeat(6,minmax(0,1fr))}.nx-calc-bank[hidden]{display:none!important}
    .nx-calculator-pro [data-calc-key]{position:relative;min-width:0;min-height:35px;padding:0 2px;border:1px solid rgba(193,224,241,.10);border-radius:10px;background:linear-gradient(180deg,#263440 0%,#17222c 53%,#0e151c 100%);box-shadow:inset 0 1px 1px rgba(255,255,255,.18),inset 0 -5px 7px rgba(0,0,0,.24),0 3px 0 #05090d,0 5px 8px rgba(0,0,0,.17);color:#e9f3f8;font-size:8.5px;font-weight:950;letter-spacing:.005em;text-shadow:0 1px 1px rgba(0,0,0,.8);transform:translateY(-1px);transition:transform .08s ease,box-shadow .08s ease,filter .12s linear;touch-action:manipulation}.nx-calculator-pro [data-calc-key]:active{transform:translateY(2px)!important;box-shadow:inset 0 3px 6px rgba(0,0,0,.3),inset 0 -1px 0 rgba(255,255,255,.06),0 1px 0 #05090d,0 2px 5px rgba(0,0,0,.18)!important}.nx-calculator-pro [data-calc-key].memory{min-height:28px;border-color:rgba(176,142,255,.13);background:linear-gradient(180deg,#2c2942,#19172a);color:#d8caff;font-size:6.8px}.nx-calculator-pro [data-calc-key].science{border-color:rgba(104,216,255,.12);background:linear-gradient(180deg,#173342,#0d202b);color:#aeefff;font-size:7px}.nx-calculator-pro [data-calc-key].pro{border-color:rgba(195,142,255,.15);background:linear-gradient(180deg,#342847,#1b1428);color:#dfc9ff;font-size:6.6px}.nx-calculator-pro [data-calc-key].operator{border-color:rgba(255,192,90,.16);background:linear-gradient(180deg,#59401d,#32230f);color:#ffd68a}.nx-calculator-pro [data-calc-key].danger{border-color:rgba(255,100,125,.16);background:linear-gradient(180deg,#542332,#2c1119);color:#ffadbd}.nx-calculator-pro [data-calc-key].equals{border-color:rgba(92,239,220,.24);background:linear-gradient(180deg,#32cfbb 0%,#159380 52%,#0b594f 100%);box-shadow:inset 0 2px 1px rgba(255,255,255,.28),inset 0 -5px 7px rgba(0,0,0,.2),0 3px 0 #063c35,0 7px 13px rgba(0,0,0,.23),0 0 18px rgba(59,235,211,.08);color:#f4fffd;font-size:12px}.nx-calculator-pro [data-calc-key].zero{grid-column:span 2}
    .nx-everyday-calculator[data-calc-profile="standard"] .nx-calc-bank [data-calc-key]{min-height:45px;font-size:10px}.nx-everyday-calculator[data-calc-profile="pro"] .nx-calc-bank [data-calc-key]{min-height:30px;font-size:6.8px}.nx-everyday-calculator[data-calc-profile="pro"] .nx-calc-history{display:none}
    .nx-calc-pro-note{margin:6px 3px 0;color:#566876;font-size:6.3px;line-height:1.35;text-align:center;letter-spacing:.02em}
    @keyframes nxCalcShellSheen{0%,22%{transform:translateX(-72%)}64%,100%{transform:translateX(72%)}}@keyframes nxCalcGlass{0%,35%{transform:translateX(-68%)}70%,100%{transform:translateX(68%)}}@keyframes nxCalcLed{0%,100%{opacity:.65}50%{opacity:1}}
    @media(max-width:390px){.nx-everyday-calculator{min-height:calc(100dvh - 178px);padding:5px}.nx-calculator-pro{padding:8px!important}.nx-calc-screen{min-height:91px;padding:9px 10px}.nx-calc-result{font-size:clamp(26px,8.3vw,36px)}.nx-calculator-pro [data-calc-key]{min-height:32px;font-size:7.7px}.nx-everyday-calculator[data-calc-profile="standard"] .nx-calc-bank [data-calc-key]{min-height:41px}.nx-everyday-calculator[data-calc-profile="pro"] .nx-calc-bank [data-calc-key]{min-height:28px;font-size:6.2px}.nx-calc-memory,.nx-calc-bank{gap:3px}}
    @media(max-height:720px){.nx-calc-screen{min-height:82px}.nx-calc-history{display:none}.nx-calc-pro-note{display:none}.nx-calculator-pro [data-calc-key]{min-height:29px}.nx-everyday-calculator[data-calc-profile="standard"] .nx-calc-bank [data-calc-key]{min-height:38px}.nx-everyday-calculator[data-calc-profile="pro"] .nx-calc-bank [data-calc-key]{min-height:26px}}
    @media(prefers-reduced-motion:reduce){.nx-everyday-calculator::before,.nx-calc-screen::after,.nx-calc-pro-led{animation:none!important}}
  `;
  document.head.appendChild(style);
}

export function renderCalculator() {
  ensureCalculatorProStyles();
  const memoryKeys = [
    ['MC','mc'], ['MR','mr'], ['M+','mplus'], ['M−','mminus'], ['DEG','mode']
  ];
  const standardKeys = [
    ['C','clear','danger'], ['(', '(', 'science'], [')', ')', 'science'], ['⌫','back','danger'], ['÷','/','operator'],
    ['7','7',''], ['8','8',''], ['9','9',''], ['×','*','operator'], ['%','%','science'],
    ['4','4',''], ['5','5',''], ['6','6',''], ['−','-','operator'], ['+','+','operator'],
    ['1','1',''], ['2','2',''], ['3','3',''], ['.','.',''], ['=','equals','equals'],
    ['0','0','zero'], ['00','00',''], ['ANS','ans','science'], ['±','negate','science']
  ];
  const scientificKeys = [
    ['sin','sin(','science'], ['cos','cos(','science'], ['tan','tan(','science'], ['log','log(','science'], ['ln','ln(','science'],
    ['asin','asin(','science'], ['acos','acos(','science'], ['atan','atan(','science'], ['√','sqrt(','science'], ['∛','cbrt(','science'],
    ['π','pi','science'], ['e','e','science'], ['ANS','ans','science'], ['x!','!','science'], ['xʸ','^','science'],
    ['(', '(', 'science'], [')', ')', 'science'], ['%','%','science'], ['C','clear','danger'], ['⌫','back','danger'],
    ['7','7',''], ['8','8',''], ['9','9',''], ['÷','/','operator'], ['×','*','operator'],
    ['4','4',''], ['5','5',''], ['6','6',''], ['−','-','operator'], ['+','+','operator'],
    ['1','1',''], ['2','2',''], ['3','3',''], ['.','.',''], ['=','equals','equals'],
    ['0','0','zero'], ['00','00',''], ['±','negate','science'], ['abs','abs(','science']
  ];
  const proKeys = [
    ['sinh','sinh(','pro'], ['cosh','cosh(','pro'], ['tanh','tanh(','pro'], ['exp','exp(','pro'], ['1/x','inv(','pro'], ['abs','abs(','pro'],
    ['asinh','asinh(','pro'], ['acosh','acosh(','pro'], ['atanh','atanh(','pro'], ['floor','floor(','pro'], ['ceil','ceil(','pro'], ['trunc','trunc(','pro'],
    ['√','sqrt(','science'], ['∛','cbrt(','science'], ['x²','sq(','pro'], ['x³','cube(','pro'], ['log','log(','science'], ['ln','ln(','science'],
    ['π','pi','science'], ['e','e','science'], ['ANS','ans','science'], ['x!','!','science'], ['%','%','science'], ['xʸ','^','science'],
    ['(', '(', 'science'], [')', ')', 'science'], ['round','round(','pro'], ['C','clear','danger'], ['⌫','back','danger'], ['÷','/','operator'],
    ['7','7',''], ['8','8',''], ['9','9',''], ['×','*','operator'], ['−','-','operator'], ['+','+','operator'],
    ['4','4',''], ['5','5',''], ['6','6',''], ['1','1',''], ['2','2',''], ['3','3',''],
    ['0','0',''], ['00','00',''], ['.','.',''], ['=','equals','equals'], ['±','negate','pro'], ['DEG','mode','pro']
  ];
  const makeKeys = (rows, group = '') => rows.map(([label,value,extra = '']) => `<button type="button" class="${group} ${extra}" data-calc-key data-calc-value="${escapeHtml(value)}">${escapeHtml(label)}</button>`).join('');
  const root = node(`
    <section class="nx-tool-card nx-calculator nx-calculator-pro">
      <div class="nx-calc-pro-head">
        <div class="nx-calc-pro-brand"><i class="nx-calc-pro-led"></i><div><strong>NEXUS CALC CORE</strong><small>SAFE ENGINE • 13 DIGIT PRECISION</small></div></div>
        <button class="nx-calc-mode" type="button" data-calc-mode>DEG</button>
      </div>
      <div class="nx-calc-profile" role="tablist" aria-label="Calculator mode">
        <button type="button" data-calc-profile="standard">STANDARD</button>
        <button type="button" data-calc-profile="scientific">SCIENTIFIC</button>
        <button type="button" data-calc-profile="pro">PRO LAB</button>
      </div>
      <div class="nx-calc-screen">
        <div class="nx-calc-expression" data-calc-expression>Ready</div>
        <div class="nx-calc-result" data-calc-result>0</div>
        <div class="nx-calc-statusline"><span data-calc-state class="hot">LIVE PREVIEW</span><span><b data-calc-profile-label>STANDARD</b> • <span data-calc-memory-state>M 0</span></span></div>
      </div>
      <div class="nx-calc-history" data-calc-history></div>
      <div class="nx-calc-memory">${makeKeys(memoryKeys,'memory')}</div>
      <div class="nx-calc-bank" data-calc-bank="standard">${makeKeys(standardKeys)}</div>
      <div class="nx-calc-bank" data-calc-bank="scientific" hidden>${makeKeys(scientificKeys)}</div>
      <div class="nx-calc-bank six" data-calc-bank="pro" hidden>${makeKeys(proKeys)}</div>
      <p class="nx-calc-pro-note" data-calc-note>Standard mode • fast daily arithmetic with memory, ANS and live preview.</p>
    </section>
  `);
  root.classList.add('nx-everyday-calculator');
  const expressionEl = root.querySelector('[data-calc-expression]');
  const resultEl = root.querySelector('[data-calc-result]');
  const stateEl = root.querySelector('[data-calc-state]');
  const memoryEl = root.querySelector('[data-calc-memory-state]');
  const historyEl = root.querySelector('[data-calc-history]');
  const modeButton = root.querySelector('[data-calc-mode]');
  const profileLabel = root.querySelector('[data-calc-profile-label]');
  const noteEl = root.querySelector('[data-calc-note]');
  let expr = '';
  let ans = 0;
  let memory = 0;
  let mode = localStorage.getItem(KEYS.calcMode) === 'RAD' ? 'RAD' : 'DEG';
  const savedProfile = localStorage.getItem(KEYS.calcProfile);
  let profile = ['standard','scientific','pro'].includes(savedProfile) ? savedProfile : 'standard';
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
    root.querySelectorAll('[data-calc-value="mode"]').forEach(button => { button.textContent = mode; });
    localStorage.setItem(KEYS.calcMode, mode);
  };
  const updateProfile = () => {
    root.dataset.calcProfile = profile;
    root.querySelectorAll('[data-calc-profile]').forEach(button => {
      const active = button.dataset.calcProfile === profile;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    root.querySelectorAll('[data-calc-bank]').forEach(bank => { bank.hidden = bank.dataset.calcBank !== profile; });
    const labels = { standard:'STANDARD', scientific:'SCIENTIFIC', pro:'PRO LAB' };
    const notes = {
      standard:'Standard mode • fast daily arithmetic with memory, ANS and live preview.',
      scientific:'Scientific mode • trig, inverse trig, roots, logs, powers, constants and factorial.',
      pro:'Pro Lab • hyperbolic math, inverse hyperbolic, reciprocal, exp, precision rounding and engineering functions.'
    };
    profileLabel.textContent = labels[profile];
    noteEl.textContent = notes[profile];
    localStorage.setItem(KEYS.calcProfile, profile);
  };
  const isValueEnding = value => /(?:\d|\)|!|%)$/.test(value) || /(?:pi|ans|e)$/.test(value);
  const startsValue = value => /^(?:pi|ans|e|sin\(|cos\(|tan\(|asin\(|acos\(|atan\(|sinh\(|cosh\(|tanh\(|asinh\(|acosh\(|atanh\(|sqrt\(|cbrt\(|log\(|ln\(|abs\(|exp\(|inv\(|sq\(|cube\(|floor\(|ceil\(|round\(|trunc\(|\()/.test(value);
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
    updateProfile();
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
    if (value === 'negate') { expr = expr ? `-(${expr})` : '-'; paint('SIGN CHANGED'); return; }
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
  root.querySelectorAll('[data-calc-profile]').forEach(button => button.addEventListener('click', () => {
    profile = button.dataset.calcProfile;
    paint(`${profile === 'pro' ? 'PRO LAB' : profile.toUpperCase()} READY`);
  }));
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
