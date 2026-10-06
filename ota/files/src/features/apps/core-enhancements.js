import { coreRenderers } from './core-apps.js';
import { escapeHtml, loadJson, saveJson, uid } from '../../core/local-store.js';

const ALERTS_KEY = 'nexus_price_alerts_v1';
const LANG_KEY = 'nexus_ui_lang_v1';
const PUBLIC_SHARE_URL = 'https://fahadsoomro123.github.io/nexusnova-app/';

function currentLanguage() {
  return localStorage.getItem(LANG_KEY) === 'ur' ? 'ur' : 'en';
}

function applyLanguagePreference(lang = currentLanguage()) {
  const urdu = lang === 'ur';
  document.documentElement.lang = urdu ? 'ur' : 'en';
  document.querySelectorAll('.nx-dock__item').forEach(button => {
    const span = button.querySelector('span');
    if (!span) return;
    if (button.dataset.route === 'mine') span.textContent = urdu ? 'مائن' : 'MINE';
    if (button.dataset.route === 'hub') span.textContent = urdu ? 'نووا ہب' : 'NOVA HUB';
  });
  window.dispatchEvent(new CustomEvent('nexusnova:language-changed', { detail: { lang } }));
}

function installConnectivityIndicator() {
  if (window.__nexusFreshConnectivityInstalled) return;
  window.__nexusFreshConnectivityInstalled = true;
  const banner = document.createElement('div');
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  Object.assign(banner.style, {
    position: 'fixed', left: '50%', top: 'max(10px, env(safe-area-inset-top))', transform: 'translateX(-50%)',
    zIndex: '9999', padding: '7px 11px', borderRadius: '999px', fontSize: '11px', fontWeight: '800',
    backdropFilter: 'blur(14px)', border: '1px solid rgba(148,163,184,.22)', background: 'rgba(7,17,31,.9)',
    color: '#dbeafe', pointerEvents: 'none', opacity: '0', transition: 'opacity .2s ease'
  });
  document.body.appendChild(banner);
  let timer = 0;
  const paint = (announce = false) => {
    const online = navigator.onLine !== false;
    document.body.classList.toggle('nx-offline', !online);
    if (!announce && online) return;
    banner.textContent = online ? 'NexusNova is online' : 'NexusNova is offline • local tools may still work';
    banner.style.opacity = '1';
    clearTimeout(timer);
    timer = setTimeout(() => { banner.style.opacity = '0'; }, online ? 1800 : 4200);
  };
  window.addEventListener('online', () => paint(true));
  window.addEventListener('offline', () => paint(true));
  paint(false);
  applyLanguagePreference();
}
installConnectivityIndicator();

