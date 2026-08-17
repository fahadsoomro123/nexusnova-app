/* NexusNova Productivity Desk v1
   Stable, local-only productivity utility.
   No Firebase, mining, wallet, ad, auth or network dependencies.
*/
(() => {
  'use strict';
  if (window.__nxProductivityDeskV1) return;
  window.__nxProductivityDeskV1 = true;

  const STORAGE_KEY = 'nexusnova_productivity_text_v1';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  function toast(message, tone = 'info') {
    let node = $('nxProductivityToast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'nxProductivityToast';
      node.className = 'nx-productivity-toast';
      document.body.appendChild(node);
    }
    node.dataset.tone = tone;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('show'), 1800);
  }

  function installStyles() {
    if ($('nxProductivityDeskStyles')) return;
    const style = document.createElement('style');
    style.id = 'nxProductivityDeskStyles';
    style.textContent = `
      #tab-productivity{padding-bottom:96px}
      .nxpd-hero{position:relative;overflow:hidden;padding:18px;border:1px solid rgba(96,185,255,.22);border-radius:22px;background:linear-gradient(145deg,rgba(8,29,55,.98),rgba(3,17,34,.98));box-shadow:0 16px 38px rgba(0,0,0,.22);margin-bottom:14px}
      .nxpd-hero:after{content:"";position:absolute;width:180px;height:180px;border-radius:50%;right:-60px;top:-90px;background:radial-gradient(circle,rgba(54,173,255,.24),transparent 70%);pointer-events:none}
      .nxpd-kicker{font-size:9px;font-weight:900;letter-spacing:.17em;color:#67c8ff;text-transform:uppercase}.nxpd-hero h2{margin:5px 0 5px;font-size:21px;color:#fff}.nxpd-hero p{margin:0;color:#9ab0c7;font-size:12px;line-height:1.55;max-width:590px}
      .nxpd-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);gap:12px}.nxpd-card{border:1px solid rgba(111,172,230,.16);background:linear-gradient(145deg,rgba(8,23,42,.92),rgba(5,16,30,.96));border-radius:18px;padding:14px;box-shadow:0 12px 30px rgba(0,0,0,.16)}
      .nxpd-card h3{margin:0;color:#f5f9ff;font-size:15px}.nxpd-sub{margin:4px 0 11px;color:#88a0ba;font-size:10px;line-height:1.45}.nxpd-textarea{width:100%;min-height:210px;resize:vertical;border:1px solid rgba(96,165,250,.23);border-radius:14px;background:#061321;color:#eaf4ff;padding:12px;font:500 13px/1.55 system-ui,-apple-system,Segoe UI,sans-serif;outline:none;box-sizing:border-box}.nxpd-textarea:focus{border-color:rgba(77,188,255,.58);box-shadow:0 0 0 3px rgba(41,153,255,.09)}
      .nxpd-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:10px 0}.nxpd-stat{padding:9px 7px;border-radius:12px;border:1px solid rgba(103,180,255,.14);background:rgba(12,35,60,.66);text-align:center}.nxpd-stat b{display:block;color:#fff;font-size:15px}.nxpd-stat span{display:block;color:#7e9ab6;font-size:8px;text-transform:uppercase;letter-spacing:.08em;margin-top:2px}
      .nxpd-actions{display:flex;flex-wrap:wrap;gap:7px}.nxpd-btn{appearance:none;border:1px solid rgba(96,174,245,.22);border-radius:11px;background:linear-gradient(145deg,rgba(14,63,112,.74),rgba(8,35,68,.88));color:#dff2ff;padding:9px 10px;font-size:10px;font-weight:800;letter-spacing:.02em;cursor:pointer}.nxpd-btn:active{transform:translateY(1px)}.nxpd-btn.primary{border-color:rgba(59,197,255,.38);background:linear-gradient(145deg,#126cc3,#149fda);color:#fff}.nxpd-btn.quiet{background:rgba(14,31,51,.72);color:#9fb4c9}
      .nxpd-divider{height:1px;background:rgba(114,168,220,.12);margin:12px 0}.nxpd-date-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.nxpd-date-row label{display:block;color:#83a0ba;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.nxpd-date-row input{display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:10px;border:1px solid rgba(96,165,250,.20);border-radius:11px;background:#071725;color:#edf7ff;outline:none;color-scheme:dark}.nxpd-date-result{margin-top:10px;padding:12px;border-radius:14px;border:1px solid rgba(82,187,255,.19);background:rgba(9,36,61,.66)}.nxpd-date-result strong{display:block;color:#fff;font-size:23px;letter-spacing:-.03em}.nxpd-date-result span{display:block;color:#89a6c0;font-size:10px;margin-top:4px;line-height:1.45}.nxpd-privacy{display:flex;gap:8px;align-items:flex-start;margin-top:11px;padding:9px 10px;border-radius:12px;background:rgba(24,111,88,.11);border:1px solid rgba(74,222,128,.14);color:#9dd7bd;font-size:9px;line-height:1.45}.nxpd-privacy b{color:#c8f5dd}
      .nx-productivity-toast{position:fixed;left:50%;bottom:88px;transform:translate(-50%,14px);opacity:0;pointer-events:none;z-index:99999;max-width:min(88vw,430px);padding:9px 13px;border-radius:999px;background:rgba(5,19,32,.96);border:1px solid rgba(97,186,255,.25);color:#dff4ff;font-size:10px;font-weight:800;box-shadow:0 12px 28px rgba(0,0,0,.28);transition:.18s ease}.nx-productivity-toast.show{opacity:1;transform:translate(-50%,0)}.nx-productivity-toast[data-tone="ok"]{border-color:rgba(74,222,128,.28);color:#b9f6d0}.nx-productivity-toast[data-tone="warn"]{border-color:rgba(251,191,36,.28);color:#fde5a6}
      @media(max-width:760px){.nxpd-grid{grid-template-columns:1fr}.nxpd-stats{grid-template-columns:repeat(2,1fr)}.nxpd-date-row{grid-template-columns:1fr}.nxpd-textarea{min-height:190px}}
    `;
    document.head.appendChild(style);
  }

  function icon() {
    return `<span class="mi-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/><path d="M18 3v4M16 5h4"/></svg></span>`;
  }

  function openDesk() {
    try {
      if (typeof window.openMoreTab === 'function') return window.openMoreTab('productivity');
      if (typeof window.switchTab === 'function') return window.switchTab('productivity');
    } catch (_) {}
    document.querySelectorAll('main .tab').forEach(tab => tab.classList.remove('active'));
    $('tab-productivity')?.classList.add('active');
    $('moreMenu')?.classList.remove('show');
    window.scrollTo({top:0,behavior:'auto'});
  }

  function ensureMenu() {
    const box = document.querySelector('#moreMenu .more-inner');
    if (!box || box.querySelector('[data-nxmega="productivity"]')) return;
    const existing = Array.from(box.querySelectorAll('.more-item')).find(button =>
      String(button.textContent || '').trim().toUpperCase() === 'PRODUCTIVITY'
    );
    if (existing) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'more-item';
    button.dataset.nxmega = 'productivity';
    button.dataset.nxStableUtility = '1';
    button.innerHTML = `${icon()}<span>PRODUCTIVITY</span>`;
    button.addEventListener('click', openDesk);
    box.appendChild(button);
  }

  function todayIso() {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0,10);
  }

  function ensureTab() {
    if ($('tab-productivity')) return;
    const main = document.querySelector('main.main') || document.querySelector('main');
    if (!main) return;
    const tab = document.createElement('section');
    tab.id = 'tab-productivity';
    tab.className = 'tab nxmega-tab';
    tab.innerHTML = `
      <div class="nx-allapps-back"><button type="button" class="tool-btn" id="nxPdBack">← ALL APPS</button></div>
      <div class="nxpd-hero nxui-hero">
        <div class="nxpd-kicker">NEXUSNOVA • OFFLINE PRODUCTIVITY</div>
        <h2>Productivity Desk</h2>
        <p>Clean text, count words, prepare copy and compare dates without sending your content to any server.</p>
      </div>
      <div class="nxpd-grid">
        <div class="nxpd-card">
          <h3>Text Studio</h3>
          <div class="nxpd-sub">Useful for messages, assignments, posts, notes and office text.</div>
          <textarea id="nxPdText" class="nxpd-textarea" maxlength="50000" placeholder="Type or paste text here…" spellcheck="true"></textarea>
          <div class="nxpd-stats" aria-live="polite">
            <div class="nxpd-stat"><b id="nxPdWords">0</b><span>Words</span></div>
            <div class="nxpd-stat"><b id="nxPdChars">0</b><span>Characters</span></div>
            <div class="nxpd-stat"><b id="nxPdLines">0</b><span>Lines</span></div>
            <div class="nxpd-stat"><b id="nxPdRead">0m</b><span>Read time</span></div>
          </div>
          <div class="nxpd-actions">
            <button type="button" class="nxpd-btn" data-nxpd-action="upper">UPPERCASE</button>
            <button type="button" class="nxpd-btn" data-nxpd-action="lower">lowercase</button>
            <button type="button" class="nxpd-btn" data-nxpd-action="title">Title Case</button>
            <button type="button" class="nxpd-btn" data-nxpd-action="spaces">CLEAN SPACES</button>
            <button type="button" class="nxpd-btn" data-nxpd-action="blank">REMOVE BLANK LINES</button>
            <button type="button" class="nxpd-btn" data-nxpd-action="dupes">REMOVE DUPLICATE LINES</button>
            <button type="button" class="nxpd-btn primary" data-nxpd-action="copy">COPY</button>
            <button type="button" class="nxpd-btn primary" data-nxpd-action="share">SHARE</button>
            <button type="button" class="nxpd-btn quiet" data-nxpd-action="clear">CLEAR</button>
          </div>
          <div class="nxpd-privacy"><span>●</span><div><b>Private by design.</b> Draft auto-save stays only in this device's local storage.</div></div>
        </div>
        <div class="nxpd-card">
          <h3>Date Desk</h3>
          <div class="nxpd-sub">Quickly compare two calendar dates for plans, forms, deadlines and records.</div>
          <div class="nxpd-date-row">
            <label>Start date<input id="nxPdDateA" type="date"></label>
            <label>End date<input id="nxPdDateB" type="date"></label>
          </div>
          <div class="nxpd-actions" style="margin-top:9px">
            <button type="button" class="nxpd-btn" id="nxPdTodayA">START = TODAY</button>
            <button type="button" class="nxpd-btn" id="nxPdTodayB">END = TODAY</button>
          </div>
          <div id="nxPdDateResult" class="nxpd-date-result" aria-live="polite"><strong>—</strong><span>Select two dates.</span></div>
          <div class="nxpd-divider"></div>
          <div class="nxpd-sub" style="margin-bottom:0">Works offline • no account data used • no network request.</div>
        </div>
      </div>`;
    main.appendChild(tab);
  }

  function textValue() { return String($('nxPdText')?.value || ''); }
  function setText(value) {
    const area = $('nxPdText');
    if (!area) return;
    area.value = String(value ?? '').slice(0,50000);
    updateStats();
    saveDraft();
  }

  function updateStats() {
    const text = textValue();
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/u).filter(Boolean).length : 0;
    const lines = text ? text.split(/\r?\n/).length : 0;
    if ($('nxPdWords')) $('nxPdWords').textContent = String(words);
    if ($('nxPdChars')) $('nxPdChars').textContent = String(text.length);
    if ($('nxPdLines')) $('nxPdLines').textContent = String(lines);
    if ($('nxPdRead')) $('nxPdRead').textContent = words ? `${Math.max(1,Math.ceil(words/200))}m` : '0m';
  }

  let saveTimer = 0;
  function saveDraft(immediate = false) {
    clearTimeout(saveTimer);
    const run = () => {
      try { localStorage.setItem(STORAGE_KEY, textValue()); } catch (_) {}
    };
    if (immediate) run(); else saveTimer = setTimeout(run, 260);
  }

  function restoreDraft() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved != null && $('nxPdText')) $('nxPdText').value = saved.slice(0,50000);
    } catch (_) {}
    updateStats();
  }

  function titleCase(text) {
    return String(text).toLowerCase().replace(/(^|[\s\-–—/([{])([\p{L}\p{N}])/gu, (_, lead, ch) => lead + ch.toUpperCase());
  }

  async function copyText() {
    const value = textValue();
    if (!value) return toast('Nothing to copy.', 'warn');
    try {
      await navigator.clipboard.writeText(value);
      toast('Text copied.', 'ok');
    } catch (_) {
      const area = $('nxPdText');
      area?.focus();
      area?.select();
      toast('Select and copy the text manually.', 'warn');
    }
  }

  async function shareText() {
    const value = textValue();
    if (!value) return toast('Nothing to share.', 'warn');
    if (navigator.share) {
      try {
        await navigator.share({title:'NexusNova Productivity Desk', text:value});
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    await copyText();
  }

  function runTextAction(action) {
    const text = textValue();
    if (action === 'upper') return setText(text.toUpperCase());
    if (action === 'lower') return setText(text.toLowerCase());
    if (action === 'title') return setText(titleCase(text));
    if (action === 'spaces') {
      const cleaned = text.split(/\r?\n/).map(line => line.replace(/[\t ]+/g,' ').trim()).join('\n').trim();
      return setText(cleaned);
    }
    if (action === 'blank') return setText(text.split(/\r?\n/).filter(line => line.trim() !== '').join('\n'));
    if (action === 'dupes') {
      const seen = new Set();
      const clean = text.split(/\r?\n/).filter(line => {
        const key = line.trim();
        if (!key || !seen.has(key)) { if (key) seen.add(key); return true; }
        return false;
      }).join('\n');
      return setText(clean);
    }
    if (action === 'copy') return void copyText();
    if (action === 'share') return void shareText();
    if (action === 'clear') {
      if (!text) return;
      if (window.confirm('Clear the Productivity Desk draft on this device?')) {
        setText('');
        saveDraft(true);
        toast('Draft cleared.', 'ok');
      }
    }
  }

  function parseIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const [y,m,d] = value.split('-').map(Number);
    const stamp = Date.UTC(y,m-1,d);
    const date = new Date(stamp);
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m-1 || date.getUTCDate() !== d) return null;
    return stamp;
  }

  function updateDateResult() {
    const out = $('nxPdDateResult');
    if (!out) return;
    const aRaw = $('nxPdDateA')?.value || '';
    const bRaw = $('nxPdDateB')?.value || '';
    const a = parseIsoDate(aRaw);
    const b = parseIsoDate(bRaw);
    if (a == null || b == null) {
      out.innerHTML = '<strong>—</strong><span>Select two dates.</span>';
      return;
    }
    const signed = Math.round((b - a) / 86400000);
    const days = Math.abs(signed);
    const weeks = Math.floor(days / 7);
    const rest = days % 7;
    const direction = signed === 0 ? 'Same calendar date' : signed > 0 ? 'End date is after start date' : 'End date is before start date';
    out.innerHTML = `<strong>${days.toLocaleString()} day${days === 1 ? '' : 's'}</strong><span>${esc(direction)} • ${weeks.toLocaleString()} week${weeks === 1 ? '' : 's'} + ${rest} day${rest === 1 ? '' : 's'}</span>`;
  }

  function bind() {
    const area = $('nxPdText');
    if (area && !area.dataset.nxPdBound) {
      area.dataset.nxPdBound = '1';
      area.addEventListener('input', () => { updateStats(); saveDraft(); });
    }
    document.querySelectorAll('#tab-productivity [data-nxpd-action]').forEach(button => {
      if (button.dataset.nxPdBound) return;
      button.dataset.nxPdBound = '1';
      button.addEventListener('click', () => runTextAction(button.dataset.nxpdAction || ''));
    });
    ['nxPdDateA','nxPdDateB'].forEach(id => {
      const input = $(id);
      if (!input || input.dataset.nxPdBound) return;
      input.dataset.nxPdBound = '1';
      input.addEventListener('change', updateDateResult);
    });
    $('nxPdTodayA')?.addEventListener('click', () => { if ($('nxPdDateA')) $('nxPdDateA').value = todayIso(); updateDateResult(); }, {once:true});
    $('nxPdTodayB')?.addEventListener('click', () => { if ($('nxPdDateB')) $('nxPdDateB').value = todayIso(); updateDateResult(); }, {once:true});
    $('nxPdBack')?.addEventListener('click', () => {
      if (typeof window.nexusBackToAllApps === 'function') window.nexusBackToAllApps();
      else if (typeof window.toggleMore === 'function') window.toggleMore();
    }, {once:true});
  }

  function install() {
    installStyles();
    ensureTab();
    ensureMenu();
    bind();
    restoreDraft();
    if ($('nxPdDateB') && !$('nxPdDateB').value) $('nxPdDateB').value = todayIso();
    updateDateResult();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
  [500,1200,2600].forEach(ms => setTimeout(() => { ensureMenu(); ensureTab(); bind(); }, ms));
})();
