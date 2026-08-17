/* NexusNova Modern UI v1
   UI-only controller for Nova Hub naming, clean launcher hierarchy and compact navigation hooks.
   No mining, reward, wallet, auth, ad value or Firebase writes.
*/
(() => {
  'use strict';
  if (window.__nxModernUiV1) return;
  window.__nxModernUiV1 = true;

  const CSS_MARKER = 'data-nx-modern-ui-v1';
  const $ = (s, root = document) => root.querySelector(s);
  const qsa = (s, root = document) => Array.from(root.querySelectorAll(s));

  function ensureCss() {
    if ($(`link[${CSS_MARKER}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './css/nexusnova-modern-ui-v1.css?v=20260817-modern1';
    link.setAttribute(CSS_MARKER, '1');
    document.head.appendChild(link);
  }

  function targetOf(button) {
    if (!button) return '';
    if (button.dataset?.nxmega) return String(button.dataset.nxmega);
    if (button.dataset?.nxSpeedtestV4 === '1' || button.hasAttribute('data-nx-speedtest-v4')) return 'speed-test';
    const match = String(button.getAttribute('onclick') || '').match(/openMoreTab\(\s*['"]([^'"]+)['"]\s*\)/);
    return match?.[1] || '';
  }

  function labelNode(button) {
    const spans = qsa(':scope > span', button);
    return spans[spans.length - 1] || null;
  }

  function renameHubLanguage() {
    const moreBtn = $('#moreBtn');
    const label = moreBtn ? labelNode(moreBtn) : null;
    if (label && label.textContent.trim() !== 'Nova Hub') label.textContent = 'Nova Hub';
    if (moreBtn) {
      moreBtn.setAttribute('aria-label', 'Open Nova Hub');
      moreBtn.title = 'Nova Hub';
    }

    qsa('[aria-label*="ALL APPS" i],[title*="ALL APPS" i]').forEach(node => {
      if (node.hasAttribute('aria-label')) node.setAttribute('aria-label', node.getAttribute('aria-label').replace(/ALL APPS/gi,'Nova Hub'));
      if (node.hasAttribute('title')) node.setAttribute('title', node.getAttribute('title').replace(/ALL APPS/gi,'Nova Hub'));
    });

    qsa('#nxUxBackHint').forEach(node => { if (/all apps/i.test(node.textContent || '')) node.textContent = 'NOVA HUB'; });
  }

  function ensureHeader() {
    const inner = $('#moreMenu .more-inner');
    if (!inner) return null;
    let header = $('#nxNovaHubHeader', inner);
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
      $('#nxNovaHubClose', header)?.addEventListener('click', () => {
        try { $('#moreBtn')?.click(); } catch (_) { $('#moreMenu')?.classList.remove('show'); }
      });
    }
    return header;
  }

  function ensureSectionLabel() {
    const inner = $('#moreMenu .more-inner');
    if (!inner) return;
    let node = $('#nxNovaHubSection', inner);
    if (!node) {
      node = document.createElement('div');
      node.id = 'nxNovaHubSection';
      node.innerHTML = '<b>Apps & tools</b><span>Tap an icon to open</span>';
      const search = $('#nxAllAppsSmartSearch', inner);
      if (search?.nextSibling) inner.insertBefore(node, search.nextSibling);
      else inner.appendChild(node);
    }
  }

  const LABELS = Object.freeze({
    'tools':'Tools',
    'speed-test':'Speed Test',
    'productivity':'Nova Desk',
    'ai':'AI Assistant',
    'browser':'Browser',
    'finance':'Gold & FX',
    'news':'News',
    'chat':'Chat',
    'location':'Location',
    'emergency':'SOS',
    'family':'Family',
    'profile':'Profile',
    'tasks':'Rewards',
    'money':'Budget',
    'learn':'Learn',
    'travel':'Travel',
    'health':'Health',
    'smart':'Smart Tools',
    'qibla':'Qibla',
    'entertainment':'Entertainment',
    'caller-id':'Caller ID',
    'about':'Settings'
  });

  const PRIORITY = [
    'tools','speed-test','productivity','ai','browser','finance','news','money','learn','travel','health','smart',
    'location','qibla','chat','family','emergency','entertainment','caller-id','profile','tasks','about'
  ];

  function normalizeTiles() {
    const inner = $('#moreMenu .more-inner');
    if (!inner) return;
    const seen = new Set();
    qsa('.more-item', inner).forEach((tile, index) => {
      const target = targetOf(tile);
      if (target) tile.dataset.nxHubTarget = target;
      const label = labelNode(tile);
      if (label && LABELS[target]) label.textContent = LABELS[target];
      const priority = PRIORITY.indexOf(target);
      tile.style.setProperty('order', String(priority >= 0 ? priority : 80 + index), 'important');
      if (target) {
        const key = `${target}:${String(label?.textContent || '').trim().toLowerCase()}`;
        if (seen.has(key)) {
          tile.hidden = true;
          tile.setAttribute('aria-hidden','true');
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
    if (!tile) return;
    const label = labelNode(tile);
    if (label) label.textContent = 'Nova Desk';
    tile.setAttribute('aria-label','Open Nova Desk');
  }

  function polishSearchCopy() {
    const panel = $('#nxAllAppsSmartSearch');
    if (!panel) return;
    const input = $('[data-smart-input]', panel);
    if (input) input.placeholder = 'Search Nova Hub…';
    const status = $('[data-smart-status]', panel);
    if (status && /Type what you need/i.test(status.textContent || '')) status.textContent = 'Find any NexusNova tool instantly.';
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
    try { window.NexusNovaBranding?.refresh?.(); } catch (_) {}
  }

  let queued = false;
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, {once:true});
  else apply();

  const observer = new MutationObserver(queue);
  const start = () => document.body && observer.observe(document.body,{childList:true,subtree:true});
  if (document.body) start(); else document.addEventListener('DOMContentLoaded',start,{once:true});
  [200,600,1200,2400,5000].forEach(ms => setTimeout(apply,ms));

  window.NexusNovaModernUI = Object.freeze({version:'1.0.0',refresh:apply});
})();
