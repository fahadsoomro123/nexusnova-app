/* NexusNova Modern UI v1
   UI-only controller for Nova Hub naming, clean launcher hierarchy and compact navigation hooks.
   No mining, reward, wallet, auth, ad value or Firebase writes.
*/
(() => {
  'use strict';
  if (window.__nxModernUiV1) return;
  window.__nxModernUiV1 = true;

  const CSS_MARKER = 'data-nx-modern-ui-v1';
  const COMPAT_STYLE_ID = 'nxModernUiCompatV1';
  const $ = (s, root = document) => root.querySelector(s);
  const qsa = (s, root = document) => Array.from(root.querySelectorAll(s));

  function ensureCss() {
    if (!$(`link[${CSS_MARKER}]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './css/nexusnova-modern-ui-v1.css?v=20260817-modern5';
      link.setAttribute(CSS_MARKER, '1');
      document.head.appendChild(link);
    }
    if (!document.getElementById(COMPAT_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = COMPAT_STYLE_ID;
      style.textContent = `
        /* Android/WebView fallback + legacy launcher override guard. */
        body #moreMenu.more-menu::before{display:none!important;content:none!important}
        body #moreMenu #nxAllAppsSmartSearch{order:-30!important}
        body #moreMenu #nxAllAppsSmartSearch .nx-smart-row{display:flex!important;align-items:center!important;gap:7px!important}
        body #moreMenu #nxAllAppsSmartSearch .nx-smart-row input{flex:1 1 auto!important;min-width:0!important}
        body #moreMenu #nxAllAppsSmartSearch .nx-smart-row button{flex:0 0 auto!important;width:auto!important}
        #moreMenu .more-item .mi-icon{
          color:var(--mi-a,#66adff)!important;
          background:#0d1727!important;
          border-color:rgba(96,145,204,.20)!important;
          box-shadow:none!important;
        }
        body #moreMenu .more-item[onclick*="browser"] .mi-icon{
          color:#66adff!important;background:#0d1727!important;border-color:rgba(96,145,204,.20)!important;
          box-shadow:none!important;filter:none!important;
        }
        #moreMenu .more-item[data-nx-speedtest-v4="1"] .mi-icon{color:#62d6e5!important;background:#0b1925!important;border-color:rgba(98,214,229,.22)!important;box-shadow:none!important}
        #moreMenu .more-item[data-nxmega="productivity"] .mi-icon{color:#82adff!important;background:#10182a!important;border-color:rgba(130,173,255,.22)!important;box-shadow:none!important}
        #moreMenu .more-item > span:not(.mi-icon):not(.nx-brand-app-badge){
          margin:0!important;padding:0 2px!important;color:#c9d7e8!important;text-shadow:none!important;
          font-size:9.5px!important;line-height:1.15!important;font-weight:720!important;letter-spacing:0!important;
          text-transform:none!important;text-align:center!important;white-space:normal!important;overflow-wrap:anywhere!important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  function targetOf(button) {
    if (!button) return '';
    if (button.dataset?.nxmega) return String(button.dataset.nxmega);
    if (button.dataset?.nxSpeedtestV4 === '1' || button.hasAttribute('data-nx-speedtest-v4')) return 'speed-test';
    const match = String(button.getAttribute('onclick') || '').match(/openMoreTab\(\s*['"]([^'"]+)['"]\s*\)/);
    return match?.[1] || '';
  }

  function labelNode(button) {
    return qsa(':scope > span', button)
      .filter(node => !node.classList.contains('mi-icon') && !node.classList.contains('nx-brand-app-badge'))
      .pop() || null;
  }

  function setText(node, value) {
    if (node && String(node.textContent || '').trim() !== value) node.textContent = value;
  }

  function renameHubLanguage() {
    const moreBtn = $('#moreBtn');
    const label = moreBtn ? labelNode(moreBtn) : null;
    setText(label,'Nova Hub');
    if (moreBtn) {
      if (moreBtn.getAttribute('aria-label') !== 'Open Nova Hub') moreBtn.setAttribute('aria-label','Open Nova Hub');
      if (moreBtn.title !== 'Nova Hub') moreBtn.title = 'Nova Hub';
    }

    qsa('[aria-label*="ALL APPS" i],[title*="ALL APPS" i]').forEach(node => {
      if (node.hasAttribute('aria-label')) node.setAttribute('aria-label',node.getAttribute('aria-label').replace(/ALL APPS/gi,'Nova Hub'));
      if (node.hasAttribute('title')) node.setAttribute('title',node.getAttribute('title').replace(/ALL APPS/gi,'Nova Hub'));
    });

    qsa('#nxUxBackHint').forEach(node => { if (/all apps/i.test(node.textContent || '')) setText(node,'NOVA HUB'); });
  }

  function ensureHeader() {
    const inner = $('#moreMenu .more-inner');
    if (!inner) return null;
    let header = $('#nxNovaHubHeader',inner);
    if (!header) {
      header = document.createElement('div');
      header.id = 'nxNovaHubHeader';
      header.innerHTML = `
        <div class="nxm-hub-title">
          <span class="nxm-hub-mark" aria-hidden="true">N</span>
          <div><strong>Nova Hub</strong><small>Daily tools, knowledge and utilities in one place</small></div>
        </div>
        <button id="nxNovaHubClose" type="button" aria-label="Close Nova Hub">×</button>`;
      inner.prepend(header);
      $('#nxNovaHubClose',header)?.addEventListener('click',() => {
        try { $('#moreBtn')?.click(); } catch (_) { $('#moreMenu')?.classList.remove('show'); }
      });
    }
    return header;
  }

  function ensureSectionLabel() {
    const inner = $('#moreMenu .more-inner');
    if (!inner) return;
    let node = $('#nxNovaHubSection',inner);
    if (!node) {
      node = document.createElement('div');
      node.id = 'nxNovaHubSection';
      node.innerHTML = '<b>Apps & tools</b><span>Tap an icon to open</span>';
      const search = $('#nxAllAppsSmartSearch',inner);
      if (search?.nextSibling) inner.insertBefore(node,search.nextSibling);
      else inner.appendChild(node);
    }
  }

  const LABELS = Object.freeze({
    'tools':'Tools','speed-test':'Speed Test','productivity':'Nova Desk','ai':'AI Assistant','browser':'Browser',
    'finance':'Gold & FX','news':'News','chat':'Chat','location':'Location','emergency':'SOS','family':'Family',
    'profile':'Profile','tasks':'Rewards','money':'Budget','learn':'Learn','travel':'Travel','health':'Health',
    'smart':'Smart Tools','qibla':'Qibla','entertainment':'Entertainment','caller-id':'Caller ID','about':'Settings'
  });

  const PRIORITY = [
    'tools','speed-test','productivity','ai','browser','finance','news','money','learn','travel','health','smart',
    'location','qibla','chat','family','emergency','entertainment','caller-id','profile','tasks','about'
  ];

  function normalizeTiles() {
    const inner = $('#moreMenu .more-inner');
    if (!inner) return;
    const seen = new Set();
    qsa('.more-item',inner).forEach((tile,index) => {
      const target = targetOf(tile);
      if (target && tile.dataset.nxHubTarget !== target) tile.dataset.nxHubTarget = target;
      const label = labelNode(tile);
      if (label && LABELS[target]) setText(label,LABELS[target]);
      const priority = PRIORITY.indexOf(target);
      const order = String(priority >= 0 ? priority : 80 + index);
      if (tile.style.getPropertyValue('order') !== order || tile.style.getPropertyPriority('order') !== 'important') {
        tile.style.setProperty('order',order,'important');
      }
      if (target) {
        const key = `${target}:${String(label?.textContent || '').trim().toLowerCase()}`;
        if (seen.has(key)) {
          if (!tile.hidden) tile.hidden = true;
          if (tile.getAttribute('aria-hidden') !== 'true') tile.setAttribute('aria-hidden','true');
        } else {
          seen.add(key);
          if (tile.hidden && tile.getAttribute('aria-hidden') === 'true') {
            tile.hidden = false;
            tile.removeAttribute('aria-hidden');
          }
        }
      }
    });
  }

  function promoteNovaDesk() {
    const tile = $('#moreMenu .more-item[data-nxmega="productivity"]');
    if (tile) {
      setText(labelNode(tile),'Nova Desk');
      if (tile.getAttribute('aria-label') !== 'Open Nova Desk') tile.setAttribute('aria-label','Open Nova Desk');
    }
    const tab = $('#tab-productivity');
    if (!tab) return;
    setText($('.nxpd-hero h2',tab),'Nova Desk');
    const kicker = $('.nxpd-kicker',tab);
    if (kicker && !/NOVA DESK/i.test(kicker.textContent || '')) setText(kicker,'NEXUSNOVA • NOVA DESK');
    const copy = $('.nxpd-hero p',tab);
    if (copy && !/text, dates and quick office tasks/i.test(copy.textContent || '')) {
      setText(copy,'Private text, dates and quick office tasks — saved locally on your device.');
    }
  }

  function polishSearchCopy() {
    const panel = $('#nxAllAppsSmartSearch');
    if (!panel) return;
    const input = $('[data-smart-input]',panel);
    if (input && input.placeholder !== 'Search Nova Hub…') input.placeholder = 'Search Nova Hub…';
    const status = $('[data-smart-status]',panel);
    if (status && /Type what you need/i.test(status.textContent || '')) setText(status,'Find any NexusNova tool instantly.');
  }

  function apply() {
    ensureCss();
    document.body?.classList.add('nx-modern-ui-ready');
    renameHubLanguage();
    ensureHeader();
    ensureSectionLabel();
    promoteNovaDesk();
    normalizeTiles();
    polishSearchCopy();
    try { window.NexusNovaUxSimplify?.refresh?.(); } catch (_) {}
  }

  let queued = false;
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();

  const observer = new MutationObserver(queue);
  const start = () => document.body && observer.observe(document.body,{childList:true,subtree:true});
  if (document.body) start(); else document.addEventListener('DOMContentLoaded',start,{once:true});
  [200,600,1200,2400,5000].forEach(ms => setTimeout(apply,ms));

  window.NexusNovaModernUI = Object.freeze({version:'1.0.4',refresh:apply});
})();
