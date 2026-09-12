const STYLE_ID = 'nn-travel-flagship-v5-preview';
const ROOT_SELECTOR = '.nn-travel-v19';
const BRAND_URL = 'https://nexusnovatools.com/';
const NASA_EARTH_4K = 'https://svs.gsfc.nasa.gov/vis/a000000/a002900/a002915/bluemarble-east-4096.png';

const CSS = `
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship{
  --v5-cyan:#47e9ff;--v5-blue:#3489ff;--v5-violet:#8d62ff;--v5-green:#54efb7;
  --v5-line:rgba(127,224,255,.22);--v5-glass:rgba(8,28,45,.72);--v5-deep:#020913;
  color:#f5fbff;background:
    radial-gradient(75% 52% at 50% -6%,rgba(56,210,255,.12),transparent 64%),
    radial-gradient(62% 50% at 98% 48%,rgba(126,88,255,.09),transparent 70%),
    linear-gradient(180deg,#03101c 0%,#020a13 55%,#01070d 100%)!important;
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-travel-frame{
  grid-template-rows:58px 48px minmax(0,1fr)!important;background:transparent!important;
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-travel-head{
  position:relative!important;height:58px!important;min-height:58px!important;padding:7px 10px!important;
  display:grid!important;grid-template-columns:42px minmax(0,1fr) auto!important;align-items:center!important;gap:8px!important;
  border:0!important;border-bottom:1px solid rgba(100,218,255,.10)!important;border-radius:0!important;
  background:linear-gradient(180deg,rgba(5,24,40,.96),rgba(3,14,25,.86))!important;
  box-shadow:none!important;overflow:visible!important;z-index:80!important;
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-head-btn{
  width:40px!important;height:40px!important;min-width:40px!important;border-radius:15px!important;
  border:1px solid rgba(116,220,255,.18)!important;background:linear-gradient(180deg,rgba(18,66,94,.82),rgba(6,25,41,.88))!important;
  color:#ecfbff!important;box-shadow:inset 0 1px rgba(255,255,255,.08),0 7px 18px rgba(0,0,0,.18)!important;
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-head-btn:last-child{display:none!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-brand{justify-self:start!important;gap:8px!important;min-width:0!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-brand-mark{
  width:34px!important;height:34px!important;border-radius:12px!important;background:linear-gradient(145deg,#183c50,#061924)!important;
  border:1px solid rgba(90,218,255,.18)!important;box-shadow:inset 0 1px rgba(255,255,255,.08)!important;font-size:11px!important;
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-brand-title{font-size:16px!important;letter-spacing:-.02em!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-brand-sub{margin-top:1px!important;font-size:7px!important;letter-spacing:.28em!important;color:#72dff3!important}
.nn-v5-brand-portal{
  justify-self:end;width:auto;max-width:210px;height:38px;padding:0 13px;border:1px solid rgba(77,224,255,.22);border-radius:16px;
  display:flex;align-items:center;gap:8px;background:linear-gradient(150deg,rgba(17,66,91,.78),rgba(5,23,38,.92));
  box-shadow:inset 0 1px rgba(255,255,255,.08),0 8px 20px rgba(0,0,0,.18);color:#ecfbff;font:800 9px/1 Inter,system-ui,sans-serif;
  letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis
}
.nn-v5-brand-portal i{width:7px;height:7px;flex:0 0 7px;border-radius:50%;background:#50efba;box-shadow:0 0 12px rgba(80,239,186,.68)}
.nn-v5-brand-portal b{color:#70e9ff;font-size:9px}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-tab-dock{
  position:relative!important;height:48px!important;min-height:48px!important;padding:5px 10px!important;display:grid!important;
  grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:5px!important;border:0!important;border-bottom:1px solid rgba(91,206,235,.08)!important;
  border-radius:0!important;background:rgba(2,12,21,.76)!important;box-shadow:none!important;z-index:70!important;
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-tab-dock button{
  height:38px!important;min-height:38px!important;border:1px solid transparent!important;border-radius:14px!important;padding:0 5px!important;
  background:transparent!important;color:#7494a6!important;font-size:9px!important;font-weight:800!important;box-shadow:none!important;transform:none!important;
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-tab-dock button.is-active,
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-tab-dock button[aria-selected="true"]{
  color:#effcff!important;border-color:rgba(73,220,255,.23)!important;background:linear-gradient(180deg,rgba(36,159,205,.22),rgba(13,58,83,.20))!important;
  box-shadow:inset 0 1px rgba(255,255,255,.08),0 0 18px rgba(47,211,255,.06)!important;
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-travel-stage{
  top:106px!important;grid-row:3!important;background:transparent!important;overflow:hidden!important;
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-panel.nn-flight-panel:not([hidden]){
  --v5-sheet-top:56%;position:absolute!important;inset:0 8px 4px!important;border:0!important;border-radius:0!important;background:transparent!important;
  box-shadow:none!important;overflow:hidden!important;
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-flight-panel>.nn-hero{display:none!important}
.nn-v5-world{
  position:absolute;z-index:2;left:0;right:0;top:0;height:var(--v5-sheet-top);min-height:0;overflow:hidden;border-radius:0 0 30px 30px;
  background:
    radial-gradient(48% 42% at 50% 60%,rgba(30,190,240,.12),transparent 72%),
    linear-gradient(180deg,rgba(4,19,33,.18),rgba(1,8,15,.38));
}
.nn-v5-world::before{content:'';position:absolute;inset:-20% -10%;pointer-events:none;background:radial-gradient(circle at 22% 25%,rgba(66,224,255,.08),transparent 19%),radial-gradient(circle at 82% 65%,rgba(127,84,255,.08),transparent 21%);filter:blur(8px)}
.nn-v5-world-copy{position:absolute;z-index:6;left:20px;top:18px;max-width:46%;pointer-events:none}
.nn-v5-world-copy small{display:block;margin-bottom:6px;color:#55e5ff;font:900 7px/1 Inter,system-ui,sans-serif;letter-spacing:.18em}
.nn-v5-world-copy strong{display:block;color:#f5fbff;font:850 clamp(22px,7.1vw,35px)/.96 Inter,system-ui,sans-serif;letter-spacing:-.055em;text-shadow:0 7px 24px rgba(0,0,0,.45)}
.nn-v5-world-copy span{display:block;margin-top:8px;color:#8ca9ba;font:700 8px/1.3 Inter,system-ui,sans-serif;letter-spacing:.035em}
.nn-v5-data-badge{position:absolute;z-index:7;right:16px;top:18px;padding:9px 11px;border:1px solid rgba(82,239,185,.22);border-radius:14px;background:rgba(6,31,37,.62);backdrop-filter:blur(12px);box-shadow:inset 0 1px rgba(255,255,255,.06);color:#75f1c2;font:900 7px/1.2 Inter,system-ui,sans-serif;letter-spacing:.10em;text-align:right}
.nn-v5-data-badge b{display:block;margin-bottom:4px;color:#eefcff;font-size:9px;letter-spacing:.03em}
.nn-v5-earth-wrap{position:absolute;z-index:3;left:50%;top:53%;width:min(76vw,430px);aspect-ratio:1;transform:translate(-50%,-47%);border-radius:50%;filter:drop-shadow(0 28px 34px rgba(0,0,0,.48))}
.nn-v5-earth-halo{position:absolute;inset:-4%;border-radius:50%;background:radial-gradient(circle,transparent 63%,rgba(61,218,255,.17) 67%,rgba(45,163,255,.05) 71%,transparent 74%);box-shadow:0 0 45px rgba(54,205,255,.13);animation:nnV5Halo 4.8s ease-in-out infinite}
.nn-v5-earth{
  position:absolute;inset:3%;overflow:hidden;border-radius:50%;background-color:#031421;
  background-image:url('${NASA_EARTH_4K}');background-size:cover;background-position:center;background-repeat:no-repeat;
  box-shadow:inset -58px -18px 90px rgba(0,0,0,.70),inset 18px 4px 30px rgba(114,231,255,.12),0 0 0 1px rgba(116,229,255,.16),0 0 35px rgba(29,187,255,.10);
  animation:nnV5EarthFloat 18s ease-in-out infinite;will-change:transform,background-position
}
.nn-v5-earth::before{content:'';position:absolute;inset:0;border-radius:inherit;background:radial-gradient(circle at 32% 24%,rgba(255,255,255,.16),transparent 17%),linear-gradient(105deg,rgba(83,224,255,.08),transparent 31%,rgba(0,0,0,.04) 54%,rgba(0,0,0,.48));mix-blend-mode:screen;pointer-events:none}
.nn-v5-earth::after{content:'';position:absolute;inset:-1%;border-radius:inherit;border:1px solid rgba(111,226,255,.18);box-shadow:inset 0 0 24px rgba(76,215,255,.09)}
.nn-v5-route-svg{position:absolute;z-index:5;inset:8%;width:84%;height:84%;overflow:visible;pointer-events:none;filter:drop-shadow(0 0 5px rgba(67,228,255,.38))}
.nn-v5-route-svg .route{fill:none;stroke:#4be6ff;stroke-width:1.5;stroke-dasharray:5 6;opacity:.78}
.nn-v5-route-svg .routeGlow{fill:none;stroke:rgba(82,221,255,.18);stroke-width:7;opacity:.55}
.nn-v5-route-svg .city{fill:#54e9ff;stroke:rgba(255,255,255,.7);stroke-width:.8}
.nn-v5-route-svg .city.end{fill:#9d70ff}
.nn-v5-route-svg text{fill:#eefbff;font:800 10px Inter,system-ui,sans-serif;paint-order:stroke;stroke:#02101b;stroke-width:3px}
.nn-v5-route-svg .flightCore{fill:url(#nnV5FlightGradient);stroke:rgba(255,255,255,.72);stroke-width:.6}
.nn-v5-route-svg .flightGlyph{fill:#fff;font:700 14px Inter,system-ui,sans-serif;dominant-baseline:middle;text-anchor:middle;stroke:none}
.nn-v5-world-foot{position:absolute;z-index:7;left:18px;right:18px;bottom:14px;display:flex;justify-content:space-between;gap:8px;pointer-events:none}
.nn-v5-metric{min-width:0;padding:8px 10px;border:1px solid rgba(111,209,238,.14);border-radius:14px;background:rgba(2,14,25,.55);backdrop-filter:blur(9px);box-shadow:inset 0 1px rgba(255,255,255,.04)}
.nn-v5-metric small{display:block;color:#69899b;font:800 6px/1 Inter,system-ui,sans-serif;letter-spacing:.12em}
.nn-v5-metric b{display:block;margin-top:4px;color:#f2fbff;font:850 11px/1 Inter,system-ui,sans-serif}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-panel.nn-flight-panel:not([hidden])>.nn-search-card{
  z-index:12!important;top:var(--v5-sheet-top)!important;bottom:0!important;left:0!important;right:0!important;width:auto!important;height:auto!important;
  min-height:0!important;max-height:none!important;margin:0!important;padding:9px!important;gap:5px!important;overflow:hidden!important;overscroll-behavior:none!important;
  display:grid!important;grid-template-rows:30px minmax(54px,1.12fr) minmax(42px,.84fr) minmax(42px,.84fr) 0 minmax(47px,.82fr) 16px!important;align-content:stretch!important;
  border:1px solid rgba(114,218,247,.18)!important;border-radius:28px 28px 24px 24px!important;
  background:radial-gradient(70% 44% at 50% -8%,rgba(54,213,255,.09),transparent 66%),linear-gradient(160deg,rgba(7,29,46,.96),rgba(2,13,24,.985))!important;
  box-shadow:inset 0 1px rgba(255,255,255,.07),0 -18px 40px rgba(0,0,0,.34)!important;backdrop-filter:blur(18px)!important;
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-search-card::before{display:none!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-trip-top,
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-routes,
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-pair,
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-search-button,
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-search-card>div:last-child{height:100%!important;min-height:0!important;max-height:none!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-trip-modes{height:30px!important;min-height:30px!important;padding:2px!important;border:1px solid rgba(109,205,230,.11)!important;border-radius:12px!important;background:rgba(1,12,21,.48)!important;box-shadow:none!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-trip-mode{
  height:26px!important;min-height:26px!important;border:0!important;border-radius:9px!important;background:transparent!important;color:#7897a9!important;box-shadow:none!important;transform:none!important;font-size:8px!important;
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-trip-mode.is-active{
  background:linear-gradient(180deg,rgba(46,190,235,.24),rgba(19,81,112,.22))!important;color:#effcff!important;box-shadow:inset 0 1px rgba(255,255,255,.06)!important;
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-routes{gap:5px!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-route,
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-control{
  height:100%!important;min-height:0!important;padding:5px 9px!important;border:1px solid rgba(111,203,229,.13)!important;border-radius:15px!important;
  background:linear-gradient(155deg,rgba(15,55,76,.68),rgba(4,21,34,.86))!important;color:#effbff!important;
  box-shadow:inset 0 1px rgba(255,255,255,.055),0 5px 12px rgba(0,0,0,.11)!important;transform:none!important;
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-route::before,
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-control::before,
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-control::after{display:none!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-route input{font-size:clamp(18px,5.4vw,27px)!important;line-height:1!important;color:#fff!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-route small,
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-control label{font-size:6.5px!important;color:#7896a7!important;letter-spacing:.08em!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-control input,
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-control select,
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-passenger-trigger,
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-class-trigger-v28{font-size:9.5px!important;font-weight:850!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-filter-row{display:none!important;height:0!important;min-height:0!important;overflow:hidden!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-search-button{
  height:100%!important;min-height:46px!important;border:1px solid rgba(223,251,255,.52)!important;border-radius:17px!important;
  background:linear-gradient(100deg,#36dfe7 0%,#2c8cff 43%,#825eff 76%,#be5eff 100%)!important;color:#fff!important;
  box-shadow:inset 0 1px rgba(255,255,255,.44),0 7px 0 #20205b,0 12px 25px rgba(34,81,176,.27)!important;transform:translateY(-2px)!important;
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-search-button::before,
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-search-button::after{display:none!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-search-button:active{transform:translateY(4px)!important;box-shadow:inset 0 3px 8px rgba(0,0,0,.24),0 1px 0 #20205b!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-trust{display:none!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-search-card>div:last-child{display:block!important;overflow:hidden!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-status{height:16px!important;line-height:16px!important;margin:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:6.5px!important;color:#7492a4!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-secondary:not([hidden]){
  border:1px solid rgba(108,214,244,.14)!important;border-radius:24px!important;background:linear-gradient(160deg,#071d2c,#020c15)!important;overflow:hidden!important;
}
@keyframes nnV5Halo{0%,100%{opacity:.66;transform:scale(.99)}50%{opacity:1;transform:scale(1.012)}}
@keyframes nnV5EarthFloat{0%,100%{transform:translateY(0) rotate(-1.2deg);background-position:48% 50%}50%{transform:translateY(-4px) rotate(1.2deg);background-position:52% 48%}}
@media(max-width:390px){
  .nn-v5-brand-portal{max-width:142px;padding:0 10px;font-size:8px}.nn-v5-brand-portal b{display:none}
  .nn-v5-world-copy{left:14px;top:14px}.nn-v5-data-badge{right:12px;top:14px;padding:8px 9px}
  .nn-v5-world-foot{left:12px;right:12px}.nn-v5-earth-wrap{width:min(82vw,390px)}
}
@media(max-height:760px){
  html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-panel.nn-flight-panel:not([hidden]){--v5-sheet-top:47%}
  .nn-v5-world-copy strong{font-size:22px}.nn-v5-world-copy span{display:none}.nn-v5-earth-wrap{width:min(62vw,300px);top:56%}.nn-v5-world-foot{bottom:7px}
  html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-panel.nn-flight-panel:not([hidden])>.nn-search-card{padding:6px!important;gap:3px!important;grid-template-rows:27px minmax(48px,1fr) 38px 38px 0 44px 13px!important}
}
@media(min-height:980px){
  html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}.nn-v5-flagship .nn-panel.nn-flight-panel:not([hidden]){--v5-sheet-top:58%}
  .nn-v5-earth-wrap{width:min(78vw,470px)}
}
@media(prefers-reduced-motion:reduce){.nn-v5-earth,.nn-v5-earth-halo{animation:none!important}.nn-v5-route-svg animateMotion{display:none}}
`;

