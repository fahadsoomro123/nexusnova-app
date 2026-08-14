/* NexusNova Mobile + Wallet UX v1
   UI-only enhancements. Does not mutate balances, transactions or wallet providers. */
(() => {
  'use strict';

  const HIDE_ZERO_KEY = 'nexusnova_wallet_hide_zero_v1';
  const $ = id => document.getElementById(id);

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
    list.querySelectorAll(':scope > .wallet-asset-row, :scope > [data-wallet-asset], :scope > .coin-row').forEach(row => {
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
      <span class="nx-wallet-switch" aria-hidden="true">
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

    const cards = Array.from(tab.children).filter(el => el.classList?.contains('card'));
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

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();

  window.NexusNovaMobileWalletUX = {
    version:'mobile-wallet-ux-v1',
    install:installWalletLayout,
    applyZeroFilter
  };
})();