function renderMarketEnhanced() {
  const root = coreRenderers.market();
  const panel = document.createElement('section');
  panel.className = 'nx-tool-card';
  panel.innerHTML = `
    <strong>Price Alerts</strong>
    <div class="nx-two-col">
      <label class="nx-field"><span>Symbol</span><input maxlength="15" data-alert-symbol placeholder="BTC"></label>
      <label class="nx-field"><span>Target USD</span><input type="number" min="0" step="any" inputmode="decimal" data-alert-price placeholder="100000"></label>
    </div>
    <label class="nx-field"><span>Trigger</span><select data-alert-dir><option value="above">At or above target</option><option value="below">At or below target</option></select></label>
    <div class="nx-two-col"><button class="nx-primary" type="button" data-alert-add>ADD ALERT</button><button type="button" data-alert-check>CHECK NOW</button></div>
    <p class="nx-tool-meta" data-alert-status>Alerts use live market prices while this Market screen is open.</p>
    <div class="nx-stack" data-alert-list></div>
  `;
  root.appendChild(panel);
  const symbol = panel.querySelector('[data-alert-symbol]');
  const price = panel.querySelector('[data-alert-price]');
  const dir = panel.querySelector('[data-alert-dir]');
  const status = panel.querySelector('[data-alert-status]');
  const list = panel.querySelector('[data-alert-list]');
  const notified = new Map();
  let busy = false;
  let timer = null;

  const readAlerts = () => {
    const rows = loadJson(ALERTS_KEY, []);
    return Array.isArray(rows) ? rows.filter(row => /^[A-Z0-9._-]{1,15}$/.test(String(row?.symbol || '')) && Number(row?.price) > 0 && ['above','below'].includes(row?.dir)) : [];
  };
  const draw = () => {
    const rows = readAlerts();
    list.innerHTML = rows.length ? rows.map(row => `<article class="nx-list-card"><div class="nx-list-card__head"><strong>${escapeHtml(row.symbol)}</strong><button class="nx-icon-button" type="button" data-alert-delete="${escapeHtml(String(row.id))}">×</button></div><p>${row.dir === 'above' ? '≥' : '≤'} $${Number(row.price).toLocaleString()}</p></article>`).join('') : '<div class="nx-empty">No price alerts set.</div>';
    list.querySelectorAll('[data-alert-delete]').forEach(button => button.addEventListener('click', () => {
      saveJson(ALERTS_KEY, readAlerts().filter(row => String(row.id) !== button.dataset.alertDelete));
      draw();
    }));
  };

  const check = async () => {
    const alerts = readAlerts();
    if (!alerts.length || busy || navigator.onLine === false) return;
    busy = true;
    status.textContent = 'Checking live market prices…';
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false', { cache:'no-store' });
      if (!response.ok) throw new Error(`Market HTTP ${response.status}`);
      const data = await response.json();
      const prices = new Map((Array.isArray(data) ? data : []).map(coin => [String(coin.symbol || '').toUpperCase(), Number(coin.current_price)]));
      const hits = [];
      alerts.forEach(alert => {
        const live = prices.get(alert.symbol);
        if (!Number.isFinite(live)) return;
        const hit = alert.dir === 'above' ? live >= Number(alert.price) : live <= Number(alert.price);
        if (!hit) { notified.delete(String(alert.id)); return; }
        hits.push(`${alert.symbol} $${live.toLocaleString()}`);
        if (notified.has(String(alert.id))) return;
        notified.set(String(alert.id), Date.now());
        if ('Notification' in window && Notification.permission === 'granted') {
          try { new Notification(`NexusNova Alert: ${alert.symbol}`, { body: `${alert.symbol} is $${live.toLocaleString()} (${alert.dir} $${Number(alert.price).toLocaleString()})` }); } catch {}
        }
      });
      status.textContent = hits.length ? `Triggered: ${hits.join(' • ')}` : 'Live check complete • no alerts triggered.';
    } catch (error) {
      status.textContent = 'Live price alert check unavailable. No guessed prices were used.';
      console.warn('[NexusNova Fresh] price alerts:', error);
    } finally { busy = false; }
  };

  panel.querySelector('[data-alert-add]').addEventListener('click', async () => {
    const cleanSymbol = symbol.value.trim().toUpperCase();
    const target = Number(price.value);
    if (!/^[A-Z0-9._-]{1,15}$/.test(cleanSymbol) || !(target > 0)) {
      status.textContent = 'Enter a valid symbol and target price.';
      return;
    }
    const rows = readAlerts();
    rows.push({ id: uid('alert'), symbol: cleanSymbol, price: target, dir: dir.value, created: new Date().toISOString() });
    saveJson(ALERTS_KEY, rows.slice(-100));
    symbol.value = ''; price.value = '';
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch {}
    }
    status.textContent = 'Price alert saved.';
    draw(); check();
  });
  panel.querySelector('[data-alert-check]').addEventListener('click', check);
  draw();
  timer = setInterval(check, 60_000);
  const baseCleanup = root.__cleanup;
  root.__cleanup = () => { clearInterval(timer); baseCleanup?.(); };
  return root;
}

function walletProvider() {
  const eth = window.ethereum;
  if (!eth) return null;
  const list = Array.isArray(eth.providers) ? eth.providers : [eth];
  return list.find(item => item?.isRabby) || list[0] || null;
}

