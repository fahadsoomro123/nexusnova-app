/* NexusNova Browser Extensions & Apps Hub v2
   Installable web apps + compatible provider integrations.
   Android WebView does not run arbitrary desktop Chrome .crx packages; native WebExtension
   support is handled separately by the Android browser engine layer.
*/
(() => {
  'use strict';
  if (window.__nxBrowserExtensionsV2) return;
  window.__nxBrowserExtensionsV2 = true;
  window.__nxBrowserExtensionsV1 = true;
  window.nexusBrowserExtensionsVersion = 'extensions-apps-hub-v2';

  const STORAGE_KEY = 'nexusnova_browser_apps_v2';
  const $ = (sel, root=document) => root.querySelector(sel);
  const uid = () => 'nxapp-' + Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-5);

  const ICONS = {
    puzzle:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 4H4v4.5a2.5 2.5 0 1 0 0 5V20h4.5a2.5 2.5 0 1 1 5 0H20v-6.5a2.5 2.5 0 1 0 0-5V4h-6.5a2.5 2.5 0 1 0-5 0Z"/></svg>',
    app:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>',
    plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    wallet:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h14a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11"/><path d="M15 11h6v4h-6a2 2 0 1 1 0-4Z"/></svg>',
    shield:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 2.7 7.8 7 10 4.3-2.2 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/></svg>',
    trash:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
    external:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5h6v6"/><path d="m19 5-8 8"/><path d="M18 13v6H5V6h6"/></svg>',
    close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    info:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg>'
  };

  function esc(text){
    return String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function normalizeUrl(raw){
    const text=String(raw||'').trim().slice(0,2000);
    if(!text || /^(?:javascript|data|file|blob|intent|content):/i.test(text)) return '';
    try{
      const u=new URL(/^https?:\/\//i.test(text) ? text : 'https://'+text);
      if(u.protocol==='http:') u.protocol='https:';
      return u.protocol==='https:' && u.host ? u.href : '';
    }catch(_){ return ''; }
  }

  function loadApps(){
    try{
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
      return Array.isArray(parsed) ? parsed.filter(x=>x && x.id && x.name && normalizeUrl(x.url)).slice(0,60) : [];
    }catch(_){ return []; }
  }

  function saveApps(apps){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(apps.slice(0,60)));
  }

  function installStyle(){
    if($('#nxBrowserExtensionsStyle')) return;
    const s=document.createElement('style');
    s.id='nxBrowserExtensionsStyle';
    s.textContent=`
      .nx-ext-btn{position:relative;display:grid;place-items:center;width:46px;height:44px;padding:0!important;border-radius:14px!important;border:1px solid rgba(83,164,255,.22)!important;background:linear-gradient(160deg,rgba(21,48,80,.92),rgba(5,16,30,.96))!important;color:#cfe8ff!important;cursor:pointer;box-shadow:0 8px 19px rgba(0,0,0,.27),inset 0 1px 0 rgba(255,255,255,.055)!important}.nx-ext-btn svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.nx-ext-dot{position:absolute;right:7px;top:7px;width:7px;height:7px;border-radius:50%;background:#4da3ff;box-shadow:0 0 12px rgba(77,163,255,.85)}
      .nx-ext-overlay{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(0,4,10,.84);backdrop-filter:blur(12px)}.nx-ext-overlay.open{display:flex}.nx-ext-modal{width:min(820px,100%);max-height:88vh;overflow:auto;border-radius:28px;border:1px solid rgba(83,165,255,.3);background:radial-gradient(620px 260px at 0% 0%,rgba(45,139,255,.2),transparent 65%),linear-gradient(155deg,#0a1d35,#030a14 55%,#061426);box-shadow:0 34px 90px rgba(0,0,0,.68),0 0 50px rgba(40,133,255,.1);color:#eef7ff}.nx-ext-head{position:sticky;top:0;z-index:3;display:flex;align-items:flex-start;gap:12px;padding:18px;border-bottom:1px solid rgba(83,165,255,.18);background:rgba(5,16,30,.96);backdrop-filter:blur(12px)}.nx-ext-logo{display:grid;place-items:center;flex:0 0 48px;width:48px;height:48px;border-radius:16px;background:linear-gradient(145deg,#1268dc,#55b8ff);box-shadow:0 12px 28px rgba(25,118,255,.28)}.nx-ext-logo svg{width:25px;height:25px;fill:none;stroke:white;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.nx-ext-title{flex:1}.nx-ext-kicker{font-size:8px;letter-spacing:.18em;font-weight:950;color:#72bbff}.nx-ext-title h3{margin:3px 0;font-size:21px}.nx-ext-title p{margin:0;color:#94b4d6;font-size:10px}.nx-ext-close{display:grid;place-items:center;width:38px;height:38px;border-radius:13px;border:1px solid rgba(110,180,255,.18);background:#07172a;color:#a9c9e9;cursor:pointer}.nx-ext-close svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2}.nx-ext-body{padding:16px}.nx-ext-notice{display:flex;gap:10px;padding:12px;margin-bottom:14px;border:1px solid rgba(85,164,255,.16);border-radius:16px;background:rgba(8,29,53,.65);color:#a8c5e3;font-size:10px;line-height:1.55}.nx-ext-notice svg{width:17px;height:17px;flex:0 0 auto;fill:none;stroke:#69b6ff;stroke-width:1.8}.nx-ext-install{padding:14px;margin-bottom:14px;border-radius:19px;border:1px solid rgba(86,168,255,.22);background:linear-gradient(155deg,rgba(16,54,96,.72),rgba(5,16,30,.92))}.nx-ext-install-title{display:flex;align-items:center;gap:9px;margin-bottom:10px;font-size:12px;font-weight:900}.nx-ext-install-title svg{width:19px;height:19px;fill:none;stroke:#72c4ff;stroke-width:1.9}.nx-ext-form{display:grid;grid-template-columns:minmax(120px,.7fr) minmax(220px,1.5fr) auto;gap:8px}.nx-ext-input{height:42px;border:1px solid rgba(84,161,241,.2);border-radius:12px;background:#04111f;color:white;padding:0 11px;outline:none;font-size:10px}.nx-ext-input:focus{border-color:rgba(95,182,255,.48);box-shadow:0 0 0 3px rgba(52,141,255,.08)}.nx-ext-action{min-height:40px;padding:8px 12px;border:1px solid rgba(88,169,255,.2);border-radius:12px;background:linear-gradient(145deg,#0a315d,#07182c);color:#d9ecff;font-size:9px;font-weight:900;cursor:pointer}.nx-ext-action.primary{background:linear-gradient(135deg,#0d67f8,#52b5ff);color:#fff;border-color:rgba(90,190,255,.36);box-shadow:0 8px 20px rgba(25,118,255,.23)}.nx-ext-action.danger{color:#ffc0c8;border-color:rgba(255,94,111,.18);background:rgba(86,20,31,.24)}.nx-ext-statusline{min-height:18px;margin-top:8px;color:#88acd2;font-size:9px}.nx-ext-statusline.good{color:#8fe0bd}.nx-ext-statusline.bad{color:#ffafb9}.nx-ext-section-title{display:flex;align-items:center;justify-content:space-between;margin:16px 2px 9px;font-size:10px;font-weight:950;letter-spacing:.08em;color:#9fcdf6}.nx-ext-count{padding:4px 7px;border-radius:999px;background:rgba(44,127,218,.16);font-size:8px;color:#76bfff}.nx-ext-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.nx-ext-card{padding:14px;border-radius:19px;border:1px solid rgba(80,159,255,.17);background:linear-gradient(155deg,rgba(18,44,76,.82),rgba(5,15,28,.94));box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 12px 25px rgba(0,0,0,.24)}.nx-ext-card-head{display:flex;align-items:center;gap:10px}.nx-ext-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:14px;background:linear-gradient(145deg,rgba(20,96,201,.72),rgba(20,54,93,.9));color:#8ed0ff}.nx-ext-icon svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8}.nx-ext-card h4{margin:0 0 2px;font-size:13px}.nx-ext-type{font-size:8px;color:#77acd9;font-weight:850;letter-spacing:.08em}.nx-ext-card p{margin:9px 0;color:#8daac8;font-size:9.5px;line-height:1.5;word-break:break-all}.nx-ext-actions{display:flex;gap:7px;flex-wrap:wrap}.nx-ext-actions .nx-ext-action{flex:1;min-width:90px}.nx-ext-empty{grid-column:1/-1;padding:22px;border:1px dashed rgba(90,170,255,.2);border-radius:18px;text-align:center;color:#7698ba;font-size:10px}.nx-ext-foot{margin-top:14px;padding:11px;border-radius:15px;border:1px solid rgba(78,154,238,.12);background:rgba(3,12,23,.72);font-size:9px;color:#7798bc;line-height:1.55}
      @media(max-width:650px){.nx-ext-grid{grid-template-columns:1fr}.nx-ext-form{grid-template-columns:1fr}.nx-ext-modal{border-radius:22px}.nx-ext-head{padding:14px}.nx-ext-body{padding:12px}.nx-ext-btn{width:39px;height:39px;border-radius:12px!important}}
    `;
    document.head.appendChild(s);
  }

  function providerInfo(){
    const p=window.ethereum;
    if(!p) return {available:false,name:'No injected wallet',provider:null};
    let name='Web3 Wallet';
    if(p.isMetaMask) name='MetaMask'; else if(p.isRabby) name='Rabby Wallet'; else if(p.isCoinbaseWallet) name='Coinbase Wallet';
    return {available:true,name,provider:p};
  }

  function openBrowser(url){
    const safe=normalizeUrl(url); if(!safe) return;
    close();
    if(typeof window.nexusOpenInAppBrowser==='function'){ window.nexusOpenInAppBrowser(safe); return; }
    if(typeof window.nxBrowsePreset==='function'){ window.nxBrowsePreset(safe); return; }
    location.href=safe;
  }

  function installApp(nameRaw,urlRaw){
    const name=String(nameRaw||'').trim().replace(/\s+/g,' ').slice(0,42);
    const url=normalizeUrl(urlRaw);
    if(!name) return {ok:false,message:'App name required.'};
    if(!url) return {ok:false,message:'Valid HTTPS website required.'};
    const apps=loadApps();
    if(apps.some(a=>a.url===url)) return {ok:false,message:'This app is already installed.'};
    apps.unshift({id:uid(),name,url,installedAt:Date.now(),enabled:true});
    saveApps(apps);
    renderApps();
    return {ok:true,message:`${name} installed in NexusNova Browser.`};
  }

  function uninstallApp(id){
    saveApps(loadApps().filter(a=>a.id!==id));
    renderApps();
  }

  function renderApps(){
    const root=$('#nxBrowserExtensionsOverlay'); if(!root) return;
    const host=$('[data-nx-installed-apps]',root); if(!host) return;
    const apps=loadApps();
    const count=$('[data-nx-app-count]',root); if(count) count.textContent=String(apps.length);
    if(!apps.length){ host.innerHTML='<div class="nx-ext-empty">No browser apps installed yet. Add any secure website/PWA above and it will stay here.</div>'; return; }
    host.innerHTML=apps.map(app=>`<article class="nx-ext-card" data-app-id="${esc(app.id)}"><div class="nx-ext-card-head"><div class="nx-ext-icon">${ICONS.app}</div><div><h4>${esc(app.name)}</h4><div class="nx-ext-type">INSTALLED WEB APP</div></div></div><p>${esc(app.url)}</p><div class="nx-ext-actions"><button class="nx-ext-action primary" data-app-open type="button">Open</button><button class="nx-ext-action danger" data-app-remove type="button">Remove</button></div></article>`).join('');
    host.querySelectorAll('[data-app-id]').forEach(card=>{
      const id=card.getAttribute('data-app-id'); const app=apps.find(a=>a.id===id); if(!app) return;
      $('[data-app-open]',card)?.addEventListener('click',()=>openBrowser(app.url));
      $('[data-app-remove]',card)?.addEventListener('click',()=>uninstallApp(id));
    });
  }

  async function connectWallet(){
    const info=providerInfo(); const status=$('[data-wallet-status]');
    if(!info.available){ if(status) status.textContent='No injected wallet provider detected on this device/browser.'; return; }
    try{
      const accounts=await info.provider.request({method:'eth_requestAccounts'});
      const first=Array.isArray(accounts)?accounts[0]:'';
      if(status) status.textContent=`${info.name} connected${first?' • '+first.slice(0,8)+'…'+first.slice(-6):''}`;
    }catch(e){ if(status) status.textContent='Wallet connection cancelled or unavailable.'; }
  }

  function modal(){
    let overlay=$('#nxBrowserExtensionsOverlay'); if(overlay) return overlay;
    overlay=document.createElement('div'); overlay.id='nxBrowserExtensionsOverlay'; overlay.className='nx-ext-overlay';
    overlay.innerHTML=`<div class="nx-ext-modal" role="dialog" aria-modal="true"><div class="nx-ext-head"><div class="nx-ext-logo">${ICONS.puzzle}</div><div class="nx-ext-title"><div class="nx-ext-kicker">NEXUSNOVA // EXTENSIONS + APPS</div><h3>Extensions & Apps Hub</h3><p>Install browser apps, manage add-ons and connect compatible providers.</p></div><button class="nx-ext-close" data-nx-ext-close type="button">${ICONS.close}</button></div><div class="nx-ext-body"><div class="nx-ext-notice">${ICONS.info}<span><strong>Install any web app:</strong> add a secure HTTPS website/PWA and NexusNova saves it here like a browser app. Real browser extensions require a compatible native WebExtension engine; ordinary Android WebView cannot execute arbitrary desktop Chrome .crx packages.</span></div><section class="nx-ext-install"><div class="nx-ext-install-title">${ICONS.plus}<span>Install Web App</span></div><div class="nx-ext-form"><input class="nx-ext-input" data-app-name placeholder="App name e.g. TradingView"><input class="nx-ext-input" data-app-url placeholder="https://example.com"><button class="nx-ext-action primary" data-app-install type="button">Install App</button></div><div class="nx-ext-statusline" data-app-install-status></div></section><div class="nx-ext-section-title"><span>INSTALLED BROWSER APPS</span><span class="nx-ext-count" data-nx-app-count>0</span></div><div class="nx-ext-grid" data-nx-installed-apps></div><div class="nx-ext-section-title"><span>BUILT-IN / COMPATIBLE ADD-ONS</span></div><div class="nx-ext-grid"><article class="nx-ext-card"><div class="nx-ext-card-head"><div class="nx-ext-icon">${ICONS.wallet}</div><div><h4>Web3 Wallet Connector</h4><div class="nx-ext-type">COMPATIBLE PROVIDER</div></div></div><p>Detects compatible injected Web3 providers on browsers that expose them.</p><div class="nx-ext-actions"><button class="nx-ext-action primary" data-wallet-connect type="button">Connect Wallet</button></div><div class="nx-ext-statusline" data-wallet-status></div></article><article class="nx-ext-card"><div class="nx-ext-card-head"><div class="nx-ext-icon">${ICONS.shield}</div><div><h4>Nexus Shield</h4><div class="nx-ext-type">BUILT-IN SECURITY</div></div></div><p>HTTPS-first navigation and blocking of unsafe local/data URL schemes.</p><div class="nx-ext-statusline good">Active</div></article></div><div class="nx-ext-foot">Future native WebExtension support can expose install/uninstall/enable/disable controls here. Web apps installed in this hub already persist locally and can be opened directly inside NexusNova Browser.</div></div></div>`;
    document.body.appendChild(overlay);
    $('[data-nx-ext-close]',overlay)?.addEventListener('click',close);
    overlay.addEventListener('click',e=>{if(e.target===overlay) close();});
    $('[data-app-install]',overlay)?.addEventListener('click',()=>{
      const result=installApp($('[data-app-name]',overlay)?.value,$('[data-app-url]',overlay)?.value);
      const status=$('[data-app-install-status]',overlay); if(status){status.textContent=result.message;status.className='nx-ext-statusline '+(result.ok?'good':'bad');}
      if(result.ok){$('[data-app-name]',overlay).value='';$('[data-app-url]',overlay).value='';}
    });
    $('[data-wallet-connect]',overlay)?.addEventListener('click',connectWallet);
    renderApps(); return overlay;
  }

  function open(){modal();renderApps();$('#nxBrowserExtensionsOverlay')?.classList.add('open');document.documentElement.style.overflow='hidden';}
  function close(){$('#nxBrowserExtensionsOverlay')?.classList.remove('open');document.documentElement.style.overflow='';}

  function installButton(){
    const toolbar=$('[data-nx-browser-toolbar]'); if(!toolbar || $('[data-nx-browser-extensions]',toolbar)) return false;
    const badge=$('.nx-browser-badge',toolbar); const btn=document.createElement('button'); btn.type='button';btn.className='nx-ext-btn';btn.dataset.nxBrowserExtensions='1';btn.title='Extensions & Apps';btn.setAttribute('aria-label','Extensions and Apps');btn.innerHTML=`${ICONS.puzzle}<span class="nx-ext-dot"></span>`;btn.addEventListener('click',open);toolbar.insertBefore(btn,badge||null);toolbar.style.gridTemplateColumns='repeat(5,46px) minmax(0,1fr)';return true;
  }

  function install(){installStyle();modal();installButton();renderApps();return true;}

  window.NexusNovaBrowserExtensions=Object.freeze({version:'extensions-apps-hub-v2',install,open,close,installApp,uninstallApp,loadApps,providerInfo});
  window.nxOpenBrowserExtensions=open;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(install,650),{once:true}); else setTimeout(install,650);
  [1200,2400,4200].forEach(ms=>setTimeout(install,ms));
})();