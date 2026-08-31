import { escapeHtml, loadJson, saveJson } from '../../core/local-store.js';

const CLOCK_KEY = 'nexus_world_clock_pro_v1';
const QR_RECENT_KEY = 'nexus_qr_recent_v2';
const DEFAULT_ZONES = ['Asia/Karachi','Asia/Dubai','Europe/London','America/New_York','Asia/Tokyo','Australia/Sydney'];
const FALLBACK_ZONES = [
  'Asia/Karachi','Asia/Dubai','Asia/Riyadh','Asia/Kolkata','Asia/Dhaka','Asia/Singapore','Asia/Hong_Kong','Asia/Tokyo','Asia/Seoul','Asia/Shanghai','Asia/Jakarta','Asia/Bangkok','Asia/Kathmandu','Asia/Tehran','Asia/Istanbul',
  'Europe/London','Europe/Paris','Europe/Berlin','Europe/Rome','Europe/Madrid','Europe/Amsterdam','Europe/Zurich','Europe/Moscow','Europe/Athens','Europe/Warsaw',
  'Africa/Cairo','Africa/Johannesburg','Africa/Lagos','Africa/Nairobi','Africa/Casablanca',
  'America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Toronto','America/Vancouver','America/Mexico_City','America/Sao_Paulo','America/Buenos_Aires',
  'Australia/Sydney','Australia/Melbourne','Australia/Brisbane','Australia/Perth','Pacific/Auckland','Pacific/Honolulu','UTC'
];

function node(html, className) {
  const root = document.createElement('div');
  root.className = `nx-app-body ${className || ''}`.trim();
  root.innerHTML = html;
  return root;
}

function attachLight(root) {
  const move = event => {
    const rect = root.getBoundingClientRect();
    root.style.setProperty('--time-x', `${((event.clientX - rect.left) / Math.max(1, rect.width)) * 100}%`);
    root.style.setProperty('--time-y', `${((event.clientY - rect.top) / Math.max(1, rect.height)) * 100}%`);
  };
  root.addEventListener('pointermove', move, { passive:true });
  return () => root.removeEventListener('pointermove', move);
}