function ensureWalletLivingStyles() {
  if (document.getElementById('nx-wallet-living-v1')) return;
  const style = document.createElement('style');
  style.id = 'nx-wallet-living-v1';
  style.textContent = `
    .nx-wallet-living{
      --wallet-x:50%;--wallet-y:18%;display:grid!important;gap:13px!important;padding-bottom:12px!important;
      perspective:1000px;isolation:isolate;
    }
    .nx-wallet-living>.nx-wallet-hero{
      position:relative;overflow:hidden;min-height:190px!important;padding:22px 21px 20px!important;border-radius:28px!important;
      border:1px solid rgba(255,255,255,.14)!important;
      background:
        radial-gradient(circle at var(--wallet-x) var(--wallet-y),rgba(131,244,255,.19),transparent 20%),
        radial-gradient(circle at 88% 82%,rgba(126,75,255,.16),transparent 30%),
        linear-gradient(122deg,rgba(255,255,255,.075),transparent 18% 78%,rgba(255,255,255,.028)),
        linear-gradient(155deg,#1b222c 0%,#0b1018 43%,#05070c 100%)!important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.18),inset 0 -2px 0 rgba(0,0,0,.96),
        inset 16px 0 34px rgba(78,217,255,.025),0 18px 34px rgba(0,0,0,.40),0 0 0 1px rgba(0,0,0,.75)!important;
      transform:rotateX(.35deg) translateZ(0);transition:transform .18s ease,filter .18s ease;
    }
    .nx-wallet-living>.nx-wallet-hero::before{
      content:'';position:absolute;right:-70px;top:-82px;width:230px;height:230px;border-radius:50%;
      border:1px solid rgba(138,229,255,.16);box-shadow:inset 0 0 62px rgba(55,211,255,.055),0 0 50px rgba(106,70,255,.07);
      animation:nxWalletOrbit 11s linear infinite;pointer-events:none;
    }
    .nx-wallet-living>.nx-wallet-hero::after{
      content:'';position:absolute;inset:-35% -55%;pointer-events:none;
      background:linear-gradient(108deg,transparent 42%,rgba(255,255,255,.075) 49%,transparent 56%);
      transform:translateX(-45%);animation:nxWalletSheen 7.5s ease-in-out infinite;
    }
    .nx-wallet-living>.nx-wallet-hero .nx-eyebrow{position:relative;z-index:2;color:#97efff;letter-spacing:.20em;text-shadow:0 0 18px rgba(83,222,255,.26)}
    .nx-wallet-living>.nx-wallet-hero>span{position:relative;z-index:2;display:block;margin-top:15px;color:#8997a7;font-size:10px;font-weight:850;letter-spacing:.08em;text-transform:uppercase}
    .nx-wallet-living>.nx-wallet-hero>strong{position:relative;z-index:2;display:block;margin-top:5px;color:#f8fbff;font-size:clamp(32px,9vw,46px)!important;line-height:1;letter-spacing:-.05em;font-variant-numeric:tabular-nums;text-shadow:0 2px 0 #000,0 0 24px rgba(100,229,255,.08)}
    .nx-wallet-living>.nx-wallet-hero>small{position:relative;z-index:2;display:block;margin-top:12px;max-width:82%;color:#778697;font-size:9px;line-height:1.45}
    .nx-wallet-mainnet-note{position:relative;z-index:3;margin-top:16px;display:flex;align-items:center;gap:9px;padding:9px 11px;border:1px solid rgba(184,146,255,.14);border-radius:14px;background:linear-gradient(180deg,rgba(132,80,255,.09),rgba(31,23,62,.10));box-shadow:inset 0 1px 0 rgba(255,255,255,.055)}
    .nx-wallet-mainnet-note i{flex:0 0 28px;width:28px;height:28px;display:grid;place-items:center;border-radius:9px;border:1px solid rgba(179,147,255,.19);background:linear-gradient(145deg,rgba(142,91,255,.40),rgba(57,39,112,.42));box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 5px 10px rgba(0,0,0,.20);font-style:normal;font-size:12px}
    .nx-wallet-mainnet-note span{color:#bdc5d2!important;font-size:8.6px!important;line-height:1.35;text-transform:none!important;letter-spacing:.02em!important;margin:0!important}

    .nx-wallet-living>.nx-tool-card{
      position:relative;overflow:hidden;padding:16px!important;border-radius:25px!important;border:1px solid rgba(255,255,255,.105)!important;
      background:
        linear-gradient(118deg,rgba(255,255,255,.045),transparent 20% 82%,rgba(255,255,255,.02)),
        linear-gradient(155deg,#151b23 0%,#090d13 57%,#05070b 100%)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.13),inset 0 -2px 0 rgba(0,0,0,.94),0 17px 32px rgba(0,0,0,.34),0 0 0 1px rgba(0,0,0,.62)!important;
    }
    .nx-wallet-living>.nx-tool-card::before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at var(--wallet-x) var(--wallet-y),rgba(82,222,255,.055),transparent 28%)}
    .nx-wallet-living .nx-list-card__head{position:relative;z-index:2;align-items:center!important;gap:11px}
    .nx-wallet-living .nx-list-card__head strong{font-size:15px;color:#f2f6fb;text-shadow:0 1px 0 #000}
    .nx-wallet-living [data-wallet-network]{color:#78899a!important;font-size:8.5px!important;letter-spacing:.04em}
    .nx-wallet-living [data-wallet-connect]{
      min-width:102px;min-height:46px;padding:0 13px!important;border:1px solid rgba(111,228,255,.26)!important;border-radius:15px!important;
      background:linear-gradient(180deg,#30c8ec 0%,#1183ad 43%,#07506f 100%)!important;
      box-shadow:inset 0 2px 1px rgba(255,255,255,.42),inset 0 -6px 9px rgba(0,0,0,.27),0 5px 0 #032b3e,0 10px 18px rgba(0,0,0,.32),0 0 22px rgba(48,200,236,.10)!important;
      color:#f8fdff!important;font-size:8px!important;font-weight:1000!important;letter-spacing:.10em!important;text-shadow:0 1px 1px rgba(0,0,0,.75);transform:translateY(-2px);transition:transform .10s ease,box-shadow .10s ease,filter .14s linear;
    }
    .nx-wallet-living [data-wallet-connect]:not(:disabled):active{transform:translateY(3px)!important;box-shadow:inset 0 3px 6px rgba(0,0,0,.26),inset 0 -1px 1px rgba(255,255,255,.14),0 1px 0 #032b3e,0 4px 8px rgba(0,0,0,.26)!important}
    .nx-wallet-living [data-wallet-connect]:disabled{opacity:.62!important;filter:saturate(.6)}
    .nx-wallet-living .nx-wallet-address{
      position:relative;z-index:2;margin-top:17px!important;min-height:54px;display:flex;align-items:center;padding:0 14px!important;border-radius:16px!important;
      border:1px solid rgba(105,226,255,.10)!important;background:linear-gradient(180deg,#05090e,#020407)!important;
      box-shadow:inset 0 3px 9px rgba(0,0,0,.9),inset 0 -1px 0 rgba(255,255,255,.035),0 1px 0 rgba(255,255,255,.035)!important;
      color:#93a9ba!important;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px!important;letter-spacing:.03em;
    }
    .nx-wallet-living [data-wallet-assets]{position:relative;z-index:2;margin-top:10px!important;gap:7px!important}
    .nx-wallet-living [data-wallet-assets] .nx-world-row{min-height:52px;padding:0 13px!important;border:1px solid rgba(255,255,255,.075);border-radius:15px;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(0,0,0,.13));box-shadow:inset 0 1px 0 rgba(255,255,255,.055),0 5px 10px rgba(0,0,0,.15)}
    .nx-wallet-living [data-wallet-total]{position:relative;z-index:2;margin-top:12px!important;min-height:72px!important;display:flex;align-items:center;padding:0 16px!important;border-radius:18px!important;border:1px solid rgba(120,222,255,.13)!important;background:radial-gradient(circle at 90% 20%,rgba(89,211,255,.10),transparent 30%),linear-gradient(150deg,#101c27,#071018)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.09),inset 0 -2px 0 rgba(0,0,0,.65),0 8px 15px rgba(0,0,0,.18)!important;color:#eef8ff!important;font-size:15px!important;font-weight:950!important;text-shadow:0 1px 0 #000}
    .nx-wallet-living [data-wallet-status]{position:relative;z-index:2;margin:12px 2px 0!important;color:#697b8c!important;font-size:8.4px!important;line-height:1.45!important}

    .nx-wallet-gateway{position:relative;z-index:2;margin-top:12px;padding:12px;border:1px solid rgba(148,126,255,.13);border-radius:18px;background:linear-gradient(155deg,rgba(37,31,68,.28),rgba(6,12,20,.58));box-shadow:inset 0 1px 0 rgba(255,255,255,.045)}
    .nx-wallet-gateway[hidden]{display:none!important}
    .nx-wallet-gateway-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.nx-wallet-gateway-head strong{font-size:10px!important;letter-spacing:.08em;color:#dcd8ff!important}.nx-wallet-gateway-head span{font-size:7px;color:#7e789e;letter-spacing:.08em}
    .nx-wallet-gateway p{margin:8px 0 10px;color:#718094;font-size:8.2px;line-height:1.4}
    .nx-wallet-gateway-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
    .nx-wallet-gateway-grid a{min-width:0;min-height:44px;display:grid;place-items:center;padding:0 6px;border:1px solid rgba(255,255,255,.11);border-radius:13px;background:linear-gradient(180deg,#202833,#0b1017 60%,#07090d);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),inset 0 -4px 7px rgba(0,0,0,.28),0 4px 0 #030508,0 7px 12px rgba(0,0,0,.22);color:#dfe8f0;text-decoration:none;font-size:7.2px;font-weight:950;letter-spacing:.045em;text-align:center;transform:translateY(-1px)}
    .nx-wallet-gateway-grid a:active{transform:translateY(3px);box-shadow:inset 0 2px 5px rgba(0,0,0,.28),0 1px 0 #030508}
    .nx-wallet-gateway-check{width:100%;min-height:42px;margin-top:9px;border:1px solid rgba(103,222,255,.16);border-radius:13px;background:linear-gradient(180deg,#123d51,#092737);box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 4px 0 #03141d;color:#c9f5ff;font-size:7.5px;font-weight:950;letter-spacing:.08em}

    .nx-wallet-qr-card>strong{position:relative;z-index:2;display:block;font-size:15px;color:#f2f6fb}.nx-wallet-qr-card [data-wallet-qr-status]{position:relative;z-index:2;margin-top:7px!important;color:#758596!important;font-size:8.5px!important}.nx-wallet-qr-card [data-wallet-qr]{position:relative;z-index:2;width:100%;min-height:50px;margin-top:13px;border:1px solid rgba(182,158,255,.18)!important;border-radius:15px!important;background:linear-gradient(180deg,#6652b5,#382b73 60%,#241b50)!important;box-shadow:inset 0 2px 1px rgba(255,255,255,.24),inset 0 -5px 8px rgba(0,0,0,.26),0 5px 0 #15102f,0 10px 17px rgba(0,0,0,.27)!important;color:#fff!important;font-size:8.5px!important;font-weight:1000!important;letter-spacing:.09em!important;transform:translateY(-2px)}
    .nx-wallet-qr-card [data-wallet-qr]:active{transform:translateY(3px)!important;box-shadow:inset 0 3px 6px rgba(0,0,0,.3),0 1px 0 #15102f!important}

    @keyframes nxWalletOrbit{to{transform:rotate(360deg)}}
    @keyframes nxWalletSheen{0%,20%{transform:translateX(-52%)}62%,100%{transform:translateX(52%)}}
    @media(max-width:380px){.nx-wallet-living>.nx-wallet-hero{min-height:180px!important;padding:19px 18px!important}.nx-wallet-living [data-wallet-connect]{min-width:92px}.nx-wallet-gateway-grid{grid-template-columns:1fr}.nx-wallet-gateway-grid a{min-height:42px}}
    @media(prefers-reduced-motion:reduce){.nx-wallet-living>.nx-wallet-hero::before,.nx-wallet-living>.nx-wallet-hero::after{animation:none!important}.nx-wallet-living>.nx-wallet-hero,.nx-wallet-living [data-wallet-connect],.nx-wallet-gateway-grid a,.nx-wallet-qr-card [data-wallet-qr]{transition:none!important}}
  `;
  document.head.appendChild(style);
}

