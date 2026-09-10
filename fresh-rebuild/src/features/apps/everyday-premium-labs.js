import { escapeHtml, loadJson, saveJson, uid } from '../../core/local-store.js';

const EXPENSES_KEY = 'nexus_expenses_v1';
const BUDGET_KEY = 'nexus_expense_budget_v1';

function node(html, className) {
  const root = document.createElement('div');
  root.className = `nx-app-body ${className || ''}`.trim();
  root.innerHTML = html;
  return root;
}

function money(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function attachLight(root) {
  const move = event => {
    const rect = root.getBoundingClientRect();
    root.style.setProperty('--lab-x', `${((event.clientX - rect.left) / Math.max(1, rect.width)) * 100}%`);
    root.style.setProperty('--lab-y', `${((event.clientY - rect.top) / Math.max(1, rect.height)) * 100}%`);
  };
  root.addEventListener('pointermove', move, { passive: true });
  return () => root.removeEventListener('pointermove', move);
}

function ensurePremiumLabStyles() {
  if (document.getElementById('nx-everyday-premium-labs-v1')) return;
  const style = document.createElement('style');
  style.id = 'nx-everyday-premium-labs-v1';
  style.textContent = `
    .nx-converter-pro,.nx-expenses-pro{--lab-x:50%;--lab-y:8%;position:relative;isolation:isolate;max-height:calc(100dvh - 174px);min-height:min(610px,calc(100dvh - 174px));padding:7px;border-radius:29px;overflow:hidden;background:radial-gradient(circle at var(--lab-x) var(--lab-y),rgba(65,225,255,.15),transparent 25%),radial-gradient(circle at 91% 86%,rgba(61,231,170,.085),transparent 29%),linear-gradient(145deg,#1b2730,#101a21 54%,#0b141a);box-shadow:inset 0 1px 0 rgba(255,255,255,.13),inset 0 -2px 0 rgba(0,0,0,.70)}
    .nx-converter-pro::before,.nx-expenses-pro::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(108deg,transparent 42%,rgba(255,255,255,.04) 50%,transparent 58%);transform:translateX(-74%);animation:nxLabSheen 9s ease-in-out infinite}
    .nx-converter-pro>.nx-tool-card,.nx-expenses-pro>.nx-tool-card{margin:0!important;padding:10px!important;border:1px solid rgba(173,219,236,.14)!important;border-radius:22px!important;background:linear-gradient(135deg,rgba(255,255,255,.055),transparent 24%),linear-gradient(155deg,#1b2932,#0e181f 63%,#0a1217)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset 0 -3px 0 rgba(0,0,0,.76),0 9px 20px rgba(0,0,0,.20)!important}
    .nx-lab-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.nx-lab-brand{display:flex;align-items:center;gap:8px;min-width:0}.nx-lab-orb{width:31px;height:31px;display:grid;place-items:center;flex:0 0 auto;border-radius:11px;border:1px solid rgba(116,230,255,.21);background:radial-gradient(circle at 34% 25%,#b7f8ff 0 5%,#32cfe9 8%,#126b86 48%,#082631 100%);box-shadow:inset 1px 1px 1px rgba(255,255,255,.36),inset -3px -4px 6px rgba(0,0,0,.27),0 3px 0 #06131a,0 7px 12px rgba(0,0,0,.19),0 0 17px rgba(68,218,255,.08);color:#effdff;font-size:11px;font-weight:1000;text-shadow:0 1px #000}.nx-expenses-pro .nx-lab-orb{border-color:rgba(98,238,183,.21);background:radial-gradient(circle at 34% 25%,#d7ffed 0 5%,#47dda8 8%,#177555 48%,#082c21 100%)}.nx-lab-brand strong{display:block;color:#effbff;font-size:9px!important;letter-spacing:.095em}.nx-lab-brand small{display:block;margin-top:2px;color:#71838c;font-size:6.3px;letter-spacing:.055em}.nx-lab-chip{flex:0 0 auto;padding:5px 7px;border:1px solid rgba(80,228,181,.13);border-radius:999px;background:rgba(57,219,164,.055);color:#83f2c9;font-size:6.3px;font-weight:950;letter-spacing:.065em}
    .nx-lab-input,.nx-lab-select{width:100%;min-width:0;min-height:38px;border:1px solid rgba(115,203,231,.13)!important;border-radius:12px!important;outline:none;background:linear-gradient(180deg,#061016,#03090d)!important;color:#f0fbff!important;box-shadow:inset 0 3px 9px rgba(0,0,0,.72),inset 0 -1px 0 rgba(255,255,255,.035)!important;padding:8px 10px!important;font-size:8.5px!important}.nx-lab-input:focus,.nx-lab-select:focus{border-color:rgba(77,225,255,.34)!important;box-shadow:inset 0 3px 9px rgba(0,0,0,.72),0 0 0 2px rgba(77,225,255,.055)!important}
    .nx-converter-pro{display:grid;grid-template-rows:minmax(0,1fr)}.nx-convert-grid{display:grid;grid-template-columns:minmax(0,1fr) 104px;gap:6px}.nx-unit-pair{display:grid;grid-template-columns:minmax(0,1fr) 40px minmax(0,1fr);gap:6px;align-items:end;margin-top:7px}.nx-unit-slot span,.nx-lab-label{display:block;margin:0 0 4px 2px;color:#71838c;font-size:6.2px;font-weight:900;letter-spacing:.07em}.nx-swap-key{width:40px;height:38px;border:1px solid rgba(103,222,255,.17);border-radius:11px;background:linear-gradient(180deg,#27738c,#123f4d);box-shadow:inset 0 1px 1px rgba(255,255,255,.18),inset 0 -4px 6px rgba(0,0,0,.16),0 3px 0 #061b22,0 6px 9px rgba(0,0,0,.15);color:#e8fcff;font-size:14px;font-weight:1000;transform:translateY(-1px)}.nx-swap-key:active{transform:translateY(2px);box-shadow:inset 0 3px 6px rgba(0,0,0,.28),0 1px 0 #061b22}.nx-convert-display{position:relative;overflow:hidden;margin-top:8px;padding:13px;border:1px solid rgba(95,229,255,.17);border-radius:18px;background:radial-gradient(circle at 88% 10%,rgba(73,226,255,.08),transparent 28%),linear-gradient(180deg,#07171d,#041015);box-shadow:inset 0 4px 14px rgba(0,0,0,.66),inset 0 -1px 0 rgba(255,255,255,.04),0 1px 0 rgba(255,255,255,.03)}.nx-convert-display::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(110deg,transparent 40%,rgba(188,244,255,.055) 49%,transparent 58%);transform:translateX(-70%);animation:nxLabGlass 8s ease-in-out infinite}.nx-convert-display small,.nx-convert-display strong,.nx-convert-display span{position:relative;z-index:2}.nx-convert-display small{display:block;color:#5e7a85;font-size:6.5px;font-weight:900;letter-spacing:.08em}.nx-convert-display strong{display:block;margin-top:6px;color:#eaffff;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:clamp(29px,8.5vw,40px);line-height:1;letter-spacing:-.05em;white-space:nowrap;overflow:auto hidden;font-variant-numeric:tabular-nums;text-shadow:0 0 18px rgba(91,229,255,.08)}.nx-convert-display span{display:block;margin-top:6px;color:#79a1ad;font-size:7px}.nx-convert-controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-top:7px}.nx-lab-key{min-height:33px;border:1px solid rgba(111,218,245,.14);border-radius:10px;background:linear-gradient(180deg,#1a4655,#0d2933);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),inset 0 -4px 6px rgba(0,0,0,.17),0 3px 0 #06181f;color:#bff1ff;font-size:6.5px;font-weight:950;letter-spacing:.05em;transform:translateY(-1px)}.nx-lab-key:active{transform:translateY(2px);box-shadow:inset 0 3px 5px rgba(0,0,0,.27),0 1px 0 #06181f}.nx-convert-controls .nx-lab-select{min-height:33px!important;padding:6px!important;font-size:6.5px!important}
    .nx-expenses-pro{display:grid;grid-template-rows:auto auto minmax(0,1fr);gap:7px}.nx-expense-grid{display:grid;grid-template-columns:minmax(0,1fr) 108px;gap:6px}.nx-expense-grid+.nx-expense-grid{margin-top:6px}.nx-expense-add{width:100%;min-height:38px;margin-top:7px;border:1px solid rgba(87,239,185,.19);border-radius:12px;background:linear-gradient(180deg,#31a982,#17654b);box-shadow:inset 0 1px 1px rgba(255,255,255,.20),inset 0 -4px 6px rgba(0,0,0,.15),0 3px 0 #0a3326,0 6px 10px rgba(0,0,0,.16);color:#effff9;font-size:7.5px;font-weight:1000;letter-spacing:.08em;transform:translateY(-1px)}.nx-expense-add:active{transform:translateY(2px);box-shadow:inset 0 3px 6px rgba(0,0,0,.25),0 1px 0 #0a3326}.nx-fin-summary{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important}.nx-fin-summary>div{padding:8px!important;border:1px solid rgba(136,210,230,.10)!important;border-radius:13px!important;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(0,0,0,.11))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.05),inset 0 -2px 0 rgba(0,0,0,.30),0 3px 0 rgba(3,9,12,.45)}.nx-fin-summary span{display:block;color:#70818a!important;font-size:5.8px!important;font-weight:900!important;letter-spacing:.07em!important}.nx-fin-summary strong{display:block;margin-top:3px;color:#edfff8!important;font-size:12px!important;font-variant-numeric:tabular-nums}.nx-finance-deck{min-height:0;display:grid;grid-template-rows:auto auto minmax(0,1fr);padding:9px!important}.nx-budget-row{display:grid;grid-template-columns:minmax(0,1fr) 94px;gap:6px;align-items:end}.nx-budget-copy strong{display:block;color:#dff9ef;font-size:8px}.nx-budget-copy small{display:block;margin-top:2px;color:#698078;font-size:6px}.nx-budget-track{height:6px;margin-top:5px;border-radius:999px;overflow:hidden;background:#06100e;box-shadow:inset 0 2px 4px rgba(0,0,0,.58)}.nx-budget-track i{display:block;width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,#2bcf9b,#78ebbd 64%,#ffd36d);box-shadow:0 0 12px rgba(86,231,181,.13);transition:width .2s ease}.nx-budget-set{display:grid;grid-template-columns:minmax(0,1fr) 42px;gap:4px}.nx-budget-set .nx-lab-input{min-height:36px!important;padding:6px!important}.nx-budget-set button{min-height:36px;border:1px solid rgba(111,226,187,.14);border-radius:11px;background:linear-gradient(180deg,#286a52,#153c2f);box-shadow:inset 0 1px rgba(255,255,255,.11),0 3px 0 #091d16;color:#c5f7e2;font-size:6px;font-weight:1000}.nx-finance-tools{display:grid;grid-template-columns:minmax(0,1fr) 108px;gap:6px;margin:7px 0}.nx-finance-list{min-height:0;overflow:auto;overscroll-behavior:contain;display:grid;align-content:start;gap:6px;padding:1px 2px 4px;scrollbar-width:thin}.nx-finance-list::-webkit-scrollbar{width:4px}.nx-finance-list::-webkit-scrollbar-thumb{border-radius:999px;background:rgba(85,209,171,.19)}.nx-expense-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 9px;border:1px solid rgba(142,210,229,.09);border-radius:14px;background:linear-gradient(145deg,rgba(255,255,255,.04),transparent 28%),linear-gradient(155deg,#17252a,#0c171a);box-shadow:inset 0 1px 0 rgba(255,255,255,.085),inset 0 -2px 0 rgba(0,0,0,.45),0 3px 0 rgba(3,9,10,.50),0 7px 12px rgba(0,0,0,.12)}.nx-expense-card strong{display:block;color:#eefff8;font-size:9px}.nx-expense-card p{margin:3px 0 0!important;color:#80928b!important;font-size:6.7px!important;line-height:1.3!important}.nx-expense-card small{display:block;margin-top:3px;color:#60756d;font-size:5.8px}.nx-expense-delete{width:31px;height:30px;border:1px solid rgba(255,105,126,.12);border-radius:9px;background:linear-gradient(180deg,#4a252d,#281217);box-shadow:inset 0 1px rgba(255,255,255,.07),0 2px 0 #15090c;color:#ff9cac;font-size:10px}.nx-fin-empty{height:100%;min-height:88px;display:grid;place-items:center;border:1px dashed rgba(117,204,227,.10);border-radius:14px;color:#667c75;font-size:8px;text-align:center;padding:16px}
    @keyframes nxLabSheen{0%,24%{transform:translateX(-74%)}67%,100%{transform:translateX(74%)}}@keyframes nxLabGlass{0%,34%{transform:translateX(-72%)}70%,100%{transform:translateX(72%)}}
    @media(max-width:390px){.nx-converter-pro,.nx-expenses-pro{padding:5px}.nx-converter-pro>.nx-tool-card,.nx-expenses-pro>.nx-tool-card{padding:8px!important}.nx-convert-grid,.nx-expense-grid,.nx-finance-tools{grid-template-columns:minmax(0,1fr) 94px}.nx-unit-pair{grid-template-columns:minmax(0,1fr) 35px minmax(0,1fr);gap:4px}.nx-swap-key{width:35px}.nx-budget-row{grid-template-columns:minmax(0,1fr) 86px}}
    @media(max-height:720px){.nx-converter-pro,.nx-expenses-pro{min-height:0}.nx-lab-brand small{display:none}.nx-convert-display{padding:9px}.nx-convert-display strong{font-size:27px}.nx-fin-summary>div{padding:6px!important}.nx-finance-tools{margin:5px 0}}
    @media(prefers-reduced-motion:reduce){.nx-converter-pro::before,.nx-expenses-pro::before,.nx-convert-display::after{animation:none!important}}
  `;
  document.head.appendChild(style);
}

const UNIT_GROUPS = Object.freeze({
  length: { label:'Length', units:{ m:['Meter',1], km:['Kilometer',1000], cm:['Centimeter',.01], mm:['Millimeter',.001], mi:['Mile',1609.344], yd:['Yard',.9144], ft:['Foot',.3048], in:['Inch',.0254], nmi:['Nautical mile',1852] } },
  mass: { label:'Mass', units:{ kg:['Kilogram',1], g:['Gram',.001], mg:['Milligram',1e-6], lb:['Pound',.45359237], oz:['Ounce',.028349523125], t:['Metric tonne',1000], st:['Stone',6.35029318] } },
  temp: { label:'Temperature', units:{ C:['Celsius',1], F:['Fahrenheit',1], K:['Kelvin',1] } },
  area: { label:'Area', units:{ m2:['Square meter',1], km2:['Square kilometer',1e6], cm2:['Square centimeter',1e-4], ha:['Hectare',10000], acre:['Acre',4046.8564224], ft2:['Square foot',.09290304], in2:['Square inch',.00064516] } },
  volume: { label:'Volume', units:{ L:['Liter',1], mL:['Milliliter',.001], m3:['Cubic meter',1000], galUS:['US gallon',3.785411784], qtUS:['US quart',.946352946], cupUS:['US cup',.2365882365], flOzUS:['US fluid ounce',.0295735295625] } },
  speed: { label:'Speed', units:{ mps:['Meter/second',1], kmh:['Kilometer/hour',.2777777777777778], mph:['Mile/hour',.44704], knot:['Knot',.5144444444444445], fps:['Foot/second',.3048] } },
  time: { label:'Time', units:{ s:['Second',1], min:['Minute',60], h:['Hour',3600], day:['Day',86400], week:['Week',604800] } },
  data: { label:'Data', units:{ B:['Byte',1], KB:['Kilobyte',1000], MB:['Megabyte',1e6], GB:['Gigabyte',1e9], TB:['Terabyte',1e12], KiB:['Kibibyte',1024], MiB:['Mebibyte',1048576], GiB:['Gibibyte',1073741824], TiB:['Tebibyte',1099511627776] } },
  pressure: { label:'Pressure', units:{ Pa:['Pascal',1], kPa:['Kilopascal',1000], bar:['Bar',100000], psi:['PSI',6894.757293168], atm:['Atmosphere',101325], mmHg:['mmHg',133.322387415] } },
  energy: { label:'Energy', units:{ J:['Joule',1], kJ:['Kilojoule',1000], Wh:['Watt-hour',3600], kWh:['Kilowatt-hour',3600000], cal:['Calorie',4.184], kcal:['Kilocalorie',4184], BTU:['BTU',1055.05585262] } },
  power: { label:'Power', units:{ W:['Watt',1], kW:['Kilowatt',1000], MW:['Megawatt',1e6], hp:['Horsepower',745.699871582] } },
  angle: { label:'Angle', units:{ rad:['Radian',1], deg:['Degree',Math.PI/180], grad:['Gradian',Math.PI/200] } },
  frequency: { label:'Frequency', units:{ Hz:['Hertz',1], kHz:['Kilohertz',1000], MHz:['Megahertz',1e6], GHz:['Gigahertz',1e9] } }
});

function convertMeasurement(value, category, from, to) {
  if (!Number.isFinite(value)) throw new Error('Enter a valid number');
  if (category === 'temp') {
    let celsius = value;
    if (from === 'F') celsius = (value - 32) * 5 / 9;
    else if (from === 'K') celsius = value - 273.15;
    if (to === 'F') return celsius * 9 / 5 + 32;
    if (to === 'K') return celsius + 273.15;
    return celsius;
  }
  const group = UNIT_GROUPS[category];
  const fromFactor = group?.units?.[from]?.[1];
  const toFactor = group?.units?.[to]?.[1];
  if (!(fromFactor > 0) || !(toFactor > 0)) throw new Error('Unsupported conversion');
  return value * fromFactor / toFactor;
}

function measurementFormat(value, precision = 'auto') {
  if (!Number.isFinite(value)) return '—';
  if (Object.is(value, -0)) return '0';
  if (precision !== 'auto') return String(Number(value.toPrecision(Number(precision))));
  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-8)) return value.toExponential(8).replace(/\.0+e/,'e').replace(/(\.\d*?)0+e/,'$1e');
  return String(Number(value.toPrecision(12)));
}

