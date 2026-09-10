import { travelCall, travelHealth } from './travel-edge-client.js';

const PLAN_KEY = 'nexusnova_travel_private_plan_v19';
const HERO_B64_URL = new URL('../../../assets/travel/reference-hero-right.webp.b64', import.meta.url).href;
const FROM_B64_URL = new URL('../../../assets/travel/reference-from-exact.webp.b64', import.meta.url).href;
const TO_B64_URL = new URL('../../../assets/travel/reference-to-exact.webp.b64', import.meta.url).href;

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));

const errorText = error => String(error?.message || error || 'Live provider unavailable.').slice(0, 180);
const datePlus = days => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + Number(days || 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const clock = value => {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) : '—';
};
const duration = value => {
  const n = Math.max(0, Math.round(Number(value) || 0));
  return n ? `${Math.floor(n / 60)}h ${n % 60}m` : '—';
};
const money = (value, currency='PKR') => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('en-PK', {
      style:'currency', currency, maximumFractionDigits:0
    }).format(n);
  } catch {
    return `${Math.round(n).toLocaleString()} ${currency}`;
  }
};

function ensureStyles() {
  if (document.getElementById('nn-travel-reference-v19')) return;
  const style = document.createElement('style');
  style.id = 'nn-travel-reference-v19';
  style.textContent = `
html.nn-travel-reference-lock,html.nn-travel-reference-lock body{overflow:hidden!important}
.nn-travel-v19{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;overflow:hidden!important;background:
radial-gradient(circle at 83% 17%,rgba(0,135,235,.20),transparent 24%),
radial-gradient(circle at 18% 45%,rgba(0,84,155,.17),transparent 31%),
linear-gradient(180deg,#031324 0%,#02101e 60%,#020b14 100%)!important;
color:#f7fbff!important;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif!important;color-scheme:dark}
.nn-travel-v19 *{box-sizing:border-box}
.nn-travel-v19 button,.nn-travel-v19 input,.nn-travel-v19 select,.nn-travel-v19 textarea{font:inherit}
.nn-travel-v19 button{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.nn-travel-frame{position:absolute;inset:0;display:grid;grid-template-rows:10vw 8.7vw minmax(0,1fr);gap:0;overflow:hidden}
.nn-travel-head{height:10vw;min-height:38px;max-height:46px;display:grid;grid-template-columns:48px 1fr 48px;align-items:center;padding:0 3.1vw}
.nn-head-btn{width:7.5vw;height:7.5vw;min-width:34px;min-height:34px;max-width:42px;max-height:42px;border:1px solid #1f6e9e;border-radius:50%;background:linear-gradient(180deg,#09365a,#041d32);color:#b8edff;display:grid;place-items:center;font-size:25px;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 5px 13px rgba(0,0,0,.34)}
.nn-head-btn:last-child{justify-self:end;font-size:21px}
.nn-brand{justify-self:center;display:flex;align-items:center;gap:10px;transform:translateY(1px)}
.nn-brand-mark{width:30px;height:30px;border:2px solid #6eeaff;clip-path:polygon(50% 0,92% 24%,92% 75%,50% 100%,8% 75%,8% 24%);display:grid;place-items:center;color:#d6f8ff;font-weight:950;filter:drop-shadow(0 0 7px rgba(75,222,255,.42))}
.nn-brand-title{display:block;font-size:15px;line-height:1;font-weight:850;letter-spacing:.01em}
.nn-brand-sub{display:block;margin-top:5px;color:#4edcff;font-size:7px;line-height:1;letter-spacing:.48em}
.nn-tab-dock{height:8.7vw;min-height:34px;max-height:42px;margin:0 3.2vw;border:1px solid #165b84;border-radius:16px;background:linear-gradient(180deg,#061f35,#031523);display:grid;grid-template-columns:repeat(4,1fr);padding:2px;overflow:hidden;box-shadow:inset 0 1px rgba(255,255,255,.04)}
.nn-tab{min-width:0;border:0;border-radius:13px;background:transparent;color:#b8d7e7;display:flex;align-items:center;justify-content:center;gap:5px;font-size:10px;font-weight:800;position:relative;white-space:nowrap}
.nn-tab .ti{font-size:16px;color:#75dcff;line-height:1}
.nn-tab.is-active{color:#fff;background:linear-gradient(135deg,#25d9ee,#139cf1 55%,#1677ef);box-shadow:inset 0 1px rgba(255,255,255,.55),0 0 14px rgba(16,183,255,.5)}
.nn-tab.is-active .ti{color:#fff}
.nn-api-dot{position:absolute;right:5px;bottom:4px;width:5px;height:5px;border-radius:50%;background:#617886}
.nn-api-dot[data-state="live"]{background:#55f7a1;box-shadow:0 0 6px #55f7a1}
.nn-api-dot[data-state="standby"]{background:#f3b84a}
.nn-travel-stage{position:relative;min-height:0;overflow:hidden;padding:1.8vw 3.1vw 1.8vw}
.nn-panel{position:absolute;inset:1.8vw 3.1vw 1.8vw;min-height:0;overflow:hidden}
.nn-panel[hidden]{display:none!important}
.nn-flight-panel:not([hidden]){display:grid;grid-template-rows:30vw minmax(0,1fr);gap:0}
.nn-hero{position:relative;overflow:hidden;min-height:106px;border:0;background:
radial-gradient(circle at 65% 95%,rgba(0,105,185,.18),transparent 34%),
linear-gradient(180deg,rgba(3,21,38,.2),rgba(3,19,34,.54))}
.nn-hero-copy{position:absolute;z-index:4;left:1.7vw;top:4.5vw;width:53%;text-shadow:0 2px 9px rgba(0,0,0,.42)}
.nn-kicker{font-size:7px;font-weight:900;letter-spacing:.24em;color:#4de3ff;white-space:nowrap}
.nn-hero h2{margin:6px 0 0;font-size:clamp(22px,6.3vw,29px);line-height:.98;letter-spacing:-.045em;font-weight:900}
.nn-hero h2 span{color:#20d7f5}
.nn-hero p{margin:7px 0 0;color:#acd2e6;font-size:9px;line-height:1.32}
.nn-hero-art{position:absolute;right:-2%;top:0;width:57%;height:100%;object-fit:cover;object-position:center;opacity:0;transition:opacity .16s ease}
.nn-hero-art[data-ready="true"]{opacity:.96}
.nn-search-card{position:relative;min-height:0;overflow:hidden;border:1px solid #1d6a95;border-radius:18px;background:
radial-gradient(circle at 13% 5%,rgba(16,144,217,.16),transparent 27%),
linear-gradient(145deg,#07243a,#041828 45%,#031523);box-shadow:inset 0 1px rgba(255,255,255,.06),0 10px 22px rgba(0,0,0,.38);padding:8px 8px 7px;display:grid;grid-template-rows:auto auto auto auto auto auto minmax(34px,1fr);gap:5px}
.nn-trip-top{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}
.nn-trip-modes{height:34px;display:grid;grid-template-columns:1fr 1fr;border:1px solid #1d5f83;border-radius:14px;background:#02111e;padding:2px}
.nn-trip-mode{border:0;border-radius:11px;background:transparent;color:#b7d4e5;font-size:10px;font-weight:850}
.nn-trip-mode.is-active{color:#fff;border:1px solid #66edff;background:linear-gradient(145deg,#127dbc,#0b5998);box-shadow:0 0 10px rgba(49,216,255,.48),inset 0 1px rgba(255,255,255,.18)}
.nn-worldwide{border:0;background:transparent;color:#55ddff;font-size:9px;font-weight:800;white-space:nowrap}
.nn-routes{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:7px;min-height:72px}
.nn-route{position:relative;min-width:0;height:72px;overflow:hidden;border:1px solid #26739a;border-radius:13px;background:linear-gradient(110deg,#061926,#0b3854);padding:7px 8px}
.nn-route::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,12,20,.88) 0%,rgba(3,17,29,.7) 42%,rgba(3,17,29,.12) 74%);pointer-events:none}
.nn-route>*{position:relative;z-index:2}
.nn-route label{display:block;color:#afd1e3;font-size:8px}
.nn-route input{display:inline-block;width:64%;height:28px!important;border:0!important;background:transparent!important;color:#fff!important;padding:0!important;outline:0!important;font-size:21px!important;font-weight:900!important;text-transform:uppercase}
.nn-route small{display:block;width:57%;color:#d1e7f2;font-size:8px;line-height:1.25;white-space:normal}
.nn-swap{position:absolute;z-index:20;left:50%;top:50%;transform:translate(-50%,-50%);width:36px;height:36px;border:1px solid #50e3ff;border-radius:50%;background:linear-gradient(180deg,#0c6999,#074467);color:#c4f5ff;font-size:20px;display:grid;place-items:center;box-shadow:0 0 12px rgba(31,192,255,.34)}
.nn-pair{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.nn-control{height:50px;min-width:0;border:1px solid #24678b;border-radius:13px;background:linear-gradient(180deg,#061b2b,#03101d);display:grid;grid-template-columns:27px minmax(0,1fr);gap:6px;align-items:center;padding:5px 8px}
.nn-control .ci{font-size:17px;color:#c5f0ff}
.nn-control label{display:block;color:#9fc4d8;font-size:8px;margin-bottom:1px}
.nn-control input,.nn-control select{width:100%;height:25px!important;min-width:0;border:0!important;background:transparent!important;color:#f6fbff!important;padding:0!important;outline:0!important;font-size:10.5px!important;font-weight:800!important}
.nn-travel-v19.nn-oneway .nn-return{display:none!important}
.nn-travel-v19.nn-oneway .nn-date-pair{grid-template-columns:1fr}
.nn-filter-row{position:relative;z-index:120;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;height:36px}
.nn-filter{min-width:0;border:1px solid #286c91;border-radius:18px;background:linear-gradient(180deg,#061b2b,#03101d);color:#bed9e7;font-size:8.4px;font-weight:850;display:flex;align-items:center;justify-content:center;gap:4px}
.nn-filter .fi{font-size:14px;color:#b9ecff}
.nn-filter.is-active{border-color:#63e9ff;color:#fff;background:linear-gradient(180deg,#0b3858,#05233b);box-shadow:0 0 11px rgba(30,202,255,.25)}
.nn-search-button{height:51px;border:1px solid #7cf2ff;border-radius:17px;background:linear-gradient(100deg,#20dfdf,#0fa8f4 52%,#1877ef);color:#fff;font-size:14px;font-weight:950;letter-spacing:.035em;display:grid;grid-template-columns:32px 1fr 32px;align-items:center;padding:0 13px;box-shadow:inset 0 1px rgba(255,255,255,.52),0 0 18px rgba(19,193,255,.34),0 7px 15px rgba(0,0,0,.32)}
.nn-search-button .si{font-size:24px}
.nn-search-button .arrow{width:31px;height:31px;border-radius:50%;background:rgba(0,67,139,.54);display:grid;place-items:center;font-size:21px}
.nn-status{height:13px;line-height:13px;margin:0;padding:0 2px;color:#8db7ce;font-size:7.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nn-trust{min-height:34px;border-top:1px solid rgba(47,124,158,.56);display:grid;grid-template-columns:1fr 1fr;align-items:center}
.nn-trust>div{display:grid;grid-template-columns:25px 1fr;gap:5px;align-items:center;padding:3px 7px}
.nn-trust>div+div{border-left:1px solid rgba(47,124,158,.56)}
.nn-trust .big{font-size:20px;color:#76ddff}
.nn-trust b{display:block;font-size:8px}
.nn-trust small{display:block;color:#86b2ca;font-size:7px;margin-top:2px}
.nn-secondary:not([hidden]){display:grid;grid-template-rows:minmax(84px,25%) minmax(0,1fr);gap:7px}
.nn-secondary-hero,.nn-secondary-card{border:1px solid #1d6a95;border-radius:18px;background:linear-gradient(145deg,#07243a,#041828 45%,#031523);overflow:hidden}
.nn-secondary-hero{padding:12px 14px;display:flex;flex-direction:column;justify-content:center}
.nn-secondary-hero h2{margin:5px 0 0;font-size:23px}
.nn-secondary-hero p{margin:6px 0 0;color:#a5cada;font-size:9px;line-height:1.35}
.nn-secondary-card{padding:9px;display:flex;flex-direction:column;gap:7px}
.nn-form-head{display:flex;align-items:center;justify-content:space-between;font-size:11px}
.nn-form-head span{font-size:7.5px;color:#59dcff}
.nn-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.nn-field{height:50px;min-width:0;border:1px solid #24678b;border-radius:13px;background:#041522;padding:5px 8px}
.nn-field.wide{grid-column:1/-1}
.nn-field.tall{height:67px}
.nn-field label{display:block;color:#9fc4d8;font-size:8px;margin-bottom:2px}
.nn-field input,.nn-field select,.nn-field textarea{width:100%;height:25px!important;border:0!important;background:transparent!important;color:#fff!important;padding:0!important;outline:0!important;font-size:10.5px!important;font-weight:780!important;resize:none}
.nn-field textarea{height:42px!important}
.nn-secondary-action{margin-top:auto;height:48px;border:1px solid #70edff;border-radius:16px;background:linear-gradient(100deg,#20d7df,#119ff1 55%,#1677ed);color:#fff;font-weight:900;font-size:12px}
.nn-note{border:1px solid rgba(42,105,139,.62);border-radius:12px;background:#02111dbd;padding:7px 8px;color:#8eb9d0;font-size:7.5px;line-height:1.4}
.nn-results{position:absolute;z-index:90;left:4.1vw;right:4.1vw;bottom:2.2vw;height:34%;min-height:130px;border:1px solid #2b82aa;border-radius:17px;background:linear-gradient(180deg,#061d2e,#020d17);box-shadow:0 18px 44px rgba(0,0,0,.7);overflow:hidden;display:flex;flex-direction:column}
.nn-results[hidden]{display:none!important}
.nn-results-head{height:42px;min-height:42px;border-bottom:1px solid rgba(45,115,151,.6);display:flex;align-items:center;justify-content:space-between;padding:0 8px 0 11px}
.nn-results-head strong{display:block;font-size:11px}
.nn-results-head small{display:block;color:#83b7d1;font-size:7.5px;margin-top:2px}
.nn-results-close{width:31px;height:31px;border:1px solid #3787ad;border-radius:50%;background:#08243a;color:#fff;font-size:20px}
.nn-results-body{flex:1;min-height:0;overflow-y:auto;padding:7px;overscroll-behavior:contain}
.nn-results-body[hidden]{display:none!important}
.nn-result{min-height:70px;border:1px solid #2d80a8;border-radius:13px;background:linear-gradient(110deg,#093550,#06253b);display:grid;grid-template-columns:38px 1fr auto;gap:7px;align-items:center;padding:8px;margin-bottom:6px}
.nn-logo{width:36px;height:36px;border-radius:9px;background:#0d557b;display:grid;place-items:center;font-size:7px;font-weight:900}
.nn-result strong{font-size:9px}
.nn-meta{margin-top:3px;color:#acd0df;font-size:7px;line-height:1.28}
.nn-price{text-align:right;min-width:72px}
.nn-live-chip{display:inline-block;font-size:6px;border:1px solid rgba(65,231,146,.55);border-radius:999px;background:rgba(4,89,62,.6);color:#6bf0a8;padding:2px 4px}
.nn-price strong{display:block;margin-top:4px}
.nn-empty{min-height:88px;display:grid;place-items:center;text-align:center;color:#8ebbd3;font-size:8.5px;padding:12px}
html.nn-travel-reference-lock .nx-dock.global{left:5px!important;right:5px!important;bottom:4px!important;height:9vw!important;min-height:38px!important;max-height:46px!important;padding:4px!important;gap:7px!important;border-radius:16px!important;border:1px solid #155c86!important;background:linear-gradient(180deg,#052d4b,#021a2e)!important}
html.nn-travel-reference-lock .nx-dock.global button{border-radius:12px!important;font-size:9px!important;font-weight:900!important;color:#a8cde1!important}
html.nn-travel-reference-lock .nx-dock.global button:last-child{border:1px solid #1687bd!important;background:linear-gradient(120deg,#0d5e91,#07466f)!important;color:#fff!important}
@media(max-width:380px){
 .nn-tab{font-size:9px}.nn-tab .ti{font-size:14px}.nn-brand-title{font-size:14px}.nn-brand-sub{font-size:6.5px}
 .nn-hero-copy{top:4vw}.nn-hero h2{font-size:21px}.nn-hero p{font-size:8px}.nn-kicker{font-size:6.5px}
 .nn-search-card{gap:4px;padding:7px}.nn-routes,.nn-route{min-height:68px;height:68px}.nn-route input{font-size:19px!important}
 .nn-control{height:46px}.nn-filter-row{height:33px}.nn-filter{font-size:7.7px}.nn-search-button{height:47px}
}
@media(max-height:670px){
 .nn-flight-panel:not([hidden]){grid-template-rows:25vw minmax(0,1fr)}
 .nn-hero-copy{top:2.2vw}.nn-hero p{display:none}.nn-search-card{gap:3px;padding:6px}
 .nn-trip-modes{height:29px}.nn-routes,.nn-route{height:62px;min-height:62px}.nn-route input{height:24px!important}
 .nn-control{height:42px}.nn-filter-row{height:30px}.nn-search-button{height:43px}.nn-trust small{display:none}.nn-results{height:31%}
}
`;
  document.head.appendChild(style);
}