function renderWalletEnhanced() {
  const root = coreRenderers.wallet();
  ensureWalletLivingStyles();
  root.classList.add('nx-wallet-living');

  const hero = root.querySelector('.nx-wallet-hero');
  const heroCopy = hero?.querySelector('small');
  if (heroCopy) heroCopy.textContent = 'Your mined NVX stays secured in your NexusNova account while external EVM assets remain separate.';
  if (hero) {
    const mainnet = document.createElement('div');
    mainnet.className = 'nx-wallet-mainnet-note';
    mainnet.innerHTML = '<i aria-hidden="true">◆</i><span>NVX withdrawals will unlock with the official NexusNova mainnet launch.</span>';
    hero.appendChild(mainnet);
  }

  const evmPanel = root.querySelector('.nx-tool-card');
  const connect = root.querySelector('[data-wallet-connect]');
  const status = root.querySelector('[data-wallet-status]');
  const address = root.querySelector('[data-wallet-address]');
  if (evmPanel) evmPanel.classList.add('nx-wallet-evm-card');

  const gateway = document.createElement('div');
  gateway.className = 'nx-wallet-gateway';
  gateway.hidden = true;
  gateway.innerHTML = `
    <div class="nx-wallet-gateway-head"><strong>EVM WALLET GATEWAY</strong><span>EXTERNAL APP</span></div>
    <p>This Android WebView has no injected EVM provider. Open a compatible wallet app, then return and check again. A wallet is never marked connected until a real provider session is detected.</p>
    <div class="nx-wallet-gateway-grid">
      <a href="https://metamask.app.link/" data-wallet-launch>METAMASK</a>
      <a href="https://link.trustwallet.com/" data-wallet-launch>TRUST WALLET</a>
      <a href="https://go.cb-w.com/" data-wallet-launch>COINBASE</a>
    </div>
    <button class="nx-wallet-gateway-check" type="button" data-wallet-check-provider>CHECK PROVIDER AGAIN</button>
  `;
  address?.insertAdjacentElement('afterend', gateway);

  if (!walletProvider() && connect) {
    connect.disabled = false;
    connect.textContent = 'CONNECT EVM';
    if (status) status.textContent = 'Tap CONNECT EVM to open the secure wallet gateway. NexusNova only reads balances after a real EVM provider session is available.';
  }

  const openGateway = event => {
    if (walletProvider()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    gateway.hidden = !gateway.hidden;
    connect?.setAttribute('aria-expanded', gateway.hidden ? 'false' : 'true');
  };
  connect?.addEventListener('click', openGateway, true);

  gateway.querySelector('[data-wallet-check-provider]').addEventListener('click', () => {
    const detected = walletProvider();
    if (detected) {
      gateway.hidden = true;
      if (status) status.textContent = 'EVM provider detected. Tap CONNECT EVM to approve the wallet connection.';
      connect?.click();
      return;
    }
    if (status) status.textContent = 'No injected EVM provider detected yet. A true in-app WalletConnect session needs a configured WalletConnect/Reown connector.';
  });

  const panel = document.createElement('section');
  panel.className = 'nx-tool-card nx-wallet-qr-card';
  panel.innerHTML = `<strong>Wallet Address QR</strong><p class="nx-tool-meta" data-wallet-qr-status>Connect a verified external EVM wallet, then generate its address QR.</p><button class="nx-primary" type="button" data-wallet-qr>SHOW ADDRESS QR</button><div data-wallet-qr-box hidden style="text-align:center;margin-top:12px"></div>`;
  root.appendChild(panel);
  const qrStatus = panel.querySelector('[data-wallet-qr-status]');
  const box = panel.querySelector('[data-wallet-qr-box]');
  panel.querySelector('[data-wallet-qr]').addEventListener('click', async () => {
    const activeProvider = walletProvider();
    if (!activeProvider?.request) { qrStatus.textContent = 'Connect a compatible EVM provider first.'; return; }
    try {
      const accounts = await activeProvider.request({ method:'eth_accounts', params:[] });
      const walletAddress = String(accounts?.[0] || '');
      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) { qrStatus.textContent = 'Connect the external wallet first.'; return; }
      const src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(walletAddress)}`;
      box.innerHTML = `<img src="${src}" width="220" height="220" alt="Wallet address QR" style="max-width:100%;border-radius:12px;background:#fff;padding:8px"><p class="nx-tool-meta" style="word-break:break-all">${escapeHtml(walletAddress)}</p>`;
      box.hidden = false;
      qrStatus.textContent = 'QR generated from the currently connected EVM address.';
    } catch (error) {
      qrStatus.textContent = error?.message || 'Could not read the connected wallet address.';
    }
  });

  let raf = 0;
  const move = event => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const point = event.touches?.[0] || event;
    const rect = root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const x = Math.max(0, Math.min(100, ((point.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((point.clientY - rect.top) / rect.height) * 100));
      root.style.setProperty('--wallet-x', `${x.toFixed(1)}%`);
      root.style.setProperty('--wallet-y', `${y.toFixed(1)}%`);
    });
  };
  root.addEventListener('pointermove', move, { passive:true });
  root.addEventListener('touchmove', move, { passive:true });

  const baseCleanup = root.__cleanup;
  root.__cleanup = () => {
    cancelAnimationFrame(raf);
    root.removeEventListener('pointermove', move);
    root.removeEventListener('touchmove', move);
    connect?.removeEventListener('click', openGateway, true);
    baseCleanup?.();
  };
  return root;
}

function renderSettingsEnhanced() {
  const root = coreRenderers.settings();
  const panel = document.createElement('section');
  panel.className = 'nx-tool-card';
  panel.innerHTML = `
    <strong>App Preferences</strong>
    <div class="nx-setting-row"><div><strong>Navigation language</strong><span data-lang-label>English</span></div><button type="button" data-lang-toggle>اردو / EN</button></div>
    <div class="nx-setting-row"><div><strong>Share NexusNova</strong><span>Use Android/system share when available</span></div><button type="button" data-share>SHARE</button></div>
    <div class="nx-setting-row"><div><strong>Connectivity</strong><span data-online-status>Checking…</span></div><span class="nx-badge" data-online-badge>—</span></div>
    <p class="nx-tool-meta">The language preference preserves the original EN/Urdu navigation toggle. Full dynamic app content remains source-language specific.</p>
  `;
  root.appendChild(panel);
  const label = panel.querySelector('[data-lang-label]');
  const onlineStatus = panel.querySelector('[data-online-status]');
  const onlineBadge = panel.querySelector('[data-online-badge]');
  const paintLang = () => { label.textContent = currentLanguage() === 'ur' ? 'اردو' : 'English'; };
  const paintOnline = () => {
    const online = navigator.onLine !== false;
    onlineStatus.textContent = online ? 'Internet connection available' : 'Offline • local tools may still work';
    onlineBadge.textContent = online ? 'ONLINE' : 'OFFLINE';
    onlineBadge.classList.toggle('good', online);
  };
  panel.querySelector('[data-lang-toggle]').addEventListener('click', () => {
    const next = currentLanguage() === 'ur' ? 'en' : 'ur';
    localStorage.setItem(LANG_KEY, next);
    applyLanguagePreference(next);
    paintLang();
  });
  panel.querySelector('[data-share]').addEventListener('click', async () => {
    const data = { title:'NexusNova', text:'NexusNova • one grid, every tool, your daily universe.', url:PUBLIC_SHARE_URL };
    try {
      if (navigator.share) await navigator.share(data);
      else if (navigator.clipboard) { await navigator.clipboard.writeText(PUBLIC_SHARE_URL); onlineStatus.textContent = 'NexusNova link copied.'; }
      else throw new Error('Share is unavailable on this device.');
    } catch (error) {
      if (error?.name !== 'AbortError') onlineStatus.textContent = error?.message || 'Share unavailable.';
    }
  });
  window.addEventListener('online', paintOnline);
  window.addEventListener('offline', paintOnline);
  paintLang(); paintOnline();
  const baseCleanup = root.__cleanup;
  root.__cleanup = () => {
    window.removeEventListener('online', paintOnline);
    window.removeEventListener('offline', paintOnline);
    baseCleanup?.();
  };
  return root;
}

export const coreEnhancementRenderers = Object.freeze({
  market: renderMarketEnhanced,
  wallet: renderWalletEnhanced,
  settings: renderSettingsEnhanced
});