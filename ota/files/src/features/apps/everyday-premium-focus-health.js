import { loadJson, saveJson } from '../../core/local-store.js';

const FOCUS_KEY = 'nexus_focus_pro_v1';

function node(html, className) {
  const root = document.createElement('div');
  root.className = `nx-app-body ${className || ''}`.trim();
  root.innerHTML = html;
  return root;
}

function attachLight(root) {
  const move = event => {
    const rect = root.getBoundingClientRect();
    root.style.setProperty('--pro-x', `${((event.clientX - rect.left) / Math.max(1, rect.width)) * 100}%`);
    root.style.setProperty('--pro-y', `${((event.clientY - rect.top) / Math.max(1, rect.height)) * 100}%`);
  };
  root.addEventListener('pointermove', move, { passive:true });
  return () => root.removeEventListener('pointermove', move);
}

function ensureStyles() {
  if (document.getElementById('nx-everyday-focus-health-v1')) return;
  const style = document.createElement('style');
  style.id = 'nx-everyday-focus-health-v1';
  style.textContent = `
    .nx-focus-pro,.nx-bmi-pro,.nx-tip-pro{--pro-x:50%;--pro-y:7%;position:relative;isolation:isolate;min-height:min(610px,calc(100dvh - 174px));max-height:calc(100dvh - 174px);padding:7px;border-radius:29px;overflow:hidden;background:radial-gradient(circle at var(--pro-x) var(--pro-y),rgba(91,225,255,.13),transparent 25%),linear-gradient(145deg,#1c2730,#101820 55%,#0a1118);box-shadow:inset 0 1px 0 rgba(255,255,255,.13),inset 0 -2px 0 rgba(0,0,0,.72)}
    .nx-focus-pro{background:radial-gradient(circle at var(--pro-x) var(--pro-y),rgba(255,188,77,.15),transparent 25%),radial-gradient(circle at 92% 85%,rgba(62,221,255,.08),transparent 27%),linear-gradient(145deg,#2a241d,#171715 53%,#0d1114)}
    .nx-bmi-pro{background:radial-gradient(circle at var(--pro-x) var(--pro-y),rgba(63,235,186,.14),transparent 25%),radial-gradient(circle at 90% 88%,rgba(63,187,255,.07),transparent 27%),linear-gradient(145deg,#172822,#101b19 55%,#091210)}
    .nx-tip-pro{background:radial-gradient(circle at var(--pro-x) var(--pro-y),rgba(255,196,92,.14),transparent 25%),radial-gradient(circle at 90% 86%,rgba(219,137,54,.08),transparent 28%),linear-gradient(145deg,#2a241c,#18140f 55%,#0d0e0f)}
    .nx-focus-pro::before,.nx-bmi-pro::before,.nx-tip-pro::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(108deg,transparent 42%,rgba(255,255,255,.04) 50%,transparent 58%);transform:translateX(-74%);animation:nxProSheen 9s ease-in-out infinite}
    .nx-focus-pro>.nx-tool-card,.nx-bmi-pro>.nx-tool-card,.nx-tip-pro>.nx-tool-card{margin:0!important;padding:10px!important;border:1px solid rgba(176,218,235,.13)!important;border-radius:22px!important;background:linear-gradient(135deg,rgba(255,255,255,.055),transparent 24%),linear-gradient(155deg,#1b2931,#0e171d 65%,#091015)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset 0 -3px 0 rgba(0,0,0,.74),0 10px 22px rgba(0,0,0,.20)!important}
    .nx-focus-pro>.nx-tool-card{background:linear-gradient(135deg,rgba(255,211,127,.055),transparent 25%),linear-gradient(155deg,#29251e,#151716 65%,#0c1012)!important}.nx-bmi-pro>.nx-tool-card{background:linear-gradient(135deg,rgba(119,255,204,.05),transparent 25%),linear-gradient(155deg,#172923,#0d1916 65%,#091210)!important}.nx-tip-pro>.nx-tool-card{background:linear-gradient(135deg,rgba(255,210,125,.055),transparent 25%),linear-gradient(155deg,#2a251d,#17140f 65%,#0d0e0f)!important}
    .nx-pro-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.nx-pro-brand{display:flex;align-items:center;gap:8px;min-width:0}.nx-pro-orb{width:31px;height:31px;display:grid;place-items:center;flex:0 0 auto;border-radius:11px;border:1px solid rgba(126,226,255,.18);background:radial-gradient(circle at 34% 25%,#c4f8ff 0 5%,#3ad2e9 8%,#126d86 50%,#08252f 100%);box-shadow:inset 1px 1px rgba(255,255,255,.34),inset -3px -4px 6px rgba(0,0,0,.26),0 3px 0 #06131a,0 7px 12px rgba(0,0,0,.17);color:#f4feff;font-size:9px;font-weight:1000;text-shadow:0 1px #000}.nx-focus-pro .nx-pro-orb,.nx-tip-pro .nx-pro-orb{border-color:rgba(255,207,112,.22);background:radial-gradient(circle at 34% 25%,#fff5cf 0 5%,#efb94f 8%,#986119 50%,#382009 100%)}.nx-bmi-pro .nx-pro-orb{border-color:rgba(105,239,191,.22);background:radial-gradient(circle at 34% 25%,#e3fff3 0 5%,#50d9aa 8%,#197656 50%,#092c20 100%)}.nx-pro-brand strong{display:block;color:#effbff;font-size:9px!important;letter-spacing:.095em}.nx-pro-brand small{display:block;margin-top:2px;color:#71838c;font-size:6.3px;letter-spacing:.055em}.nx-pro-chip{padding:5px 7px;border:1px solid rgba(106,224,255,.11);border-radius:999px;background:rgba(80,199,231,.05);color:#92e8ff;font-size:6.2px;font-weight:950;letter-spacing:.065em}.nx-focus-pro .nx-pro-chip,.nx-tip-pro .nx-pro-chip{border-color:rgba(255,201,105,.12);background:rgba(255,180,73,.045);color:#ffd58c}.nx-bmi-pro .nx-pro-chip{border-color:rgba(80,232,179,.12);background:rgba(61,220,162,.045);color:#88efc8}
    .nx-pro-input,.nx-pro-select{width:100%;min-width:0;min-height:38px;border:1px solid rgba(122,202,229,.12)!important;border-radius:12px!important;background:linear-gradient(180deg,#061016,#03090d)!important;color:#f1fbff!important;box-shadow:inset 0 3px 9px rgba(0,0,0,.72),inset 0 -1px rgba(255,255,255,.035)!important;padding:8px 10px!important;font-size:8.5px!important;outline:none}.nx-focus-pro .nx-pro-input,.nx-focus-pro .nx-pro-select,.nx-tip-pro .nx-pro-input,.nx-tip-pro .nx-pro-select{border-color:rgba(255,203,112,.11)!important;background:linear-gradient(180deg,#110f0b,#080807)!important}.nx-bmi-pro .nx-pro-input,.nx-bmi-pro .nx-pro-select{border-color:rgba(102,226,183,.11)!important;background:linear-gradient(180deg,#06120e,#030b08)!important}
    .nx-seg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:4px;border:1px solid rgba(158,204,221,.09);border-radius:13px;background:rgba(3,8,11,.48);box-shadow:inset 0 3px 8px rgba(0,0,0,.45)}.nx-seg button{min-height:31px;border:1px solid transparent;border-radius:9px;background:transparent;color:#6f7d83;font-size:6.4px;font-weight:1000;letter-spacing:.055em}.nx-seg button.is-active{border-color:rgba(255,202,105,.16);background:linear-gradient(180deg,#57401f,#30230f);box-shadow:inset 0 1px rgba(255,255,255,.11),0 2px 0 #160e05;color:#ffe1a2}.nx-bmi-pro .nx-seg{grid-template-columns:repeat(2,minmax(0,1fr))}.nx-bmi-pro .nx-seg button.is-active{border-color:rgba(90,231,179,.16);background:linear-gradient(180deg,#205b48,#11352a);box-shadow:inset 0 1px rgba(255,255,255,.10),0 2px 0 #061a13;color:#bcf5df}.nx-tip-pro .nx-seg{grid-template-columns:repeat(6,minmax(0,1fr))}.nx-tip-pro .nx-seg button.is-active{border-color:rgba(255,202,105,.16);background:linear-gradient(180deg,#62451d,#34240e);color:#ffe0a0}
    .nx-focus-console{display:grid;grid-template-columns:minmax(0,1fr) 106px;gap:8px;margin-top:8px}.nx-focus-ring-pro{--focus-progress:0deg;width:min(58vw,210px);aspect-ratio:1;margin:auto;position:relative;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle,#10110f 0 55%,transparent 56%),conic-gradient(#f5bc55 var(--focus-progress),#273039 0);box-shadow:inset 0 0 28px rgba(0,0,0,.50),0 0 0 1px rgba(255,215,137,.10),0 8px 24px rgba(0,0,0,.20),0 0 26px rgba(245,188,85,.07)}.nx-focus-ring-pro::before{content:'';position:absolute;inset:7%;border-radius:50%;border:1px solid rgba(255,223,160,.08);background:radial-gradient(circle at 35% 25%,rgba(255,255,255,.045),transparent 35%)}.nx-focus-center{position:relative;z-index:2;text-align:center}.nx-focus-center span{display:block;color:#8f835f;font-size:7px;font-weight:1000;letter-spacing:.14em}.nx-focus-center strong{display:block;margin-top:5px;color:#fff0ca;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:clamp(31px,10vw,45px);letter-spacing:-.055em;font-variant-numeric:tabular-nums;text-shadow:0 0 18px rgba(255,194,76,.11)}.nx-focus-center small{display:block;margin-top:4px;color:#6c746e;font-size:6px}.nx-focus-settings{display:grid;align-content:center;gap:6px}.nx-focus-setting span,.nx-bmi-label,.nx-tip-label{display:block;margin:0 0 4px 2px;color:#7a827e;font-size:6.1px;font-weight:900;letter-spacing:.07em}.nx-focus-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:8px}.nx-pro-key{min-height:37px;border:1px solid rgba(255,207,118,.14);border-radius:11px;background:linear-gradient(180deg,#59411f,#30220f);box-shadow:inset 0 1px rgba(255,255,255,.15),inset 0 -4px 6px rgba(0,0,0,.17),0 3px 0 #160e05,0 6px 9px rgba(0,0,0,.14);color:#ffe4ac;font-size:6.6px;font-weight:1000;letter-spacing:.055em;transform:translateY(-1px)}.nx-pro-key.primary{border-color:rgba(89,231,184,.17);background:linear-gradient(180deg,#298267,#15503f);box-shadow:inset 0 1px rgba(255,255,255,.15),inset 0 -4px rgba(0,0,0,.14),0 3px 0 #082b20;color:#d8fff0}.nx-pro-key.danger{border-color:rgba(255,109,128,.12);background:linear-gradient(180deg,#51252b,#2b1216);box-shadow:inset 0 1px rgba(255,255,255,.08),0 3px 0 #16090b;color:#ffadba}.nx-pro-key:active{transform:translateY(2px);box-shadow:inset 0 3px 6px rgba(0,0,0,.26),0 1px 0 #120c06}.nx-focus-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-top:7px}.nx-focus-stats>div{padding:7px;border:1px solid rgba(255,204,112,.08);border-radius:11px;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(0,0,0,.11));box-shadow:inset 0 1px rgba(255,255,255,.04)}.nx-focus-stats span{display:block;color:#776f5b;font-size:5.7px;font-weight:900;letter-spacing:.06em}.nx-focus-stats strong{display:block;margin-top:2px;color:#f5e6bd;font-size:10px;font-variant-numeric:tabular-nums}
    .nx-bmi-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:8px}.nx-bmi-fields.three{grid-template-columns:repeat(3,minmax(0,1fr))}.nx-bmi-result{position:relative;overflow:hidden;margin-top:8px;padding:12px;border:1px solid rgba(91,230,181,.15);border-radius:18px;background:radial-gradient(circle at 85% 10%,rgba(79,232,181,.075),transparent 30%),linear-gradient(180deg,#071510,#04100c);box-shadow:inset 0 4px 13px rgba(0,0,0,.62),inset 0 -1px rgba(255,255,255,.035)}.nx-bmi-result-grid{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end}.nx-bmi-result small{display:block;color:#628073;font-size:6.2px;font-weight:900;letter-spacing:.07em}.nx-bmi-result strong{display:block;margin-top:4px;color:#ddfff1;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:38px;line-height:1;letter-spacing:-.05em}.nx-bmi-result b{color:#8ff0c9;font-size:9px}.nx-bmi-range{text-align:right;color:#7f9a8f;font-size:6.4px;line-height:1.45}.nx-bmi-range span{display:block;color:#d2efe3;font-size:8px;font-weight:900}.nx-bmi-gauge{position:relative;height:9px;margin-top:10px;border-radius:999px;background:linear-gradient(90deg,#5aa7e5 0 20%,#48d39a 20% 48%,#edc65d 48% 70%,#df6b74 70%);box-shadow:inset 0 2px 4px rgba(0,0,0,.45)}.nx-bmi-gauge i{position:absolute;top:50%;left:0;width:14px;height:14px;border:3px solid #f2fff9;border-radius:50%;background:#155b45;box-shadow:0 2px 6px rgba(0,0,0,.4),0 0 10px rgba(77,231,177,.16);transform:translate(-50%,-50%);transition:left .22s ease}.nx-bmi-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-top:8px}.nx-bmi-metrics>div{padding:7px;border:1px solid rgba(95,222,177,.08);border-radius:11px;background:rgba(4,14,10,.45)}.nx-bmi-metrics span{display:block;color:#668074;font-size:5.7px;font-weight:900}.nx-bmi-metrics strong{display:block;margin-top:2px;color:#d7f5e9;font-size:8px}.nx-bmi-note{margin:8px 2px 0;color:#657970;font-size:6.4px;line-height:1.4;text-align:center}
    .nx-tip-grid{display:grid;grid-template-columns:minmax(0,1fr) 104px;gap:6px;margin-top:7px}.nx-tip-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.nx-tip-presets{margin-top:7px}.nx-tip-receipt{position:relative;margin-top:8px;padding:11px 12px;border:1px solid rgba(255,207,118,.14);border-radius:17px;background:linear-gradient(180deg,#17130d,#0d0c09);box-shadow:inset 0 4px 12px rgba(0,0,0,.55),inset 0 -1px rgba(255,255,255,.03)}.nx-tip-receipt::before{content:'';position:absolute;left:10px;right:10px;top:38px;border-top:1px dashed rgba(255,220,153,.10)}.nx-receipt-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:10px}.nx-receipt-head strong{color:#ffe9b9;font-size:9px;letter-spacing:.07em}.nx-receipt-head span{color:#8b795b;font-size:6px}.nx-receipt-lines{display:grid;gap:5px;margin-top:3px}.nx-receipt-line{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#98866a;font-size:7px}.nx-receipt-line strong{color:#e7d5ae;font-size:8px;font-variant-numeric:tabular-nums}.nx-receipt-line.total{margin-top:3px;padding-top:6px;border-top:1px solid rgba(255,219,147,.09);color:#d7bc82;font-weight:950}.nx-receipt-line.total strong{color:#fff0c7;font-size:12px}.nx-tip-each{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;margin-top:8px;padding:9px 10px;border:1px solid rgba(255,205,110,.10);border-radius:13px;background:linear-gradient(180deg,#302617,#19130c);box-shadow:inset 0 1px rgba(255,255,255,.06),0 3px 0 #0c0905}.nx-tip-each span{color:#9a855e;font-size:6.3px;font-weight:900;letter-spacing:.07em}.nx-tip-each strong{color:#ffe9b5;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:18px;font-variant-numeric:tabular-nums}
    @keyframes nxProSheen{0%,24%{transform:translateX(-74%)}67%,100%{transform:translateX(74%)}}
    @media(max-width:390px){.nx-focus-pro,.nx-bmi-pro,.nx-tip-pro{padding:5px}.nx-focus-pro>.nx-tool-card,.nx-bmi-pro>.nx-tool-card,.nx-tip-pro>.nx-tool-card{padding:8px!important}.nx-focus-console{grid-template-columns:minmax(0,1fr) 92px}.nx-focus-ring-pro{width:min(54vw,190px)}.nx-tip-grid{grid-template-columns:minmax(0,1fr) 92px}.nx-tip-pro .nx-seg button{font-size:5.8px}.nx-bmi-result strong{font-size:34px}}
    @media(max-height:720px){.nx-focus-pro,.nx-bmi-pro,.nx-tip-pro{min-height:0}.nx-pro-brand small{display:none}.nx-focus-ring-pro{width:min(45vh,170px)}.nx-focus-center strong{font-size:32px}.nx-focus-stats>div,.nx-bmi-metrics>div{padding:5px}.nx-tip-receipt{padding:8px 10px}.nx-bmi-result{padding:9px}}
    @media(prefers-reduced-motion:reduce){.nx-focus-pro::before,.nx-bmi-pro::before,.nx-tip-pro::before{animation:none!important}}
  `;
  document.head.appendChild(style);
}