function ensureStyles() {
  if (document.getElementById('nx-everyday-time-qr-v1')) return;
  const style = document.createElement('style');
  style.id = 'nx-everyday-time-qr-v1';
  style.textContent = `
    .nx-world-pro,.nx-qr-pro{--time-x:50%;--time-y:7%;position:relative;isolation:isolate;min-height:min(610px,calc(100dvh - 174px));max-height:calc(100dvh - 174px);padding:7px;border-radius:29px;overflow:hidden;background:radial-gradient(circle at var(--time-x) var(--time-y),rgba(77,211,255,.15),transparent 25%),radial-gradient(circle at 90% 88%,rgba(93,89,255,.08),transparent 28%),linear-gradient(145deg,#17252f,#0d1720 55%,#081017);box-shadow:inset 0 1px 0 rgba(255,255,255,.13),inset 0 -2px 0 rgba(0,0,0,.72)}
    .nx-qr-pro{background:radial-gradient(circle at var(--time-x) var(--time-y),rgba(173,102,255,.14),transparent 25%),radial-gradient(circle at 91% 86%,rgba(57,225,198,.08),transparent 29%),linear-gradient(145deg,#211d2d,#121522 56%,#0b0e16)}
    .nx-world-pro::before,.nx-qr-pro::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(108deg,transparent 42%,rgba(255,255,255,.04) 50%,transparent 58%);transform:translateX(-74%);animation:nxTimeSheen 9s ease-in-out infinite}
    .nx-world-pro>.nx-tool-card,.nx-qr-pro>.nx-tool-card{margin:0!important;padding:10px!important;border:1px solid rgba(170,216,237,.14)!important;border-radius:22px!important;background:linear-gradient(135deg,rgba(255,255,255,.055),transparent 24%),linear-gradient(155deg,#192a35,#0d1821 64%,#091118)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset 0 -3px 0 rgba(0,0,0,.74),0 10px 22px rgba(0,0,0,.20)!important}
    .nx-qr-pro>.nx-tool-card{background:linear-gradient(135deg,rgba(195,137,255,.055),transparent 25%),linear-gradient(155deg,#231f31,#121522 65%,#0b0e16)!important}
    .nx-time-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.nx-time-brand{display:flex;align-items:center;gap:8px;min-width:0}.nx-time-orb{width:31px;height:31px;display:grid;place-items:center;flex:0 0 auto;border-radius:11px;border:1px solid rgba(112,226,255,.21);background:radial-gradient(circle at 34% 25%,#d6f9ff 0 5%,#46d3ec 8%,#126b88 49%,#082532 100%);box-shadow:inset 1px 1px 1px rgba(255,255,255,.35),inset -3px -4px 6px rgba(0,0,0,.27),0 3px 0 #06141b,0 7px 12px rgba(0,0,0,.18);color:#effdff;font-size:9px;font-weight:1000;text-shadow:0 1px #000}.nx-qr-pro .nx-time-orb{border-color:rgba(203,149,255,.22);background:radial-gradient(circle at 34% 25%,#f6e8ff 0 5%,#b86cea 8%,#603487 49%,#251536 100%)}.nx-time-brand strong{display:block;color:#effbff;font-size:9px!important;letter-spacing:.095em}.nx-time-brand small{display:block;margin-top:2px;color:#71838d;font-size:6.3px;letter-spacing:.055em}.nx-time-chip{padding:5px 7px;border:1px solid rgba(96,224,255,.12);border-radius:999px;background:rgba(67,207,240,.05);color:#8deaff;font-size:6.2px;font-weight:950;letter-spacing:.065em}.nx-qr-pro .nx-time-chip{border-color:rgba(194,138,255,.13);background:rgba(170,94,239,.05);color:#dfc5ff}
    .nx-time-input,.nx-time-select{width:100%;min-width:0;min-height:37px;border:1px solid rgba(112,203,234,.12)!important;border-radius:12px!important;outline:none;background:linear-gradient(180deg,#061018,#03090e)!important;color:#f0fbff!important;box-shadow:inset 0 3px 9px rgba(0,0,0,.72),inset 0 -1px 0 rgba(255,255,255,.035)!important;padding:8px 10px!important;font-size:8px!important}.nx-qr-pro .nx-time-input,.nx-qr-pro .nx-time-select{border-color:rgba(190,142,244,.12)!important;background:linear-gradient(180deg,#0c0a12,#06060b)!important}.nx-time-input:focus,.nx-time-select:focus{border-color:rgba(83,220,255,.34)!important;box-shadow:inset 0 3px 9px rgba(0,0,0,.72),0 0 0 2px rgba(83,220,255,.055)!important}
    .nx-world-pro{display:grid;grid-template-rows:auto minmax(0,1fr);gap:7px}.nx-home-clock{position:relative;overflow:hidden;padding:10px 12px;border:1px solid rgba(91,221,255,.15);border-radius:18px;background:radial-gradient(circle at 86% 12%,rgba(72,220,255,.075),transparent 29%),linear-gradient(180deg,#071821,#041017);box-shadow:inset 0 4px 13px rgba(0,0,0,.62),inset 0 -1px 0 rgba(255,255,255,.04)}.nx-home-clock::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(110deg,transparent 40%,rgba(195,245,255,.055) 49%,transparent 58%);transform:translateX(-70%);animation:nxTimeGlass 8s ease-in-out infinite}.nx-home-top,.nx-home-time,.nx-home-bottom{position:relative;z-index:2}.nx-home-top{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#668696;font-size:6.3px;font-weight:900;letter-spacing:.07em}.nx-home-top b{color:#9eeeff;font-size:6.5px}.nx-home-time{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;margin-top:4px}.nx-home-time strong{min-width:0;color:#eaffff;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:clamp(34px,10vw,48px);line-height:.94;letter-spacing:-.06em;font-variant-numeric:tabular-nums;text-shadow:0 0 20px rgba(92,226,255,.10)}.nx-home-time span{padding-bottom:3px;color:#7b9ba8;font-size:7px;text-align:right}.nx-home-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:7px;padding-top:6px;border-top:1px solid rgba(126,219,244,.07);color:#68818d;font-size:6.3px}.nx-home-bottom b{color:#b6d9e5;font-size:6.5px}
    .nx-world-controls{display:grid;grid-template-columns:minmax(0,1fr) 88px 70px;gap:5px;margin-top:7px}.nx-time-key{min-height:37px;border:1px solid rgba(101,221,253,.15);border-radius:11px;background:linear-gradient(180deg,#23667b,#123d4b);box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset 0 -4px 6px rgba(0,0,0,.17),0 3px 0 #061a21,0 6px 9px rgba(0,0,0,.14);color:#dffaff;font-size:6.5px;font-weight:1000;letter-spacing:.055em;transform:translateY(-1px)}.nx-time-key:active{transform:translateY(2px);box-shadow:inset 0 3px 6px rgba(0,0,0,.27),0 1px 0 #061a21}.nx-world-toolbar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin-top:6px;padding:4px;border:1px solid rgba(126,204,229,.08);border-radius:12px;background:rgba(3,9,14,.45)}.nx-world-toolbar button{min-height:29px;border:1px solid transparent;border-radius:8px;background:transparent;color:#667b87;font-size:6.1px;font-weight:950;letter-spacing:.05em}.nx-world-toolbar button.is-active{border-color:rgba(99,222,255,.14);background:linear-gradient(180deg,#1c4658,#102a36);box-shadow:inset 0 1px rgba(255,255,255,.08),0 2px 0 #06141b;color:#c0f5ff}
    .nx-world-deck{min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);padding:9px!important}.nx-world-deck-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;color:#69818e;font-size:6.2px;font-weight:900;letter-spacing:.07em}.nx-world-deck-head b{color:#9eddeb}.nx-world-list{min-height:0;overflow:auto;overscroll-behavior:contain;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-content:start;gap:6px;padding:1px 2px 4px;scrollbar-width:thin}.nx-world-list::-webkit-scrollbar{width:4px}.nx-world-list::-webkit-scrollbar-thumb{border-radius:999px;background:rgba(96,207,237,.18)}.nx-zone-card{position:relative;overflow:hidden;padding:8px 9px;border:1px solid rgba(139,209,232,.09);border-radius:14px;background:linear-gradient(145deg,rgba(255,255,255,.04),transparent 29%),linear-gradient(155deg,#172730,#0c171e);box-shadow:inset 0 1px rgba(255,255,255,.09),inset 0 -2px rgba(0,0,0,.45),0 3px 0 rgba(3,9,12,.49),0 7px 12px rgba(0,0,0,.12)}.nx-zone-card.day{border-top-color:rgba(255,203,105,.20)}.nx-zone-card.night{border-top-color:rgba(112,139,255,.20)}.nx-zone-head{display:flex;align-items:flex-start;justify-content:space-between;gap:6px}.nx-zone-head strong{min-width:0;color:#effbff;font-size:8.5px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nx-zone-head button{width:25px;height:24px;flex:0 0 auto;border:1px solid rgba(255,105,126,.10);border-radius:8px;background:linear-gradient(180deg,#48252d,#271216);box-shadow:inset 0 1px rgba(255,255,255,.06),0 2px 0 #15090c;color:#ff9dac;font-size:9px}.nx-zone-time{display:block;margin-top:4px;color:#dff8ff;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:16px;font-weight:850;letter-spacing:-.04em;font-variant-numeric:tabular-nums}.nx-zone-meta{display:flex;align-items:center;justify-content:space-between;gap:5px;margin-top:4px;color:#718995;font-size:5.8px}.nx-zone-meta b{color:#9ccbd8;font-size:5.9px}.nx-zone-empty{grid-column:1/-1;min-height:100px;display:grid;place-items:center;padding:15px;border:1px dashed rgba(111,202,228,.10);border-radius:14px;color:#687e89;font-size:7.5px;text-align:center;line-height:1.4}
    .nx-qr-pro{display:grid;grid-template-rows:minmax(0,1fr)}.nx-qr-console{min-height:0;display:grid;grid-template-rows:auto auto minmax(0,1fr)}.nx-qr-modes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;padding:4px;border:1px solid rgba(183,139,235,.10);border-radius:12px;background:rgba(7,5,12,.50)}.nx-qr-modes button{min-height:30px;border:1px solid transparent;border-radius:8px;background:transparent;color:#79688a;font-size:6.4px;font-weight:1000;letter-spacing:.07em}.nx-qr-modes button.is-active{border-color:rgba(201,151,255,.16);background:linear-gradient(180deg,#4a3165,#281b38);box-shadow:inset 0 1px rgba(255,255,255,.09),0 2px 0 #160d20;color:#ead7ff}.nx-qr-template-bar{display:flex;gap:4px;overflow:auto hidden;margin:6px 0 0;padding:1px 0 3px;scrollbar-width:none}.nx-qr-template-bar::-webkit-scrollbar{display:none}.nx-qr-template-bar button{flex:0 0 auto;min-height:27px;padding:0 8px;border:1px solid rgba(188,142,240,.09);border-radius:9px;background:linear-gradient(180deg,#21172d,#130e1b);color:#8c79a1;font-size:5.9px;font-weight:950;letter-spacing:.05em}.nx-qr-template-bar button.is-active{border-color:rgba(204,153,255,.17);background:linear-gradient(180deg,#51336e,#2b1b3c);color:#ead8ff}.nx-qr-workspace{min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 132px;gap:7px;margin-top:6px}.nx-qr-form{min-height:0;display:grid;align-content:start;gap:5px}.nx-qr-fields{display:grid;gap:5px}.nx-qr-fields.two{grid-template-columns:repeat(2,minmax(0,1fr))}.nx-qr-fields textarea{min-height:66px!important;max-height:86px!important;resize:none}.nx-qr-preview{min-height:0;display:grid;align-content:start;gap:6px}.nx-qr-stage{position:relative;aspect-ratio:1;display:grid;place-items:center;overflow:hidden;border:1px solid rgba(204,154,255,.14);border-radius:17px;background:radial-gradient(circle at 50% 45%,rgba(190,126,255,.075),transparent 42%),linear-gradient(180deg,#0d0a13,#07070c);box-shadow:inset 0 4px 12px rgba(0,0,0,.58),inset 0 -1px rgba(255,255,255,.03)}.nx-qr-stage::before,.nx-qr-stage::after{content:'';position:absolute;width:27px;height:27px;border-color:#bb81f0;border-style:solid;opacity:.7}.nx-qr-stage::before{left:8px;top:8px;border-width:2px 0 0 2px}.nx-qr-stage::after{right:8px;bottom:8px;border-width:0 2px 2px 0}.nx-qr-stage img{position:relative;z-index:2;width:min(92%,220px);height:auto;padding:5px;border-radius:10px;background:#fff;box-shadow:0 5px 18px rgba(0,0,0,.25)}.nx-qr-stage .placeholder{text-align:center;color:#705e82;font-size:6.6px;line-height:1.45;padding:12px}.nx-qr-video{position:relative;z-index:2;width:100%;height:100%;object-fit:cover;background:#000}.nx-scan-reticle{position:absolute;z-index:3;inset:20%;border:2px solid rgba(105,244,211,.72);border-radius:12px;box-shadow:0 0 0 999px rgba(3,5,8,.24),0 0 18px rgba(85,240,207,.12);pointer-events:none}.nx-scan-reticle::after{content:'';position:absolute;left:8%;right:8%;top:50%;height:1px;background:#66f4d0;box-shadow:0 0 10px rgba(102,244,208,.65);animation:nxScanLine 2s ease-in-out infinite}.nx-qr-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}.nx-qr-key{min-height:32px;border:1px solid rgba(196,147,250,.14);border-radius:10px;background:linear-gradient(180deg,#493064,#281b38);box-shadow:inset 0 1px rgba(255,255,255,.12),inset 0 -4px 6px rgba(0,0,0,.17),0 3px 0 #160e20;color:#ead8ff;font-size:6px;font-weight:1000;letter-spacing:.045em;transform:translateY(-1px)}.nx-qr-key.primary{border-color:rgba(90,236,203,.16);background:linear-gradient(180deg,#277c69,#164b40);box-shadow:inset 0 1px rgba(255,255,255,.12),0 3px 0 #08271f;color:#d8fff5}.nx-qr-key.danger{border-color:rgba(255,103,130,.12);background:linear-gradient(180deg,#50242f,#291218);box-shadow:inset 0 1px rgba(255,255,255,.07),0 3px 0 #16090d;color:#ffadbd}.nx-qr-key:active{transform:translateY(2px);box-shadow:inset 0 3px 6px rgba(0,0,0,.26),0 1px 0 #130c1c}.nx-qr-status{min-height:28px;padding:6px 8px;border:1px solid rgba(186,140,238,.08);border-radius:10px;background:rgba(8,6,12,.42);color:#7c6c8d;font-size:6.1px;line-height:1.35}.nx-qr-status.good{color:#82eacb;border-color:rgba(90,232,191,.10)}.nx-qr-recent{display:flex;gap:4px;overflow:auto hidden;margin-top:5px;padding-bottom:2px;scrollbar-width:none}.nx-qr-recent button{flex:0 0 auto;max-width:120px;min-height:25px;padding:0 7px;border:1px solid rgba(181,137,231,.08);border-radius:8px;background:rgba(28,19,39,.65);color:#776789;font-size:5.6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    @keyframes nxTimeSheen{0%,24%{transform:translateX(-74%)}67%,100%{transform:translateX(74%)}}@keyframes nxTimeGlass{0%,34%{transform:translateX(-72%)}70%,100%{transform:translateX(72%)}}@keyframes nxScanLine{0%,100%{transform:translateY(-45px);opacity:.45}50%{transform:translateY(45px);opacity:1}}
    @media(max-width:390px){.nx-world-pro,.nx-qr-pro{padding:5px}.nx-world-pro>.nx-tool-card,.nx-qr-pro>.nx-tool-card{padding:8px!important}.nx-world-controls{grid-template-columns:minmax(0,1fr) 78px 62px}.nx-world-list{gap:5px}.nx-qr-workspace{grid-template-columns:minmax(0,1fr) 116px;gap:5px}.nx-qr-fields.two{grid-template-columns:1fr}.nx-qr-fields textarea{min-height:56px!important;max-height:66px!important}.nx-zone-time{font-size:14px}}
    @media(max-height:720px){.nx-world-pro,.nx-qr-pro{min-height:0}.nx-time-brand small{display:none}.nx-home-clock{padding:8px 10px}.nx-home-time strong{font-size:34px}.nx-world-controls{margin-top:5px}.nx-world-toolbar{margin-top:4px}.nx-world-list{gap:4px}.nx-zone-card{padding:6px 7px}.nx-qr-template-bar{margin-top:4px}.nx-qr-workspace{margin-top:4px}.nx-qr-fields textarea{min-height:48px!important;max-height:54px!important}.nx-qr-stage{max-height:130px}.nx-qr-status{min-height:24px;padding:4px 6px}}
    @media(prefers-reduced-motion:reduce){.nx-world-pro::before,.nx-qr-pro::before,.nx-home-clock::after,.nx-scan-reticle::after{animation:none!important}}
  `;
  document.head.appendChild(style);
}

