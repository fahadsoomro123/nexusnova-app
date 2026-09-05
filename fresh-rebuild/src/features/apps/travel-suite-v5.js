import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { firebaseApp, requireFirebaseUser } from '../../core/firebase-backend.js';
import { renderTravelSuite as renderTravelSuiteV4 } from './travel-suite-v4.js';

const functions = getFunctions(firebaseApp, 'us-central1');
const GLOBE = 'data:image/webp;base64,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';

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function money(value, currency = 'PKR') {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  try { return new Intl.NumberFormat('en-PK',{style:'currency',currency,maximumFractionDigits:0}).format(n); }
  catch { return `${Math.round(n).toLocaleString()} ${currency}`; }
}

function durationText(minutes) {
  const n = Math.max(0, Math.round(Number(minutes)||0));
  if (!n) return '—';
  const h = Math.floor(n/60), m = n%60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function clock(value) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
}

function svgIcon(kind) {
  const icons = {
    flights:'<svg viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16Z"/></svg>',
    hotels:'<svg viewBox="0 0 24 24"><path d="M3 5h2v6h6V7h6a4 4 0 0 1 4 4v8h-2v-2H5v2H3V5Zm2 8v2h14v-4a2 2 0 0 0-2-2h-4v4H5Z"/></svg>',
    ground:'<svg viewBox="0 0 24 24"><path d="M6 3h12a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3l1.5 2H16l-1.5-2h-5L8 20H5.5L7 18a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Zm0 2v5h12V5H6Zm1.5 8A1.5 1.5 0 1 0 9 14.5 1.5 1.5 0 0 0 7.5 13Zm9 0a1.5 1.5 0 1 0 1.5 1.5 1.5 1.5 0 0 0-1.5-1.5Z"/></svg>',
    plan:'<svg viewBox="0 0 24 24"><path d="M6 2h10l3 3v17H6V2Zm2 2v16h9V6h-3V4H8Zm2 5h5v2h-5V9Zm0 4h5v2h-5v-2Z"/></svg>'
  };
  return icons[kind] || icons.flights;
}