function routeMarkup(kind, label, value, city, attr) {
  return `<div class="nn-route ${kind}" data-route-scene="${kind}">
    <label>${label}</label>
    <input ${attr} value="${value}" maxlength="18" aria-label="${label}">
    <small data-city="${kind}">${city}</small>
  </div>`;
}

function markup() {
  return `<div class="nn-travel-frame">
    <header class="nn-travel-head">
      <button class="nn-head-btn" data-travel-back type="button" aria-label="Back">‹</button>
      <div class="nn-brand" aria-label="NexusNova Travel">
        <span class="nn-brand-mark">N</span>
        <span><strong class="nn-brand-title">NexusNova</strong><small class="nn-brand-sub">TRAVEL</small></span>
      </div>
      <button class="nn-head-btn" data-travel-alert type="button" aria-label="Travel alerts">♧</button>
    </header>
    <nav class="nn-tab-dock" role="tablist" aria-label="Travel">
      <button class="nn-tab is-active" data-travel-tab="flights" type="button"><span class="ti">✈</span>Flights<i class="nn-api-dot" data-api-dot="flights"></i></button>
      <button class="nn-tab" data-travel-tab="hotels" type="button"><span class="ti">▰</span>Hotels<i class="nn-api-dot" data-api-dot="hotels"></i></button>
      <button class="nn-tab" data-travel-tab="ground" type="button"><span class="ti">▣</span>Rail/Bus<i class="nn-api-dot" data-api-dot="ground"></i></button>
      <button class="nn-tab" data-travel-tab="plan" type="button"><span class="ti">◇</span>Trip Plan</button>
    </nav>
    <main class="nn-travel-stage">
      <section class="nn-panel nn-flight-panel" data-panel="flights">
        <div class="nn-hero">
          <div class="nn-hero-copy">
            <div class="nn-kicker">EXPLORE A BRIGHTER TOMORROW</div>
            <h2>Travel Further<br>With <span>NexusNova</span></h2>
            <p>Real flights. Real prices. Trusted partners worldwide.</p>
          </div>
          <img class="nn-hero-art" data-hero-art alt="">
        </div>
        <div class="nn-search-card">
          <div class="nn-trip-top">
            <div class="nn-trip-modes">
              <button class="nn-trip-mode is-active" data-v16-trip-mode="roundtrip" type="button">Round Trip</button>
              <button class="nn-trip-mode" data-v16-trip-mode="oneway" type="button">One Way</button>
            </div>
            <button class="nn-worldwide" type="button" data-worldwide>◎ Worldwide Travel ›</button>
          </div>
          <div class="nn-routes">
            ${routeMarkup('from','From','LHR','London Heathrow Airport','data-flight-origin')}
            ${routeMarkup('to','To','CDG','Paris Charles de Gaulle','data-flight-destination')}
            <button class="nn-swap" type="button" aria-label="Swap origin and destination">⇄</button>
          </div>
          <div class="nn-pair nn-date-pair">
            <div class="nn-control nn-depart"><span class="ci">▦</span><div><label>Departure</label><input type="date" data-flight-departure data-flight-depart></div></div>
            <div class="nn-control nn-return"><span class="ci">▦</span><div><label>Return</label><input type="date" data-flight-return></div></div>
          </div>
          <div class="nn-pair">
            <div class="nn-control"><span class="ci">●</span><div><label>Travelers</label><select data-flight-adults><option value="1">1 Adult</option><option value="2">2 Adults</option><option value="3">3 Adults</option><option value="4">4 Adults</option></select></div></div>
            <div class="nn-control"><span class="ci">▱</span><div><label>Class</label><select data-flight-cabin><option value="economy">Economy</option><option value="premium_economy">Premium Economy</option><option value="business">Business</option><option value="first">First</option></select></div></div>
          </div>
          <div class="nn-filter-row">
            <button class="nn-filter is-active" data-v16-sort="best" type="button"><span class="fi">★</span>Best</button>
            <button class="nn-filter" data-v16-sort="cheapest" type="button"><span class="fi">◉</span>Cheapest</button>
            <button class="nn-filter" data-v16-sort="fastest" type="button"><span class="fi">ϟ</span>Fastest</button>
            <button class="nn-filter" data-v16-sort="direct" type="button"><span class="fi">✈</span>Direct</button>
          </div>
          <button class="nn-search-button" data-flight-search type="button"><span class="si">⌕</span><span>SEARCH FLIGHTS</span><span class="arrow">›</span></button>
          <div>
            <p class="nn-status" data-flight-status>Live worldwide flight search ready.</p>
            <div class="nn-trust">
              <div><span class="big">⬡</span><span><b>Trusted Travel Partners</b><small>Real time fares & availability</small></span></div>
              <div><span class="big">◎</span><span><b>Worldwide Coverage</b><small>Global providers. One search.</small></span></div>
            </div>
          </div>
        </div>
      </section>

      <section class="nn-panel nn-secondary" data-panel="hotels" hidden>
        <div class="nn-secondary-hero"><div class="nn-kicker">WORLDWIDE • VERIFIED INVENTORY</div><h2>Find Real Hotels</h2><p>Genuine live provider availability. No scraped or invented room prices.</p></div>
        <div class="nn-secondary-card">
          <div class="nn-form-head"><b>Hotel Search</b><span>LIVE PROVIDERS</span></div>
          <div class="nn-grid">
            <div class="nn-field wide"><label>Destination</label><input data-hotel-destination value="Paris, France"></div>
            <div class="nn-field"><label>Check-in</label><input type="date" data-hotel-checkin></div>
            <div class="nn-field"><label>Check-out</label><input type="date" data-hotel-checkout></div>
            <div class="nn-field"><label>Guests</label><select data-hotel-adults><option value="1">1 Adult</option><option value="2">2 Adults</option><option value="3">3 Adults</option></select></div>
            <div class="nn-field"><label>Rooms</label><select data-hotel-rooms><option value="1">1 Room</option><option value="2">2 Rooms</option></select></div>
          </div>
          <button class="nn-secondary-action" data-hotel-search type="button">▰ SEARCH HOTELS</button>
          <p class="nn-status" data-hotel-status>Live worldwide hotel search ready.</p>
          <div class="nn-note">Only genuine provider inventory is shown. No fake availability.</div>
        </div>
      </section>

      <section class="nn-panel nn-secondary" data-panel="ground" hidden>
        <div class="nn-secondary-hero"><div class="nn-kicker">WORLDWIDE • RAIL + BUS</div><h2>Ground Transport</h2><p>Approved partner inventory only. No scraping or fake timetables.</p></div>
        <div class="nn-secondary-card">
          <div class="nn-form-head"><b>Rail / Bus Search</b><span>NO FAKE FARES</span></div>
          <div class="nn-grid">
            <div class="nn-field"><label>From</label><input data-ground-origin value="London"></div>
            <div class="nn-field"><label>To</label><input data-ground-destination value="Paris"></div>
            <div class="nn-field"><label>Date</label><input type="date" data-ground-date></div>
            <div class="nn-field"><label>Time</label><input type="time" data-ground-time value="08:00"></div>
            <div class="nn-field"><label>Adults</label><select data-ground-adults><option>1</option><option>2</option><option>3</option></select></div>
            <div class="nn-field"><label>Currency</label><select data-ground-currency><option>PKR</option><option>USD</option><option>EUR</option></select></div>
          </div>
          <button class="nn-secondary-action" data-ground-search type="button">▣ SEARCH RAIL / BUS</button>
          <p class="nn-status" data-ground-status>Worldwide provider approval may still be pending.</p>
          <div class="nn-note">Pakistan rail/bus inventory is shown only through approved official provider access.</div>
        </div>
      </section>

      <section class="nn-panel nn-secondary" data-panel="plan" hidden>
        <div class="nn-secondary-hero"><div class="nn-kicker">PRIVATE • ON DEVICE</div><h2>Trip Plan</h2><p>Save a private local plan without publishing your itinerary.</p></div>
        <div class="nn-secondary-card">
          <div class="nn-form-head"><b>My Trip</b><span>LOCAL SAVE</span></div>
          <div class="nn-grid">
            <div class="nn-field wide"><label>Destination</label><input data-trip-destination value="Dubai"></div>
            <div class="nn-field"><label>Start date</label><input type="date" data-trip-start></div>
            <div class="nn-field"><label>Travelers</label><select data-trip-travelers><option value="1">1 Traveler</option><option value="2">2 Travelers</option><option value="3">3 Travelers</option></select></div>
            <div class="nn-field wide tall"><label>Notes</label><textarea data-trip-notes></textarea></div>
          </div>
          <button class="nn-secondary-action" data-trip-save type="button">▣ SAVE TRIP PLAN</button>
          <p class="nn-status" data-trip-status>Nothing saved yet.</p>
          <div class="nn-note" data-trip-preview>Your saved plan stays on this device.</div>
        </div>
      </section>
    </main>
  </div>
  <section class="nn-results" data-results hidden>
    <div class="nn-results-head"><span><strong data-results-title>Live Results</strong><small data-results-sub>Real provider inventory</small></span><button class="nn-results-close" data-results-close type="button">×</button></div>
    <div class="nn-results-body" data-flight-results></div>
    <div class="nn-results-body" data-hotel-results hidden></div>
    <div class="nn-results-body" data-ground-results hidden></div>
  </section>`;
}