function supportedZones() {
  try {
    const zones = Intl.supportedValuesOf?.('timeZone');
    if (Array.isArray(zones) && zones.length) return zones;
  } catch {}
  return FALLBACK_ZONES;
}

function validZone(zone) {
  try { new Intl.DateTimeFormat('en-US', { timeZone:zone }).format(new Date()); return true; }
  catch { return false; }
}

function zoneLabel(zone) {
  if (zone === 'UTC') return 'UTC';
  const parts = String(zone).split('/');
  return (parts[parts.length - 1] || zone).replace(/_/g,' ');
}

function offsetMinutes(zone, date = new Date()) {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone:zone, timeZoneName:'shortOffset', hour:'2-digit' }).formatToParts(date).find(item => item.type === 'timeZoneName')?.value || 'GMT';
    if (part === 'GMT' || part === 'UTC') return 0;
    const match = part.match(/(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?/i);
    if (match) return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] || 0));
  } catch {}
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone:zone, hour12:false, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit' });
    const values = Object.fromEntries(formatter.formatToParts(date).filter(item => item.type !== 'literal').map(item => [item.type,item.value]));
    const hour = Number(values.hour) === 24 ? 0 : Number(values.hour);
    const asUtc = Date.UTC(Number(values.year), Number(values.month)-1, Number(values.day), hour, Number(values.minute), Number(values.second));
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch { return 0; }
}