function ensureRefStyles() {
  if (document.getElementById('nn-travel-approved-ref-v5')) return;
  const style = document.createElement('style');
  style.id = 'nn-travel-approved-ref-v5';
  style.textContent = `
  [data-nn-travel-root="v5"]{width:100%;height:100%;min-height:0;overflow:hidden!important;position:relative;background:radial-gradient(circle at 50% -15%,#0b3b68 0,#061b31 27%,#03111f 62%,#020b14 100%);color:#eef7ff;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}
  [data-nn-travel-root="v5"] *{box-sizing:border-box}
  [data-nn-travel-root="v5"] .nn-ref-canvas{position:absolute;left:50%;top:0;width:550px;height:1032px;transform-origin:top center;overflow:hidden;padding:8px 8px 0;display:grid;grid-template-rows:92px minmax(0,1fr);gap:8px}
  [data-nn-travel-root="v5"] .nn-dock{position:relative;height:92px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:7px 8px 7px 80px;border:1px solid #15496d;border-radius:26px;background:linear-gradient(180deg,rgba(7,39,66,.98),rgba(3,24,43,.98));box-shadow:0 18px 36px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.08),0 0 22px rgba(0,143,255,.09);overflow:visible}
  [data-nn-travel-root="v5"] .nn-tab{height:76px;min-width:0;border:1px solid #1d5275;border-radius:18px;background:linear-gradient(180deg,#123958,#0a263f);box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 8px 18px rgba(0,0,0,.25);color:#e8f6ff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;font-size:14px;font-weight:800;position:relative}
  [data-nn-travel-root="v5"] .nn-tab .nn-ref-tab-icon{width:28px;height:28px;display:grid;place-items:center}
  [data-nn-travel-root="v5"] .nn-tab .nn-ref-tab-icon svg{width:26px;height:26px;fill:#dff5ff;filter:drop-shadow(0 2px 6px rgba(69,199,255,.35))}
  [data-nn-travel-root="v5"] .nn-tab.is-active{border-color:#4bd8ff;background:linear-gradient(150deg,#18caff 0,#0f7be9 58%,#0556c7 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 0 0 2px rgba(19,195,255,.28),0 0 24px rgba(0,174,255,.65),0 13px 26px rgba(0,0,0,.35)}
  [data-nn-travel-root="v5"] .nn-api-dot{position:absolute;right:10px;bottom:12px;width:10px;height:10px;border-radius:50%;background:#f5ad43;box-shadow:0 0 9px rgba(245,173,67,.85)}
  [data-nn-travel-root="v5"] .nn-api-dot[data-state="live"]{background:#43ed92;box-shadow:0 0 11px #43ed92}
  [data-nn-travel-root="v5"] .nn-stage{height:100%;min-height:0;overflow:hidden}
  [data-nn-travel-root="v5"] .nn-panel{height:100%;min-height:0;overflow:hidden;padding:0;display:grid;grid-template-rows:auto auto minmax(0,1fr);gap:9px}
  [data-nn-travel-root="v5"] .nn-panel[hidden]{display:none!important}
  [data-nn-travel-root="v5"] .nn-ref-hero{height:132px;border:1px solid #1e5f8a;border-radius:25px;position:relative;overflow:hidden;padding:19px 22px;background:linear-gradient(110deg,rgba(4,42,70,.98),rgba(3,31,54,.9));box-shadow:0 13px 28px rgba(0,0,0,.33),inset 0 1px 0 rgba(255,255,255,.08)}
  [data-nn-travel-root="v5"] .nn-ref-hero:after{content:"";position:absolute;right:-2px;top:-11px;width:185px;height:185px;background:url('${GLOBE}') center/contain no-repeat;filter:drop-shadow(0 0 20px rgba(38,158,255,.28));opacity:.98}
  [data-nn-travel-root="v5"] .nn-ref-kicker{position:relative;z-index:2;font-size:13px;font-weight:900;letter-spacing:.075em;color:#29c8ff;text-transform:uppercase;display:flex;align-items:center;gap:8px}
  [data-nn-travel-root="v5"] .nn-ref-kicker:before{content:'◉';font-size:15px}
  [data-nn-travel-root="v5"] .nn-ref-title{position:relative;z-index:2;margin:8px 0 3px;font-size:27px;line-height:1.05;font-weight:900;letter-spacing:-.02em;max-width:370px}
  [data-nn-travel-root="v5"] .nn-ref-sub{position:relative;z-index:2;margin:0;color:#9bc4df;font-size:13px;max-width:360px;line-height:1.35}
  [data-nn-travel-root="v5"] .nn-ref-live{position:absolute;right:28px;top:24px;z-index:3;display:flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid rgba(61,232,139,.35);border-radius:999px;background:rgba(10,54,57,.72);font-size:12px;font-weight:900;box-shadow:0 0 14px rgba(58,234,139,.12)}
  [data-nn-travel-root="v5"] .nn-ref-live:before{content:"";width:12px;height:12px;border-radius:50%;background:#45ed8f;box-shadow:0 0 12px #45ed8f}
  [data-nn-travel-root="v5"] .nn-ref-live-copy{position:absolute;right:26px;top:63px;z-index:3;color:#a8c5d9;font-size:12px;text-align:right;line-height:1.35}
  [data-nn-travel-root="v5"] .nn-card{margin:0!important;padding:12px 14px 10px!important;border:1px solid #1d5d82!important;border-radius:23px!important;background:linear-gradient(155deg,rgba(10,44,69,.96),rgba(4,25,43,.97))!important;box-shadow:0 12px 28px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.065),inset 0 -1px 0 rgba(0,0,0,.5)!important}
  [data-nn-travel-root="v5"] .nn-form-head{display:none!important}
  [data-nn-travel-root="v5"] .nn-ref-flight-form{display:grid;grid-template-columns:1fr 42px 1fr;grid-template-areas:'from swap to' 'depart depart return' 'adults cabin currency' 'search search search' 'status status status';gap:10px 9px;align-items:end}
  [data-nn-travel-root="v5"] .nn-ref-field{min-width:0;display:flex;flex-direction:column;gap:6px;position:relative}
  [data-nn-travel-root="v5"] .nn-ref-field>span{font-size:12px;font-weight:800;color:#d8e9f5;padding-left:2px}
  [data-nn-travel-root="v5"] .nn-ref-field input,[data-nn-travel-root="v5"] .nn-ref-field select{width:100%;height:50px;border:1px solid #28678f;border-radius:12px;background:linear-gradient(180deg,#061a2d,#041424);color:#f4fbff;padding:0 14px 0 47px;font-size:16px;outline:none;box-shadow:inset 0 2px 8px rgba(0,0,0,.34),0 1px 0 rgba(255,255,255,.03);appearance:auto}
  [data-nn-travel-root="v5"] .nn-ref-field:after{position:absolute;left:16px;bottom:14px;font-size:20px;line-height:1;filter:drop-shadow(0 0 6px rgba(80,201,255,.25))}
  [data-nn-travel-root="v5"] .nn-from{grid-area:from}.nn-from:after{content:'✈'}
  [data-nn-travel-root="v5"] .nn-to{grid-area:to}.nn-to:after{content:'✈'}
  [data-nn-travel-root="v5"] .nn-depart{grid-area:depart}.nn-depart:after{content:'▣'}
  [data-nn-travel-root="v5"] .nn-return{grid-area:return}.nn-return:after{content:'▣'}
  [data-nn-travel-root="v5"] .nn-adults{grid-area:adults}.nn-adults:after{content:'♟'}
  [data-nn-travel-root="v5"] .nn-cabin{grid-area:cabin}.nn-cabin:after{content:'◔'}
  [data-nn-travel-root="v5"] .nn-currency{grid-area:currency}.nn-currency:after{content:'▤'}
  [data-nn-travel-root="v5"] .nn-swap{grid-area:swap;width:38px;height:46px;margin-bottom:2px;border:1px solid #2775a7;border-radius:11px;background:linear-gradient(180deg,#0a4269,#062a49);color:#3dd3ff;font-size:24px;font-weight:900;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 6px 12px rgba(0,0,0,.25)}
  [data-nn-travel-root="v5"] .nn-ref-search{grid-area:search;height:58px;border:1px solid #67e5ff!important;border-radius:15px!important;background:linear-gradient(100deg,#19d5ec,#0ba2fa 48%,#126ce9)!important;color:white!important;font-size:17px!important;font-weight:900!important;letter-spacing:.04em;box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 0 22px rgba(13,171,255,.36),0 9px 18px rgba(0,0,0,.3)!important}
  [data-nn-travel-root="v5"] .nn-ref-search:before{content:'⌕';font-size:27px;margin-right:10px;vertical-align:-2px}
  [data-nn-travel-root="v5"] .nn-ref-status{grid-area:status;margin:0;text-align:center;color:#8ed0f3;font-size:12px;line-height:20px;min-height:20px}
  [data-nn-travel-root="v5"] .nn-ref-status:before{content:"";display:inline-block;width:10px;height:10px;border-radius:50%;background:#42ed91;box-shadow:0 0 10px #42ed91;margin-right:7px;vertical-align:-1px}
  [data-nn-travel-root="v5"] .nn-results{min-height:0!important;margin:0!important;padding:10px!important;border:1px solid #1d5d82!important;border-radius:23px!important;background:linear-gradient(155deg,rgba(7,37,61,.96),rgba(3,22,38,.98))!important;overflow:hidden!important;box-shadow:0 12px 28px rgba(0,0,0,.33),inset 0 1px 0 rgba(255,255,255,.055)!important}
  [data-nn-travel-root="v5"] .nn-ref-results-head{height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 8px 8px;color:#eef9ff}
  [data-nn-travel-root="v5"] .nn-ref-results-title{display:flex;align-items:center;gap:12px}.nn-ref-results-title>b:first-child{font-size:30px;color:#22c8ff}.nn-ref-results-title strong{display:block;font-size:17px}.nn-ref-results-title small{display:block;color:#8dbbd6;font-size:12px;margin-top:3px}
  [data-nn-travel-root="v5"] .nn-ref-result-count{color:#9bc7e2;font-size:12px}
  [data-nn-travel-root="v5"] .nn-ref-results-list{height:calc(100% - 54px);overflow:auto;display:flex;flex-direction:column;gap:8px;padding-right:1px;scrollbar-width:none}
  [data-nn-travel-root="v5"] .nn-ref-results-list::-webkit-scrollbar{display:none}
  [data-nn-travel-root="v5"] .nn-ref-result{min-height:85px;border:1px solid #2d79a3;border-radius:15px;background:linear-gradient(105deg,rgba(11,56,83,.96),rgba(5,31,52,.98));display:grid;grid-template-columns:66px 1fr auto 18px;gap:10px;align-items:center;padding:9px 10px;box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 5px 12px rgba(0,0,0,.22)}
  [data-nn-travel-root="v5"] .nn-ref-logo{width:62px;height:62px;border-radius:10px;background:linear-gradient(145deg,#0f7dc4,#164f88);display:grid;place-items:center;text-align:center;padding:5px;color:white;font-size:10px;font-weight:900;line-height:1.05;box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 7px 14px rgba(0,0,0,.26)}
  [data-nn-travel-root="v5"] .nn-ref-route{font-size:14px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nn-ref-meta{font-size:11px;color:#b9d4e4;line-height:1.45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nn-ref-provider{color:#77bde7}
  [data-nn-travel-root="v5"] .nn-ref-price{text-align:right;min-width:92px}.nn-ref-live-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid rgba(57,230,135,.42);border-radius:999px;background:rgba(7,63,53,.62);color:#62f0a4;padding:5px 8px;font-size:10px;font-weight:900;margin-bottom:7px}.nn-ref-live-chip:before{content:"";width:8px;height:8px;border-radius:50%;background:#44ec90;box-shadow:0 0 8px #44ec90}.nn-ref-price strong{display:block;font-size:14px}.nn-ref-arrow{font-size:26px;color:#b4d5e8}
  [data-nn-travel-root="v5"] .nn-ref-empty{height:100%;display:grid;place-items:center;color:#84b4d0;font-size:13px;text-align:center;padding:20px}
  [data-nn-travel-root="v5"] .nn-panel[data-panel="hotels"],[data-nn-travel-root="v5"] .nn-panel[data-panel="ground"],[data-nn-travel-root="v5"] .nn-panel[data-panel="plan"]{grid-template-rows:auto minmax(0,1fr);padding:0}
  [data-nn-travel-root="v5"] .nn-panel:not([data-panel="flights"]) .nn-card{padding:16px!important}
  [data-nn-travel-root="v5"] .nn-panel:not([data-panel="flights"]) .nn-form-head{display:flex!important;color:#eaf8ff;font-weight:900;margin-bottom:12px}
  [data-nn-travel-root="v5"] .nn-panel:not([data-panel="flights"]) .nn-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  [data-nn-travel-root="v5"] .nn-panel:not([data-panel="flights"]) .nx-field{display:flex;flex-direction:column;gap:5px;font-size:12px;color:#cfe5f3}
  [data-nn-travel-root="v5"] .nn-panel:not([data-panel="flights"]) input,[data-nn-travel-root="v5"] .nn-panel:not([data-panel="flights"]) select,[data-nn-travel-root="v5"] .nn-panel:not([data-panel="flights"]) textarea{min-height:48px;border:1px solid #28678f;border-radius:12px;background:#061a2d;color:#f4fbff;padding:10px 12px}
  [data-nn-travel-root="v5"] .nn-panel:not([data-panel="flights"]) .nn-action{min-height:50px;border:1px solid #59dcff;border-radius:13px;background:linear-gradient(100deg,#17cae7,#0c86ee);color:#fff;font-weight:900}
  `;
  document.head.appendChild(style);
}