function installStyle() {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
  }
  document.head.appendChild(style);
}

function openBrandInNovaBrowser() {
  try {
    if (typeof window.NexusBrowserAndroid?.postMessage === 'function') {
      window.NexusBrowserAndroid.postMessage(JSON.stringify({ action: 'open', url: BRAND_URL }));
      return true;
    }
    if (typeof window.nexusPostNativeAction === 'function' && window.nexusPostNativeAction('openExternal', { url: BRAND_URL })) return true;
    window.open(BRAND_URL, '_blank', 'noopener,noreferrer');
    return true;
  } catch (error) {
    console.warn('[NexusNova Travel V5] brand portal:', error);
    return false;
  }
}

function escapeText(value, fallback = '—') {
  const text = String(value || '').trim();
  return text || fallback;
}

function worldMarkup() {
  return `
    <section class="nn-v5-world" aria-label="NexusNova spatial route preview">
      <div class="nn-v5-world-copy">
        <small>NEXUSNOVA WORLDVIEW</small>
        <strong><span data-v5-route-origin>LHR</span> → <span data-v5-route-destination>CDG</span></strong>
        <span data-v5-route-meta>Real provider search • no fake fares</span>
      </div>
      <div class="nn-v5-data-badge"><b>REAL DATA</b>GENUINE PROVIDERS</div>
      <div class="nn-v5-earth-wrap" aria-hidden="true">
        <div class="nn-v5-earth-halo"></div>
        <div class="nn-v5-earth"></div>
        <svg class="nn-v5-route-svg" viewBox="0 0 520 520" role="presentation">
          <defs>
            <linearGradient id="nnV5FlightGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4beeff"/><stop offset="1" stop-color="#8e62ff"/></linearGradient>
          </defs>
          <path class="routeGlow" d="M105 326 C190 206 337 194 420 278"/>
          <path class="route" d="M105 326 C190 206 337 194 420 278"/>
          <circle class="city" cx="105" cy="326" r="6"/><circle class="city end" cx="420" cy="278" r="6"/>
          <text x="84" y="353" data-v5-svg-origin>LHR</text><text x="405" y="305" data-v5-svg-destination>CDG</text>
          <g>
            <circle class="flightCore" cx="0" cy="0" r="18"/><text class="flightGlyph" x="0" y="1">✈</text>
            <animateMotion dur="6.5s" repeatCount="indefinite" rotate="auto" path="M105 326 C190 206 337 194 420 278"/>
          </g>
        </svg>
      </div>
      <div class="nn-v5-world-foot">
        <span class="nn-v5-metric"><small>ROUTE MOTION</small><b>ACTIVE</b></span>
        <span class="nn-v5-metric"><small>EARTH SOURCE</small><b>NASA • 4K</b></span>
      </div>
    </section>`;
}

