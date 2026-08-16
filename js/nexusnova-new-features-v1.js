/**
 * NexusNova New Features v1 - 2026-08-11
 * - Price Alerts (localStorage)
 * - Wallet Address QR Code
 * - Language toggle (EN / Roman Urdu)
 * - Quick Share App
 * - Improved offline indicator
 */
(function(){
  'use strict';

  const STORAGE_ALERTS = 'nexus_price_alerts_v1';
  const STORAGE_LANG = 'nexus_ui_lang_v1';
  let currentLang = localStorage.getItem(STORAGE_LANG) || 'en';

  // --- i18n dictionary (key labels) ---
  const i18n = {
    en: {
      startMining: 'START MINING',
      stopMining: 'STOP MINING',
      connectWallet: '🔗 Connect Wallet',
      disconnect: 'Disconnect',
      market: 'Market',
      wallet: 'Wallet',
      news: 'News',
      ai: 'AI',
      family: 'Family',
      emergency: 'Emergency',
      settings: 'Settings',
      profile: 'Profile',
      priceAlerts: 'Price Alerts',
      addAlert: 'Add Alert',
      alertSymbol: 'Symbol (e.g. BTC)',
      alertPrice: 'Target Price (USD)',
      alertAbove: 'Alert when above',
      alertBelow: 'Alert when below',
      noAlerts: 'No price alerts set.',
      qrTitle: 'Wallet QR Code',
      shareApp: 'Share NexusNova',
      offline: 'You are offline',
      online: 'Online',
      langToggle: 'اردو / EN'
    },
    ur: {
      startMining: 'مائننگ شروع کریں',
      stopMining: 'مائننگ بند کریں',
      connectWallet: '🔗 والیٹ جوڑیں',
      disconnect: 'منقطع کریں',
      market: 'مارکیٹ',
      wallet: 'والیٹ',
      news: 'خبریں',
      ai: 'AI',
      family: 'فیملی',
      emergency: 'ایمرجنسی',
      settings: 'سیٹنگز',
      profile: 'پروفائل',
      priceAlerts: 'قیمت الرٹس',
      addAlert: 'الرٹ شامل کریں',
      alertSymbol: 'سمبل (جیسے BTC)',
      alertPrice: 'ہدف قیمت (USD)',
      alertAbove: 'اوپر جانے پر الرٹ',
      alertBelow: 'نیچے آنے پر الرٹ',
      noAlerts: 'کوئی قیمت الرٹ سیٹ نہیں۔',
      qrTitle: 'والیٹ QR کوڈ',
      shareApp: 'NexusNova شیئر کریں',
      offline: 'آپ آف لائن ہیں',
      online: 'آن لائن',
      langToggle: 'EN / اردو'
    }
  };

  function t(key){
    return (i18n[currentLang] && i18n[currentLang][key]) || i18n.en[key] || key;
  }

  // --- Price Alerts ---
  function getAlerts(){
    try { return JSON.parse(localStorage.getItem(STORAGE_ALERTS) || '[]'); }
    catch(e){ return []; }
  }
  function saveAlerts(list){
    localStorage.setItem(STORAGE_ALERTS, JSON.stringify(list));
  }
  function esc(value){
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  window.addNexusPriceAlert = function(){
    const symbol = (document.getElementById('alertSymbol')?.value || '').trim().toUpperCase();
    const price = parseFloat(document.getElementById('alertPrice')?.value || '0');
    const dir = document.getElementById('alertDir')?.value || 'above';
    if(!/^[A-Z0-9._-]{1,15}$/.test(symbol) || !price || price <= 0){
      alert('Please enter a valid coin symbol and price.');
      return;
    }
    const list = getAlerts();
    list.push({ id: Date.now(), symbol, price, dir, created: new Date().toISOString() });
    saveAlerts(list);
    renderPriceAlerts();
    if(document.getElementById('alertSymbol')) document.getElementById('alertSymbol').value = '';
    if(document.getElementById('alertPrice')) document.getElementById('alertPrice').value = '';
  };

  window.removeNexusPriceAlert = function(id){
    const list = getAlerts().filter(a => a.id !== id);
    saveAlerts(list);
    renderPriceAlerts();
  };

  function renderPriceAlerts(){
    const box = document.getElementById('priceAlertsList');
    if(!box) return;
    const list = getAlerts();
    if(!list.length){
      box.innerHTML = `<div class="muted" style="padding:10px;color:#94a3b8">${t('noAlerts')}</div>`;
      return;
    }
    box.innerHTML = list.map(a => `
      <div class="alert-row" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid #263449;font-size:13px">
        <span><b>${esc(a.symbol)}</b> ${a.dir === 'above' ? '≥' : '≤'} $${Number(a.price).toLocaleString()}</span>
        <button onclick="removeNexusPriceAlert(${a.id})" style="background:#ef4444;color:#fff;border:0;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px">✕</button>
      </div>
    `).join('');
  }

  // Check alerts against live prices (called from market refresh if available)
  window.checkNexusPriceAlerts = function(priceMap){
    if(!priceMap) return;
    const list = getAlerts();
    list.forEach(a => {
      const p = priceMap[a.symbol] || priceMap[a.symbol + 'USDT'];
      if(p == null) return;
      const hit = (a.dir === 'above' && p >= a.price) || (a.dir === 'below' && p <= a.price);
      if(hit){
        try {
          if(Notification.permission === 'granted'){
            new Notification(`NexusNova Alert: ${a.symbol}`, {
              body: `${a.symbol} is now $${Number(p).toFixed(4)} (${a.dir} $${a.price})`,
              icon: '/favicon.ico'
            });
          }
        } catch(e){}
        // Also show in-app toast if possible
        const status = document.getElementById('walletActionStatus') || document.getElementById('aiVoiceStatus');
        if(status){
          status.textContent = `🔔 ${a.symbol} hit $${Number(p).toFixed(4)}`;
          status.style.color = '#00ffcc';
        }
      }
    });
  };

  // --- Wallet QR ---
  window.showNexusWalletQR = function(){
    const addrEl = document.getElementById('connectedWalletAddress');
    const addr = (addrEl?.textContent || '').trim();
    if(!addr || addr.length < 10 || addr.includes('Not connected') || addr.includes('—')){
      alert('Connect a wallet first to generate QR.');
      return;
    }
    let modal = document.getElementById('nexusQrModal');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'nexusQrModal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px';
      modal.innerHTML = `
        <div style="background:#151b27;border:1px solid #263449;border-radius:16px;padding:20px;max-width:320px;width:100%;text-align:center">
          <h3 style="color:#00ffcc;margin-bottom:12px">${t('qrTitle')}</h3>
          <div id="nexusQrCanvasWrap" style="display:flex;justify-content:center;margin:12px 0"></div>
          <div id="nexusQrAddr" style="font-size:11px;color:#94a3b8;word-break:break-all;margin-bottom:12px"></div>
          <button onclick="document.getElementById('nexusQrModal').remove()" style="background:#00ffcc;color:#0b0f17;border:0;border-radius:8px;padding:10px 18px;font-weight:bold;cursor:pointer">Close</button>
        </div>`;
      document.body.appendChild(modal);
    }
    document.getElementById('nexusQrAddr').textContent = addr;
    const wrap = document.getElementById('nexusQrCanvasWrap');
    wrap.innerHTML = '';
    // Simple QR using Google Charts API (no extra lib)
    const img = document.createElement('img');
    img.alt = 'QR';
    img.width = 200;
    img.height = 200;
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(addr);
    img.style.borderRadius = '8px';
    img.style.background = '#fff';
    wrap.appendChild(img);
  };

  // --- Language toggle ---
  window.toggleNexusLang = function(){
    currentLang = currentLang === 'en' ? 'ur' : 'en';
    localStorage.setItem(STORAGE_LANG, currentLang);
    applyLang();
  };

  function applyLang(){
    // Update known dynamic buttons if present
    const map = [
      ['mineBtn', 'startMining'], // may be dynamic
      ['connectWalletBtn', 'connectWallet'],
      // bottom nav spans are harder; skip heavy rewrite
    ];
    // Update language button itself
    const btn = document.getElementById('nexusLangBtn');
    if(btn) btn.textContent = t('langToggle');

    // Update price alerts labels
    const labels = {
      'labelAlertTitle': 'priceAlerts',
      'btnAddAlert': 'addAlert',
      'labelAlertSymbol': 'alertSymbol',
      'labelAlertPrice': 'alertPrice'
    };
    Object.keys(labels).forEach(id => {
      const el = document.getElementById(id);
      if(el) el.textContent = t(labels[id]);
    });
    renderPriceAlerts();
  }

  // --- Share ---
  window.shareNexusNova = async function(){
    const data = {
      title: 'NexusNova',
      text: 'All-in-one digital utility • AI, Wallet, Mining, News & Family Hub',
      url: window.location.href
    };
    try {
      if(navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      }
    } catch(e){}
  };

  // --- Offline indicator ---
  function updateOnlineStatus(){
    const dots = document.querySelectorAll('.online-dot');
    const statusText = document.querySelector('.top-header [style*="font-size:11px"]');
    const online = navigator.onLine;
    dots.forEach(d => {
      d.style.background = online ? '#22c55e' : '#ef4444';
    });
    if(statusText){
      // preserve structure
    }
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // Request notification permission early (optional)
  function initNotif(){
    if('Notification' in window && Notification.permission === 'default'){
      // don't force; user can enable later
    }
  }

  // Inject UI pieces when DOM ready
  function injectUI(){
    // Language button in header
    const headerInner = document.querySelector('.header-inner');
    if(headerInner && !document.getElementById('nexusLangBtn')){
      const btn = document.createElement('button');
      btn.id = 'nexusLangBtn';
      btn.textContent = t('langToggle');
      btn.onclick = toggleNexusLang;
      btn.style.cssText = 'background:transparent;border:1px solid #334155;color:#94a3b8;border-radius:8px;padding:4px 8px;font-size:11px;cursor:pointer;margin-left:8px';
      headerInner.appendChild(btn);
    }

    // Price Alerts panel inside Market tab
    const marketTab = document.getElementById('tab-market');
    if(marketTab && !document.getElementById('priceAlertsPanel')){
      const panel = document.createElement('div');
      panel.id = 'priceAlertsPanel';
      panel.className = 'card';
      panel.style.marginTop = '16px';
      panel.innerHTML = `
        <h3 id="labelAlertTitle" style="margin-bottom:10px">🔔 ${t('priceAlerts')}</h3>
        <div style="display:grid;gap:8px;margin-bottom:10px">
          <input id="alertSymbol" placeholder="${t('alertSymbol')}" style="width:100%;padding:10px;background:#0f1724;border:1px solid #334155;border-radius:8px;color:#fff">
          <input id="alertPrice" type="number" step="any" placeholder="${t('alertPrice')}" style="width:100%;padding:10px;background:#0f1724;border:1px solid #334155;border-radius:8px;color:#fff">
          <select id="alertDir" style="width:100%;padding:10px;background:#0f1724;border:1px solid #334155;border-radius:8px;color:#fff">
            <option value="above">${t('alertAbove')}</option>
            <option value="below">${t('alertBelow')}</option>
          </select>
          <button id="btnAddAlert" onclick="addNexusPriceAlert()" style="background:#00ffcc;color:#0b0f17;border:0;border-radius:8px;padding:10px;font-weight:bold;cursor:pointer">${t('addAlert')}</button>
        </div>
        <div id="priceAlertsList"></div>
      `;
      marketTab.appendChild(panel);
      renderPriceAlerts();
    }

    // QR button next to connect wallet
    const connectBtn = document.getElementById('connectWalletBtn');
    if(connectBtn && !document.getElementById('showQrBtn')){
      const qrBtn = document.createElement('button');
      qrBtn.id = 'showQrBtn';
      qrBtn.className = connectBtn.className || '';
      qrBtn.textContent = '📷 QR';
      qrBtn.title = t('qrTitle');
      qrBtn.onclick = showNexusWalletQR;
      qrBtn.style.marginLeft = '8px';
      connectBtn.parentNode.insertBefore(qrBtn, connectBtn.nextSibling);
    }

    // Share button in Settings / About
    const aboutTab = document.getElementById('tab-about') || document.getElementById('tab-profile');
    if(aboutTab && !document.getElementById('shareNexusBtn')){
      const shareBtn = document.createElement('button');
      shareBtn.id = 'shareNexusBtn';
      shareBtn.className = 'settings-btn';
      shareBtn.textContent = '📤 ' + t('shareApp');
      shareBtn.onclick = shareNexusNova;
      shareBtn.style.cssText = 'margin-top:12px;width:100%;padding:12px;background:#1e293b;border:1px solid #334155;color:#00ffcc;border-radius:10px;cursor:pointer';
      aboutTab.appendChild(shareBtn);
    }

    updateOnlineStatus();
    applyLang();
    initNotif();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', injectUI);
  } else {
    // delay a bit so page2.js auth / tabs exist
    setTimeout(injectUI, 800);
  }

  // Expose for debugging
  window.__nexusNewFeatures = { t, getAlerts, currentLang: () => currentLang };
})();

/* NexusNova Reader/Popup Polish bootstrap — additive only. */
(function loadNexusReaderPolish(){
  'use strict';
  if (window.__nxReaderPopupPolishBootstrapV2) return;
  window.__nxReaderPopupPolishBootstrapV2 = true;

  if (!document.querySelector('link[data-nx-reader-popup-v2]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './css/nexusnova-reader-popup-v2.css?v=20260816';
    link.dataset.nxReaderPopupV2 = '1';
    document.head.appendChild(link);
  }

  function loadScript(src, key) {
    if (document.querySelector(`script[data-nx-addon="${key}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.dataset.nxAddon = key;
    script.onerror = () => console.warn('NexusNova additive UI file unavailable:', key);
    document.head.appendChild(script);
  }

  loadScript('./js/nexusnova-scripture-reader-polish-v1.js?v=20260816', 'scripture-reader-polish');
  loadScript('./js/nexusnova-quran-highlights-v1.js?v=20260816', 'quran-sacred-highlights');
})();