const FOCUS_PRESETS = Object.freeze({
  classic:{ label:'CLASSIC', focus:25, break:5 },
  deep:{ label:'DEEP', focus:50, break:10 },
  sprint:{ label:'SPRINT', focus:15, break:3 },
  custom:{ label:'CUSTOM', focus:35, break:7 }
});

function focusState() {
  const saved = loadJson(FOCUS_KEY, {});
  return saved && typeof saved === 'object' ? saved : {};
}

export function renderPremiumFocusTimer() {
  ensureStyles();
  const saved = focusState();
  const today = new Date().toISOString().slice(0,10);
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-pro-head"><div class="nx-pro-brand"><span class="nx-pro-orb">◉</span><div><strong>FOCUS CHRONOMETER</strong><small>DEADLINE ENGINE • WAKE LOCK • SESSION LOG</small></div></div><span class="nx-pro-chip" data-focus-chip>READY</span></div>
      <div class="nx-seg" data-focus-presets>${Object.entries(FOCUS_PRESETS).map(([key,preset]) => `<button type="button" data-focus-preset="${key}">${preset.label}</button>`).join('')}</div>
      <div class="nx-focus-console">
        <div class="nx-focus-ring-pro" data-focus-ring><div class="nx-focus-center"><span data-focus-mode>FOCUS</span><strong data-focus-time>25:00</strong><small data-focus-cycle>CYCLE 1</small></div></div>
        <div class="nx-focus-settings"><label><span>FOCUS MIN</span><input class="nx-pro-input" type="number" min="1" max="180" step="1" data-focus-min></label><label><span>BREAK MIN</span><input class="nx-pro-input" type="number" min="1" max="60" step="1" data-break-min></label><label><span>AUTO NEXT</span><select class="nx-pro-select" data-focus-auto><option value="1">ON</option><option value="0">OFF</option></select></label></div>
      </div>
      <div class="nx-focus-actions"><button class="nx-pro-key primary" type="button" data-focus-start>START</button><button class="nx-pro-key" type="button" data-focus-pause>PAUSE</button><button class="nx-pro-key danger" type="button" data-focus-reset>RESET</button><button class="nx-pro-key" type="button" data-focus-skip>SKIP</button></div>
      <div class="nx-focus-stats"><div><span>TODAY SESSIONS</span><strong data-focus-sessions>0</strong></div><div><span>FOCUS MINUTES</span><strong data-focus-total>0</strong></div><div><span>WAKE LOCK</span><strong data-focus-wake>OFF</strong></div></div>
    </section>
  `, 'nx-focus-pro');
  const ring = root.querySelector('[data-focus-ring]');
  const timeEl = root.querySelector('[data-focus-time]');
  const modeEl = root.querySelector('[data-focus-mode]');
  const cycleEl = root.querySelector('[data-focus-cycle]');
  const chip = root.querySelector('[data-focus-chip]');
  const focusInput = root.querySelector('[data-focus-min]');
  const breakInput = root.querySelector('[data-break-min]');
  const autoInput = root.querySelector('[data-focus-auto]');
  const sessionsEl = root.querySelector('[data-focus-sessions]');
  const totalEl = root.querySelector('[data-focus-total]');
  const wakeEl = root.querySelector('[data-focus-wake]');
  let preset = FOCUS_PRESETS[saved.preset] ? saved.preset : 'classic';
  let focusMinutes = Math.max(1, Math.min(180, Number(saved.focus) || FOCUS_PRESETS[preset].focus));
  let breakMinutes = Math.max(1, Math.min(60, Number(saved.break) || FOCUS_PRESETS[preset].break));
  let autoNext = saved.autoNext !== false;
  let phase = 'focus';
  let cycle = 1;
  let durationSeconds = focusMinutes * 60;
  let remaining = durationSeconds;
  let deadline = 0;
  let running = false;
  let timer = null;
  let wakeLock = null;
  let disposed = false;
  const stats = saved.stats?.date === today ? { date:today, sessions:Number(saved.stats.sessions)||0, minutes:Number(saved.stats.minutes)||0 } : { date:today, sessions:0, minutes:0 };

  const persist = () => saveJson(FOCUS_KEY, { preset, focus:focusMinutes, break:breakMinutes, autoNext, stats });
  const requestWake = async () => {
    try {
      if (!wakeLock && navigator.wakeLock?.request) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener?.('release', () => { wakeLock = null; wakeEl.textContent = 'OFF'; });
      }
    } catch {}
    wakeEl.textContent = wakeLock ? 'ON' : 'OFF';
  };
  const releaseWake = async () => { try { await wakeLock?.release?.(); } catch {} wakeLock = null; wakeEl.textContent = 'OFF'; };
  const paint = () => {
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    timeEl.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    modeEl.textContent = phase === 'focus' ? 'FOCUS' : 'BREAK';
    cycleEl.textContent = `CYCLE ${cycle}`;
    chip.textContent = running ? 'RUNNING' : remaining < durationSeconds ? 'PAUSED' : 'READY';
    const done = durationSeconds ? Math.max(0, Math.min(1, (durationSeconds - remaining) / durationSeconds)) : 0;
    ring.style.setProperty('--focus-progress', `${done * 360}deg`);
    sessionsEl.textContent = stats.sessions;
    totalEl.textContent = stats.minutes;
    root.querySelectorAll('[data-focus-preset]').forEach(button => button.classList.toggle('is-active', button.dataset.focusPreset === preset));
    focusInput.value = String(focusMinutes);
    breakInput.value = String(breakMinutes);
    autoInput.value = autoNext ? '1' : '0';
  };
  const stopClock = () => { clearInterval(timer); timer = null; running = false; };
  const resetPhase = () => { durationSeconds = (phase === 'focus' ? focusMinutes : breakMinutes) * 60; remaining = durationSeconds; deadline = 0; };
  const completePhase = async () => {
    stopClock();
    if (phase === 'focus') {
      stats.sessions += 1;
      stats.minutes += focusMinutes;
      phase = 'break';
    } else {
      phase = 'focus';
      cycle += 1;
    }
    navigator.vibrate?.([90,60,90]);
    resetPhase();
    persist();
    paint();
    if (autoNext && !disposed) start();
    else await releaseWake();
  };
  const tick = () => {
    if (!running) return;
    remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (remaining <= 0) { completePhase(); return; }
    paint();
  };
  const start = () => {
    if (running) return;
    if (remaining <= 0) resetPhase();
    deadline = Date.now() + remaining * 1000;
    running = true;
    chip.textContent = 'RUNNING';
    requestWake();
    timer = setInterval(tick, 250);
    paint();
  };
  const pause = () => { if (running) tick(); stopClock(); releaseWake(); paint(); };
  const applyPreset = key => {
    const chosen = FOCUS_PRESETS[key];
    if (!chosen) return;
    stopClock(); releaseWake(); preset = key; focusMinutes = chosen.focus; breakMinutes = chosen.break; phase = 'focus'; cycle = 1; resetPhase(); persist(); paint();
  };
  root.querySelectorAll('[data-focus-preset]').forEach(button => button.addEventListener('click', () => applyPreset(button.dataset.focusPreset)));
  root.querySelector('[data-focus-start]').addEventListener('click', start);
  root.querySelector('[data-focus-pause]').addEventListener('click', pause);
  root.querySelector('[data-focus-reset]').addEventListener('click', () => { stopClock(); releaseWake(); phase = 'focus'; cycle = 1; resetPhase(); paint(); });
  root.querySelector('[data-focus-skip]').addEventListener('click', () => completePhase());
  const customUpdate = () => {
    const f = Math.max(1, Math.min(180, Number(focusInput.value) || focusMinutes));
    const b = Math.max(1, Math.min(60, Number(breakInput.value) || breakMinutes));
    const changed = f !== focusMinutes || b !== breakMinutes;
    focusMinutes = f; breakMinutes = b; autoNext = autoInput.value === '1';
    if (changed) { preset = 'custom'; stopClock(); releaseWake(); phase = 'focus'; cycle = 1; resetPhase(); }
    persist(); paint();
  };
  [focusInput, breakInput, autoInput].forEach(element => element.addEventListener('change', customUpdate));
  const visibility = () => { if (document.visibilityState === 'visible' && running) { requestWake(); tick(); } };
  document.addEventListener('visibilitychange', visibility);
  const detach = attachLight(root);
  root.__cleanup = () => { disposed = true; stopClock(); releaseWake(); document.removeEventListener('visibilitychange', visibility); detach(); };
  persist(); paint();
  return root;
}

function bmiCategory(bmi) {
  if (bmi < 18.5) return 'UNDERWEIGHT';
  if (bmi < 25) return 'HEALTHY RANGE';
  if (bmi < 30) return 'OVERWEIGHT';
  return 'HIGH RANGE';
}

export function renderPremiumBMI() {
  ensureStyles();
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-pro-head"><div class="nx-pro-brand"><span class="nx-pro-orb">BMI</span><div><strong>BODY INDEX LAB</strong><small>METRIC + IMPERIAL • LIVE SCREENING</small></div></div><span class="nx-pro-chip" data-bmi-chip>READY</span></div>
      <div class="nx-seg"><button type="button" data-bmi-mode="metric" class="is-active">METRIC</button><button type="button" data-bmi-mode="imperial">IMPERIAL</button></div>
      <div class="nx-bmi-fields" data-bmi-metric><label><span class="nx-bmi-label">HEIGHT CM</span><input class="nx-pro-input" type="number" min="50" max="260" step="0.1" inputmode="decimal" data-bmi-cm placeholder="170"></label><label><span class="nx-bmi-label">WEIGHT KG</span><input class="nx-pro-input" type="number" min="10" max="500" step="0.1" inputmode="decimal" data-bmi-kg placeholder="65"></label></div>
      <div class="nx-bmi-fields three" data-bmi-imperial hidden><label><span class="nx-bmi-label">HEIGHT FT</span><input class="nx-pro-input" type="number" min="1" max="8" step="1" inputmode="numeric" data-bmi-ft placeholder="5"></label><label><span class="nx-bmi-label">INCHES</span><input class="nx-pro-input" type="number" min="0" max="11.9" step="0.1" inputmode="decimal" data-bmi-in placeholder="8"></label><label><span class="nx-bmi-label">WEIGHT LB</span><input class="nx-pro-input" type="number" min="20" max="1100" step="0.1" inputmode="decimal" data-bmi-lb placeholder="145"></label></div>
      <div class="nx-bmi-result"><div class="nx-bmi-result-grid"><div><small>BODY MASS INDEX</small><strong data-bmi-value>—</strong><b data-bmi-category>ENTER VALUES</b></div><div class="nx-bmi-range">ADULT HEALTHY-WEIGHT RANGE<span data-bmi-weight-range>—</span></div></div><div class="nx-bmi-gauge"><i data-bmi-marker></i></div></div>
      <div class="nx-bmi-metrics"><div><span>BMI PRIME</span><strong data-bmi-prime>—</strong></div><div><span>HEIGHT</span><strong data-bmi-height>—</strong></div><div><span>WEIGHT</span><strong data-bmi-weight>—</strong></div></div>
      <p class="nx-bmi-note">BMI is an adult screening metric, not a diagnosis. It does not directly measure body fat or individual health.</p>
    </section>
  `, 'nx-bmi-pro');
  let mode = 'metric';
  const metric = root.querySelector('[data-bmi-metric]');
  const imperial = root.querySelector('[data-bmi-imperial]');
  const valueEl = root.querySelector('[data-bmi-value]');
  const categoryEl = root.querySelector('[data-bmi-category]');
  const rangeEl = root.querySelector('[data-bmi-weight-range]');
  const primeEl = root.querySelector('[data-bmi-prime]');
  const heightEl = root.querySelector('[data-bmi-height]');
  const weightEl = root.querySelector('[data-bmi-weight]');
  const marker = root.querySelector('[data-bmi-marker]');
  const chip = root.querySelector('[data-bmi-chip]');
  const calculate = () => {
    let meters = 0, kg = 0;
    if (mode === 'metric') {
      meters = Number(root.querySelector('[data-bmi-cm]').value) / 100;
      kg = Number(root.querySelector('[data-bmi-kg]').value);
    } else {
      const inches = Number(root.querySelector('[data-bmi-ft]').value) * 12 + Number(root.querySelector('[data-bmi-in]').value);
      meters = inches * 0.0254;
      kg = Number(root.querySelector('[data-bmi-lb]').value) * 0.45359237;
    }
    if (!(meters > 0) || !(kg > 0)) {
      valueEl.textContent = '—'; categoryEl.textContent = 'ENTER VALUES'; rangeEl.textContent = '—'; primeEl.textContent = '—'; heightEl.textContent = '—'; weightEl.textContent = '—'; marker.style.left = '0%'; chip.textContent = 'READY'; return;
    }
    const bmi = kg / (meters * meters);
    const lowKg = 18.5 * meters * meters;
    const highKg = 24.9 * meters * meters;
    valueEl.textContent = bmi.toFixed(1);
    categoryEl.textContent = bmiCategory(bmi);
    primeEl.textContent = (bmi / 25).toFixed(2);
    heightEl.textContent = mode === 'metric' ? `${(meters * 100).toFixed(1)} cm` : `${(meters / 0.0254).toFixed(1)} in`;
    weightEl.textContent = mode === 'metric' ? `${kg.toFixed(1)} kg` : `${(kg / 0.45359237).toFixed(1)} lb`;
    rangeEl.textContent = mode === 'metric' ? `${lowKg.toFixed(1)}–${highKg.toFixed(1)} kg` : `${(lowKg / 0.45359237).toFixed(1)}–${(highKg / 0.45359237).toFixed(1)} lb`;
    const gauge = Math.max(0, Math.min(100, (bmi - 12) / (40 - 12) * 100));
    marker.style.left = `${gauge}%`;
    chip.textContent = categoryEl.textContent;
  };
  root.querySelectorAll('[data-bmi-mode]').forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.bmiMode;
    root.querySelectorAll('[data-bmi-mode]').forEach(item => item.classList.toggle('is-active', item === button));
    metric.hidden = mode !== 'metric';
    imperial.hidden = mode !== 'imperial';
    calculate();
  }));
  root.querySelectorAll('input').forEach(input => input.addEventListener('input', calculate));
  const detach = attachLight(root);
  root.__cleanup = detach;
  calculate();
  return root;
}