export function renderPremiumUnitConverter() {
  ensurePremiumLabStyles();
  const categoryOptions = Object.entries(UNIT_GROUPS).map(([key, group]) => `<option value="${key}">${group.label}</option>`).join('');
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-lab-head"><div class="nx-lab-brand"><span class="nx-lab-orb">↔</span><div><strong>MEASUREMENT LAB</strong><small>13 DISCIPLINES • LIVE PRECISION</small></div></div><span class="nx-lab-chip" data-unit-chip>LENGTH</span></div>
      <div class="nx-convert-grid"><input class="nx-lab-input" type="number" step="any" inputmode="decimal" data-unit-value value="1" aria-label="Value"><select class="nx-lab-select" data-unit-cat>${categoryOptions}</select></div>
      <div class="nx-unit-pair"><label class="nx-unit-slot"><span>FROM</span><select class="nx-lab-select" data-unit-from></select></label><button class="nx-swap-key" type="button" data-unit-swap aria-label="Swap units">⇄</button><label class="nx-unit-slot"><span>TO</span><select class="nx-lab-select" data-unit-to></select></label></div>
      <div class="nx-convert-display"><small>CONVERTED RESULT</small><strong data-unit-result>—</strong><span data-unit-ratio>Choose units to calculate</span></div>
      <div class="nx-convert-controls"><button class="nx-lab-key" type="button" data-unit-preset="1">1×</button><button class="nx-lab-key" type="button" data-unit-preset="100">100×</button><select class="nx-lab-select" data-unit-precision aria-label="Precision"><option value="auto">AUTO PRECISION</option><option value="6">6 SIG</option><option value="10">10 SIG</option></select></div>
      <div class="nx-convert-controls"><button class="nx-lab-key" type="button" data-unit-copy>COPY RESULT</button><button class="nx-lab-key" type="button" data-unit-preset="1000">1000×</button><button class="nx-lab-key" type="button" data-unit-clear>CLEAR</button></div>
    </section>
  `, 'nx-converter-pro');
  const cat = root.querySelector('[data-unit-cat]');
  const value = root.querySelector('[data-unit-value]');
  const from = root.querySelector('[data-unit-from]');
  const to = root.querySelector('[data-unit-to]');
  const result = root.querySelector('[data-unit-result]');
  const ratio = root.querySelector('[data-unit-ratio]');
  const precision = root.querySelector('[data-unit-precision]');
  const chip = root.querySelector('[data-unit-chip]');
  let lastResult = '';

  const optionsFor = category => Object.entries(UNIT_GROUPS[category].units).map(([key,[label]]) => `<option value="${key}">${escapeHtml(label)} • ${escapeHtml(key)}</option>`).join('');
  const calculate = () => {
    const n = Number(value.value);
    if (!Number.isFinite(n)) { result.textContent = '—'; ratio.textContent = 'Enter a valid number'; lastResult = ''; return; }
    try {
      const output = convertMeasurement(n, cat.value, from.value, to.value);
      const formatted = measurementFormat(output, precision.value);
      const one = convertMeasurement(1, cat.value, from.value, to.value);
      lastResult = `${formatted} ${to.value}`;
      result.textContent = lastResult;
      ratio.textContent = `1 ${from.value} = ${measurementFormat(one, precision.value)} ${to.value}`;
    } catch (error) {
      result.textContent = '—';
      ratio.textContent = error?.message || 'Conversion unavailable';
      lastResult = '';
    }
  };
  const rebuild = () => {
    const options = optionsFor(cat.value);
    from.innerHTML = options;
    to.innerHTML = options;
    const keys = Object.keys(UNIT_GROUPS[cat.value].units);
    to.value = keys[1] || keys[0];
    chip.textContent = UNIT_GROUPS[cat.value].label.toUpperCase();
    calculate();
  };
  cat.addEventListener('change', rebuild);
  [value, from, to, precision].forEach(element => element.addEventListener('input', calculate));
  root.querySelector('[data-unit-swap]').addEventListener('click', () => { const hold = from.value; from.value = to.value; to.value = hold; calculate(); });
  root.querySelectorAll('[data-unit-preset]').forEach(button => button.addEventListener('click', () => { value.value = button.dataset.unitPreset; calculate(); }));
  root.querySelector('[data-unit-clear]').addEventListener('click', () => { value.value = ''; calculate(); });
  root.querySelector('[data-unit-copy]').addEventListener('click', async () => {
    if (!lastResult) return;
    try { await navigator.clipboard?.writeText(lastResult); ratio.textContent = 'Result copied to clipboard.'; }
    catch { ratio.textContent = 'Clipboard unavailable on this device.'; }
  });
  const detach = attachLight(root);
  root.__cleanup = detach;
  rebuild();
  return root;
}

export function renderPremiumExpenses() {
  ensurePremiumLabStyles();
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-lab-head"><div class="nx-lab-brand"><span class="nx-lab-orb">¤</span><div><strong>EXPENSE COMMAND</strong><small>LOCAL LEDGER • BUDGET CONTROL</small></div></div><span class="nx-lab-chip" data-budget-chip>NO BUDGET</span></div>
      <div class="nx-expense-grid"><label><span class="nx-lab-label">AMOUNT</span><input class="nx-lab-input" type="number" inputmode="decimal" min="0" step="0.01" data-exp-amount placeholder="0.00"></label><label><span class="nx-lab-label">CATEGORY</span><select class="nx-lab-select" data-exp-cat><option>Food</option><option>Transport</option><option>Bills</option><option>Shopping</option><option>Education</option><option>Health</option><option>Family</option><option>Entertainment</option><option>Business</option><option>Other</option></select></label></div>
      <div class="nx-expense-grid"><label><span class="nx-lab-label">DATE</span><input class="nx-lab-input" type="date" data-exp-date></label><label><span class="nx-lab-label">PAYMENT</span><select class="nx-lab-select" data-exp-payment><option>Cash</option><option>Card</option><option>Bank</option><option>Wallet</option><option>Other</option></select></label></div>
      <label><span class="nx-lab-label" style="margin-top:6px">NOTE</span><input class="nx-lab-input" maxlength="180" data-exp-note placeholder="Optional detail"></label>
      <button class="nx-expense-add" type="button" data-add-expense>ADD TRANSACTION</button>
    </section>
    <div class="nx-summary-grid nx-fin-summary"><div><span>THIS MONTH</span><strong data-exp-month>0</strong></div><div><span>TODAY</span><strong data-exp-today>0</strong></div><div><span>ALL TIME</span><strong data-exp-total>0</strong></div></div>
    <section class="nx-tool-card nx-finance-deck">
      <div class="nx-budget-row"><div class="nx-budget-copy"><strong data-budget-copy>Monthly budget not set</strong><small data-budget-detail>Set a target to track this month.</small><div class="nx-budget-track"><i data-budget-bar></i></div></div><div class="nx-budget-set"><input class="nx-lab-input" type="number" min="0" step="1" inputmode="decimal" data-budget-input placeholder="Budget"><button type="button" data-budget-set>SET</button></div></div>
      <div class="nx-finance-tools"><input class="nx-lab-input" type="search" data-exp-search placeholder="Search transactions"><select class="nx-lab-select" data-exp-filter><option value="all">ALL CATEGORIES</option><option>Food</option><option>Transport</option><option>Bills</option><option>Shopping</option><option>Education</option><option>Health</option><option>Family</option><option>Entertainment</option><option>Business</option><option>Other</option></select></div>
      <div class="nx-finance-list" data-exp-list></div>
    </section>
  `, 'nx-expenses-pro');
  const amount = root.querySelector('[data-exp-amount]');
  const cat = root.querySelector('[data-exp-cat]');
  const date = root.querySelector('[data-exp-date]');
  const payment = root.querySelector('[data-exp-payment]');
  const note = root.querySelector('[data-exp-note]');
  const list = root.querySelector('[data-exp-list]');
  const total = root.querySelector('[data-exp-total]');
  const month = root.querySelector('[data-exp-month]');
  const todayEl = root.querySelector('[data-exp-today]');
  const search = root.querySelector('[data-exp-search]');
  const filter = root.querySelector('[data-exp-filter]');
  const budgetInput = root.querySelector('[data-budget-input]');
  const budgetCopy = root.querySelector('[data-budget-copy]');
  const budgetDetail = root.querySelector('[data-budget-detail]');
  const budgetBar = root.querySelector('[data-budget-bar]');
  const budgetChip = root.querySelector('[data-budget-chip]');
  date.value = localDateKey();

  const read = () => { const rows = loadJson(EXPENSES_KEY, []); return Array.isArray(rows) ? rows : []; };
  const readBudget = () => { const saved = loadJson(BUDGET_KEY, {amount:0}); const n = Number(saved?.amount); return Number.isFinite(n) && n > 0 ? n : 0; };
  const itemDate = item => item.date || new Date(item.at || Date.now()).toISOString().slice(0,10);
  const draw = () => {
    const rows = read();
    const today = localDateKey();
    const monthId = today.slice(0,7);
    const monthRows = rows.filter(item => itemDate(item).slice(0,7) === monthId);
    const todayRows = rows.filter(item => itemDate(item) === today);
    const allTotal = rows.reduce((sum,item) => sum + Number(item.amount || 0), 0);
    const monthTotal = monthRows.reduce((sum,item) => sum + Number(item.amount || 0), 0);
    const todayTotal = todayRows.reduce((sum,item) => sum + Number(item.amount || 0), 0);
    const budget = readBudget();
    total.textContent = money(allTotal);
    month.textContent = money(monthTotal);
    todayEl.textContent = money(todayTotal);
    if (budget > 0) {
      const pct = Math.max(0, monthTotal / budget * 100);
      budgetCopy.textContent = `${money(monthTotal)} of ${money(budget)}`;
      budgetDetail.textContent = `${pct.toFixed(1)}% used • ${money(Math.max(0,budget - monthTotal))} remaining`;
      budgetBar.style.width = `${Math.min(100,pct)}%`;
      budgetChip.textContent = pct > 100 ? 'OVER BUDGET' : `${Math.round(pct)}% USED`;
    } else {
      budgetCopy.textContent = 'Monthly budget not set';
      budgetDetail.textContent = 'Set a target to track this month.';
      budgetBar.style.width = '0%';
      budgetChip.textContent = 'NO BUDGET';
    }
    const q = search.value.trim().toLowerCase();
    let visible = rows.filter(item => (filter.value === 'all' || item.cat === filter.value) && (!q || `${item.cat || ''} ${item.note || ''} ${item.payment || ''} ${item.amount || ''}`.toLowerCase().includes(q)));
    visible.sort((a,b) => itemDate(b).localeCompare(itemDate(a)) || new Date(b.at || 0) - new Date(a.at || 0));
    list.innerHTML = visible.length ? visible.slice(0,150).map(item => `<article class="nx-expense-card"><div><strong>${money(item.amount)} • ${escapeHtml(item.cat || 'Other')}</strong><p>${escapeHtml(item.note || 'No note')} • ${escapeHtml(item.payment || 'Unspecified')}</p><small>${escapeHtml(itemDate(item))}</small></div><button class="nx-expense-delete" type="button" data-delete-expense="${escapeHtml(item.id)}" aria-label="Delete transaction">×</button></article>`).join('') : '<div class="nx-fin-empty">No transactions match this view.</div>';
    list.querySelectorAll('[data-delete-expense]').forEach(button => button.addEventListener('click', () => { saveJson(EXPENSES_KEY, read().filter(item => item.id !== button.dataset.deleteExpense)); draw(); }));
  };
  root.querySelector('[data-add-expense]').addEventListener('click', () => {
    const n = Number(amount.value);
    if (!Number.isFinite(n) || n <= 0) return;
    const rows = read();
    const now = new Date().toISOString();
    rows.unshift({ id:uid('expense'), amount:n, cat:cat.value, date:date.value || localDateKey(), payment:payment.value, note:note.value.trim(), at:now });
    saveJson(EXPENSES_KEY, rows.slice(0,1000));
    amount.value = '';
    note.value = '';
    date.value = localDateKey();
    draw();
  });
  root.querySelector('[data-budget-set]').addEventListener('click', () => {
    const n = Number(budgetInput.value);
    saveJson(BUDGET_KEY, { amount:Number.isFinite(n) && n > 0 ? n : 0 });
    budgetInput.value = '';
    draw();
  });
  search.addEventListener('input', draw);
  filter.addEventListener('change', draw);
  const detach = attachLight(root);
  root.__cleanup = detach;
  draw();
  return root;
}

export const everydayPremiumRenderers = Object.freeze({
  'unit-converter': renderPremiumUnitConverter,
  expenses: renderPremiumExpenses
});