function decorateTabs(root) {
  const map = {flights:['Flights','flights'],hotels:['Hotels','hotels'],ground:['Rail/Bus','ground'],plan:['Trip Plan','plan']};
  root.querySelectorAll('[data-travel-tab]').forEach(btn => {
    const [label,kind] = map[btn.dataset.travelTab] || ['Travel','flights'];
    const dot = btn.querySelector('.nn-api-dot');
    btn.innerHTML = `<span class="nn-ref-tab-icon">${svgIcon(kind)}</span><span>${label}</span>`;
    if (dot) btn.appendChild(dot);
  });
}

function rebuildFlightPanel(root) {
  const panel = root.querySelector('[data-panel="flights"]');
  const card = panel?.querySelector('.nn-card');
  if (!panel || !card) return;
  const old = {
    origin:panel.querySelector('[data-flight-origin]')?.value || '',
    destination:panel.querySelector('[data-flight-destination]')?.value || '',
    departure:panel.querySelector('[data-flight-departure]')?.value || '',
    returnDate:panel.querySelector('[data-flight-return]')?.value || '',
    adults:panel.querySelector('[data-flight-adults]'), cabin:panel.querySelector('[data-flight-cabin]'), currency:panel.querySelector('[data-flight-currency]')
  };
  const hero = document.createElement('section');
  hero.className = 'nn-ref-hero';
  hero.innerHTML = `<div class="nn-ref-kicker">Worldwide Travel</div><h2 class="nn-ref-title">Find & Compare Real Flights</h2><p class="nn-ref-sub">Live fares from trusted travel providers. Search by city, airport or IATA code.</p><div class="nn-ref-live">LIVE API</div><div class="nn-ref-live-copy">Real Data.<br>Real Journeys.</div>`;
  panel.prepend(hero);
  card.innerHTML = `<div class="nn-ref-flight-form">
    <label class="nn-ref-field nn-from"><span>From</span><input maxlength="80" autocomplete="off" data-flight-origin placeholder="Karachi or KHI"></label>
    <button type="button" class="nn-swap" data-flight-swap aria-label="Swap route">⇄</button>
    <label class="nn-ref-field nn-to"><span>To</span><input maxlength="80" autocomplete="off" data-flight-destination placeholder="Dubai or DXB"></label>
    <label class="nn-ref-field nn-depart"><span>Departure</span><input type="date" data-flight-departure></label>
    <label class="nn-ref-field nn-return"><span>Return (Optional)</span><input type="date" data-flight-return></label>
    <label class="nn-ref-field nn-adults"><span>Adults</span><select data-flight-adults>${old.adults?.innerHTML || '<option value="1">1</option>'}</select></label>
    <label class="nn-ref-field nn-cabin"><span>Cabin</span><select data-flight-cabin>${old.cabin?.innerHTML || '<option value="economy">Economy</option>'}</select></label>
    <label class="nn-ref-field nn-currency"><span>Currency</span><select data-flight-currency>${old.currency?.innerHTML || '<option value="PKR">PKR</option>'}</select></label>
    <button class="nn-action nn-ref-search" type="button" data-flight-search>SEARCH FLIGHTS</button>
    <p class="nn-ref-status" role="status" aria-live="polite" data-flight-status>Ready • secure flight APIs checked on search.</p>
  </div>`;
  panel.querySelector('[data-flight-origin]').value = old.origin;
  panel.querySelector('[data-flight-destination]').value = old.destination;
  panel.querySelector('[data-flight-departure]').value = old.departure;
  panel.querySelector('[data-flight-return]').value = old.returnDate;
  panel.querySelector('[data-flight-adults]').value = old.adults?.value || '1';
  panel.querySelector('[data-flight-cabin]').value = old.cabin?.value || 'economy';
  panel.querySelector('[data-flight-currency]').value = old.currency?.value || 'PKR';
  paintFlightResults(root, []);
}

