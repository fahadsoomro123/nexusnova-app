/* NexusNova UX Simplify v2.0.0
   Compact, contextual navigation for NexusNova.
   - No giant generic Back strip.
   - Small inline Back control inside sub-apps.
   - Compact Previous / Hub / Next bar only while reading books.
   - Android systemBack() remains the native back-stack hook.
   - No mining, rewards, ads, wallet, auth or Firebase value changes.
*/
(() => {
  'use strict';
  if (window.__nxUxSimplifyV1) return;
  window.__nxUxSimplifyV1 = true;

  const CORE = new Set(['home','wallet','tasks','market']);
  const BAR_ID = 'nxUxBottomNav';
  const STYLE_ID = 'nxUxSimplifyStylesV2';
  const BACK_CLASS = 'nx-compact-back';
  let raf = 0;

  const $ = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const visible = el => Boolean(el && el.isConnected && !el.hidden && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden');

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
      body.nx-ux-compact-nav-ready .nx-allapps-back,
      body.nx-ux-compact-nav-ready .tools-main-back,
      body.nx-ux-compact-nav-ready #nxUrduReaderBack,
      body.nx-ux-compact-nav-ready #nxBookFocusBack{display:none!important}
      #${BAR_ID}{opacity:0;pointer-events:none}
      #${BAR_ID}.show.reader{opacity:1;pointer-events:auto}
      .${BACK_CLASS}[hidden]{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function ensureBar() {
    let bar = document.getElementById(BAR_ID);
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.setAttribute('role', 'navigation');
    bar.setAttribute('aria-label', 'Reader navigation');
    bar.innerHTML = `
      <button type="button" id="nxUxPrev" aria-label="Previous page">← PREV</button>
      <button type="button" id="nxUxBack" class="nx-ux-back" aria-label="Back to Nova Hub">⌂ HUB<small id="nxUxBackHint">NOVA HUB</small></button>
      <button type="button" id="nxUxNext" aria-label="Next page">NEXT →</button>`;
    document.body.appendChild(bar);
    $('#nxUxPrev', bar)?.addEventListener('click', () => triggerReaderMove(-1));
    $('#nxUxNext', bar)?.addEventListener('click', () => triggerReaderMove(1));
    $('#nxUxBack', bar)?.addEventListener('click', goBackContextually);
    return bar;
  }

  function ensureInlineBack(tab) {
    if (!(tab instanceof HTMLElement)) return null;
    let button = tab.querySelector(`:scope > .${BACK_CLASS}`);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = BACK_CLASS;
      button.setAttribute('aria-label','Back to Nova Hub');
      button.title = 'Back to Nova Hub';
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
      button.addEventListener('click', goBackContextually);
      tab.insertBefore(button, tab.firstElementChild || null);
    }
    return button;
  }

  function visibleReader() {
    const readers = [
      ['urdu', document.getElementById('nxUrduReader')],
      ['quran', document.getElementById('nxQuranReader')],
      ['hadith', document.getElementById('nxHadithReader')],
      ['bukhari', document.getElementById('nxBukhariReader')],
      ['bible', document.getElementById('nxBibleReader')]
    ];
    for (const [kind, el] of readers) {
      if (!visible(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) return { kind, el };
    }
    return null;
  }

  function buttonVisible(id) {
    const el = document.getElementById(id);
    return visible(el) ? el : null;
  }

  function findUrduNextLink() {
    const page = document.getElementById('nxUrduReaderPage');
    if (!visible(page)) return null;
    const links = Array.from(page.querySelectorAll('a[data-nx-urdu-wiki-link="1"]'))
      .filter(link => visible(link))
      .filter(link => {
        const text = String(link.textContent || '').replace(/\s+/g,' ').trim();
        const href = String(link.getAttribute('href') || link.href || '');
        if (!text || !href) return false;
        return !/(?:Category|Special|Author|مصنف|زمرہ):/i.test(href + ' ' + text);
      });
    return links.find(link => /(?:اگلا|اگلی|بعد|next|صفحہ)/i.test(String(link.textContent || ''))) || links[0] || null;
  }

  function readerControls(reader) {
    if (!reader) return { prev:null, next:null };
    if (reader.kind === 'urdu') return { prev:null, next:findUrduNextLink() };
    if (reader.kind === 'quran') return { prev:buttonVisible('nxQuranPrevPolish'), next:buttonVisible('nxQuranNextPolish') };
    if (reader.kind === 'hadith') return { prev:buttonVisible('nxHadithPrev'), next:buttonVisible('nxHadithNext') };
    if (reader.kind === 'bukhari') return { prev:buttonVisible('nxBukhariPrev'), next:buttonVisible('nxBukhariNext') };
    if (reader.kind === 'bible') return { prev:buttonVisible('nxBiblePrev'), next:buttonVisible('nxBibleNext') };
    return { prev:null, next:null };
  }

  function triggerReaderMove(direction) {
    const reader = visibleReader();
    const controls = readerControls(reader);
    const target = direction < 0 ? controls.prev : controls.next;
    if (!target) return false;
    try { target.click(); } catch (_) { return false; }
    setTimeout(scheduleRender,80);
    setTimeout(scheduleRender,700);
    return true;
  }

  function clickFirstExisting(selector, root = document) {
    const target = root.querySelector(selector);
    if (!target) return false;
    try { target.click(); return true; } catch (_) { return false; }
  }

  function goBackContextually() {
    const reader = visibleReader();
    const tab = activeTab();
    const tabName = activeTabName();

    if (reader?.kind === 'urdu' && clickFirstExisting('#nxUrduReaderBack')) return true;
    if (tabName === 'mega-islamic' && clickFirstExisting('#nxBookFocusBack')) return true;
    if (tab && clickFirstExisting('.nx-allapps-back button,.tools-main-back,[data-nx-back-allapps]',tab)) return true;

    if (!CORE.has(tabName)) {
      try {
        if (typeof window.nexusBackToAllApps === 'function' && window.nexusBackToAllApps() !== false) return true;
      } catch (_) {}
      const more = document.getElementById('moreBtn');
      try { more?.click(); return Boolean(more); } catch (_) {}
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

  function setButton(button, enabled, label) {
    if (!button) return;
    button.disabled = !enabled;
    if (label) button.textContent = label;
  }

  function render() {
    raf = 0;
    ensureStyles();
    const bar = ensureBar();
    const reader = visibleReader();
    const tab = activeTab();
    const tabName = activeTabName();
    const prev = document.getElementById('nxUxPrev');
    const next = document.getElementById('nxUxNext');

    qsa(`main .tab > .${BACK_CLASS}, main.main .tab > .${BACK_CLASS}`).forEach(button => { button.hidden = true; });

    if (reader) {
      const controls = readerControls(reader);
      bar.classList.add('show','reader');
      setButton(prev,Boolean(controls.prev),'← PREV');
      setButton(next,Boolean(controls.next),reader.kind === 'urdu' ? 'NEXT PAGE →' : 'NEXT →');
      return;
    }

    bar.classList.remove('show','reader');
    if (prev) prev.disabled = true;
    if (next) next.disabled = true;

    if (!menuOpen() && tab && tabName && !CORE.has(tabName)) {
      const button = ensureInlineBack(tab);
      if (button) button.hidden = false;
    }
  }

  function scheduleRender() {
    if (raf) return;
    raf = requestAnimationFrame(render);
  }

  function installObserver() {
    if (document.documentElement.dataset.nxUxSimplifyObserved === '2') return;
    document.documentElement.dataset.nxUxSimplifyObserved = '2';
    const observer = new MutationObserver(scheduleRender);
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','style']});
  }

  function install() {
    ensureStyles();
    ensureBar();
    document.body?.classList.add('nx-ux-compact-nav-ready');
    installObserver();
    scheduleRender();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  [250,700,1500,3000,6000].forEach(ms => setTimeout(scheduleRender,ms));

  window.NexusNovaUxSimplify = Object.freeze({
    version:'2.0.0',
    refresh:scheduleRender,
    back:goBackContextually,
    systemBack:handleSystemBack
  });
})();