function offsetText(minutes) {
  if (!minutes) return 'UTC±00:00';
  const sign = minutes < 0 ? '−' : '+';
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs/60)).padStart(2,'0')}:${String(abs%60).padStart(2,'0')}`;
}

function diffText(minutes) {
  if (!minutes) return 'SAME AS HOME';
  const sign = minutes < 0 ? '−' : '+';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs/60), m = abs%60;
  return `${sign}${h}H${m ? ` ${m}M` : ''}`;
}

function zoneHour(zone, date) {
  try { return Number(new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'2-digit',hourCycle:'h23'}).format(date)); }
  catch { return 12; }
}

export function renderPremiumWorldClockPro() {
  ensureStyles();
  const allZones = supportedZones();
  const homeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const saved = loadJson(CLOCK_KEY, {});
  let zones = Array.isArray(saved?.zones) ? saved.zones.filter(validZone).slice(0,8) : DEFAULT_ZONES.filter(validZone);
  if (!zones.length) zones = DEFAULT_ZONES.filter(validZone);
  let hour12 = saved?.hour12 === true;
  let seconds = saved?.seconds !== false;
  let sort = ['custom','name','offset'].includes(saved?.sort) ? saved.sort : 'custom';
  const datalist = allZones.map(zone => `<option value="${escapeHtml(zone)}">${escapeHtml(zoneLabel(zone))}</option>`).join('');
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-time-head"><div class="nx-time-brand"><span class="nx-time-orb">UTC</span><div><strong>GLOBAL CHRONOGRAPH</strong><small>LIVE IANA TIME ZONES • OFFSET COMPARATOR</small></div></div><span class="nx-time-chip" data-world-count>0 ZONES</span></div>
      <div class="nx-home-clock"><div class="nx-home-top"><span>HOME TIME ZONE</span><b data-home-zone>${escapeHtml(homeZone)}</b></div><div class="nx-home-time"><strong data-home-time>--:--</strong><span data-home-date>—</span></div><div class="nx-home-bottom"><span data-home-offset>UTC</span><b data-home-state>LOCAL SYSTEM CLOCK</b></div></div>
      <div class="nx-world-controls"><input class="nx-time-input" list="nx-world-zone-options" data-zone-input placeholder="Type IANA zone e.g. Asia/Karachi"><datalist id="nx-world-zone-options">${datalist}</datalist><button class="nx-time-key" type="button" data-zone-add>ADD ZONE</button><button class="nx-time-key" type="button" data-zone-reset>RESET</button></div>
      <div class="nx-world-toolbar"><button type="button" data-world-format>${hour12 ? '12 HOUR' : '24 HOUR'}</button><button type="button" data-world-seconds>${seconds ? 'SECONDS ON' : 'SECONDS OFF'}</button><button type="button" data-world-sort>${sort === 'custom' ? 'CUSTOM' : sort.toUpperCase()}</button></div>
    </section>
    <section class="nx-tool-card nx-world-deck"><div class="nx-world-deck-head"><span>PINNED GLOBAL DESK</span><b data-world-status>LIVE • 1s refresh</b></div><div class="nx-world-list" data-world-list></div></section>
  `, 'nx-world-pro');
  const list = root.querySelector('[data-world-list]');
  const input = root.querySelector('[data-zone-input]');
  const status = root.querySelector('[data-world-status]');
  const formatButton = root.querySelector('[data-world-format]');
  const secondsButton = root.querySelector('[data-world-seconds]');
  const sortButton = root.querySelector('[data-world-sort]');
  let timer = null;
  let disposed = false;

  const persist = () => saveJson(CLOCK_KEY, { zones, hour12, seconds, sort });
  const orderedZones = date => {
    const rows = zones.map((zone,index) => ({ zone,index,offset:offsetMinutes(zone,date),label:zoneLabel(zone) }));
    if (sort === 'name') rows.sort((a,b) => a.label.localeCompare(b.label));
    else if (sort === 'offset') rows.sort((a,b) => a.offset-b.offset || a.label.localeCompare(b.label));
    else rows.sort((a,b) => a.index-b.index);
    return rows;
  };
  const draw = () => {
    if (disposed) return;
    const now = new Date();
    const homeOffset = offsetMinutes(homeZone, now);
    const timeOptions = { timeZone:homeZone, hour:'2-digit', minute:'2-digit', second:seconds?'2-digit':undefined, hour12 };
    root.querySelector('[data-home-time]').textContent = now.toLocaleTimeString([], timeOptions);
    root.querySelector('[data-home-date]').textContent = now.toLocaleDateString([], {timeZone:homeZone,weekday:'short',month:'short',day:'numeric',year:'numeric'});
    root.querySelector('[data-home-offset]').textContent = offsetText(homeOffset);
    root.querySelector('[data-home-state]').textContent = `${zoneHour(homeZone,now) >= 7 && zoneHour(homeZone,now) < 19 ? 'DAYLIGHT' : 'NIGHT'} • SYSTEM CLOCK`;
    root.querySelector('[data-world-count]').textContent = `${zones.length} ZONE${zones.length===1?'':'S'}`;
    const rows = orderedZones(now);
    list.innerHTML = rows.length ? rows.map(({zone,offset,label}) => {
      const hour = zoneHour(zone,now);
      const state = hour >= 7 && hour < 19 ? 'day' : 'night';
      const time = now.toLocaleTimeString([], {timeZone:zone,hour:'2-digit',minute:'2-digit',second:seconds?'2-digit':undefined,hour12});
      const date = now.toLocaleDateString([], {timeZone:zone,weekday:'short',month:'short',day:'numeric'});
      return `<article class="nx-zone-card ${state}"><div class="nx-zone-head"><strong>${escapeHtml(label)}</strong><button type="button" data-zone-remove="${escapeHtml(zone)}" aria-label="Remove ${escapeHtml(label)}">×</button></div><span class="nx-zone-time">${escapeHtml(time)}</span><div class="nx-zone-meta"><span>${escapeHtml(date)} • ${escapeHtml(offsetText(offset))}</span><b>${escapeHtml(diffText(offset-homeOffset))}</b></div></article>`;
    }).join('') : '<div class="nx-zone-empty">No pinned zones. Add any IANA time zone above.</div>';
    list.querySelectorAll('[data-zone-remove]').forEach(button => button.addEventListener('click', () => { zones = zones.filter(zone => zone !== button.dataset.zoneRemove); persist(); draw(); }));
  };
  const addZone = () => {
    const zone = input.value.trim();
    if (!zone) { status.textContent = 'TYPE A TIME ZONE FIRST'; return; }
    if (!validZone(zone)) { status.textContent = 'INVALID IANA TIME ZONE'; return; }
    if (zones.includes(zone)) { status.textContent = 'ZONE ALREADY PINNED'; return; }
    if (zones.length >= 8) { status.textContent = 'MAX 8 PINNED ZONES'; return; }
    zones.push(zone); input.value=''; persist(); status.textContent='ZONE ADDED'; draw();
  };
  root.querySelector('[data-zone-add]').addEventListener('click', addZone);
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addZone(); } });
  root.querySelector('[data-zone-reset]').addEventListener('click', () => { zones = DEFAULT_ZONES.filter(validZone); sort='custom'; persist(); status.textContent='DEFAULT DESK RESTORED'; draw(); });
  formatButton.addEventListener('click', () => { hour12=!hour12; formatButton.textContent=hour12?'12 HOUR':'24 HOUR'; formatButton.classList.toggle('is-active',hour12); persist(); draw(); });
  secondsButton.addEventListener('click', () => { seconds=!seconds; secondsButton.textContent=seconds?'SECONDS ON':'SECONDS OFF'; secondsButton.classList.toggle('is-active',seconds); persist(); draw(); });
  sortButton.addEventListener('click', () => { sort = sort==='custom'?'offset':sort==='offset'?'name':'custom'; sortButton.textContent=sort==='custom'?'CUSTOM':sort.toUpperCase(); sortButton.classList.toggle('is-active',sort!=='custom'); persist(); draw(); });
  formatButton.classList.toggle('is-active',hour12); secondsButton.classList.toggle('is-active',seconds); sortButton.classList.toggle('is-active',sort!=='custom');
  timer = setInterval(draw,1000);
  const detach = attachLight(root);
  root.__cleanup = () => { disposed=true; clearInterval(timer); detach(); };
  persist(); draw();
  return root;
}