function syncRoute(root) {
  const from = escapeText(root.querySelector('[data-flight-origin]')?.value, 'LHR').toUpperCase();
  const to = escapeText(root.querySelector('[data-flight-destination]')?.value, 'CDG').toUpperCase();
  root.querySelectorAll('[data-v5-route-origin]').forEach(node => { node.textContent = from; });
  root.querySelectorAll('[data-v5-route-destination]').forEach(node => { node.textContent = to; });
  root.querySelectorAll('[data-v5-svg-origin]').forEach(node => { node.textContent = from; });
  root.querySelectorAll('[data-v5-svg-destination]').forEach(node => { node.textContent = to; });

  const depart = root.querySelector('[data-flight-departure]')?.value;
  const ret = root.querySelector('[data-flight-return]')?.value;
  const adults = root.querySelector('[data-flight-adults]')?.value || '1';
  const cabin = root.querySelector('[data-flight-cabin]')?.value || 'economy';
  const meta = root.querySelector('[data-v5-route-meta]');
  if (meta) {
    const dateCopy = [depart, ret].filter(Boolean).join(' → ');
    meta.textContent = [dateCopy, `${adults} traveler${String(adults) === '1' ? '' : 's'}`, cabin].filter(Boolean).join(' • ') || 'Real provider search • no fake fares';
  }
}

