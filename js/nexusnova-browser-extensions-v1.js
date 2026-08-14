/* NexusNova Browser Extensions Hub v1
   Safe extension-like integrations for the NexusNova browser.
   Important: Android WebView cannot install arbitrary Chrome .crx extensions.
   This hub supports approved NexusNova modules and compatible injected wallet providers.
*/
(() => {
  'use strict';
  if (window.__nxBrowserExtensionsV1) return;
  window.__nxBrowserExtensionsV1 = true;
  window.nexusBrowserExtensionsVersion = 'extensions-hub-v1';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const ICONS = {
    puzzle:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 4H4v4.5a2.5 2.5 0 1 0 0 5V20h4.5a2.5 2.5 0 1 1 5 0H20v-6.5a2.5 2.5 0 1 0 0-5V4h-6.5a2.5 2.5 0 1 0-5 0Z"/></svg>',
    wallet:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h14a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11"/><path d="M15 11h6v4h-6a2 2 0 1 1 0-4Z"/></svg>',
    shield:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 2.7 7.8 7 10 4.3-2.2 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/></svg>',
    check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
    external:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5h6v6"/><path d="m19 5-8 8"/><path d="M18 13v6H5V6h6"/></svg>',
    close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    info:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg>'
  };

  function installStyle(){
    if ($('#nxBrowserExtensionsStyle')) return;
    const s=document.createElement('style');
    s.id='nxBrowserExtensionsStyle';
    s.textContent=`
      .nx-ext-btn{position:relative;display:grid;place-items:center;width:46px;height:44px;padding:0!important;border-radius:14px!important;border:1px solid rgba(83,164,255,.22)!important;background:linear-gradient(160deg,rgba(21,48,80,.92),rgba(5,16,30,.96))!important;color:#cfe8ff!important;cursor:pointer;box-shadow:0 8px 19px rgba(0,0,0,.27),inset 0 1px 0 rgba(255,255,255,.055)!important;transition:.15s ease!important}.nx-ext-btn:hover{transform:translateY(-1px);border-color:rgba(93,180,255,.5)!important;box-shadow:0 10px 24px rgba(0,0,0,.32),0 0 20px rgba(47,140,255,.11)!important}.nx-ext-btn svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.nx-ext-dot{position:absolute;right:7px;top:7px;width:7px;height:7px;border-radius:50%;background:#4da3ff;box-shadow:0 0 12px rgba(77,163,255,.85)}
      .nx-ext-overlay{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,4,10,.82);backdrop-filter:blur(12px)}.nx-ext-overlay.open{display:flex}.nx-ext-modal{width:min(720px,100%);max-height:min(86vh,760px);overflow:auto;border-radius:28px;border:1px solid rgba(83,165,255,.3);background:radial-gradient(500px 220px at 0% 0%,rgba(45,139,255,.18),transparent 65%),linear-gradient(155deg,#0a1d35,#030a14 55%,#061426);box-shadow:0 34px 90px rgba(0,0,0,.68),0 0 50px rgba(40,133,255,.1);color:#eef7ff}.nx-ext-head{position:sticky;top:0;z-index:2;display:flex;align-items:flex-start;gap:12px;padding:18px;border-bottom:1px solid rgba(83,165,255,.18);background:rgba(5,16,30,.94);backdrop-filter:blur(12px)}.nx-ext-logo{display:grid;place-items:center;flex:0 0 48px;width:48px;height:48px;border-radius:16px;background:linear-gradient(145deg,#1268dc,#55b8ff);box-shadow:0 12px 28px rgba(25,118,255,.28),inset 0 1px 0 rgba(255,255,255,.2)}.nx-ext-logo svg{width:25px;height:25px;fill:none;stroke:white;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.nx-ext-title{flex:1}.nx-ext-kicker{font-size:8px;letter-spacing:.18em;font-weight:950;color:#72bbff}.nx-ext-title h3{margin:3px 0 3px;font-size:21px;letter-spacing:-.03em}.nx-ext-title p{margin:0;color:#94b4d6;font-size:10px;line-height:1.5}.nx-ext-close{display:grid;place-items:center;width:38px;height:38px;border-radius:13px;border:1px solid rgba(110,180,255,.18);background:#07172a;color:#a9c9e9;cursor:pointer}.nx-ext-close svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2}
      .nx-ext-body{padding:16px}.nx-ext-notice{display:flex;gap:10px;padding:12px;margin-bottom:14px;border:1px solid rgba(85,164,255,.16);border-radius:16px;background:rgba(8,29,53,.65);color:#a8c5e3;font-size:10px;line-height:1.55}.nx-ext-notice svg{flex:0 0 auto;width:17px;height:17px;fill:none;stroke:#69b6ff;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.nx-ext-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.nx-ext-card{position:relative;padding:14px;border-radius:19px;border:1px solid rgba(80,159,255,.17);background:linear-gradient(155deg,rgba(18,44,76,.82),rgba(5,15,28,.94));box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 12px 25px rgba(0,0,0,.24)}.nx-ext-card-head{display:flex;align-items:center;gap:10px}.nx-ext-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:14px;background:linear-gradient(145deg,rgba(20,96,201,.72),rgba(20,54,93,.9));color:#8ed0ff;box-shadow:inset 0 1px 0 rgba(255,255,255,.09)}.nx-ext-icon svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.nx-ext-card h4{margin:0 0 2px;font-size:13px}.nx-ext-type{font-size:8px;color:#77acd9;letter-spacing:.08em;font-weight:850}.nx-ext-card p{min-height:42px;margin:10px 0;color:#8daac8;font-size:9.5px;line-height:1.5}.nx-ext-status{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;margin-bottom:9px;border-radius:999px;border:1px solid rgba(96,177,255,.15);background:rgba(8,35,62,.6);color:#91c9f8;font-size:8px;font-weight:900}.nx-ext-status.good{color:#8fe0bd;border-color:rgba(61,207,143,.18);background:rgba(18,80,55,.22)}.nx-ext-status.warn{color:#ffd28a;border-color:rgba(255,179,67,.18);background:rgba(110,70,13,.18)}.nx-ext-actions{display:flex;gap:7px;flex-wrap:wrap}.nx-ext-action{flex:1;min-width:110px;min-height:38px;padding:8px 10px;border:1px solid rgba(88,169,255,.2);border-radius:12px;background:linear-gradient(145deg,#0a315d,#07182c);color:#d9ecff;font-size:9px;font-weight:900;cursor:pointer}.nx-ext-action.primary{border-color:rgba(89,188,255,.35);background:linear-gradient(135deg,#0d67f8,#52b5ff);color:white;box-shadow:0 8px 20px rgba(25,118,255,.23)}.nx-ext-action:disabled{opacity:.42;cursor:not-allowed}.nx-ext-foot{margin-top:13px;padding:11px 12px;border-radius:15px;border:1px solid rgba(78,154,238,.12);background:rgba(3,12,23,.72);font-size:9px;color:#7798bc;line-height:1.55}.nx-ext-account{margin-top:8px;word-break:break-all;color:#a8d7ff;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px}
      @media(max-width:620px){.nx-ext-grid{grid-template-columns:1fr}.nx-ext-modal{border-radius:22px}.nx-ext-head{padding:14px}.nx-ext-body{padding:12px}.nx-ext-btn{width:39px;height:39px;border-radius:12px!important}}
    `;
    document.head.appendChild(s);
  }

  function providerInfo(){
    const eth=window.ethereum;
    if(!eth) return {available:false,name:'No injected wallet',provider:null};
    let name='Web3 Wallet';
    if(eth.isMetaMask) name='MetaMask';
    else if(eth.isRabby) name='Rabby Wallet';
    else if(eth.isCoinbaseWallet) name='Coinbase Wallet';
    return {available:true,name,provider:eth};
  }

  function modal(){
    let overlay=$('#nxBrowserExtensionsOverlay');
    if(overlay) return overlay;
    overlay=document.createElement('div');
    overlay.id='nxBrowserExtensionsOverlay';
    overlay.className='nx-ext-overlay';
    overlay.innerHTML=`
      <div class="nx-ext-modal" role="dialog" aria-modal="true" aria-labelledby="nxExtTitle">
        <div class="nx-ext-head">
          <div class="nx-ext-logo">${ICONS.puzzle}</div>
          <div class="nx-ext-title"><div class="nx-ext-kicker">NEXUSNOVA // EXTENSION LAYER</div><h3 id="nxExtTitle">Extensions Hub</h3><p>Approved browser add-ons, wallet connectors and future NexusNova modules.</p></div>
          <button class="nx-ext-close" type="button" data-nx-ext-close aria-label="Close">${ICONS.close}</button>
        </div>
        <div class="nx-ext-body">
          <div class="nx-ext-notice">${ICONS.info}<span><strong>Android note:</strong> NexusNova Browser uses Android WebView, so normal desktop Chrome <code>.crx</code> extensions cannot be installed directly. This hub provides compatible integrations instead of pretending unsupported extensions will work.</span></div>
          <div class="nx-ext-grid">
            <article class="nx-ext-card" data-ext="wallet">
              <div class="nx-ext-card-head"><div class="nx-ext-icon">${ICONS.wallet}</div><div><h4>Web3 Wallet Connector</h4><div class="nx-ext-type">METAMASK • RABBY • EIP-1193</div></div></div>
              <p>Connect an injected wallet when NexusNova runs in a browser that already provides one. Android wallet-app support is handled as a dedicated connector, not a fake Chrome extension.</p>
              <div class="nx-ext-status" data-ext-wallet-status>Checking wallet…</div>
              <div class="nx-ext-actions"><button class="nx-ext-action primary" type="button" data-ext-wallet-connect>Connect wallet</button><button class="nx-ext-action" type="button" data-ext-wallet-site>MetaMask info</button></div>
              <div class="nx-ext-account" data-ext-account></div>
            </article>
            <article class="nx-ext-card" data-ext="security">
              <div class="nx-ext-card-head"><div class="nx-ext-icon">${ICONS.shield}</div><div><h4>Nexus Shield</h4><div class="nx-ext-type">BUILT-IN • SECURITY</div></div></div>
              <p>Built-in protection layer for unsafe local/data URL schemes and HTTPS-first navigation inside the NexusNova Browser shell.</p>
              <div class="nx-ext-status good">${ICONS.check} Active</div>
              <div class="nx-ext-actions"><button class="nx-ext-action" type="button" disabled>Built in</button></div>
            </article>
            <article class="nx-ext-card" data-ext="future">
              <div class="nx-ext-card-head"><div class="nx-ext-icon">${ICONS.puzzle}</div><div><h4>Nexus Add-ons</h4><div class="nx-ext-type">APPROVED MODULES</div></div></div>
              <p>Reserved for future NexusNova add-ons such as translator, password tools, ad controls, note clipper and other audited modules.</p>
              <div class="nx-ext-status warn">Extension framework ready</div>
              <div class="nx-ext-actions"><button class="nx-ext-action" type="button" disabled>Coming modules</button></div>
            </article>
            <article class="nx-ext-card" data-ext="developer">
              <div class="nx-ext-card-head"><div class="nx-ext-icon">${ICONS.external}</div><div><h4>Extension Policy</h4><div class="nx-ext-type">SAFE • CONTROLLED</div></div></div>
              <p>Arbitrary third-party scripts are not silently injected into visited pages. New add-ons must be explicitly approved and permission-scoped.</p>
              <div class="nx-ext-status good">Controlled install model</div>
              <div class="nx-ext-actions"><button class="nx-ext-action" type="button" data-ext-policy>Show compatibility</button></div>
            </article>
          </div>
          <div class="nx-ext-foot">NexusNova Extensions Hub v1 keeps the browser extensible without weakening the app's security model. Desktop/PWA can use compatible injected providers; Android will use native/mobile connector flows where required.</div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    $('[data-nx-ext-close]',overlay)?.addEventListener('click',close);
    overlay.addEventListener('click',e=>{ if(e.target===overlay) close(); });
    $('[data-ext-wallet-connect]',overlay)?.addEventListener('click',connectWallet);
    $('[data-ext-wallet-site]',overlay)?.addEventListener('click',()=>openExternal('https://metamask.io/'));
    $('[data-ext-policy]',overlay)?.addEventListener('click',()=>{
      alert('NexusNova Browser supports approved in-app add-ons and compatible wallet connectors. Android WebView cannot install arbitrary desktop Chrome .crx extensions.');
    });
    return overlay;
  }

  function openExternal(url){
    try{
      if(typeof window.nxOpenExternal==='function'){ window.nxOpenExternal(url); return; }
      const a=document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener noreferrer'; document.body.appendChild(a); a.click(); a.remove();
    }catch(_){ }
  }

  async function connectWallet(){
    const info=providerInfo();
    const root=modal();
    const status=$('[data-ext-wallet-status]',root);
    const account=$('[data-ext-account]',root);
    const button=$('[data-ext-wallet-connect]',root);
    if(!info.available){
      if(status){ status.className='nx-ext-status warn'; status.textContent='No injected wallet detected here'; }
      if(account) account.textContent='On Android, use the wallet/mobile connector flow rather than a desktop Chrome extension.';
      return;
    }
    try{
      if(button) button.disabled=true;
      if(status){ status.className='nx-ext-status'; status.textContent=`Connecting ${info.name}…`; }
      const accounts=await info.provider.request({method:'eth_requestAccounts'});
      const first=Array.isArray(accounts) ? accounts[0] : '';
      if(status){ status.className='nx-ext-status good'; status.textContent=`${info.name} connected`; }
      if(account) account.textContent=first ? `Account: ${first}` : 'Wallet connected.';
      try{ window.dispatchEvent(new CustomEvent('nexusnova:wallet-connected',{detail:{provider:info.name,account:first||''}})); }catch(_){ }
    }catch(error){
      if(status){ status.className='nx-ext-status warn'; status.textContent='Wallet connection cancelled or unavailable'; }
      if(account) account.textContent=String(error?.message || '').slice(0,180);
    }finally{ if(button) button.disabled=false; }
  }

  function refresh(){
    const root=modal();
    const info=providerInfo();
    const status=$('[data-ext-wallet-status]',root);
    const button=$('[data-ext-wallet-connect]',root);
    if(info.available){
      if(status){ status.className='nx-ext-status good'; status.textContent=`${info.name} detected`; }
      if(button){ button.disabled=false; button.textContent=`Connect ${info.name}`; }
    }else{
      if(status){ status.className='nx-ext-status warn'; status.textContent='No injected wallet detected'; }
      if(button){ button.disabled=false; button.textContent='Connect wallet'; }
    }
  }

  function open(){ const m=modal(); refresh(); m.classList.add('open'); document.documentElement.style.overflow='hidden'; }
  function close(){ $('#nxBrowserExtensionsOverlay')?.classList.remove('open'); document.documentElement.style.overflow=''; }

  function installButton(){
    const toolbar=$('[data-nx-browser-toolbar]');
    if(!toolbar || $('[data-nx-browser-extensions]',toolbar)) return false;
    const badge=$('.nx-browser-badge',toolbar);
    const btn=document.createElement('button');
    btn.type='button'; btn.className='nx-ext-btn'; btn.dataset.nxBrowserExtensions='1'; btn.title='Extensions'; btn.setAttribute('aria-label','Extensions');
    btn.innerHTML=`${ICONS.puzzle}<span class="nx-ext-dot"></span>`;
    btn.addEventListener('click',open);
    toolbar.insertBefore(btn,badge || null);
    toolbar.style.gridTemplateColumns='repeat(5,46px) minmax(0,1fr)';
    return true;
  }

  function install(){ installStyle(); modal(); installButton(); return true; }

  window.NexusNovaBrowserExtensions=Object.freeze({version:'extensions-hub-v1',install,open,close,providerInfo,connectWallet});
  window.nxOpenBrowserExtensions=open;

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(install,700),{once:true});
  else setTimeout(install,700);
  [1200,2400,4200].forEach(ms=>setTimeout(install,ms));
})();