function qrEscape(value) {
  return String(value || '').replace(/([\\;,:])/g,'\\$1').replace(/\n/g,'\\n');
}

function qrPayload(root, type) {
  const value = selector => root.querySelector(selector)?.value?.trim() || '';
  if (type === 'text') return value('[data-qr-text]');
  if (type === 'url') return value('[data-qr-url]');
  if (type === 'wifi') {
    const ssid=value('[data-qr-ssid]'), password=value('[data-qr-password]'), security=value('[data-qr-security]') || 'WPA', hidden=value('[data-qr-hidden]') === '1';
    if (!ssid) return '';
    return `WIFI:T:${qrEscape(security)};S:${qrEscape(ssid)};P:${qrEscape(password)};H:${hidden?'true':'false'};;`;
  }
  if (type === 'email') {
    const to=value('[data-qr-email]'), subject=value('[data-qr-subject]'), body=value('[data-qr-email-body]');
    if (!to) return '';
    const params=new URLSearchParams(); if(subject)params.set('subject',subject); if(body)params.set('body',body);
    return `mailto:${to}${params.toString()?`?${params.toString()}`:''}`;
  }
  if (type === 'phone') { const phone=value('[data-qr-phone]'); return phone?`tel:${phone}`:''; }
  if (type === 'sms') { const phone=value('[data-qr-sms-phone]'), message=value('[data-qr-sms-message]'); return phone?`SMSTO:${phone}:${message}`:''; }
  if (type === 'contact') {
    const name=value('[data-qr-contact-name]'), phone=value('[data-qr-contact-phone]'), email=value('[data-qr-contact-email]'), org=value('[data-qr-contact-org]');
    if (!name && !phone && !email) return '';
    return ['BEGIN:VCARD','VERSION:3.0',name?`FN:${name}`:'',phone?`TEL:${phone}`:'',email?`EMAIL:${email}`:'',org?`ORG:${org}`:'','END:VCARD'].filter(Boolean).join('\n');
  }
  return '';
}

