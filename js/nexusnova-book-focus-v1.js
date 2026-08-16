/* NexusNova Book Focus v1
   Presentation/navigation-only reading UX. No religious text, auth, mining,
   wallet, reward, Firebase or source-selection logic is changed here. */
(() => {
  'use strict';
  if (window.__nxBookFocusV1) return;
  window.__nxBookFocusV1 = true;

  const $ = id => document.getElementById(id);
  const BOOK_LIBRARIES = new Set(['quran','hadith','fiqh','jafari']);
  const PANEL_MAP = {quran:'faith-quran', hadith:'faith-bukhari', fiqh:'faith-fiqh', jafari:'faith-jafari'};
  let activeIslamicLibrary = '';
  let focusTimer = 0;

  function ensureStyleLink() {
    if (document.querySelector('link[data-nx-book-focus-v1]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './css/nexusnova-book-focus-v1.css?v=20260816-1';
    link.dataset.nxBookFocusV1 = '1';
    document.head.appendChild(link);
  }

  function topChromeOffset() {
    let offset = 12;
    const header = document.querySelector('.top-header');
    const ticker = document.querySelector('.ticker-wrap');
    [header, ticker].forEach(el => {
      if (!el) return;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      const rect = el.getBoundingClientRect();
      if (rect.height > 0 && (style.position === 'fixed' || style.position === 'sticky')) {
        offset += rect.height;
      }
    });
    return Math.min(190, Math.max(12, offset + 10));
  }

  function smartScroll(target, behavior = 'smooth') {
    if (!target || !target.isConnected) return;
    clearTimeout(focusTimer);
    focusTimer = setTimeout(() => {
      const rect = target.getBoundingClientRect();
      const top = Math.max(0, window.scrollY + rect.top - topChromeOffset());
      try { window.scrollTo({top, behavior}); }
      catch (_) { window.scrollTo(0, top); }
    }, 24);
  }

  function launcherTitle(button, library) {
    const urdu = button?.querySelector('b')?.textContent?.trim();
    const english = button?.querySelector('small')?.textContent?.trim();
    if (urdu && english) return `${urdu} · ${english}`;
    return ({quran:'قرآن پاک · QURAN',hadith:'کتبِ حدیث · HADITH',fiqh:'فقہ لائبریری · FIQH',jafari:'فقہ جعفریہ · JA‘FARI'}[library] || 'Book Reader');
  }

  function ensureIslamicFocusBar(hero) {
    let bar = $('nxBookFocusBar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'nxBookFocusBar';
    bar.className = 'nx-book-focus-bar';
    bar.hidden = true;
    bar.innerHTML = `<button id="nxBookFocusBack" type="button" class="nx-book-focus-back" aria-label="Back to Islamic library"><span aria-hidden="true">←</span><span>Library</span></button><div class="nx-book-focus-title"><small>NOW READING</small><strong id="nxBookFocusTitle">Book Reader</strong></div><div class="nx-book-focus-mark" aria-hidden="true">⌁</div>`;
    const firstPanel = hero.querySelector('#faith-quran,#faith-bukhari,#faith-fiqh,#faith-jafari,#faith-prayer');
    if (firstPanel?.parentNode === hero) hero.insertBefore(bar, firstPanel);
    else hero.appendChild(bar);
    $('nxBookFocusBack')?.addEventListener('click', exitIslamicFocus);
    return bar;
  }

  function enterIslamicFocus(library, button) {
    if (!BOOK_LIBRARIES.has(library)) return;
    const tab = $('tab-mega-islamic');
    const hero = tab?.querySelector('.nxmega-hero');
    const target = $(PANEL_MAP[library]);
    if (!hero || !target) return;

    activeIslamicLibrary = library;
    const bar = ensureIslamicFocusBar(hero);
    hero.classList.add('nx-book-focus-active');
    hero.dataset.nxBookFocus = library;
    bar.hidden = false;
    const title = $('nxBookFocusTitle');
    if (title) title.textContent = launcherTitle(button, library);

    Object.values(PANEL_MAP).forEach(id => {
      const panel = $(id);
      if (!panel) return;
      panel.classList.toggle('nx-book-focus-panel', panel === target);
    });

    target.classList.add('nx-book-focus-enter');
    setTimeout(() => target.classList.remove('nx-book-focus-enter'), 520);
    smartScroll(bar);
  }

  function exitIslamicFocus() {
    const tab = $('tab-mega-islamic');
    const hero = tab?.querySelector('.nxmega-hero');
    if (!hero) return;
    hero.classList.remove('nx-book-focus-active');
    hero.removeAttribute('data-nx-book-focus');
    const bar = $('nxBookFocusBar');
    if (bar) bar.hidden = true;
    Object.values(PANEL_MAP).forEach(id => $(id)?.classList.remove('nx-book-focus-panel','nx-book-focus-enter'));
    activeIslamicLibrary = '';
    const shelf = hero.querySelector('.nxlib-shell') || hero;
    smartScroll(shelf);
  }
  window.nexusBookFocusBack = exitIslamicFocus;

  function markReader(reader) {
    if (!reader) return;
    reader.classList.add('nx-book-reader-focus');
    reader.classList.remove('nx-book-reader-pop');
    void reader.offsetWidth;
    reader.classList.add('nx-book-reader-pop');
    setTimeout(() => reader.classList.remove('nx-book-reader-pop'), 560);
  }

  function focusReader(readerId) {
    const reader = $(readerId);
    if (!reader) return;
    markReader(reader);
    smartScroll(reader);
  }

  function focusReaderWhenVisible(readerId) {
    const reader = $(readerId);
    if (!reader) return;
    const visible = () => !reader.hidden && getComputedStyle(reader).display !== 'none';
    if (visible()) {
      focusReader(readerId);
      return;
    }
    const observer = new MutationObserver(() => {
      if (!visible()) return;
      observer.disconnect();
      focusReader(readerId);
    });
    observer.observe(reader, {attributes:true, attributeFilter:['hidden','style','class']});
    setTimeout(() => { observer.disconnect(); if (visible()) focusReader(readerId); }, 2200);
  }

  function readerForTrigger(target) {
    const id = target?.id || '';
    if (['nxQuranLoad','nxQuranPrevPolish','nxQuranNextPolish','nxQuranLastPolish'].includes(id)) return 'nxQuranReader';
    if (['nxHadithRead','nxHadithPrev','nxHadithNext','nxHadithLast'].includes(id)) return 'nxHadithReader';
    if (['nxBukhariLoad','nxBukhariPrev','nxBukhariNext','nxBukhariLastPolish'].includes(id)) return 'nxBukhariReader';
    if (['nxBibleOpen','nxBiblePrev','nxBibleNext','nxBibleLast'].includes(id)) return 'nxBibleReader';
    return '';
  }

  function installDelegatedBookFlow() {
    if (document.documentElement.dataset.nxBookFocusBound === '1') return;
    document.documentElement.dataset.nxBookFocusBound = '1';

    document.addEventListener('click', event => {
      const target = event.target?.closest?.('button,a,[role="button"]');
      if (!target) return;

      const launcher = target.closest?.('#tab-mega-islamic .nxlib-launcher[data-library]');
      if (launcher) {
        const library = String(launcher.dataset.library || '');
        if (BOOK_LIBRARIES.has(library)) {
          // Let the existing library handler select its panel first, then move
          // that selected book/panel into the user's viewport automatically.
          setTimeout(() => enterIslamicFocus(library, launcher), 35);
        }
        return;
      }

      const readerId = readerForTrigger(target);
      if (readerId) {
        // The existing loader immediately changes the reader to Loading….
        // Bring that page into view right away; content then replaces Loading…
        // in the same viewport, so no manual downward scroll is necessary.
        setTimeout(() => focusReader(readerId), 55);
        setTimeout(() => focusReader(readerId), 420);
        return;
      }

      if (target.closest?.('[data-read-book]')) {
        // Urdu Library already owns its reader/data logic. We only make the
        // newly opened reader visible immediately when its hidden state flips.
        setTimeout(() => focusReaderWhenVisible('nxUrduReader'), 40);
      }
    }, false);
  }

  function keepFocusedPanelVisible() {
    const hero = $('tab-mega-islamic')?.querySelector('.nxmega-hero');
    if (!hero || !activeIslamicLibrary) return;
    const target = $(PANEL_MAP[activeIslamicLibrary]);
    if (target && target.style.display === 'none') {
      activeIslamicLibrary = '';
      hero.classList.remove('nx-book-focus-active');
      const bar = $('nxBookFocusBar');
      if (bar) bar.hidden = true;
    }
  }

  function install() {
    ensureStyleLink();
    installDelegatedBookFlow();
    const hero = $('tab-mega-islamic')?.querySelector('.nxmega-hero');
    if (hero) ensureIslamicFocusBar(hero);
    keepFocusedPanelVisible();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install, 650), {once:true});
  else setTimeout(install, 180);
  [1200,2600,5200,9000].forEach(ms => setTimeout(install, ms));
})();