function setDot(root, key, state) {
  const dot = root.querySelector(`[data-api-dot="${key}"]`);
  if (dot) dot.dataset.state = state;
}

function closeResults(root) {
  const box = root.querySelector('[data-results]');
  if (box) box.hidden = true;
}

function openResults(root, type, title, sub) {
  const box = root.querySelector('[data-results]');
  if (!box) return;
  root.querySelector('[data-results-title]').textContent = title;
  root.querySelector('[data-results-sub]').textContent = sub;
  root.querySelectorAll('.nn-results-body').forEach(body => {
    body.hidden = !body.hasAttribute(`data-${type}-results`);
  });
  box.hidden = false;
}

function activatePanel(root, name) {
  const active = ['flights','hotels','ground','plan'].includes(name) ? name : 'flights';
  root.dataset.activeTravelPanel = active;
  root.querySelectorAll('[data-travel-tab]').forEach(button => {
    const on = button.dataset.travelTab === active;
    button.classList.toggle('is-active', on);
    button.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  root.querySelectorAll('[data-panel]').forEach(panel => {
    panel.hidden = panel.dataset.panel !== active;
  });
  closeResults(root);
}

function providerLogo(name) {
  const words = String(name || 'LIVE').trim().split(/\s+/).filter(Boolean);
  return esc((words.length > 1 ? words.map(word => word[0]).join('') : words[0] || 'LIVE').slice(0, 5).toUpperCase());
}

function sortFlightOffers(root, offers) {
  const mode = root.dataset.flightSort || 'best';
  const rows = [...offers];
  if (mode === 'direct') return rows.filter(offer => Number(offer.stops || 0) === 0);
  if (mode === 'cheapest') {
    return rows.sort((a,b) => Number(a.compareTotal ?? a.total ?? 1e15) - Number(b.compareTotal ?? b.total ?? 1e15));
  }
  if (mode === 'fastest') {
    return rows.sort((a,b) => Number(a.durationMinutes || 1e15) - Number(b.durationMinutes || 1e15));
  }
  return rows.sort((a,b) => {
    const score = offer => Number(offer.compareTotal ?? offer.total ?? 1e15)
      + Number(offer.durationMinutes || 0) * 45
      + (Number(offer.stops || 0) ? 12000 : 0);
    return score(a) - score(b);
  });
}

function renderFlightResults(root, offers) {
  const box = root.querySelector('[data-flight-results]');
  const list = sortFlightOffers(root, offers);
  box.innerHTML = list.length ? list.map(offer => {
    const carrier = (offer.carriers || [])[0] || offer.provider || 'Live fare';
    const stops = Number(offer.stops || 0);
    return `<article class="nn-result">
      <div class="nn-logo">${providerLogo(carrier)}</div>
      <div><strong>${esc(offer.originCode || offer.originLabel || '')} → ${esc(offer.destinationCode || offer.destinationLabel || '')}</strong>
        <div class="nn-meta">${esc(clock(offer.departingAt))}${offer.arrivingAt ? ` – ${esc(clock(offer.arrivingAt))}` : ''} • ${esc(duration(offer.durationMinutes))} • ${stops ? `${stops} stop${stops > 1 ? 's' : ''}` : 'Non-stop'}</div>
        <div class="nn-meta">${esc(carrier)} • ${esc(offer.provider || 'Live provider')}</div>
      </div>
      <div class="nn-price"><span class="nn-live-chip">LIVE FARE</span><strong>${esc(money(offer.compareTotal ?? offer.total, offer.compareCurrency || offer.currency || 'PKR'))}</strong></div>
    </article>`;
  }).join('') : '<div class="nn-empty">No matching genuine live fare returned. No fake fare is shown.</div>';
}

function renderHotelResults(root, offers) {
  const box = root.querySelector('[data-hotel-results]');
  box.innerHTML = offers.length ? offers.map(offer => `<article class="nn-result">
    <div class="nn-logo">HTL</div>
    <div><strong>${esc(offer.name || 'Hotel')}</strong><div class="nn-meta">${esc(offer.cityCode || '')}${offer.countryCode ? ` • ${esc(offer.countryCode)}` : ''}</div><div class="nn-meta">${esc(offer.nights || 0)} nights • Live provider</div></div>
    <div class="nn-price"><span class="nn-live-chip">LIVE API</span><strong>${esc(money(offer.compareTotal ?? offer.stayTotal, offer.compareCurrency || offer.currency || 'PKR'))}</strong></div>
  </article>`).join('') : '<div class="nn-empty">No genuine live hotel availability returned.</div>';
}

function renderGroundResults(root, offers) {
  const box = root.querySelector('[data-ground-results]');
  box.innerHTML = offers.length ? offers.map(offer => `<article class="nn-result">
    <div class="nn-logo">${esc(String(offer.mode || 'BUS').slice(0,3).toUpperCase())}</div>
    <div><strong>${esc(offer.originLabel || '')} → ${esc(offer.destinationLabel || '')}</strong><div class="nn-meta">${esc((offer.carrierNames || []).join(' + ') || offer.provider || 'Live provider')}</div><div class="nn-meta">${esc(clock(offer.departingAt))} • ${esc(duration(offer.durationMinutes))}</div></div>
    <div class="nn-price"><span class="nn-live-chip">LIVE FARE</span><strong>${esc(money(offer.total, offer.currency || 'PKR'))}</strong></div>
  </article>`).join('') : '<div class="nn-empty">No approved live rail/bus inventory returned. No scraped or estimated fare is shown.</div>';
}

async function searchFlights(root) {
  const q = selector => root.querySelector(selector);
  const origin = q('[data-flight-origin]').value.trim();
  const destination = q('[data-flight-destination]').value.trim();
  const departureDate = q('[data-flight-departure]').value;
  const returnDate = root.classList.contains('nn-oneway') ? '' : q('[data-flight-return]').value;
  const adults = Number(q('[data-flight-adults]').value) || 1;
  const cabin = q('[data-flight-cabin]').value;
  const status = q('[data-flight-status]');
  const button = q('[data-flight-search]');
  if (!origin || !destination || !departureDate) {
    status.textContent = 'Enter origin, destination and departure date.';
    return;
  }
  if (origin.toLowerCase() === destination.toLowerCase()) {
    status.textContent = 'Origin and destination must be different.';
    return;
  }
  button.disabled = true;
  status.textContent = 'Checking genuine worldwide flight inventory…';
  try {
    const payload = {origin,destination,departureDate,returnDate,adults,cabin,currency:'PKR'};
    const settled = await Promise.allSettled([
      travelCall('searchWorldwideFlights', payload),
      travelCall('searchPakistanAgencyFlights', payload)
    ]);
    const offers = [];
    const notes = [];
    settled.forEach(item => {
      if (item.status === 'fulfilled') {
        const data = item.value || {};
        if (Array.isArray(data.offers)) offers.push(...data.offers.filter(offer => offer?.live === true));
        if (data.message) notes.push(data.message);
        if (data.reason) notes.push(data.reason);
      } else notes.push(errorText(item.reason));
    });
    root.__flightOffers = offers;
    renderFlightResults(root, offers);
    openResults(root,'flight','Live Flight Results',offers.length ? `${offers.length} genuine live fare${offers.length === 1 ? '' : 's'}` : 'No fake fares shown');
    status.textContent = offers.length ? `${offers.length} genuine live fare${offers.length === 1 ? '' : 's'} loaded.` : (notes.join(' • ') || 'No live fare returned.');
    setDot(root,'flights',offers.length ? 'live' : 'standby');
  } catch (error) {
    root.__flightOffers = [];
    renderFlightResults(root, []);
    openResults(root,'flight','Live Flight Results','Provider unavailable');
    status.textContent = `Live flight search failed • ${errorText(error)}`;
    setDot(root,'flights','standby');
  } finally {
    button.disabled = false;
  }
}

async function searchHotels(root) {
  const q = selector => root.querySelector(selector);
  const destination = q('[data-hotel-destination]').value.trim();
  const checkIn = q('[data-hotel-checkin]').value;
  const checkOut = q('[data-hotel-checkout]').value;
  const adults = Number(q('[data-hotel-adults]').value) || 1;
  const rooms = Number(q('[data-hotel-rooms]').value) || 1;
  const status = q('[data-hotel-status]');
  const button = q('[data-hotel-search]');
  if (!destination || !checkIn || !checkOut) {
    status.textContent = 'Enter destination, check-in and check-out.';
    return;
  }
  button.disabled = true;
  status.textContent = 'Checking genuine live hotel inventory…';
  try {
    const data = await travelCall('searchWorldwideHotels', {destination,checkIn,checkOut,adults,rooms,currency:'PKR'});
    const offers = data?.ok === true && Array.isArray(data.offers) ? data.offers.filter(offer => offer?.live === true) : [];
    renderHotelResults(root, offers);
    openResults(root,'hotel','Live Hotel Results',offers.length ? `${offers.length} genuine live offer${offers.length === 1 ? '' : 's'}` : 'No fake availability shown');
    status.textContent = offers.length ? `${offers.length} genuine live hotel offer${offers.length === 1 ? '' : 's'} loaded.` : (data?.message || 'Live hotel provider returned no availability.');
    setDot(root,'hotels',offers.length ? 'live' : 'standby');
  } catch (error) {
    renderHotelResults(root, []);
    openResults(root,'hotel','Live Hotel Results','Provider unavailable');
    status.textContent = `Live hotel search failed • ${errorText(error)}`;
    setDot(root,'hotels','standby');
  } finally {
    button.disabled = false;
  }
}

async function searchGround(root) {
  const q = selector => root.querySelector(selector);
  const origin = q('[data-ground-origin]').value.trim();
  const destination = q('[data-ground-destination]').value.trim();
  const departureDate = q('[data-ground-date]').value;
  const departureTime = q('[data-ground-time]').value || '08:00';
  const adults = Number(q('[data-ground-adults]').value) || 1;
  const currency = q('[data-ground-currency]').value || 'PKR';
  const status = q('[data-ground-status]');
  const button = q('[data-ground-search]');
  if (!origin || !destination || !departureDate) {
    status.textContent = 'Enter origin, destination and date.';
    return;
  }
  button.disabled = true;
  status.textContent = 'Checking approved live rail/bus inventory…';
  try {
    const payload = {origin,destination,departureDate,departureTime,adults,currency};
    const settled = await Promise.allSettled([
      travelCall('searchWorldwideGroundTransport', payload),
      travelCall('searchPakistanGroundTransport', payload)
    ]);
    const offers = [];
    const notes = [];
    settled.forEach(item => {
      if (item.status === 'fulfilled') {
        const data = item.value || {};
        if (Array.isArray(data.offers)) offers.push(...data.offers.filter(offer => offer?.live === true));
        if (data.message) notes.push(data.message);
        if (data.reason) notes.push(data.reason);
      } else notes.push(errorText(item.reason));
    });
    renderGroundResults(root, offers);
    openResults(root,'ground','Rail / Bus Results',offers.length ? `${offers.length} genuine live option${offers.length === 1 ? '' : 's'}` : 'Approved provider inventory only');
    status.textContent = offers.length ? `${offers.length} genuine live rail/bus fare${offers.length === 1 ? '' : 's'} loaded.` : (notes.join(' • ') || 'Worldwide rail/bus provider approval pending.');
    setDot(root,'ground',offers.length ? 'live' : 'standby');
  } catch (error) {
    renderGroundResults(root, []);
    openResults(root,'ground','Rail / Bus Results','Provider approval may be pending');
    status.textContent = `Rail/bus provider pending or unavailable • ${errorText(error)}`;
    setDot(root,'ground','standby');
  } finally {
    button.disabled = false;
  }
}

function savePlan(root) {
  const q = selector => root.querySelector(selector);
  const destination = q('[data-trip-destination]').value.trim();
  const start = q('[data-trip-start]').value;
  const travelers = q('[data-trip-travelers]').value;
  const notes = q('[data-trip-notes]').value.trim();
  const status = q('[data-trip-status]');
  if (!destination) {
    status.textContent = 'Enter a destination first.';
    return;
  }
  const plan = {destination,start,travelers,notes};
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
    status.textContent = 'Trip plan saved privately on this device.';
    q('[data-trip-preview]').innerHTML = `<b>${esc(destination)}</b>${start ? ` • ${esc(start)}` : ''} • ${esc(travelers)} traveler${travelers === '1' ? '' : 's'}${notes ? `<br>${esc(notes.slice(0,100))}` : ''}`;
  } catch {
    status.textContent = 'Private local storage is unavailable.';
  }
}

function loadPlan(root) {
  try {
    const plan = JSON.parse(localStorage.getItem(PLAN_KEY) || 'null');
    if (!plan) return;
    root.querySelector('[data-trip-destination]').value = plan.destination || '';
    root.querySelector('[data-trip-start]').value = plan.start || '';
    root.querySelector('[data-trip-travelers]').value = plan.travelers || '1';
    root.querySelector('[data-trip-notes]').value = plan.notes || '';
    root.querySelector('[data-trip-status]').textContent = 'Saved trip plan loaded privately.';
  } catch {}
}

async function readB64(url) {
  const response = await fetch(url, {cache:'force-cache'});
  const text = (await response.text()).trim();
  if (!response.ok || !/^[A-Za-z0-9+/=]+$/.test(text.slice(0,128))) throw new Error('asset unavailable');
  return `data:image/webp;base64,${text}`;
}

async function loadReferenceAssets(root) {
  const jobs = [
    readB64(HERO_B64_URL).then(src => {
      const img = root.querySelector('[data-hero-art]');
      if (img) { img.src = src; img.dataset.ready = 'true'; }
    }),
    readB64(FROM_B64_URL).then(src => {
      const el = root.querySelector('[data-route-scene="from"]');
      if (el) el.style.backgroundImage = `url("${src}")`;
      if (el) { el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; }
    }),
    readB64(TO_B64_URL).then(src => {
      const el = root.querySelector('[data-route-scene="to"]');
      if (el) el.style.backgroundImage = `url("${src}")`;
      if (el) { el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; }
    })
  ];
  await Promise.allSettled(jobs);
}

async function updateHealth(root) {
  try {
    const health = await travelHealth();
    const providers = health?.providers || {};
    const coverage = health?.coverage || {};
    setDot(root,'flights',coverage.globalFlights || providers.scrappaFlights || providers.scrappa ? 'live' : 'standby');
    setDot(root,'hotels',coverage.globalHotels || providers.scrappaHotels || providers.scrappa ? 'live' : 'standby');
    setDot(root,'ground',coverage.globalRailBus || coverage.pakistanBusFares || providers.distribusion || providers.pakistanBusPartner ? 'live' : 'standby');
    root.dataset.backend = 'cloudflare-only';
  } catch {
    root.dataset.backend = 'cloudflare-only';
  }
}

function wire(root) {
  const on = (el,event,handler) => el?.addEventListener(event,handler);

  root.querySelectorAll('[data-travel-tab]').forEach(button => on(button,'click',() => activatePanel(root,button.dataset.travelTab)));
  root.querySelectorAll('[data-v16-trip-mode]').forEach(button => on(button,'click',() => {
    const oneWay = button.dataset.v16TripMode === 'oneway';
    root.querySelectorAll('[data-v16-trip-mode]').forEach(item => item.classList.toggle('is-active', item === button));
    root.classList.toggle('nn-oneway', oneWay);
    const ret = root.querySelector('.nn-return');
    if (ret) ret.hidden = oneWay;
    if (oneWay) root.querySelector('[data-flight-return]').value = '';
    else if (!root.querySelector('[data-flight-return]').value) root.querySelector('[data-flight-return]').value = datePlus(14);
  }));

  on(root.querySelector('.nn-swap'),'click',() => {
    const a = root.querySelector('[data-flight-origin]');
    const b = root.querySelector('[data-flight-destination]');
    const ac = root.querySelector('[data-city="from"]');
    const bc = root.querySelector('[data-city="to"]');
    [a.value,b.value] = [b.value,a.value];
    [ac.textContent,bc.textContent] = [bc.textContent,ac.textContent];
  });

  root.querySelectorAll('[data-v16-sort]').forEach(button => on(button,'click',() => {
    root.dataset.flightSort = button.dataset.v16Sort;
    root.querySelectorAll('[data-v16-sort]').forEach(item => item.classList.toggle('is-active', item === button));
    if (root.__flightOffers) renderFlightResults(root, root.__flightOffers);
  }));

  on(root.querySelector('[data-flight-search]'),'click',() => searchFlights(root));
  on(root.querySelector('[data-hotel-search]'),'click',() => searchHotels(root));
  on(root.querySelector('[data-ground-search]'),'click',() => searchGround(root));
  on(root.querySelector('[data-trip-save]'),'click',() => savePlan(root));
  on(root.querySelector('[data-results-close]'),'click',() => closeResults(root));
  on(root.querySelector('[data-worldwide]'),'click',() => {
    root.querySelector('[data-flight-status]').textContent = 'Worldwide live search uses approved Cloudflare-connected providers.';
  });
  on(root.querySelector('[data-travel-alert]'),'click',() => {
    root.querySelector('[data-flight-status]').textContent = 'Travel alerts are ready for future itinerary updates.';
  });
  on(root.querySelector('[data-travel-back]'),'click',() => {
    const back = root.closest('.nx-screen')?.querySelector('.nx-app-head [data-app-back]');
    if (back) back.click();
    else if (history.length > 1) history.back();
  });

  const departure = root.querySelector('[data-flight-departure]');
  const returning = root.querySelector('[data-flight-return]');
  const checkIn = root.querySelector('[data-hotel-checkin]');
  const checkOut = root.querySelector('[data-hotel-checkout]');
  const groundDate = root.querySelector('[data-ground-date]');
  const tripStart = root.querySelector('[data-trip-start]');

  departure.min = datePlus(1);
  departure.value = datePlus(7);
  returning.min = datePlus(2);
  returning.value = datePlus(14);
  checkIn.min = datePlus(1);
  checkIn.value = datePlus(7);
  checkOut.min = datePlus(2);
  checkOut.value = datePlus(10);
  groundDate.min = datePlus(1);
  groundDate.value = datePlus(7);
  tripStart.value = datePlus(7);

  on(departure,'change',() => {
    returning.min = departure.value || datePlus(1);
    if (returning.value && returning.value <= returning.min) returning.value = datePlus(14);
  });
  on(checkIn,'change',() => {
    checkOut.min = checkIn.value || datePlus(2);
    if (!checkOut.value || checkOut.value <= checkOut.min) checkOut.value = datePlus(10);
  });
}

function installShell(root) {
  const apply = () => {
    if (!root.isConnected) return;
    const screen = root.closest('.nx-screen');
    const mount = root.parentElement;
    const head = screen?.querySelector('.nx-app-head');
    if (screen) {
      screen.classList.add('nn-travel-reference-shell');
      screen.style.setProperty('overflow','hidden','important');
      screen.style.setProperty('padding','0','important');
      screen.style.setProperty('min-height','0','important');
      if (getComputedStyle(screen).position === 'static') screen.style.setProperty('position','relative','important');
    }
    if (mount) {
      mount.style.setProperty('position','absolute','important');
      mount.style.setProperty('inset','0','important');
      mount.style.setProperty('width','100%','important');
      mount.style.setProperty('height','100%','important');
      mount.style.setProperty('min-height','0','important');
      mount.style.setProperty('overflow','hidden','important');
      mount.style.setProperty('padding','0','important');
      mount.style.setProperty('margin','0','important');
    }
    if (head) {
      head.hidden = true;
      head.setAttribute('aria-hidden','true');
      head.style.setProperty('display','none','important');
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(apply));
  setTimeout(apply, 120);
  setTimeout(apply, 420);
}

export function renderTravelSuite() {
  ensureStyles();
  const root = document.createElement('section');
  root.className = 'nn-travel-v19 nn-travel-v16';
  root.dataset.runtimeRepair = 'fresh-reference-v19-pixel-map';
  root.dataset.referenceMaster = 'user-approved-neon-flight-search';
  root.dataset.referenceCanvas = '941x1672';
  root.dataset.referenceSafeApp = '941x1480';
  root.dataset.referenceMethod = 'measured-reference-hybrid';
  root.dataset.flightSort = 'best';
  root.innerHTML = markup();

  document.documentElement.classList.add('nn-travel-reference-lock');
  activatePanel(root,'flights');
  wire(root);
  installShell(root);
  loadPlan(root);
  queueMicrotask(() => loadReferenceAssets(root));
  queueMicrotask(() => updateHealth(root));

  root.__cleanup = () => {
    document.documentElement.classList.remove('nn-travel-reference-lock');
    const screen = root.closest('.nx-screen');
    const head = screen?.querySelector('.nx-app-head');
    if (head) {
      head.hidden = false;
      head.removeAttribute('aria-hidden');
      head.style.removeProperty('display');
    }
    screen?.classList.remove('nn-travel-reference-shell');
  };
  return root;
}

export const travelSuiteRenderers = Object.freeze({ travel: renderTravelSuite });