function resultLogo(name) {
  const clean = String(name || 'LIVE').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  return esc((words.length > 1 ? words.map(w => w[0]).join('').slice(0,3) : clean.slice(0,8)).toUpperCase());
}

function paintFlightResults(root, offers) {
  const box = root.querySelector('[data-flight-results]');
  if (!box) return;
  const sorted = [...offers].sort((a,b)=>(Number(a.compareTotal ?? a.total)||1e15)-(Number(b.compareTotal ?? b.total)||1e15));
  const cards = sorted.map(o => {
    const carrier = Array.isArray(o.carriers) && o.carriers.length ? o.carriers[0] : (o.provider || 'Live fare');
    const origin = o.originCode || o.originLabel || '';
    const dest = o.destinationCode || o.destinationLabel || '';
    const time = `${clock(o.departingAt)}${o.arrivingAt ? ` – ${clock(o.arrivingAt)}` : ''}`;
    const stops = Number(o.stops)||0;
    const source = o.agency ? `${o.provider} • Pakistan agency` : (o.provider || 'Live provider');
    return `<article class="nn-ref-result"><div class="nn-ref-logo">${resultLogo(carrier)}</div><div><div class="nn-ref-route">${esc(origin)} → ${esc(dest)}</div><div class="nn-ref-meta">${esc(time)} &nbsp;•&nbsp; ${esc(durationText(o.durationMinutes))} &nbsp;•&nbsp; ${stops ? `${stops} stop${stops>1?'s':''}` : 'Non-stop'}</div><div class="nn-ref-meta nn-ref-provider">${esc(source)}${o.flightNumber ? ` • ${esc(o.flightNumber)}` : ''}${Number.isFinite(Number(o.seatsLeft)) ? ` • ${esc(o.seatsLeft)} seats` : ''}</div></div><div class="nn-ref-price"><span class="nn-ref-live-chip">LIVE FARE</span><strong>${esc(money(o.compareTotal ?? o.total,o.compareCurrency || o.currency || 'PKR'))}</strong></div><div class="nn-ref-arrow">›</div></article>`;
  }).join('');
  box.innerHTML = `<div class="nn-ref-results-head"><div class="nn-ref-results-title"><b>✈</b><div><strong>Live Flight Results</strong><small>Real-time results from trusted providers</small></div></div><span class="nn-ref-result-count">${sorted.length ? `${sorted.length} result${sorted.length===1?'':'s'}` : ''}</span></div><div class="nn-ref-results-list">${cards || '<div class="nn-ref-empty">Search a route to load genuine live fares. No fake fares are shown.</div>'}</div>`;
}

