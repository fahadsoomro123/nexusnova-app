/* NexusNova Popup Modernizer v1
   Replaces known legacy browser-alert paths with NexusNova visual UI.
   Additive and scoped: does not override window.alert globally.
*/
(() => {
  'use strict';
  if (window.__nxPopupModernizerV1) return;
  window.__nxPopupModernizerV1 = true;

  const $ = id => document.getElementById(id);
  let uiPromise = null;

  function fallbackToast(text) {
    let el = $('nxPopupModernizerToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'nxPopupModernizerToast';
      el.style.cssText = 'position:fixed;left:50%;bottom:94px;z-index:2147483640;transform:translateX(-50%);max-width:min(90vw,440px);padding:12px 15px;border-radius:14px;background:rgba(8,23,43,.98);border:1px solid rgba(82,168,255,.28);box-shadow:0 16px 42px rgba(0,0,0,.45);color:#f5f9ff;font:700 12px/1.45 system-ui,sans-serif;text-align:center';
      document.body.appendChild(el);
    }
    el.textContent = String(text || '');
    el.hidden = false;
    clearTimeout(el._nxTimer);
    el._nxTimer = setTimeout(() => { el.hidden = true; }, 2800);
  }

  function getUI() {
    if (window.NexusNovaUI) return Promise.resolve(window.NexusNovaUI);
    if (uiPromise) return uiPromise;
    uiPromise = new Promise((resolve) => {
      const done = () => resolve(window.NexusNovaUI || null);
      const existing = document.querySelector('script[data-nx-popup-premium],script[data-nx-premium-ui],script[data-nx-experience-premium]');
      if (existing) {
        window.addEventListener('nexusnova:premium-ui-ready', done, {once:true});
        setTimeout(done, 1400);
        return;
      }
      const script = document.createElement('script');
      script.src = './js/nexusnova-premium-ui-v1.js?v=1';
      script.dataset.nxPopupPremium = '1';
      script.onload = done;
      script.onerror = done;
      document.body.appendChild(script);
    }).finally(() => { uiPromise = null; });
    return uiPromise;
  }

  async function notice({title='NexusNova', subtitle='', text='', icon='spark'} = {}) {
    const ui = await getUI();
    if (ui?.alert) return ui.alert({title, subtitle, text, icon});
    fallbackToast(text || title);
    return true;
  }

  async function toast(text) {
    const ui = await getUI();
    if (ui?.toast) return ui.toast(text);
    fallbackToast(text);
  }

  function qrSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM18 18h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2z"/></svg>';
  }

  async function showWalletQr() {
    const addr = String($('connectedWalletAddress')?.textContent || '').trim();
    if (!addr || addr.length < 10 || /not connected|—|---/i.test(addr)) {
      await notice({
        title:'Connect Wallet First',
        subtitle:'Wallet QR',
        text:'Connect an external wallet before creating its QR code.',
        icon:'security'
      });
      return;
    }

    await getUI();
    document.getElementById('nexusQrModal')?.remove();
    const backdrop = document.createElement('div');
    backdrop.id = 'nexusQrModal';
    backdrop.className = 'nxui-backdrop';
    backdrop.innerHTML = `<div class="nxui-modal" role="dialog" aria-modal="true" aria-labelledby="nxWalletQrTitle">
      <button class="nxui-close" type="button" aria-label="Close">×</button>
      <div class="nxui-hero"><div class="nxui-orb">${qrSvg()}</div><div><div class="nxui-eyebrow">NEXUSNOVA WALLET</div><h2 class="nxui-title" id="nxWalletQrTitle">Wallet QR Code</h2><p class="nxui-subtitle">Scan this code to use the connected wallet address.</p></div></div>
      <div class="nxui-message">
        <div class="nxui-message-box" style="text-align:center">
          <img alt="Wallet address QR code" width="210" height="210" src="https://api.qrserver.com/v1/create-qr-code/?size=210x210&data=${encodeURIComponent(addr)}" style="display:block;margin:0 auto 14px;border-radius:16px;background:#fff;padding:8px;max-width:100%;height:auto">
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;word-break:break-all;color:#a9c5e5">${addr.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}</div>
        </div>
        <div class="nxui-actions"><button class="nxui-btn secondary" data-nx-copy type="button">Copy Address</button><button class="nxui-btn primary" data-nx-close type="button">Done</button></div>
      </div>
    </div>`;
    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';
    const close = () => {
      backdrop.remove();
      document.body.style.removeProperty('overflow');
    };
    backdrop.querySelector('.nxui-close')?.addEventListener('click',close);
    backdrop.querySelector('[data-nx-close]')?.addEventListener('click',close);
    backdrop.addEventListener('mousedown',event=>{if(event.target===backdrop)close();});
    backdrop.querySelector('[data-nx-copy]')?.addEventListener('click',async()=>{
      try {
        await navigator.clipboard.writeText(addr);
        toast('Wallet address copied.');
      } catch (_) {
        notice({title:'Copy Address',text:'Clipboard access is unavailable on this device.',icon:'security'});
      }
    });
  }

  function installLegacyWrappers() {
    const addAlert = window.addNexusPriceAlert;
    if (typeof addAlert === 'function' && !addAlert.__nxModernized) {
      const wrapped = function() {
        const symbol = String($('alertSymbol')?.value || '').trim().toUpperCase();
        const price = Number($('alertPrice')?.value || 0);
        if (!/^[A-Z0-9._-]{1,15}$/.test(symbol) || !(price > 0)) {
          notice({
            title:'Price Alert Details',
            subtitle:'Market Alerts',
            text:'Enter a valid coin symbol and a target price greater than zero.',
            icon:'number'
          });
          return;
        }
        return addAlert.apply(this,arguments);
      };
      wrapped.__nxModernized = true;
      window.addNexusPriceAlert = wrapped;
    }

    const walletQr = window.showNexusWalletQR;
    if (typeof walletQr === 'function' && !walletQr.__nxModernized) {
      const wrapped = function() { return showWalletQr(); };
      wrapped.__nxModernized = true;
      wrapped.__nxPrior = walletQr;
      window.showNexusWalletQR = wrapped;
    }

    const share = window.shareNexusNova;
    if (typeof share === 'function' && !share.__nxModernized) {
      const wrapped = async function() {
        const data = {
          title:'NexusNova',
          text:'All-in-one digital utility • AI, Wallet, Mining, News & Family Hub',
          url:window.location.href
        };
        try {
          if (navigator.share) {
            await navigator.share(data);
            return;
          }
          await navigator.clipboard.writeText(window.location.href);
          await toast('NexusNova link copied to clipboard.');
        } catch (error) {
          if (error?.name === 'AbortError') return;
          await notice({title:'Share NexusNova',text:'Sharing is unavailable on this device right now.',icon:'spark'});
        }
      };
      wrapped.__nxModernized = true;
      wrapped.__nxPrior = share;
      window.shareNexusNova = wrapped;
    }
  }

  function installSmartCapture() {
    if (window.__nxPopupSmartCaptureV1) return;
    window.__nxPopupSmartCaptureV1 = true;
    document.addEventListener('click',event=>{
      const button = event.target.closest('#nxSmartCameraLive,#nxSmartBriefLive');
      if (!button) return;
      if (button.id === 'nxSmartCameraLive' && !$('aiImageInput')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        notice({title:'Camera / Documents',subtitle:'Smart Tools',text:'The NexusNova AI image input is not ready on this screen yet.',icon:'document'});
      }
      if (button.id === 'nxSmartBriefLive' && (!$('aiInput') || typeof window.sendAIMessage !== 'function')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        notice({title:'AI Daily Brief',subtitle:'Smart Tools',text:'NexusNova AI is still loading. Open AI again in a moment.',icon:'spark'});
      }
    },true);
  }

  function install() {
    getUI().catch(()=>{});
    installLegacyWrappers();
    installSmartCapture();
    [500,1200,2500,5000,9000].forEach(ms=>setTimeout(installLegacyWrappers,ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();