/* NexusNova UX Simplify v1.0.3 — reader-only navigation
   Keeps the useful book-reader Previous / Back / Next controls, but never
   overlays Settings or other Nova Hub apps with a generic floating panel.
   Hardware/native back remains available without adding visible UI.
*/
(() => {
  'use strict';
  if (window.__nxUxSimplifyV1) return;
  window.__nxUxSimplifyV1 = true;
  window.nexusNovaUxSimplifyVersion = 'reader-only-v1.0.3';

  const CORE = new Set(['home','wallet','tasks','market']);
  const BAR_ID = 'nxUxBottomNav';
  const STYLE_ID = 'nxUxSimplifyStylesV1';
  let raf = 0;

  const $ = (selector, root = document) => root.querySelector(selector);
  const visible = el => Boolean(
    el && el.isConnected && !el.hidden &&
    getComputedStyle(el).display !== 'none' &&
    getComputedStyle(el).visibility !== 'hidden'
  );

  function activeTab() {
    return $('main.main > .tab.active, main > .tab.active, .tab.active');
  }

  function activeTabName() {
    return String(activeTab()?.id || '').replace(/^tab-/, '') || 'home';
  }

  function menuOpen() {
    const menu = document.getElementById('moreMenu');
    return Boolean(menu && menu.classList.contains('show') && getComputedStyle(menu).display !== 'none');
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BAR_ID}{
        position:fixed;left:50%;bottom:calc(88px + env(safe-area-inset-bottom,0px));z-index:2147482500;
        width:min(calc(100vw - 24px),460px);transform:translateX(-50%);display:none;
        grid-template-columns:minmax(0,.9fr) minmax(0,1.25fr) minmax(0,.9fr);gap:8px;padding:8px;
        border:1px solid rgba(89,173,255,.30);border-radius:20px;
        background:linear-gradient(145deg,rgba(2,10,24,.985),rgba(5,28,52,.99));
        box-shadow:0 18px 45px rgba(0,0,0,.44),inset 0 1px rgba(255,255,255,.06);
        pointer-events:none
      }
      #${BAR_ID}.reader{display:grid;pointer-events:auto}
      #${BAR_ID} button{
        min-height:50px;border:1px solid rgba(113,191,255,.24);border-radius:14px;padding:9px 10px;
        background:linear-gradient(145deg,rgba(14,91,180,.24),rgba(10,42,84,.44));color:#f6fbff;
        font:900 11px/1.15 system-ui,-apple-system,sans-serif;letter-spacing:.035em;
        box-shadow:inset 0 1px rgba(255,255,255,.05);touch-action:manipulation;-webkit-tap-highlight-color:transparent
      }
      #${BAR_ID} button:active{transform:scale(.985)}
      #${BAR_ID} button[disabled]{opacity:.38;filter:saturate(.35)}
      #${BAR_ID} .nx-ux-back{
        background:linear-gradient(135deg,#126dff,#24b9f4);border-color:rgba(140,220,255,.55);
        box-shadow:0 10px 28px rgba(20,125,255,.26)
      }
      #${BAR_ID} small{display:block;margin-top:3px;color:rgba(232,246,255,.72);font-size:8px;font-weight:800;letter-spacing:.08em}
      body.nx-ux-bottom-nav-ready .nx-allapps-back,
      body.nx-ux-bottom-nav-ready .tools-main-back{display:none!important}
      body.nx-ux-bottom-nav-ready #nxUrduReaderBack{display:none!important}
      body.nx-ux-bottom-nav-ready #nxBookFocusBack{display:none!important}
      @media(max-width:420px){
        #${BAR_ID}{bottom:calc(82px + env(safe-area-inset-bottom,0px));width:calc(100vw - 16px);padding:7px;border-radius:18px}
        #${BAR_ID} button{min-height:48px;font-size:10px;padding:8px 7px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureBar() {
    let bar = document.getElementById(BAR_ID);
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.setAttribute('role','navigation');
    bar.setAttribute('aria-label','Book reader navigation');
    bar.innerHTML = `
      <button type="button" id="nxUxPrev" aria-label="Previous page">← PREVIOUS</button>
      <button type="button" id="nxUxBack" class="nx-ux-back" aria-label="Back to library">← BACK<small id="nxUxBackHint">LIBRARY</small></button>
      <button type="button" id="nxUxNext" aria-label="Next page">NEXT →</button>`;
    document.body.appendChild(bar);
    document.body.classList.add('nx-ux-bottom-nav-ready');
    $('#nxUxPrev',bar)?.addEventListener('click',()=>triggerReaderMove(-1));
    $('#nxUxNext',bar)?.addEventListener('click',()=>triggerReaderMove(1));
    $('#nxUxBack',bar)?.addEventListener('click',goBackContextually);
    return bar;
  }

  function visibleReader() {
    const readers = [
      ['urdu',document.getElementById('nxUrduReader')],
      ['quran',document.getElementById('nxQuranReader')],
      ['hadith',document.getElementById('nxHadithReader')],
      ['bukhari',document.getElementById('nxBukhariReader')],
      ['bible',document.getElementById('nxBibleReader')]
    ];
    for (const [kind,el] of readers) {
      if (!visible(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) return {kind,el};
    }
    return null;
  }

  const buttonVisible = id => {
    const el = document.getElementById(id);
    return visible(el) ? el : null;
  };

  function findUrduNextLink() {
    const page = document.getElementById('nxUrduReaderPage');
    if (!visible(page)) return null;
    const links = Array.from(page.querySelectorAll('a[data-nx-urdu-wiki-link="1"]'))
      .filter(visible)
      .filter(link => {
        const text = String(link.textContent || '').replace(/\s+/g,' ').trim();
        const href = String(link.getAttribute('href') || link.href || '');
        return Boolean(text && href && !/(?:Category|Special|Author|مصنف|زمرہ):/i.test(href + ' ' + text));
      });
    return links.find(link => /(?:اگلا|اگلی|بعد|next|صفحہ)/i.test(String(link.textContent || ''))) || links[0] || null;
  }

  function readerControls(reader) {
    if (!reader) return {prev:null,next:null,backHint:'LIBRARY'};
    if (reader.kind === 'urdu') return {prev:null,next:findUrduNextLink(),backHint:'URDU LIBRARY'};
    if (reader.kind === 'quran') return {prev:buttonVisible('nxQuranPrevPolish'),next:buttonVisible('nxQuranNextPolish'),backHint:'QURAN LIBRARY'};
    if (reader.kind === 'hadith') return {prev:buttonVisible('nxHadithPrev'),next:buttonVisible('nxHadithNext'),backHint:'HADITH LIBRARY'};
    if (reader.kind === 'bukhari') return {prev:buttonVisible('nxBukhariPrev'),next:buttonVisible('nxBukhariNext'),backHint:'HADITH LIBRARY'};
    if (reader.kind === 'bible') return {prev:buttonVisible('nxBiblePrev'),next:buttonVisible('nxBibleNext'),backHint:'BIBLE LIBRARY'};
    return {prev:null,next:null,backHint:'LIBRARY'};
  }

  function triggerReaderMove(direction) {
    const controls = readerControls(visibleReader());
    const target = direction < 0 ? controls.prev : controls.next;
    if (!target) return false;
    try { target.click(); } catch (_) { return false; }
    [60,300,800].forEach(ms=>setTimeout(scheduleRender,ms));
    return true;
  }

  function clickExisting(selector,root=document) {
    const target = root.querySelector(selector);
    if (!target) return false;
    try { target.click(); return true; } catch (_) { return false; }
  }

  function goBackContextually() {
    const reader = visibleReader();
    const tab = activeTab();
    const tabName = activeTabName();
    if (reader?.kind === 'urdu' && clickExisting('#nxUrduReaderBack')) return true;
    if (tabName === 'mega-islamic' && clickExisting('#nxBookFocusBack')) return true;
    if (tab && clickExisting('.nx-allapps-back button,.tools-main-back,[data-nx-back-allapps]',tab)) return true;
    if (!CORE.has(tabName)) {
      try { if (typeof window.nexusBackToAllApps === 'function' && window.nexusBackToAllApps() !== false) return true; } catch (_) {}
      try { document.getElementById('moreBtn')?.click(); return true; } catch (_) {}
    }
    return false;
  }

  function handleSystemBack() {
    if (menuOpen()) {
      try { document.getElementById('moreBtn')?.click(); return true; } catch (_) {}
    }
    if (visibleReader()) return goBackContextually();
    if (!CORE.has(activeTabName())) return goBackContextually();
    return false;
  }

  function setButton(button,enabled,label) {
    if (!button) return;
    button.disabled = !enabled;
    if (label) button.textContent = label;
  }

  function render() {
    raf = 0;
    ensureStyles();
    const bar = ensureBar();
    const reader = visibleReader();
    if (!reader) {
      bar.classList.remove('reader');
      return;
    }
    const controls = readerControls(reader);
    bar.classList.add('reader');
    const hint = document.getElementById('nxUxBackHint');
    if (hint) hint.textContent = controls.backHint;
    setButton(document.getElementById('nxUxPrev'),Boolean(controls.prev),'← PREVIOUS');
    setButton(document.getElementById('nxUxNext'),Boolean(controls.next),reader.kind === 'urdu' ? 'NEXT PAGE →' : 'NEXT →');
    const back = document.getElementById('nxUxBack');
    if (back) back.innerHTML = `← BACK<small id="nxUxBackHint">${controls.backHint}</small>`;
  }

  function scheduleRender() {
    if (raf) return;
    raf = requestAnimationFrame(render);
  }

  function install() {
    ensureStyles();
    ensureBar();
    scheduleRender();
    document.addEventListener('click',()=>{
      [0,80,260,700].forEach(ms=>setTimeout(scheduleRender,ms));
    },true);
    window.addEventListener('nexusnova:tab-changed',scheduleRender);
    window.addEventListener('pageshow',scheduleRender);
    [250,800,1800,4000,8000].forEach(ms=>setTimeout(scheduleRender,ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.NexusNovaUxSimplify = Object.freeze({
    version:'1.0.3-reader-only',
    refresh:scheduleRender,
    back:goBackContextually,
    systemBack:handleSystemBack
  });
})();