function dedupeOffers(offers) {
  const seen = new Set();
  return offers.filter(o => {
    const key = [o.provider,o.originCode||o.originLabel,o.destinationCode||o.destinationLabel,String(o.departingAt||'').slice(0,16),Math.round(Number(o.compareTotal ?? o.total)||0),o.compareCurrency||o.currency].join('|').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

async function realFlightSearch(root) {
  const origin = root.querySelector('[data-flight-origin]')?.value.trim();
  const destination = root.querySelector('[data-flight-destination]')?.value.trim();
  const departureDate = root.querySelector('[data-flight-departure]')?.value;
  const returnDate = root.querySelector('[data-flight-return]')?.value || '';
  const adults = Number(root.querySelector('[data-flight-adults]')?.value)||1;
  const cabin = root.querySelector('[data-flight-cabin]')?.value || 'economy';
  const currency = root.querySelector('[data-flight-currency]')?.value || 'PKR';
  const status = root.querySelector('[data-flight-status]');
  const button = root.querySelector('[data-flight-search]');
  if (!origin || !destination || !departureDate) { status.textContent = 'Enter origin, destination and departure date.'; return; }
  if (origin.toLowerCase() === destination.toLowerCase()) { status.textContent = 'Origin and destination must be different.'; return; }
  if (returnDate && returnDate < departureDate) { status.textContent = 'Return must be after departure.'; return; }
  button.disabled = true; button.textContent = 'SEARCHING LIVE…'; status.textContent = 'Checking global providers + Pakistan travel agencies…';
  paintFlightResults(root, []);
  try {
    await requireFirebaseUser();
    const payload = {origin,destination,departureDate,returnDate,adults,cabin,currency};
    const world = httpsCallable(functions,'searchWorldwideFlights')(payload);
    const pakistan = httpsCallable(functions,'searchPakistanAgencyFlights')(payload);
    const settled = await Promise.allSettled([world,pakistan]);
    let offers = [];
    const notes = [];
    for (const item of settled) {
      if (item.status === 'fulfilled') {
        const data = item.value?.data || {};
        if (Array.isArray(data.offers)) offers.push(...data.offers.filter(x => x?.live === true));
        if (Array.isArray(data.providerErrors)) notes.push(...data.providerErrors);
        if (data.reason) notes.push(data.reason);
      } else notes.push(String(item.reason?.message || item.reason || 'Provider search failed.'));
    }
    offers = dedupeOffers(offers);
    paintFlightResults(root, offers);
    const pk = offers.filter(x => x.agency).length;
    status.textContent = offers.length ? `${offers.length} genuine live fare${offers.length===1?'':'s'} loaded${pk ? ` • ${pk} from Pakistan agencies` : ''}.` : `No live inventory returned for this search${notes.length ? ` • ${notes[0].slice(0,90)}` : ''}.`;
    const dot = root.querySelector('[data-api-dot="flights"]');
    if (dot) dot.dataset.state = offers.length ? 'live' : 'standby';
  } catch (error) {
    paintFlightResults(root, []);
    status.textContent = String(error?.message || error || 'Live search unavailable.').replace(/^FirebaseError:\s*/i,'').slice(0,140);
  } finally {
    button.disabled = false; button.textContent = 'SEARCH FLIGHTS';
  }
}

function installV5Events(root) {
  root.addEventListener('click', event => {
    const swap = event.target.closest('[data-flight-swap]');
    if (swap) {
      event.preventDefault(); event.stopImmediatePropagation();
      const a = root.querySelector('[data-flight-origin]'), b = root.querySelector('[data-flight-destination]');
      const value = a.value; a.value = b.value; b.value = value; return;
    }
    const search = event.target.closest('[data-flight-search]');
    if (search) {
      event.preventDefault(); event.stopImmediatePropagation(); realFlightSearch(root);
    }
  }, true);
}

function installReferenceScale(root) {
  const nav = root.querySelector('.nn-dock');
  const stage = root.querySelector('.nn-stage');
  const canvas = document.createElement('div');
  canvas.className = 'nn-ref-canvas';
  canvas.append(nav, stage);
  root.appendChild(canvas);
  let disposed = false;
  const fit = () => {
    if (disposed || !root.isConnected) return;
    const w = Math.max(1, root.clientWidth), h = Math.max(1, root.clientHeight);
    const scale = Math.min(w / 550, h / 1032);
    canvas.style.transform = `translateX(-50%) scale(${Math.max(.5,Math.min(1.06,scale))})`;
  };
  requestAnimationFrame(fit);
  window.addEventListener('resize', fit,{passive:true});
  window.visualViewport?.addEventListener('resize',fit,{passive:true});
  const previous = root.__cleanup;
  root.__cleanup = () => { disposed = true; window.removeEventListener('resize',fit); window.visualViewport?.removeEventListener('resize',fit); previous?.(); };
}

export function renderTravelSuite() {
  ensureRefStyles();
  const root = renderTravelSuiteV4();
  root.dataset.nnTravelRoot = 'v5';
  root.classList.remove('nn-travel-v4');
  root.classList.add('nn-travel-v5');
  decorateTabs(root);
  rebuildFlightPanel(root);
  installV5Events(root);
  installReferenceScale(root);
  return root;
}

export const travelSuiteRenderers = Object.freeze({ travel: renderTravelSuite });