function qrTemplateFields(type) {
  if (type === 'text') return `<textarea class="nx-time-input" rows="3" maxlength="1500" data-qr-text placeholder="Type any text…"></textarea>`;
  if (type === 'url') return `<input class="nx-time-input" inputmode="url" maxlength="1500" data-qr-url placeholder="https://example.com">`;
  if (type === 'wifi') return `<div class="nx-qr-fields"><input class="nx-time-input" maxlength="64" data-qr-ssid placeholder="Wi-Fi network name"><div class="nx-qr-fields two"><input class="nx-time-input" maxlength="128" data-qr-password placeholder="Password"><select class="nx-time-select" data-qr-security><option>WPA</option><option>WEP</option><option value="nopass">OPEN</option></select></div><select class="nx-time-select" data-qr-hidden><option value="0">VISIBLE NETWORK</option><option value="1">HIDDEN NETWORK</option></select></div>`;
  if (type === 'email') return `<div class="nx-qr-fields"><input class="nx-time-input" type="email" data-qr-email placeholder="recipient@example.com"><input class="nx-time-input" data-qr-subject placeholder="Subject"><textarea class="nx-time-input" rows="2" maxlength="800" data-qr-email-body placeholder="Message"></textarea></div>`;
  if (type === 'phone') return `<input class="nx-time-input" type="tel" data-qr-phone placeholder="+92…">`;
  if (type === 'sms') return `<div class="nx-qr-fields"><input class="nx-time-input" type="tel" data-qr-sms-phone placeholder="Phone number"><textarea class="nx-time-input" rows="2" maxlength="500" data-qr-sms-message placeholder="SMS message"></textarea></div>`;
  return `<div class="nx-qr-fields"><input class="nx-time-input" data-qr-contact-name placeholder="Full name"><div class="nx-qr-fields two"><input class="nx-time-input" type="tel" data-qr-contact-phone placeholder="Phone"><input class="nx-time-input" type="email" data-qr-contact-email placeholder="Email"></div><input class="nx-time-input" data-qr-contact-org placeholder="Organization"></div>`;
}

