/* NexusNova Final User Fixes v1
   Purpose: requested stability/UX fixes while preserving approved visual design.
*/
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const fetchJson = async (url, timeout = 9000) => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeout);
    try {
      const r = await fetch(url, { cache: 'no-store', signal: c.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } finally { clearTimeout(t); }
  };
  const fetchText = async (url, timeout = 15000) => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeout);
    try {
      const r = await fetch(url, { cache: 'no-store', signal: c.signal, mode: 'cors' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } finally { clearTimeout(t); }
  };

  async function fetchTextFromSources(urls, timeout = 15000) {
    let lastError = null;
    for (const url of urls) {
      try {
        const text = await fetchText(url, timeout);
        if (text && text.trim()) return text;
      } catch (err) { lastError = err; }
    }
    throw lastError || new Error('Text source unavailable');
  }

  /* ---------------- One-active bottom navigation ---------------- */
  function setDockForTab(name, explicitButton) {
    $$('.bottom-dock .dock-item').forEach(b => b.classList.remove('active'));
    const core = { home: 0, wallet: 1, tasks: 2, market: 3 };
    if (explicitButton && explicitButton.classList?.contains('dock-item')) {
      explicitButton.classList.add('active');
      return;
    }
    if (Object.prototype.hasOwnProperty.call(core, name)) {
      $$('.bottom-dock .dock-item')[core[name]]?.classList.add('active');
    } else {
      $('moreBtn')?.classList.add('active');
    }
  }
  function restoreDockFromActiveTab() {
    const active = document.querySelector('.tab.active');
    const name = active?.id?.replace(/^tab-/, '') || 'home';
    setDockForTab(name, null);
  }
  function installDockGuard() {
    const original = window.switchTab;
    if (typeof original === 'function' && !original.__nxFinalWrapped) {
      const wrapped = function(name, button) {
        const ok = original.call(this, name, button);
        if (ok !== false) {
          setTimeout(() => setDockForTab(name, button), 0);
          if (name === 'tools') setTimeout(window.nexusBackToTools, 20);
        }
        return ok;
      };
      wrapped.__nxFinalWrapped = true;
      window.switchTab = wrapped;
    }
    document.addEventListener('click', e => {
      const b = e.target.closest('.bottom-dock .dock-item');
      if (!b) return;
      setTimeout(() => {
        if (b.id === 'moreBtn') setDockForTab('__allapps', b);
        else setDockForTab('', b);
      }, 20);
    }, true);
  }

  /* ---------------- Profile repair ---------------- */
  async function installProfileRepair() {
    try {
      const appmod = await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js');
      const authmod = await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js');
      const fsmod = await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js');
      const apps = appmod.getApps();
      if (!apps.length) return;
      const app = apps[0], auth = authmod.getAuth(app), db = fsmod.getFirestore(app);
      const render = async user => {
        if (!user) return;
        const immediateName = user.displayName || 'Miner User';
        if ($('profileName')) $('profileName').textContent = immediateName;
        if ($('profileEmailDisplay')) $('profileEmailDisplay').textContent = user.email || '';
        if ($('profileId')) $('profileId').textContent = user.uid.slice(0, 12) + '...';
        if ($('settingsName')) $('settingsName').textContent = immediateName;
        if ($('settingsEmail')) $('settingsEmail').textContent = user.email || '';
        window.__nexusAuthUser = user;
        try {
          const snap = await fsmod.getDoc(fsmod.doc(db, 'users', user.uid));
          if (!snap.exists()) return;
          const d = snap.data() || {};
          const name = String(d.name || user.displayName || 'Miner User');
          if ($('profileName')) $('profileName').textContent = name;
          if ($('profileEmailDisplay')) $('profileEmailDisplay').textContent = user.email || d.email || '';
          if ($('profileId')) $('profileId').textContent = user.uid.slice(0, 12) + '...';
          if ($('profileTotalMined')) $('profileTotalMined').textContent = `${Number(d.totalMined || 0).toFixed(4)} NVX`;
          if ($('profileTasksDone')) $('profileTasksDone').textContent = String(Number(d.tasksCompleted || 0));
          if ($('settingsName')) $('settingsName').textContent = name;
          if ($('settingsEmail')) $('settingsEmail').textContent = user.email || d.email || '';
          // Referral stays truthful: only show a server-stored referral code.
          // If referral backend setup is not complete, do not invent a working-looking code.
          const ref = String(d.referralCode || '').trim();
          if ($('refCodeDisplay')) $('refCodeDisplay').textContent = ref || 'Not available yet';
        } catch (err) {
          console.warn('Final profile Firestore refresh failed:', err);
        }
      };
      authmod.onAuthStateChanged(auth, render);
      if (auth.currentUser) render(auth.currentUser);
    } catch (err) {
      console.warn('Final profile repair could not initialize:', err);
    }
  }

  /* ---------------- Reliable currency converter ---------------- */
  const FX_CODES = ['USD','PKR','EUR','GBP','AED','SAR','INR','JPY','CAD','AUD','CNY','CHF','TRY','BDT','LKR','NPR','SGD','MYR','THB','IDR','KRW','NZD','ZAR'];
  const FX_CACHE = 'nexusnova_final_fx_v1';
  let fxRates = null, fxPending = null;
  function fxGood(r) { return r && ['USD','PKR','EUR','GBP','AED','SAR','INR'].every(c => Number(r[c]) > 0); }
  function fxCacheRead() {
    try { const x = JSON.parse(localStorage.getItem(FX_CACHE) || 'null'); return fxGood(x?.rates) ? x : null; } catch { return null; }
  }
  function fxCacheSave(rates) { try { localStorage.setItem(FX_CACHE, JSON.stringify({ at: Date.now(), rates })); } catch {} }
  async function getFx(force = false) {
    if (!force && fxGood(fxRates)) return fxRates;
    const cached = fxCacheRead();
    if (!force && cached && Date.now() - cached.at < 24 * 3600e3) return (fxRates = cached.rates);
    if (fxPending) return fxPending;
    fxPending = (async () => {
      let last;
      try {
        const j = await fetchJson('https://open.er-api.com/v6/latest/USD', 7000);
        const r = { USD: 1, ...(j?.rates || {}) };
        if (!fxGood(r)) throw new Error('Primary FX data incomplete');
        fxCacheSave(r); return (fxRates = r);
      } catch (e) { last = e; }

      const openCurrencyFallback = async (url) => {
        const j = await fetchJson(url, 7000);
        const src = j?.usd || {};
        const r = { USD: 1 };
        Object.entries(src).forEach(([code, value]) => {
          const v = Number(value);
          if (v > 0) r[String(code).toUpperCase()] = v;
        });
        if (!fxGood(r)) throw new Error('Fallback FX data incomplete');
        return r;
      };

      for (const url of [
        'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json',
        'https://latest.currency-api.pages.dev/v1/currencies/usd.min.json'
      ]) {
        try {
          const r = await openCurrencyFallback(url);
          fxCacheSave(r); return (fxRates = r);
        } catch (e) { last = e; }
      }

      if (cached?.rates) return (fxRates = cached.rates);
      throw last || new Error('FX unavailable');
    })().finally(() => { fxPending = null; });
    return fxPending;
  }
  function convertValue(amount, from, to, rates) {
    const a = Number(rates[from]), b = Number(rates[to]);
    if (!(a > 0 && b > 0)) throw new Error('Selected currency unavailable');
    return (Number(amount) / a) * b;
  }
  async function finalConvertCurrency(force = false) {
    const mainAmount = $('convertAmount'), mainFrom = $('fromCurrency'), mainTo = $('toCurrency');
    if (!mainAmount || !mainFrom || !mainTo) return;
    const display = $('converterDisplay'), out = $('convertResult');
    if (display) display.textContent = 'Loading live rates...';
    try {
      const rates = await getFx(force);
      const amount = Number(mainAmount.value || 0), from = mainFrom.value, to = mainTo.value;
      if (!Number.isFinite(amount)) throw new Error('Enter a valid amount');
      const result = convertValue(amount, from, to, rates);
      if (out) out.value = result.toFixed(result >= 100 ? 2 : 4);
      if (display) display.textContent = `${amount.toLocaleString()} ${from} = ${result.toLocaleString(undefined,{maximumFractionDigits:4})} ${to}`;
    } catch (err) {
      if (out) out.value = '--';
      if (display) display.textContent = 'Live rates unavailable — change amount/currency to retry.';
    }
  }
  async function finalMoneyConvert(force = false) {
    const amount = Number($('currencyAmount')?.value || 0), from = $('currencyFrom')?.value, to = $('currencyTo')?.value;
    const out = $('currencyResult'), status = $('currencyStatus');
    if (!out || !status || !from || !to) return;
    status.textContent = 'Loading live rates...';
    try {
      const rates = await getFx(force);
      const result = convertValue(amount, from, to, rates);
      out.textContent = `${amount.toLocaleString()} ${from} = ${result.toLocaleString(undefined,{maximumFractionDigits:4})} ${to}`;
      status.textContent = 'Live exchange rates';
    } catch {
      out.textContent = '—'; status.textContent = 'Live rates unavailable — tap Convert to retry.';
    }
  }
  function installCurrency() {
    window.nexusFinalConvertCurrency = finalConvertCurrency;
    window.nexusFinalMoneyConvert = finalMoneyConvert;
    window.convertCurrency = () => finalConvertCurrency(false);
    ['convertAmount','fromCurrency','toCurrency'].forEach(id => $(id)?.addEventListener(id==='convertAmount'?'input':'change', () => finalConvertCurrency(false)));
    const from = $('currencyFrom'), to = $('currencyTo');
    if (from && to) {
      const options = FX_CODES.map(c => `<option value="${c}">${c}</option>`).join('');
      from.innerHTML = options; to.innerHTML = options; from.value = 'USD'; to.value = 'PKR';
      $('convertCurrencyBtn')?.addEventListener('click', () => finalMoneyConvert(true));
      $('currencyAmount')?.addEventListener('input', () => finalMoneyConvert(false));
      from.addEventListener('change', () => finalMoneyConvert(false)); to.addEventListener('change', () => finalMoneyConvert(false));
    }
    finalConvertCurrency(false); finalMoneyConvert(false);
    // page2.js is a module and can finish after classic scripts on slow links.
    // Re-assert the reliable converter after those late initializers.
    [2500, 6000, 12000].forEach(ms => setTimeout(() => {
      window.convertCurrency = () => finalConvertCurrency(false);
    }, ms));
  }

  /* ---------------- Tools navigation ---------------- */
  const TOOL_TITLES = {notes:'Notes',todo:'To-Do',calc:'Calculator',units:'Unit Converter',expense:'Expense Tracker',pomo:'Focus Timer',bmi:'BMI',tip:'Tip Calculator',world:'World Clock',qr:'QR Tools',weather:'Weather',prayer:'Prayer Times',speed:'Internet Speed Test',bills:'Bill Reminders',files:'Files',brief:'Daily Brief',caller:'Caller ID'};
  function installToolsNav() {
    const tab = $('tab-tools'); if (!tab) return;
    const menuCard = tab.querySelector(':scope > .card');
    if (menuCard) {
      menuCard.id = 'toolsMenuCard';
      if (!menuCard.querySelector('.tools-main-back')) {
        const back = document.createElement('button'); back.type='button'; back.className='tool-btn tools-main-back'; back.textContent='← Back to ALL APPS'; back.onclick=window.nexusBackToAllApps;
        menuCard.insertBefore(back, menuCard.firstChild);
      }
    }
    if (!$('toolsDetailHead')) {
      const h = document.createElement('div'); h.id='toolsDetailHead'; h.className='tools-detail-head card';
      h.innerHTML='<button class="tool-btn" type="button">← Back to Tools</button><div id="toolsDetailTitle" class="tools-detail-title">Tool</div>';
      h.querySelector('button').onclick=window.nexusBackToTools;
      menuCard?.insertAdjacentElement('afterend', h);
    }
    const originalShow = window.nexusShowTool;
    if (typeof originalShow === 'function' && !originalShow.__nxFinalWrapped) {
      const wrap = function(id) {
        originalShow.call(this,id);
        tab.classList.add('tools-detail-mode');
        $('toolsDetailHead')?.classList.add('show');
        if ($('toolsDetailTitle')) $('toolsDetailTitle').textContent = TOOL_TITLES[id] || 'Tool';
        window.scrollTo({top:0,behavior:'smooth'});
      }; wrap.__nxFinalWrapped=true; window.nexusShowTool=wrap;
    }
    window.nexusBackToTools();
  }
  window.nexusBackToTools = function() {
    const tab=$('tab-tools'); if(!tab) return;
    tab.classList.remove('tools-detail-mode'); $('toolsDetailHead')?.classList.remove('show');
    $$('.nexus-tool-panel').forEach(p=>p.style.display='none');
    $$('.nexus-tool-chip').forEach(c=>c.classList.remove('active'));
    window.scrollTo({top:0,behavior:'smooth'});
  };
  function showAllAppsMenu() {
    window.nexusStopQRScan?.();
    const m = $('moreMenu');
    if (!m) return false;
    // Older recovery scripts write an inline display:none. Clear that state
    // explicitly so the approved .show CSS can take effect.
    m.style.removeProperty('display');
    m.classList.add('show');
    if (getComputedStyle(m).display === 'none') m.style.display = 'block';
    document.body.classList.add('nx-allapps-open');
    setDockForTab('__allapps', $('moreBtn'));
    return true;
  }
  function hideAllAppsMenu() {
    const m = $('moreMenu');
    if (!m) return;
    m.classList.remove('show');
    m.style.display = 'none';
    document.body.classList.remove('nx-allapps-open');
  }
  window.nexusBackToAllApps = function() {
    window.nexusBackToTools?.();
    document.body.classList.add('nx-opened-from-allapps');
    showAllAppsMenu();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  function targetFromMoreButton(button) {
    if (!button) return '';
    if (button.dataset?.nxmega) return button.dataset.nxmega;
    if (button.dataset?.finalBible) return 'bible';
    const code = String(button.getAttribute('onclick') || '');
    const match = code.match(/openMoreTab\(\s*['"]([^'"]+)['"]\s*\)/);
    return match?.[1] || '';
  }

  function ensureAllAppsBackButtons() {
    const buttons = $$('#moreMenu .more-item');
    const targets = new Set(buttons.map(targetFromMoreButton).filter(Boolean));
    targets.add('bible');
    targets.forEach(name => {
      if (name === 'tools') return; // Tools has its own Back to ALL APPS control.
      const tab = $('tab-' + name);
      if (!tab || tab.querySelector(':scope > .nx-allapps-back')) return;
      const bar = document.createElement('div');
      bar.className = 'nx-allapps-back';
      bar.innerHTML = '<button class="tool-btn" type="button">← Back to ALL APPS</button>';
      bar.querySelector('button').addEventListener('click', window.nexusBackToAllApps);
      tab.insertBefore(bar, tab.firstChild);
    });
  }

  function installAllAppsNavigation() {
    ensureAllAppsBackButtons();

    const realSwitchTab = window.switchTab;
    if (typeof realSwitchTab === 'function' && !realSwitchTab.__nxAllAppsV2) {
      const wrappedSwitch = function(name, button) {
        if (button?.classList?.contains('dock-item') && button.id !== 'moreBtn') {
          document.body.classList.remove('nx-opened-from-allapps');
          hideAllAppsMenu();
        }
        const result = realSwitchTab.call(this, name, button);
        setTimeout(() => setDockForTab(name, button), 0);
        return result;
      };
      wrappedSwitch.__nxAllAppsV2 = true;
      window.switchTab = wrappedSwitch;
    }

    window.openMoreTab = function(name) {
      document.body.classList.add('nx-opened-from-allapps');
      hideAllAppsMenu();
      ensureAllAppsBackButtons();
      if (typeof window.switchTab === 'function') window.switchTab(name, null);
      setDockForTab(name, $('moreBtn'));
      if (name === 'finance') setTimeout(() => window.nexusFinalConvertCurrency?.(false), 60);
      if (name === 'tools') setTimeout(() => window.nexusBackToTools?.(), 60);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.toggleMore = function() {
      const m = $('moreMenu');
      if (!m) return;
      const open = m.classList.contains('show') && getComputedStyle(m).display !== 'none';
      if (open) { hideAllAppsMenu(); restoreDockFromActiveTab(); }
      else {
        document.body.classList.add('nx-opened-from-allapps');
        showAllAppsMenu();
      }
    };

    document.addEventListener('click', () => {
      setTimeout(() => {
        const m = $('moreMenu');
        if (m && !m.classList.contains('show') && getComputedStyle(m).display === 'none') {
          restoreDockFromActiveTab();
        }
      }, 30);
    }, false);

    // Mega modules are created shortly after DOMContentLoaded. Keep newly
    // inserted tabs covered without asking the user to find missing Back buttons.
    const main = document.querySelector('main.main') || document.querySelector('main');
    if (main && !main.__nxAllAppsObserver) {
      const observer = new MutationObserver(() => ensureAllAppsBackButtons());
      observer.observe(main, { childList: true });
      main.__nxAllAppsObserver = observer;
    }
  }

  /* ---------------- Height: feet + inches ---------------- */
  const feetToMeters = (ft, inch) => ((Number(ft)||0)*12 + (Number(inch)||0)) * 0.0254;
  function installFeetBMI() {
    window.nexusCalcBMI = function() {
      const m=feetToMeters($('bmiHeightFt')?.value,$('bmiHeightIn')?.value), w=Number($('bmiWeight')?.value||0), out=$('bmiResult');
      if(!out || !(m>0) || !(w>0)){if(out)out.textContent='—';return;}
      const bmi=w/(m*m); const cat=bmi<18.5?'Underweight':bmi<25?'Normal':bmi<30?'Overweight':'Obese';
      const color=bmi<18.5?'#3b82f6':bmi<25?'#22c55e':bmi<30?'#f59e0b':'#ef4444';
      out.innerHTML=`<span style="color:${color};font-size:28px;font-weight:bold">${bmi.toFixed(1)}</span><br><span style="color:${color}">${cat}</span>`;
    };
    window.nxBMI = function() {
      const w=Number($('healthBmiWeight')?.value||0), m=feetToMeters($('healthBmiHeightFt')?.value,$('healthBmiHeightIn')?.value), r=$('healthBmiResult');
      if(!r)return; if(!(w>0&&m>0)){r.textContent='Enter weight, feet and inches.';return;}
      const bmi=w/(m*m); r.textContent=`BMI ${bmi.toFixed(1)} • ${bmi<18.5?'Underweight':bmi<25?'Normal range':bmi<30?'Overweight':'Obesity range'}`;
    };
  }

  /* ---------------- QR scanner: camera + uploaded image ---------------- */
  let qrValue=''; let qrRaf=0; let qrStream=null;
  function showQrResult(value) {
    qrValue=String(value||'').trim();
    const status=$('qrScanStatus'); if(status) status.textContent=qrValue?`Found: ${qrValue}`:'No QR code found.';
    if($('qrText') && qrValue) $('qrText').value=qrValue;
    const copy=$('qrCopyBtn'), open=$('qrOpenBtn'); if(copy)copy.style.display=qrValue?'inline-flex':'none';
    let link=false; try{const u=new URL(qrValue);link=['http:','https:'].includes(u.protocol);}catch{}
    if(open)open.style.display=link?'inline-flex':'none';
  }
  let qrLibraryPromise = null;
  async function ensureQrLibrary() {
    if (typeof window.jsQR === 'function') return true;
    if (qrLibraryPromise) return qrLibraryPromise;
    qrLibraryPromise = (async () => {
      const sources = [
        'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
        'https://unpkg.com/jsqr@1.4.0/dist/jsQR.js'
      ];
      for (const src of sources) {
        try {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src; script.async = true;
            script.onload = resolve; script.onerror = reject;
            document.head.appendChild(script);
          });
          if (typeof window.jsQR === 'function') return true;
        } catch (_) {}
      }
      return false;
    })().finally(() => { qrLibraryPromise = null; });
    return qrLibraryPromise;
  }
  function decodeCanvas(canvas) {
    const ctx=canvas.getContext('2d',{willReadFrequently:true}); if(!ctx)return null;
    const data=ctx.getImageData(0,0,canvas.width,canvas.height);
    if(typeof window.jsQR==='function'){const q=window.jsQR(data.data,data.width,data.height,{inversionAttempts:'attemptBoth'});return q?.data||null;}
    return null;
  }
  window.nexusScanQRImage = async function(file) {
    if(!file)return; const status=$('qrScanStatus'); if(status)status.textContent='Scanning image...';
    try{
      const bmp=await createImageBitmap(file); const max=1400, scale=Math.min(1,max/Math.max(bmp.width,bmp.height)); const canvas=$('qrCanvas')||document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(bmp.width*scale));canvas.height=Math.max(1,Math.round(bmp.height*scale));canvas.getContext('2d').drawImage(bmp,0,0,canvas.width,canvas.height);
      if('BarcodeDetector'in window){try{const codes=await new BarcodeDetector({formats:['qr_code']}).detect(canvas);if(codes?.length){showQrResult(codes[0].rawValue);return;}}catch{}}
      if (typeof window.jsQR !== 'function') await ensureQrLibrary();
      const v=decodeCanvas(canvas);
      if (!v && typeof window.jsQR !== 'function') {
        if(status) status.textContent='QR decoder could not load. Camera may still work in a supported browser.';
        return;
      }
      showQrResult(v||'');
    }catch(e){if(status)status.textContent='Could not read this image. Try a clearer QR image.';}
  };
  window.nexusStartQRScan = async function() {
    const status=$('qrScanStatus'), video=$('qrVideo'); if(!video)return;
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera unsupported');
      window.nexusStopQRScan();
      qrStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
      video.srcObject=qrStream;video.style.display='block';await video.play();if(status)status.textContent='Point camera at a QR code...';
      const canvas=$('qrCanvas')||document.createElement('canvas'), ctx=canvas.getContext('2d',{willReadFrequently:true});
      const detector='BarcodeDetector'in window?new BarcodeDetector({formats:['qr_code']}):null;
      if (!detector && typeof window.jsQR !== 'function') await ensureQrLibrary();
      const loop=async()=>{if(!video.srcObject)return; try{
        if(detector){const codes=await detector.detect(video);if(codes?.length){showQrResult(codes[0].rawValue);window.nexusStopQRScan();return;}}
        else if(typeof window.jsQR==='function'&&video.videoWidth){const scale=Math.min(1,900/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);ctx.drawImage(video,0,0,canvas.width,canvas.height);const v=decodeCanvas(canvas);if(v){showQrResult(v);window.nexusStopQRScan();return;}}
      }catch{} qrRaf=requestAnimationFrame(loop);}; loop();
    }catch(e){if(status)status.textContent='Camera unavailable or permission denied. You can upload a QR image instead.';}
  };
  window.nexusStopQRScan=function(){if(qrRaf)cancelAnimationFrame(qrRaf);qrRaf=0;if(qrStream)qrStream.getTracks().forEach(t=>t.stop());qrStream=null;const v=$('qrVideo');if(v){if(v.srcObject)v.srcObject.getTracks?.().forEach(t=>t.stop());v.srcObject=null;v.style.display='none';}};
  window.nexusCopyQRResult=async()=>{if(!qrValue)return;try{await navigator.clipboard.writeText(qrValue);$('qrScanStatus').textContent='Copied QR result.';}catch{}};
  window.nexusOpenQRResult=()=>{try{const u=new URL(qrValue);if(['http:','https:'].includes(u.protocol))window.open(u.href,'_blank','noopener,noreferrer');}catch{}};

  /* ---------------- Location helpers, weather, prayer ---------------- */
  async function geocodeCity(city) {
    const q=String(city||'').trim(); if(!q)throw new Error('Enter a city');
    const j=await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`,8000);
    const x=j?.results?.[0]; if(!x)throw new Error('City not found');
    return {lat:x.latitude,lon:x.longitude,label:[x.name,x.admin1,x.country].filter(Boolean).join(', ')};
  }
  async function geoPosition() {
    return await new Promise((res,rej)=>navigator.geolocation?.getCurrentPosition(p=>res({lat:p.coords.latitude,lon:p.coords.longitude,label:'Current location'}),rej,{enableHighAccuracy:false,timeout:9000,maximumAge:300000}));
  }
  function weatherMeta(code,isDay=1){
    const c=Number(code);let desc='Weather',icon='🌤️',cls='';
    if(c===0){desc='Clear sky';icon=isDay?'☀️':'🌙';cls=isDay?'':'night';}
    else if(c<=2){desc='Partly cloudy';icon=isDay?'🌤️':'☁️';cls='cloud';}
    else if(c===3){desc='Overcast';icon='☁️';cls='cloud';}
    else if(c===45||c===48){desc='Fog';icon='🌫️';cls='cloud';}
    else if((c>=51&&c<=67)||(c>=80&&c<=82)){desc='Rain / showers';icon='🌧️';cls='rain';}
    else if(c>=71&&c<=77){desc='Snow';icon='❄️';cls='cloud';}
    else if(c>=95){desc='Thunderstorm';icon='⛈️';cls='storm';}
    return {desc,icon,cls};
  }
  window.nexusLoadWeather=async function(mode='auto'){
    const status=$('weatherStatus'),box=$('weatherBox');if(status)status.textContent='Loading weather...';
    try{
      let loc;if(mode==='city'||($('weatherCityInput')?.value||'').trim())loc=await geocodeCity($('weatherCityInput')?.value);else if(mode==='geo')loc=await geoPosition();else{const saved=localStorage.getItem('nx_weather_city');loc=saved?await geocodeCity(saved):await geoPosition();}
      if($('weatherCityInput')?.value?.trim())localStorage.setItem('nx_weather_city',$('weatherCityInput').value.trim());
      const url=`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=3`;
      const d=await fetchJson(url,9000),c=d.current||{},m=weatherMeta(c.weather_code,c.is_day); const days=(d.daily?.time||[]).map((t,i)=>{const dm=weatherMeta(d.daily.weather_code[i],1);return `<div class="nx-weather-day"><b>${new Date(t+'T12:00').toLocaleDateString(undefined,{weekday:'short'})}</b><div style="font-size:24px">${dm.icon}</div><span>${Math.round(d.daily.temperature_2m_max[i])}° / ${Math.round(d.daily.temperature_2m_min[i])}°</span></div>`}).join('');
      if(box)box.innerHTML=`<div class="nx-weather-visual ${m.cls}"><div class="nx-weather-top"><div><div class="nx-weather-temp">${Math.round(c.temperature_2m)}°C</div><div class="nx-weather-place">${esc(loc.label)}</div><div class="nx-weather-desc">${m.desc}</div></div><div class="nx-weather-icon">${m.icon}</div></div><div class="nx-weather-metrics"><div class="nx-weather-metric"><small>Feels like</small><b>${Math.round(c.apparent_temperature)}°</b></div><div class="nx-weather-metric"><small>Humidity</small><b>${Math.round(c.relative_humidity_2m)}%</b></div><div class="nx-weather-metric"><small>Wind</small><b>${Math.round(c.wind_speed_10m)} km/h</b></div></div><div class="nx-weather-days">${days}</div></div>`;
      if(status)status.textContent=`Updated ${new Date().toLocaleTimeString()}`;
    }catch(e){if(status)status.textContent='Could not load weather. Enter a city or allow location permission.';if(box)box.innerHTML='<div class="muted-tools">Weather is temporarily unavailable.</div>';}
  };
  window.nexusLoadPrayer=async function(mode='auto'){
    const status=$('prayerStatus'),box=$('prayerBox');if(status)status.textContent='Loading prayer times...';
    try{
      let loc;if(mode==='city'||($('prayerCityInput')?.value||'').trim())loc=await geocodeCity($('prayerCityInput')?.value);else if(mode==='geo')loc=await geoPosition();else{const saved=localStorage.getItem('nx_prayer_city');loc=saved?await geocodeCity(saved):await geoPosition();}
      if($('prayerCityInput')?.value?.trim())localStorage.setItem('nx_prayer_city',$('prayerCityInput').value.trim());
      const now=new Date(),date=`${now.getDate()}-${now.getMonth()+1}-${now.getFullYear()}`;const j=await fetchJson(`https://api.aladhan.com/v1/timings/${date}?latitude=${loc.lat}&longitude=${loc.lon}&method=1`,9000);const t=j?.data?.timings||{};const names=['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'];
      if(box)box.innerHTML=names.map(n=>`<div class="prayer-row"><span>${n}</span><strong>${String(t[n]||'--').slice(0,5)}</strong></div>`).join('')+`<div class="muted-tools" style="margin-top:10px">${esc(loc.label)} · ${esc(j?.data?.date?.readable||'')}</div>`;
      if(status)status.textContent='Prayer times loaded';
    }catch(e){if(status)status.textContent='Could not load prayer times. Enter a city or allow location permission.';if(box)box.innerHTML='<div class="muted-tools">Prayer service is temporarily unavailable.</div>';}
  };

  /* ---------------- Internet speed test ---------------- */
  function injectSpeedTool(){
    const chips=$('toolChips');if(!chips||$('tool-speed'))return;
    const btn=document.createElement('button');btn.className='nexus-tool-chip';btn.dataset.tool='speed';btn.innerHTML='⚡ Speed Test';btn.onclick=()=>window.nexusShowTool('speed');chips.appendChild(btn);
    const panel=document.createElement('div');panel.id='tool-speed';panel.className='nexus-tool-panel card';panel.style.display='none';panel.innerHTML=`<h3>⚡ Internet Speed Test</h3><p class="muted-tools">Measures your browser connection against Cloudflare edge endpoints.</p><button id="nxSpeedStart" class="tool-btn primary full-btn" type="button">Start Test</button><div class="nx-speed-progress"><i id="nxSpeedBar"></i></div><div id="nxSpeedStatus" class="muted-tools">Ready</div><div class="nx-speed-gauge"><div id="nxSpeedMain" class="nx-speed-main">— Mbps</div><div class="nx-speed-grid"><div class="nx-speed-stat"><small>Download</small><b id="nxSpeedDown">—</b><span>Mbps</span></div><div class="nx-speed-stat"><small>Upload</small><b id="nxSpeedUp">—</b><span>Mbps</span></div><div class="nx-speed-stat"><small>Ping</small><b id="nxSpeedPing">—</b><span>ms</span></div></div></div>`;
    $('tab-tools')?.appendChild(panel);$('nxSpeedStart').onclick=runSpeedTest;
  }
  async function timedFetch(url,opts={}){const start=performance.now();const r=await fetch(url,{cache:'no-store',...opts});if(!r.ok)throw new Error('HTTP '+r.status);const buf=await r.arrayBuffer();return {ms:performance.now()-start,bytes:buf.byteLength};}
  async function runSpeedTest(){const start=$('nxSpeedStart'),status=$('nxSpeedStatus'),bar=$('nxSpeedBar');if(start)start.disabled=true;try{
    status.textContent='Testing ping...';bar.style.width='15%';const p=[];for(let i=0;i<3;i++){const t=performance.now();const r=await fetch(`https://speed.cloudflare.com/__down?bytes=0&x=${Date.now()}${i}`,{cache:'no-store'});await r.arrayBuffer();p.push(performance.now()-t);}const ping=p.sort((a,b)=>a-b)[1];$('nxSpeedPing').textContent=ping.toFixed(0);
    status.textContent='Testing download...';bar.style.width='42%';const d=await timedFetch(`https://speed.cloudflare.com/__down?bytes=5000000&x=${Date.now()}`);const down=(d.bytes*8)/(d.ms/1000)/1e6;$('nxSpeedDown').textContent=down.toFixed(1);$('nxSpeedMain').textContent=`${down.toFixed(1)} Mbps`;bar.style.width='72%';
    status.textContent='Testing upload...';const size=2_000_000,body=new Uint8Array(size);const us=performance.now();const ur=await fetch(`https://speed.cloudflare.com/__up?bytes=${size}`,{method:'POST',body,cache:'no-store'});if(!ur.ok)throw new Error('Upload HTTP '+ur.status);await ur.text();const ums=performance.now()-us,up=(size*8)/(ums/1000)/1e6;$('nxSpeedUp').textContent=up.toFixed(1);bar.style.width='100%';status.textContent='Test complete';
  }catch(e){console.warn('Speed test:',e);status.textContent='Speed test could not complete. Try again on a normal browser connection.';}finally{if(start)start.disabled=false;setTimeout(()=>{if(bar)bar.style.width='0'},1200);}}

  /* ---------------- Quran + Sahih Bukhari + separate Bible ---------------- */
  const SURAH_NAMES=['Al-Fatihah','Al-Baqarah','Aal-E-Imran','An-Nisa','Al-Maidah','Al-Anam','Al-Araf','Al-Anfal','At-Tawbah','Yunus','Hud','Yusuf','Ar-Rad','Ibrahim','Al-Hijr','An-Nahl','Al-Isra','Al-Kahf','Maryam','Taha','Al-Anbiya','Al-Hajj','Al-Muminun','An-Nur','Al-Furqan','Ash-Shuara','An-Naml','Al-Qasas','Al-Ankabut','Ar-Rum','Luqman','As-Sajdah','Al-Ahzab','Saba','Fatir','Ya-Sin','As-Saffat','Sad','Az-Zumar','Ghafir','Fussilat','Ash-Shura','Az-Zukhruf','Ad-Dukhan','Al-Jathiyah','Al-Ahqaf','Muhammad','Al-Fath','Al-Hujurat','Qaf','Adh-Dhariyat','At-Tur','An-Najm','Al-Qamar','Ar-Rahman','Al-Waqiah','Al-Hadid','Al-Mujadila','Al-Hashr','Al-Mumtahanah','As-Saff','Al-Jumuah','Al-Munafiqun','At-Taghabun','At-Talaq','At-Tahrim','Al-Mulk','Al-Qalam','Al-Haqqah','Al-Maarij','Nuh','Al-Jinn','Al-Muzzammil','Al-Muddaththir','Al-Qiyamah','Al-Insan','Al-Mursalat','An-Naba','An-Naziat','Abasa','At-Takwir','Al-Infitar','Al-Mutaffifin','Al-Inshiqaq','Al-Buruj','At-Tariq','Al-Ala','Al-Ghashiyah','Al-Fajr','Al-Balad','Ash-Shams','Al-Layl','Ad-Duha','Ash-Sharh','At-Tin','Al-Alaq','Al-Qadr','Al-Bayyinah','Az-Zalzalah','Al-Adiyat','Al-Qariah','At-Takathur','Al-Asr','Al-Humazah','Al-Fil','Quraysh','Al-Maun','Al-Kawthar','Al-Kafirun','An-Nasr','Al-Masad','Al-Ikhlas','Al-Falaq','An-Nas'];
  function scriptureUI(){
    const tab=$('tab-mega-islamic');if(!tab)return;tab.innerHTML=`<div class="card nxmega-hero"><h2>☪ Islamic Hub</h2><div class="nx-scripture-tabs"><button class="tool-btn active" data-faith="quran">Quran Pak</button><button class="tool-btn" data-faith="bukhari">Sahih Bukhari</button><button class="tool-btn" data-faith="prayer">Prayer Times</button><button class="tool-btn" onclick="openMoreTab('qibla')">Qibla</button></div><div id="faith-quran"><div class="nx-scripture-controls"><select id="nxQuranSurah" class="tool-input">${SURAH_NAMES.map((n,i)=>`<option value="${i+1}">${i+1}. ${n}</option>`).join('')}</select><button id="nxQuranLoad" class="tool-btn primary">Open Surah</button><button id="nxQuranBookmark" class="tool-btn">Bookmark</button></div><div id="nxQuranStatus" class="tool-muted">Arabic Quran + Urdu translation</div><div id="nxQuranReader" class="nx-scripture-reader tool-result">Choose a Surah.</div><div class="nx-attribution">Quran text: Al Quran Cloud · Arabic quran-uthmani · Urdu Fateh Muhammad Jalandhry (ur.jalandhry).</div></div><div id="faith-bukhari" style="display:none"><div class="nx-scripture-controls"><input id="nxBukhariNo" class="tool-input" type="number" min="1" placeholder="Hadith number"><button id="nxBukhariLoad" class="tool-btn primary">Open Hadith</button><button id="nxBukhariPrev" class="tool-btn">Previous</button><button id="nxBukhariNext" class="tool-btn">Next</button></div><div id="nxBukhariStatus" class="tool-muted">Arabic + Urdu Sahih al-Bukhari</div><div id="nxBukhariReader" class="nx-scripture-reader tool-result">Enter a Hadith number.</div><div class="nx-attribution">Hadith data: fawazahmed0/hadith-api (Unlicense), Arabic and Urdu Bukhari editions.</div></div><div id="faith-prayer" style="display:none"><p class="tool-muted">Use the full Prayer Times tool for city/current-location timings.</p><button class="tool-btn primary" onclick="openMoreTab('tools');setTimeout(()=>nexusShowTool('prayer'),100)">Open Prayer Times</button></div></div>`;
    tab.querySelectorAll('[data-faith]').forEach(b=>b.onclick=()=>{tab.querySelectorAll('[data-faith]').forEach(x=>x.classList.toggle('active',x===b));['quran','bukhari','prayer'].forEach(x=>{const e=$('faith-'+x);if(e)e.style.display=x===b.dataset.faith?'block':'none';});});
    $('nxQuranLoad').onclick=loadSurah;$('nxQuranBookmark').onclick=()=>{localStorage.setItem('nx_quran_last',String($('nxQuranSurah').value));$('nxQuranStatus').textContent='Bookmarked.';};
    const last=Number(localStorage.getItem('nx_quran_last')||1);if(last>=1&&last<=114)$('nxQuranSurah').value=String(last);
    $('nxBukhariLoad').onclick=()=>loadBukhari(Number($('nxBukhariNo').value||1));$('nxBukhariPrev').onclick=()=>loadBukhari(Math.max(1,Number($('nxBukhariNo').value||1)-1));$('nxBukhariNext').onclick=()=>loadBukhari(Number($('nxBukhariNo').value||1)+1);
  }
  async function loadSurah(){const n=Number($('nxQuranSurah').value||1),status=$('nxQuranStatus'),reader=$('nxQuranReader');status.textContent='Loading Surah...';reader.textContent='Loading...';try{const j=await fetchJson(`https://api.alquran.cloud/v1/surah/${n}/editions/quran-uthmani,ur.jalandhry`,12000);const editions=j?.data||[],ar=editions.find(x=>x.edition?.identifier==='quran-uthmani')||editions[0],ur=editions.find(x=>x.edition?.identifier==='ur.jalandhry')||editions[1];if(!ar?.ayahs?.length)throw new Error('No verses');reader.innerHTML=ar.ayahs.map((a,i)=>`<div class="nx-ayah"><div class="nx-verse-no">${n}:${a.numberInSurah}</div><div class="nx-arabic">${esc(a.text)}</div><div class="nx-urdu">${esc(ur?.ayahs?.[i]?.text||'')}</div></div>`).join('');status.textContent=`${SURAH_NAMES[n-1]} · ${ar.ayahs.length} Ayat`;localStorage.setItem('nx_quran_last',String(n));}catch(e){reader.textContent='Could not load Quran text. Check connection and retry.';status.textContent='Quran service unavailable';}}
  async function loadBukhari(n){n=Math.max(1,Math.floor(n||1));$('nxBukhariNo').value=String(n);const status=$('nxBukhariStatus'),reader=$('nxBukhariReader');status.textContent='Loading Hadith...';reader.textContent='Loading...';try{const [a,u]=await Promise.all([fetchJson(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-bukhari/${n}.min.json`,12000),fetchJson(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/urd-bukhari/${n}.min.json`,12000)]);const ah=a?.hadiths?.[0]||a?.hadith||a,uh=u?.hadiths?.[0]||u?.hadith||u;const at=ah?.text||ah?.hadith||'',ut=uh?.text||uh?.hadith||'';if(!at&&!ut)throw new Error('Missing');reader.innerHTML=`<div class="nx-hadith"><div class="nx-verse-no">Sahih al-Bukhari · Hadith ${n}</div><div class="nx-arabic">${esc(at)}</div><div class="nx-urdu">${esc(ut)}</div></div>`;status.textContent=`Hadith ${n}`;localStorage.setItem('nx_bukhari_last',String(n));}catch(e){reader.textContent='Hadith could not be loaded. Check the number or connection.';status.textContent='Bukhari service unavailable';}}
  const BIBLE_BOOKS=[['GEN','Genesis',50],['EXO','Exodus',40],['LEV','Leviticus',27],['NUM','Numbers',36],['DEU','Deuteronomy',34],['JOS','Joshua',24],['JDG','Judges',21],['RUT','Ruth',4],['1SA','1 Samuel',31],['2SA','2 Samuel',24],['1KI','1 Kings',22],['2KI','2 Kings',25],['1CH','1 Chronicles',29],['2CH','2 Chronicles',36],['EZR','Ezra',10],['NEH','Nehemiah',13],['EST','Esther',10],['JOB','Job',42],['PSA','Psalms',150],['PRO','Proverbs',31],['ECC','Ecclesiastes',12],['SNG','Song of Songs',8],['ISA','Isaiah',66],['JER','Jeremiah',52],['LAM','Lamentations',5],['EZK','Ezekiel',48],['DAN','Daniel',12],['HOS','Hosea',14],['JOL','Joel',3],['AMO','Amos',9],['OBA','Obadiah',1],['JON','Jonah',4],['MIC','Micah',7],['NAM','Nahum',3],['HAB','Habakkuk',3],['ZEP','Zephaniah',3],['HAG','Haggai',2],['ZEC','Zechariah',14],['MAL','Malachi',4],['MAT','Matthew',28],['MRK','Mark',16],['LUK','Luke',24],['JHN','John',21],['ACT','Acts',28],['ROM','Romans',16],['1CO','1 Corinthians',16],['2CO','2 Corinthians',13],['GAL','Galatians',6],['EPH','Ephesians',6],['PHP','Philippians',4],['COL','Colossians',4],['1TH','1 Thessalonians',5],['2TH','2 Thessalonians',3],['1TI','1 Timothy',6],['2TI','2 Timothy',4],['TIT','Titus',3],['PHM','Philemon',1],['HEB','Hebrews',13],['JAS','James',5],['1PE','1 Peter',5],['2PE','2 Peter',3],['1JN','1 John',5],['2JN','2 John',1],['3JN','3 John',1],['JUD','Jude',1],['REV','Revelation',22]];
  const BIBLE_DATA = {
    vref: [
      'https://raw.githubusercontent.com/BibleNLP/ebible/main/metadata/vref.txt',
      'https://cdn.jsdelivr.net/gh/BibleNLP/ebible@main/metadata/vref.txt'
    ],
    en: [
      'https://raw.githubusercontent.com/BibleNLP/ebible/main/corpus/eng-engwebp.txt',
      'https://cdn.jsdelivr.net/gh/BibleNLP/ebible@main/corpus/eng-engwebp.txt'
    ],
    ur: [
      'https://raw.githubusercontent.com/BibleNLP/ebible/main/corpus/urd-urdgvu.txt',
      'https://cdn.jsdelivr.net/gh/BibleNLP/ebible@main/corpus/urd-urdgvu.txt'
    ]
  };
  const bibleMemory = { vref: null, en: null, ur: null };
  async function bibleDataset(kind) {
    if (bibleMemory[kind]) return bibleMemory[kind];
    const text = await fetchTextFromSources(BIBLE_DATA[kind], 20000);
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    bibleMemory[kind] = lines;
    return lines;
  }
  function installBible(){
    let tab=$('tab-bible');
    const main=document.querySelector('main.main')||document.querySelector('main');if(!main)return;
    if(!tab){tab=document.createElement('section');tab.id='tab-bible';tab.className='tab nxmega-tab';main.appendChild(tab);}
    tab.innerHTML=`<div class="card nxmega-hero"><h2>✝ Bible</h2><p class="tool-muted">Separate Christian scripture reader — not part of Islamic Hub.</p><div class="nx-scripture-controls"><select id="nxBibleBook" class="tool-input">${BIBLE_BOOKS.map((b,i)=>`<option value="${i}">${b[1]}</option>`).join('')}</select><select id="nxBibleChapter" class="tool-input"></select><select id="nxBibleLang" class="tool-input"><option value="en">English — World English Bible</option><option value="ur">Urdu — Urdu Bible</option></select><button id="nxBibleOpen" class="tool-btn primary" type="button">Open Chapter</button><button id="nxBiblePrev" class="tool-btn" type="button">Previous</button><button id="nxBibleNext" class="tool-btn" type="button">Next</button></div><div id="nxBibleStatus" class="tool-muted">Choose book, chapter and language.</div><div id="nxBibleReader" class="nx-scripture-reader tool-result"><div class="nx-bible-empty">Choose a chapter, then tap Open Chapter.</div></div><div class="nx-attribution">English: World English Bible. Urdu text: Urdu Bible corpus. Verse-aligned text is loaded directly as data instead of embedding another website.</div></div>`;
    const book=$('nxBibleBook'),chap=$('nxBibleChapter');
    const fill=()=>{const b=BIBLE_BOOKS[Number(book.value)||0];const old=Number(chap.value||1);chap.innerHTML=Array.from({length:b[2]},(_,i)=>`<option value="${i+1}">Chapter ${i+1}</option>`).join('');chap.value=String(Math.min(old,b[2]));};
    fill();book.onchange=fill;
    $('nxBibleOpen').onclick=()=>openBibleChapter(false);
    $('nxBiblePrev').onclick=()=>moveBibleChapter(-1);
    $('nxBibleNext').onclick=()=>moveBibleChapter(1);
    const menu=$('moreMenu')?.querySelector('.more-inner');
    if(menu&&!menu.querySelector('[data-final-bible]')){const b=document.createElement('button');b.type='button';b.className='more-item';b.dataset.finalBible='1';b.innerHTML='<span class="mi-icon nx3d-ico" aria-hidden="true">✝</span><span>Bible</span>';b.onclick=()=>window.openMoreTab('bible');const islamic=menu.querySelector('[data-nxmega="mega-islamic"]');islamic?.insertAdjacentElement('afterend',b)||menu.appendChild(b);}
  }
  async function openBibleChapter(force=false){
    const status=$('nxBibleStatus'),reader=$('nxBibleReader');if(!status||!reader)return;
    const b=BIBLE_BOOKS[Number($('nxBibleBook')?.value)||0], chapter=Math.max(1,Number($('nxBibleChapter')?.value)||1), lang=$('nxBibleLang')?.value||'en';
    status.textContent='Loading Bible chapter…';reader.innerHTML='<div class="nx-bible-empty">Loading text…</div>';
    try{
      const [refs,texts]=await Promise.all([bibleDataset('vref'),bibleDataset(lang)]);
      const prefix=`${b[0]} ${chapter}:`; const verses=[];
      const total=Math.min(refs.length,texts.length);
      for(let i=0;i<total;i++){
        const ref=String(refs[i]||'').trim();
        if(!ref.startsWith(prefix)) continue;
        const verseNo=ref.slice(prefix.length).trim(); const text=String(texts[i]||'').trim();
        if(text) verses.push({verseNo,text});
      }
      if(!verses.length) throw new Error('Chapter data missing');
      const rtl=lang==='ur';
      reader.innerHTML=verses.map(v=>`<div class="nx-bible-verse ${rtl?'rtl':''}"><span class="nx-bible-verse-no">${esc(v.verseNo)}</span><div>${esc(v.text)}</div></div>`).join('');
      status.textContent=`${b[1]} ${chapter} · ${lang==='ur'?'Urdu':'English'} · ${verses.length} verses`;
      localStorage.setItem('nx_bible_last',JSON.stringify({book:Number($('nxBibleBook').value)||0,chapter,lang}));
      reader.scrollTop=0;
    }catch(err){console.warn('Bible reader:',err);reader.innerHTML='<div class="nx-bible-error">Bible text could not load from either data source. Check internet access and tap Open Chapter again.</div>';status.textContent='Bible data temporarily unavailable';}
  }
  function moveBibleChapter(delta){
    const book=$('nxBibleBook'),chap=$('nxBibleChapter');if(!book||!chap)return;
    let bi=Number(book.value)||0, ch=Number(chap.value)||1; ch+=delta;
    if(ch<1&&bi>0){bi--;book.value=String(bi);book.onchange?.();ch=BIBLE_BOOKS[bi][2];}
    else if(ch>BIBLE_BOOKS[bi][2]&&bi<BIBLE_BOOKS.length-1){bi++;book.value=String(bi);book.onchange?.();ch=1;}
    ch=Math.max(1,Math.min(ch,BIBLE_BOOKS[bi][2]));chap.value=String(ch);openBibleChapter(false);
  }

  /* ---------------- ALL APPS label and mining state cosmetics ---------------- */
  function cosmetics(){const more=$('moreBtn');if(more){const span=more.querySelector('span:last-child');if(span)span.textContent='ALL APPS';}
    const mine=$('mineBtn');if(mine){const sync=()=>{const txt=(mine.textContent||'').toLowerCase();mine.classList.toggle('nx-stop-state',txt.includes('stop'));};new MutationObserver(sync).observe(mine,{childList:true,subtree:true,characterData:true,class:true});sync();}
  }

  function init(){
    installDockGuard();
    installToolsNav();
    installFeetBMI();
    installCurrency();
    injectSpeedTool();
    scriptureUI();
    installBible();
    installAllAppsNavigation();
    cosmetics();
    installProfileRepair();
    ensureAllAppsBackButtons();
    try {
      const last=JSON.parse(localStorage.getItem('nx_bible_last')||'null');
      if(last&&$('nxBibleBook')&&$('nxBibleChapter')&&$('nxBibleLang')){
        $('nxBibleBook').value=String(last.book||0);$('nxBibleBook').onchange?.();$('nxBibleChapter').value=String(last.chapter||1);$('nxBibleLang').value=last.lang||'en';
      }
    } catch(_) {}
    // Remove misleading auxiliary fallback text if auth has not resolved yet.
    if($('profileEmailDisplay')?.textContent==='Account loaded')$('profileEmailDisplay').textContent='Loading account…';
    setTimeout(ensureAllAppsBackButtons, 1800);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,1350),{once:true});else setTimeout(init,1350);
})();
