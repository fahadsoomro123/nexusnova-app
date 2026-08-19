import { coreRenderers } from './core-apps.js';
import { escapeHtml, loadJson, saveJson, uid } from '../../core/local-store.js';

const ALERTS_KEY = 'nexus_price_alerts_v1';
const LANG_KEY = 'nexus_ui_lang_v1';

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

function renderWalletEnhanced() {
  const root = coreRenderers.wallet();
  const panel = document.createElement('section');
  panel.className = 'nx-tool-card';
  panel.innerHTML = `<strong>Wallet Address QR</strong><p class="nx-tool-meta" data-wallet-qr-status>Connect an external wallet, then generate its address QR.</p><button class="nx-primary" type="button" data-wallet-qr>SHOW ADDRESS QR</button><div data-wallet-qr-box hidden style="text-align:center;margin-top:12px"></div>`;
  root.appendChild(panel);
  const status = panel.querySelector('[data-wallet-qr-status]');
  const box = panel.querySelector('[data-wallet-qr-box]');
  panel.querySelector('[data-wallet-qr]').addEventListener('click', async () => {
    const provider = walletProvider();
    if (!provider?.request) { status.textContent = 'No compatible external wallet provider is available.'; return; }
    try {
      const accounts = await provider.request({ method:'eth_accounts', params:[] });
      const address = String(accounts?.[0] || '');
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) { status.textContent = 'Connect the external wallet first.'; return; }
      const src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(address)}`;
      box.innerHTML = `<img src="${src}" width="220" height="220" alt="Wallet address QR" style="max-width:100%;border-radius:12px;background:#fff;padding:8px"><p class="nx-tool-meta" style="word-break:break-all">${escapeHtml(address)}</p>`;
      box.hidden = false;
      status.textContent = 'QR generated from the currently connected wallet address.';
    } catch (error) {
      status.textContent = error?.message || 'Could not read the connected wallet address.';
    }
  });
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
    const data = { title:'NexusNova', text:'NexusNova • one grid, every tool, your daily universe.', url:location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else if (navigator.clipboard) { await navigator.clipboard.writeText(location.href); onlineStatus.textContent = 'NexusNova link copied.'; }
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