function bind(root) {
  if (!(root instanceof HTMLElement) || root.dataset.flagshipV5 === 'true') return;
  root.dataset.flagshipV5 = 'true';
  root.classList.add('nn-v5-flagship');
  installStyle();

  const header = root.querySelector('.nn-travel-head');
  const panel = root.querySelector('.nn-panel.nn-flight-panel');
  const searchCard = panel?.querySelector(':scope > .nn-search-card');
  if (!(header instanceof HTMLElement) || !(panel instanceof HTMLElement) || !(searchCard instanceof HTMLElement)) return;

  searchCard.style.setProperty('overflow-x', 'hidden', 'important');
  searchCard.style.setProperty('overflow-y', 'hidden', 'important');
  searchCard.style.setProperty('overscroll-behavior', 'none', 'important');

  if (!header.querySelector('[data-v5-brand-portal]')) {
    const portal = document.createElement('button');
    portal.type = 'button';
    portal.className = 'nn-v5-brand-portal';
    portal.dataset.v5BrandPortal = 'true';
    portal.setAttribute('aria-label', 'Open nexusnovatools.com in Nova Browser');
    portal.innerHTML = '<i aria-hidden="true"></i><span>nexusnovatools.com</span><b>NOVA ↗</b>';
    portal.addEventListener('click', openBrandInNovaBrowser);
    header.appendChild(portal);
  }

  if (!panel.querySelector(':scope > .nn-v5-world')) {
    const shell = document.createElement('div');
    shell.innerHTML = worldMarkup().trim();
    panel.insertBefore(shell.firstElementChild, searchCard);
  }

  const watched = [
    '[data-flight-origin]','[data-flight-destination]','[data-flight-departure]','[data-flight-return]','[data-flight-adults]','[data-flight-cabin]'
  ];
  const sync = () => syncRoute(root);
  watched.forEach(selector => {
    const input = root.querySelector(selector);
    input?.addEventListener('input', sync);
    input?.addEventListener('change', sync);
  });
  sync();

  const reassert = () => {
    if (!root.isConnected) return;
    installStyle();
    searchCard.style.setProperty('overflow-x', 'hidden', 'important');
    searchCard.style.setProperty('overflow-y', 'hidden', 'important');
  };
  requestAnimationFrame(reassert);
  setTimeout(reassert, 180);
  setTimeout(reassert, 900);

  const previousCleanup = root.__cleanup;
  root.__cleanup = () => {
    watched.forEach(selector => {
      const input = root.querySelector(selector);
      input?.removeEventListener('input', sync);
      input?.removeEventListener('change', sync);
    });
    root.classList.remove('nn-v5-flagship');
    previousCleanup?.();
  };
}

function scan() {
  document.querySelectorAll(ROOT_SELECTOR).forEach(bind);
}

installStyle();
scan();
new MutationObserver(scan).observe(document.documentElement, { subtree: true, childList: true });