export function renderPremiumQRPro() {
  ensureStyles();
  const root = node(`
    <section class="nx-tool-card nx-qr-console">
      <div class="nx-time-head"><div class="nx-time-brand"><span class="nx-time-orb">QR</span><div><strong>QR SIGNAL STATION</strong><small>PRIVATE BUILDER • CAMERA DETECTOR • SHARE/COPY</small></div></div><span class="nx-time-chip" data-qr-chip>CREATE</span></div>
      <div class="nx-qr-modes"><button type="button" data-qr-mode="create" class="is-active">CREATE</button><button type="button" data-qr-mode="scan">SCAN</button></div>
      <div data-qr-create>
        <div class="nx-qr-template-bar">${[['text','TEXT'],['url','URL'],['wifi','WI-FI'],['email','EMAIL'],['phone','PHONE'],['sms','SMS'],['contact','CONTACT']].map(([key,label],index)=>`<button type="button" data-qr-template="${key}" class="${index===0?'is-active':''}">${label}</button>`).join('')}</div>
        <div class="nx-qr-workspace"><div class="nx-qr-form"><div data-qr-fields>${qrTemplateFields('text')}</div><div class="nx-qr-fields two"><select class="nx-time-select" data-qr-size><option value="180">180 PX</option><option value="240" selected>240 PX</option><option value="320">320 PX</option></select><button class="nx-qr-key primary" type="button" data-qr-generate>GENERATE</button></div><div class="nx-qr-actions"><button class="nx-qr-key" type="button" data-qr-copy>COPY DATA</button><button class="nx-qr-key" type="button" data-qr-share>SHARE DATA</button></div><div class="nx-qr-status" data-qr-status>Nothing leaves the device until you tap GENERATE and confirm.</div><div class="nx-qr-recent" data-qr-recent></div></div><div class="nx-qr-preview"><div class="nx-qr-stage" data-qr-stage><span class="placeholder">QR preview appears here after confirmation.</span></div></div></div>
      </div>
      <div data-qr-scan hidden>
        <div class="nx-qr-workspace"><div class="nx-qr-form"><div class="nx-qr-status" data-scan-status>Camera is off. Scanning stays on-device when BarcodeDetector is supported.</div><textarea class="nx-time-input" rows="4" readonly data-scan-result placeholder="Detected QR content"></textarea><div class="nx-qr-actions"><button class="nx-qr-key primary" type="button" data-scan-start>START CAMERA</button><button class="nx-qr-key danger" type="button" data-scan-stop>STOP</button><button class="nx-qr-key" type="button" data-scan-copy>COPY RESULT</button><button class="nx-qr-key" type="button" data-scan-share>SHARE RESULT</button></div></div><div class="nx-qr-preview"><div class="nx-qr-stage"><video class="nx-qr-video" data-scan-video playsinline muted hidden></video><span class="placeholder" data-scan-placeholder>CAMERA<br>STANDBY</span><i class="nx-scan-reticle" data-scan-reticle hidden></i></div></div></div>
      </div>
    </section>
  `, 'nx-qr-pro');
  const createPanel=root.querySelector('[data-qr-create]'), scanPanel=root.querySelector('[data-qr-scan]'), fields=root.querySelector('[data-qr-fields]'), stage=root.querySelector('[data-qr-stage]'), status=root.querySelector('[data-qr-status]'), recentEl=root.querySelector('[data-qr-recent]'), chip=root.querySelector('[data-qr-chip]'), video=root.querySelector('[data-scan-video]'), scanPlaceholder=root.querySelector('[data-scan-placeholder]'), reticle=root.querySelector('[data-scan-reticle]'), scanStatus=root.querySelector('[data-scan-status]'), scanResult=root.querySelector('[data-scan-result]');
  let template='text', mode='create', stream=null, scanning=false, frame=0, disposed=false, lastPayload='';

  const readRecent=()=>{const rows=loadJson(QR_RECENT_KEY,[]);return Array.isArray(rows)?rows.slice(0,6):[];};
  const drawRecent=()=>{const rows=readRecent();recentEl.innerHTML=rows.length?rows.map((item,index)=>`<button type="button" data-qr-recent-index="${index}" title="Copy recent payload">${escapeHtml(item.type.toUpperCase())} • ${escapeHtml(String(item.payload).slice(0,36))}</button>`).join(''):'<button type="button" disabled>RECENTS EMPTY</button>';recentEl.querySelectorAll('[data-qr-recent-index]').forEach(button=>button.addEventListener('click',async()=>{const item=readRecent()[Number(button.dataset.qrRecentIndex)];if(!item)return;lastPayload=String(item.payload||'');try{await navigator.clipboard?.writeText(lastPayload);status.textContent='Recent payload copied.';status.classList.add('good');}catch{status.textContent='Clipboard unavailable.';}}));};
  const currentPayload=()=>qrPayload(root,template);
  const setTemplate=next=>{template=next;fields.innerHTML=qrTemplateFields(template);root.querySelectorAll('[data-qr-template]').forEach(button=>button.classList.toggle('is-active',button.dataset.qrTemplate===template));stage.innerHTML='<span class="placeholder">QR preview appears here after confirmation.</span>';lastPayload='';status.textContent='Nothing leaves the device until you tap GENERATE and confirm.';status.classList.remove('good');};
  const shareValue=async(value,title)=>{if(!value)return;try{if(navigator.share)await navigator.share({title,text:value});else if(navigator.clipboard){await navigator.clipboard.writeText(value);status.textContent='Share unavailable — data copied instead.';}else throw new Error();}catch(error){if(error?.name!=='AbortError')status.textContent='Share unavailable on this device.';}};
  const stop=()=>{scanning=false;if(frame)cancelAnimationFrame(frame);frame=0;stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;video.hidden=true;reticle.hidden=true;scanPlaceholder.hidden=false;if(!disposed)scanStatus.textContent='Camera stopped.';};
  const start=async()=>{if(!('BarcodeDetector'in window)){scanStatus.textContent='BarcodeDetector is not supported on this device.';return;}try{stop();stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});video.srcObject=stream;video.hidden=false;scanPlaceholder.hidden=true;reticle.hidden=false;await video.play();const detector=new BarcodeDetector({formats:['qr_code']});scanning=true;scanStatus.textContent='Scanning on-device • point camera at a QR code.';const loop=async()=>{if(!scanning||disposed)return;try{const codes=await detector.detect(video);if(codes.length){const raw=String(codes[0].rawValue||'');scanResult.value=raw;scanStatus.textContent='QR detected successfully.';navigator.vibrate?.(80);stop();scanStatus.textContent='QR detected • camera stopped.';return;}}catch{}frame=requestAnimationFrame(loop);};loop();}catch{scanStatus.textContent='Camera permission denied or unavailable.';stop();scanStatus.textContent='Camera permission denied or unavailable.';}};
  root.querySelectorAll('[data-qr-mode]').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.qrMode;root.querySelectorAll('[data-qr-mode]').forEach(item=>item.classList.toggle('is-active',item===button));createPanel.hidden=mode!=='create';scanPanel.hidden=mode!=='scan';chip.textContent=mode.toUpperCase();if(mode!=='scan')stop();}));
  root.querySelectorAll('[data-qr-template]').forEach(button=>button.addEventListener('click',()=>setTemplate(button.dataset.qrTemplate)));
  root.querySelector('[data-qr-generate]').addEventListener('click',()=>{const payload=currentPayload();if(!payload){status.textContent='Complete the selected template first.';return;}if(payload.length>1500){status.textContent='Payload is too long for this QR generator.';return;}if(!confirm('Generating this QR sends its payload to the configured QR image service. Continue?'))return;const size=Number(root.querySelector('[data-qr-size]').value)||240;const image=new Image(size,size);image.alt=`Generated ${template} QR code`;image.loading='eager';image.decoding='async';image.referrerPolicy='no-referrer';image.onload=()=>{status.textContent='QR generated successfully.';status.classList.add('good');};image.onerror=()=>{status.textContent='QR image service unavailable.';status.classList.remove('good');};image.src=`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(payload)}`;stage.replaceChildren(image);lastPayload=payload;const recents=readRecent().filter(item=>item.payload!==payload);recents.unshift({type:template,payload,at:new Date().toISOString()});saveJson(QR_RECENT_KEY,recents.slice(0,6));drawRecent();});
  root.querySelector('[data-qr-copy]').addEventListener('click',async()=>{const payload=currentPayload()||lastPayload;if(!payload)return;try{await navigator.clipboard?.writeText(payload);status.textContent='QR payload copied.';status.classList.add('good');}catch{status.textContent='Clipboard unavailable.';}});
  root.querySelector('[data-qr-share]').addEventListener('click',()=>shareValue(currentPayload()||lastPayload,'NexusNova QR data'));
  root.querySelector('[data-scan-start]').addEventListener('click',start);root.querySelector('[data-scan-stop]').addEventListener('click',stop);root.querySelector('[data-scan-copy]').addEventListener('click',async()=>{if(!scanResult.value)return;try{await navigator.clipboard?.writeText(scanResult.value);scanStatus.textContent='Detected content copied.';}catch{scanStatus.textContent='Clipboard unavailable.';}});root.querySelector('[data-scan-share]').addEventListener('click',()=>shareValue(scanResult.value,'Scanned QR content'));
  const detach=attachLight(root);root.__cleanup=()=>{disposed=true;stop();detach();};drawRecent();return root;
}

export const everydayTimeQrRenderers = Object.freeze({
  'world-clock': renderPremiumWorldClockPro,
  qr: renderPremiumQRPro
});
