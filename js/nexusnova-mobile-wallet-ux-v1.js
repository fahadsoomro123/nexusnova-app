/* NexusNova Mobile + Wallet UX v1
   UI-only enhancements. Does not mutate balances, transactions or wallet providers. */
(() => {
  'use strict';

  const HIDE_ZERO_KEY = 'nexusnova_wallet_hide_zero_v1';
  const $ = id => document.getElementById(id);

  function installStyles(){
    if(document.getElementById('nxMobileWalletUxStyles')) return;
    const style = document.createElement('style');
    style.id = 'nxMobileWalletUxStyles';
    style.textContent = `
      html{scroll-behavior:smooth;overscroll-behavior-y:none}
      body{touch-action:pan-y;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
      .wallet-assets-scroll,.chat-box,.ai-box,.more-menu,.nx-scripture-reader,.nxmega-search-results{
        -webkit-overflow-scrolling:touch;scroll-behavior:smooth;overscroll-behavior:contain
      }
      .nx-wallet-zero-toggle{
        display:flex;align-items:center;justify-content:space-between;gap:14px;
        margin:12px 0 10px;padding:12px 13px;border-radius:15px;
        background:linear-gradient(180deg,rgba(39,126,255,.10),rgba(13,34,63,.34));
        border:1px solid rgba(78,157,255,.22);cursor:pointer;user-select:none
      }
      .nx-wallet-zero-copy{display:flex;flex-direction:column;min-width:0}
      .nx-wallet-zero-copy strong{font-size:.84rem;color:#fff;line-height:1.2}
      .nx-wallet-zero-copy small{font-size:.67rem;color:var(--sub,#9db9dc);margin-top:4px;line-height:1.3}
      .nx-wallet-switch{position:relative;display:inline-flex;flex:0 0 auto;width:46px;height:26px}
      .nx-wallet-switch input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
      .nx-wallet-switch i{
        position:absolute;inset:0;border-radius:999px;background:#17263b;
        border:1px solid rgba(103,166,244,.28);box-shadow:inset 0 2px 7px rgba(0,0,0,.30);
        transition:background .18s ease,border-color .18s ease
      }
      .nx-wallet-switch i:after{
        content:'';position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;
        background:#dbeaff;box-shadow:0 3px 8px rgba(0,0,0,.38);transition:transform .18s ease,background .18s ease
      }
      .nx-wallet-switch input:checked+i{background:linear-gradient(135deg,#0b69f8,#38b8ff);border-color:rgba(116,205,255,.65)}
      .nx-wallet-switch input:checked+i:after{transform:translateX(20px);background:#fff}
      .nx-wallet-actions-card{scroll-margin-top:86px}
      .nx-wallet-assets-card{scroll-margin-top:86px}
      .nx-zero-hidden{display:none!important}

      @media(max-width:700px){
        body{padding-bottom:132px!important}
        .bottom-dock{
          bottom:max(24px,env(safe-area-inset-bottom))!important;
          left:10px!important;right:10px!important;
          transform:translateZ(0);will-change:transform
        }
        body:not(.nx-allapps-open) .more-menu{
          bottom:calc(max(24px,env(safe-area-inset-bottom)) + 78px)!important
        }
        .dock-item{padding:8px 3px 7px!important}
        .dock-item .mi-icon{width:22px!important;height:22px!important}
        .dock-item .mi-icon svg{width:18px!important;height:18px!important}
        .more-item .mi-icon{width:52px!important;height:52px!important}
        .more-item .mi-icon svg{width:26px!important;height:26px!important}
        button .mi-icon,.tool-btn .mi-icon,.settings-btn .mi-icon,.nexus-tool-chip .mi-icon{
          width:16px!important;height:16px!important
        }
        button .mi-icon svg,.tool-btn .mi-icon svg,.settings-btn .mi-icon svg,.nexus-tool-chip .mi-icon svg{
          width:13px!important;height:13px!important
        }
        .feature-tile .mi-icon{width:36px!important;height:36px!important}
        .feature-tile .mi-icon svg{width:17px!important;height:17px!important}
        .h-ico .mi-icon{width:29px!important;height:29px!important}
        .h-ico .mi-icon svg{width:14px!important;height:14px!important}
        .wallet-asset-row img,.coin-row img{max-width:38px!important;max-height:38px!important}
        .bottom-dock,.more-menu{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
        .card,.wallet-asset-row,.coin-row{backface-visibility:hidden;transform:translateZ(0)}
      }
    `;
    document.head.appendChild(style);
  }

  function savedHideZero(){
    try { return localStorage.getItem(HIDE_ZERO_KEY) === '1'; }
    catch (_) { return false; }
  }

  function saveHideZero(value){
    try { localStorage.setItem(HIDE_ZERO_KEY, value ? '1' : '0'); }
    catch (_) {}
  }

  function numericBalance(row){
    if(!row) return null;
    const explicit = row.querySelector('.wallet-live-balance,[data-wallet-balance],[data-balance]');
    const raw = explicit?.getAttribute('data-wallet-balance') ||
      explicit?.getAttribute('data-balance') ||
      explicit?.textContent || '';
    const match = String(raw).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);
    if(match) return Number(match[0]);

    const lines = String(row.innerText || row.textContent || '')
      .split(/\n+/).map(v => v.trim()).filter(Boolean);
    for(let i = lines.length - 1; i >= 0; i--){
      const m = lines[i].replace(/,/g,'').match(/^(-?\d+(?:\.\d+)?)\s+\S+/);
      if(m) return Number(m[1]);
    }
    return null;
  }

  function applyZeroFilter(){
    const list = $('walletAssetList');
    const toggle = $('nxWalletHideZero');
    if(!list || !toggle) return;
    const hide = Boolean(toggle.checked);
    list.querySelectorAll('.wallet-asset-row,[data-wallet-asset],.coin-row').forEach(row => {
      const balance = numericBalance(row);
      row.hidden = hide && Number.isFinite(balance) && Math.abs(balance) < 1e-12;
      row.classList.toggle('nx-zero-hidden', row.hidden);
    });
  }

  function makeToggle(){
    const wrap = document.createElement('label');
    wrap.id = 'nxWalletZeroToggle';
    wrap.className = 'nx-wallet-zero-toggle';
    wrap.innerHTML = `
      <span class="nx-wallet-zero-copy">
        <strong>Hide zero balances</strong>
        <small>Show only coins that currently have a balance</small>
      </span>
      <span class="nx-wallet-switch">
        <input id="nxWalletHideZero" type="checkbox" aria-label="Hide zero balance coins">
        <i></i>
      </span>`;
    const input = wrap.querySelector('#nxWalletHideZero');
    input.checked = savedHideZero();
    input.addEventListener('change', () => {
      saveHideZero(input.checked);
      applyZeroFilter();
    });
    return wrap;
  }

  function installWalletLayout(){
    const tab = $('tab-wallet');
    const list = $('walletAssetList');
    if(!tab || !list) return false;

    const assetCard = list.closest('.card');
    const actionCard = $('connectWalletBtn')?.closest('.card') || $('walletActionStatus')?.closest('.card');

    if(actionCard && assetCard && actionCard !== assetCard){
      actionCard.classList.add('nx-wallet-actions-card');
      assetCard.classList.add('nx-wallet-assets-card');
      if(actionCard.nextElementSibling !== assetCard){
        tab.insertBefore(actionCard, assetCard);
      }
    }

    if(assetCard && !$('nxWalletZeroToggle')){
      const header = assetCard.querySelector('.market-header');
      const toggle = makeToggle();
      if(header?.nextSibling) assetCard.insertBefore(toggle, header.nextSibling);
      else assetCard.prepend(toggle);
    }

    if(!list.dataset.nxZeroObserver){
      list.dataset.nxZeroObserver = '1';
      const observer = new MutationObserver(() => requestAnimationFrame(applyZeroFilter));
      observer.observe(list,{childList:true,subtree:true,characterData:true});
    }

    applyZeroFilter();
    return true;
  }

  function install(){
    installStyles();
    installWalletLayout();
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if(installWalletLayout() || attempts > 30) clearInterval(timer);
    }, 250);

    document.addEventListener('click', event => {
      if(event.target.closest('[data-tab="wallet"], .dock-item[onclick*="wallet"], [onclick*="switchTab(\'wallet\'"]')){
        setTimeout(installWalletLayout, 0);
      }
    }, true);
  }

  installStyles();
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();

  window.NexusNovaMobileWalletUX = {
    version:'mobile-wallet-ux-v1',
    install:installWalletLayout,
    applyZeroFilter
  };
})();