const CURRENCIES = Object.freeze(['PKR','USD','EUR','GBP','AED','SAR','INR']);
function formatCurrency(value, currency) {
  const n = Number(value) || 0;
  try { return new Intl.NumberFormat(undefined, { style:'currency', currency, maximumFractionDigits:2 }).format(n); }
  catch { return `${currency} ${n.toFixed(2)}`; }
}

export function renderPremiumTip() {
  ensureStyles();
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-pro-head"><div class="nx-pro-brand"><span class="nx-pro-orb">%</span><div><strong>SMART BILL SPLITTER</strong><small>TAX • TIP BASIS • ROUNDING • MULTI-CURRENCY DISPLAY</small></div></div><span class="nx-pro-chip" data-tip-chip>10% TIP</span></div>
      <div class="nx-tip-grid"><label><span class="nx-tip-label">BILL AMOUNT</span><input class="nx-pro-input" type="number" min="0" step="0.01" inputmode="decimal" data-tip-bill placeholder="0.00"></label><label><span class="nx-tip-label">CURRENCY</span><select class="nx-pro-select" data-tip-currency>${CURRENCIES.map(code => `<option${code === 'PKR' ? ' selected' : ''}>${code}</option>`).join('')}</select></label></div>
      <div class="nx-seg nx-tip-presets">${[0,5,10,15,20,25].map(pct => `<button type="button" data-tip-preset="${pct}" class="${pct === 10 ? 'is-active' : ''}">${pct}%</button>`).join('')}</div>
      <div class="nx-tip-grid three"><label><span class="nx-tip-label">TIP %</span><input class="nx-pro-input" type="number" min="0" max="100" step="0.1" inputmode="decimal" data-tip-pct value="10"></label><label><span class="nx-tip-label">TAX %</span><input class="nx-pro-input" type="number" min="0" max="100" step="0.1" inputmode="decimal" data-tip-tax value="0"></label><label><span class="nx-tip-label">PEOPLE</span><input class="nx-pro-input" type="number" min="1" max="100" step="1" inputmode="numeric" data-tip-people value="1"></label></div>
      <div class="nx-tip-grid"><label><span class="nx-tip-label">TIP BASIS</span><select class="nx-pro-select" data-tip-basis><option value="subtotal">BILL BEFORE TAX</option><option value="with-tax">BILL + TAX</option></select></label><label><span class="nx-tip-label">ROUND TOTAL</span><select class="nx-pro-select" data-tip-round><option value="exact">EXACT</option><option value="nearest">NEAREST WHOLE</option><option value="up">ROUND UP</option><option value="down">ROUND DOWN</option></select></label></div>
      <div class="nx-tip-receipt"><div class="nx-receipt-head"><strong>LIVE RECEIPT</strong><span data-tip-rate>10% SERVICE TIP</span></div><div class="nx-receipt-lines"><div class="nx-receipt-line"><span>Bill</span><strong data-tip-subtotal>—</strong></div><div class="nx-receipt-line"><span>Tax</span><strong data-tip-tax-out>—</strong></div><div class="nx-receipt-line"><span>Tip</span><strong data-tip-tip-out>—</strong></div><div class="nx-receipt-line total"><span>Grand total</span><strong data-tip-total>—</strong></div></div></div>
      <div class="nx-tip-each"><span>PER PERSON • EQUAL SPLIT</span><strong data-tip-each>—</strong></div>
    </section>
  `, 'nx-tip-pro');
  const bill = root.querySelector('[data-tip-bill]');
  const currency = root.querySelector('[data-tip-currency]');
  const pct = root.querySelector('[data-tip-pct]');
  const tax = root.querySelector('[data-tip-tax]');
  const people = root.querySelector('[data-tip-people]');
  const basis = root.querySelector('[data-tip-basis]');
  const round = root.querySelector('[data-tip-round]');
  const chip = root.querySelector('[data-tip-chip]');
  const calculate = () => {
    const subtotal = Math.max(0, Number(bill.value) || 0);
    const tipPct = Math.max(0, Math.min(100, Number(pct.value) || 0));
    const taxPct = Math.max(0, Math.min(100, Number(tax.value) || 0));
    const split = Math.max(1, Math.floor(Number(people.value) || 1));
    const taxAmount = subtotal * taxPct / 100;
    const tipBase = basis.value === 'with-tax' ? subtotal + taxAmount : subtotal;
    const tipAmount = tipBase * tipPct / 100;
    let total = subtotal + taxAmount + tipAmount;
    if (round.value === 'nearest') total = Math.round(total);
    else if (round.value === 'up') total = Math.ceil(total);
    else if (round.value === 'down') total = Math.floor(total);
    root.querySelector('[data-tip-subtotal]').textContent = formatCurrency(subtotal, currency.value);
    root.querySelector('[data-tip-tax-out]').textContent = formatCurrency(taxAmount, currency.value);
    root.querySelector('[data-tip-tip-out]').textContent = formatCurrency(tipAmount, currency.value);
    root.querySelector('[data-tip-total]').textContent = formatCurrency(total, currency.value);
    root.querySelector('[data-tip-each]').textContent = formatCurrency(total / split, currency.value);
    root.querySelector('[data-tip-rate]').textContent = `${tipPct.toFixed(tipPct % 1 ? 1 : 0)}% SERVICE TIP`;
    chip.textContent = `${tipPct.toFixed(tipPct % 1 ? 1 : 0)}% TIP`;
    root.querySelectorAll('[data-tip-preset]').forEach(button => button.classList.toggle('is-active', Number(button.dataset.tipPreset) === tipPct));
  };
  root.querySelectorAll('[data-tip-preset]').forEach(button => button.addEventListener('click', () => { pct.value = button.dataset.tipPreset; calculate(); }));
  [bill,currency,pct,tax,people,basis,round].forEach(element => element.addEventListener('input', calculate));
  const detach = attachLight(root);
  root.__cleanup = detach;
  calculate();
  return root;
}

export const everydayFocusHealthRenderers = Object.freeze({
  pomodoro: renderPremiumFocusTimer,
  bmi: renderPremiumBMI,
  tip: renderPremiumTip
});
