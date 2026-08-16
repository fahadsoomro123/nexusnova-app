/* NexusNova Scripture Reader Polish v1
   Additive reader UX only. Existing Quran/Bukhari/Bible data sources stay unchanged.
*/
(() => {
  'use strict';
  if (window.__nxScriptureReaderPolishV1) return;
  window.__nxScriptureReaderPolishV1 = true;

  const $ = id => document.getElementById(id);
  const $$ = (selector, root=document) => Array.from(root.querySelectorAll(selector));

  function ensureStyles() {
    if ($('nxScripturePolishStyles')) return;
    const style = document.createElement('style');
    style.id = 'nxScripturePolishStyles';
    style.textContent = `
      .nx-scripture-polish-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin:10px 0}
      .nx-scripture-polish-search{width:100%;min-width:0;min-height:42px;border-radius:13px;border:1px solid rgba(91,169,245,.20);background:linear-gradient(180deg,rgba(4,15,31,.94),rgba(8,24,45,.94));color:#f8fbff;padding:10px 12px;outline:0}
      .nx-scripture-polish-search:focus{border-color:#4ca7ff;box-shadow:0 0 0 3px rgba(38,134,255,.13)}
      .nx-scripture-search-count{min-width:72px;display:grid;place-items:center;padding:0 10px;border-radius:13px;border:1px solid rgba(91,169,245,.16);background:rgba(8,24,45,.72);color:#8db7df;font-size:10px;font-weight:800}
      .nx-scripture-nav-extra{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
      .nx-scripture-match{border-color:rgba(64,180,255,.45)!important;box-shadow:0 0 0 1px rgba(64,180,255,.12),0 8px 24px rgba(0,0,0,.13)!important}
      .nx-scripture-filtered{display:none!important}
      @media(max-width:520px){.nx-scripture-polish-row{grid-template-columns:1fr}.nx-scripture-search-count{min-height:34px}}
    `;
    document.head.appendChild(style);
  }

  function filterReader(input, reader, itemSelector, count) {
    const query = String(input?.value || '').trim().toLocaleLowerCase();
    const items = $$(itemSelector, reader);
    let visible = 0;
    items.forEach(item => {
      const hit = !query || String(item.textContent || '').toLocaleLowerCase().includes(query);
      item.classList.toggle('nx-scripture-filtered', !hit);
      item.classList.toggle('nx-scripture-match', Boolean(query && hit));
      if (hit) visible += 1;
    });
    if (count) count.textContent = query ? `${visible} found` : `${items.length} verses`;
  }

  function addSearch({readerId,inputId,countId,placeholder,itemSelector}) {
    const reader = $(readerId);
    if (!reader || $(inputId)) return;
    const row = document.createElement('div');
    row.className = 'nx-scripture-polish-row';
    row.innerHTML = `<input id="${inputId}" class="nx-scripture-polish-search" type="search" autocomplete="off" placeholder="${placeholder}"><div id="${countId}" class="nx-scripture-search-count">Search text</div>`;
    reader.insertAdjacentElement('beforebegin', row);
    const input = $(inputId), count = $(countId);
    input?.addEventListener('input', () => filterReader(input, reader, itemSelector, count));
    const refresh = () => filterReader(input, reader, itemSelector, count);
    [150,700,1600].forEach(ms=>setTimeout(refresh,ms));
    return refresh;
  }

  function addQuranNavigation() {
    const select = $('nxQuranSurah'), load = $('nxQuranLoad');
    if (!select || !load || $('nxQuranPrevPolish')) return;
    const row = document.createElement('div');
    row.className = 'nx-scripture-nav-extra';
    row.innerHTML = '<button id="nxQuranPrevPolish" class="tool-btn" type="button">← Previous Surah</button><button id="nxQuranNextPolish" class="tool-btn" type="button">Next Surah →</button><button id="nxQuranLastPolish" class="tool-btn" type="button">Last Read</button>';
    load.closest('.nx-scripture-controls')?.insertAdjacentElement('afterend', row);
    const move = delta => {
      const next = Math.max(1, Math.min(114, Number(select.value || 1) + delta));
      select.value = String(next);
      load.click();
    };
    $('nxQuranPrevPolish')?.addEventListener('click',()=>move(-1));
    $('nxQuranNextPolish')?.addEventListener('click',()=>move(1));
    $('nxQuranLastPolish')?.addEventListener('click',()=>{
      const last = Math.max(1,Math.min(114,Number(localStorage.getItem('nx_quran_last') || 1)));
      select.value = String(last);
      load.click();
    });
  }

  function addBukhariResume() {
    const controls = $('nxBukhariLoad')?.closest('.nx-scripture-controls');
    if (!controls || $('nxBukhariLastPolish')) return;
    const button = document.createElement('button');
    button.id = 'nxBukhariLastPolish';
    button.className = 'tool-btn';
    button.type = 'button';
    button.textContent = 'Last Read';
    button.addEventListener('click',()=>{
      const last = Math.max(1,Number(localStorage.getItem('nx_bukhari_last') || 1));
      if ($('nxBukhariNo')) $('nxBukhariNo').value = String(last);
      $('nxBukhariLoad')?.click();
    });
    controls.appendChild(button);
  }

  function install() {
    ensureStyles();
    addQuranNavigation();
    addBukhariResume();
    addSearch({readerId:'nxQuranReader',inputId:'nxQuranFindPolish',countId:'nxQuranFindCount',placeholder:'Search this Surah in Arabic or Urdu…',itemSelector:'.nx-ayah'});
    addSearch({readerId:'nxBibleReader',inputId:'nxBibleFindPolish',countId:'nxBibleFindCount',placeholder:'Search this Bible chapter…',itemSelector:'.nx-bible-verse'});

    const qLoad = $('nxQuranLoad');
    if (qLoad && qLoad.dataset.nxPolishRefresh !== '1') {
      qLoad.dataset.nxPolishRefresh='1';
      qLoad.addEventListener('click',()=>setTimeout(()=>{
        const input=$('nxQuranFindPolish'); if(input) input.value='';
        filterReader(input,$('nxQuranReader'),'.nx-ayah',$('nxQuranFindCount'));
      },500));
    }
    const bOpen = $('nxBibleOpen');
    if (bOpen && bOpen.dataset.nxPolishRefresh !== '1') {
      bOpen.dataset.nxPolishRefresh='1';
      bOpen.addEventListener('click',()=>setTimeout(()=>{
        const input=$('nxBibleFindPolish'); if(input) input.value='';
        filterReader(input,$('nxBibleReader'),'.nx-bible-verse',$('nxBibleFindCount'));
      },700));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(install,900),{once:true});
  else setTimeout(install,300);
  [1400,2800,5200,9000].forEach(ms=>setTimeout(install,ms));
})();

/* Urdu Library loader. This file is already part of the proven additive boot path,
   so the new library can be added without touching mining, wallet, auth or page2 core. */
(() => {
  'use strict';
  if (window.__nxUrduLibraryLoaderV1) return;
  window.__nxUrduLibraryLoaderV1 = true;
  const load = () => {
    if (window.__nxUrduLibraryV1 || document.querySelector('script[data-nx-urdu-library-v1]')) return;
    const script = document.createElement('script');
    script.src = './js/nexusnova-urdu-library-v1.js?v=20260816';
    script.defer = true;
    script.dataset.nxUrduLibraryV1 = '1';
    script.onerror = () => console.warn('NexusNova Urdu Library could not load.');
    document.head.appendChild(script);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, {once:true});
  else load();
})();

/* Islamic library + high-contrast reader loader. */
(() => {
  'use strict';
  if (window.__nxIslamicLibraryLoaderV2) return;
  window.__nxIslamicLibraryLoaderV2 = true;
  const load = () => {
    if (window.__nxIslamicLibraryV2 || document.querySelector('script[data-nx-islamic-library-v2]')) return;
    const script = document.createElement('script');
    script.src = './js/nexusnova-islamic-library-v2.js?v=20260816-3';
    script.defer = true;
    script.dataset.nxIslamicLibraryV2 = '1';
    script.onerror = () => console.warn('NexusNova Islamic Library v2 could not load.');
    document.head.appendChild(script);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, {once:true});
  else load();
})();

/* Universal book-focus loader. Quran, Hadith, Fiqh, Ja‘fari, Bible and Urdu
   Library keep their own data/source logic; this addon only changes how an
   opened book is brought into the user's viewport. */
(() => {
  'use strict';
  if (window.__nxBookFocusLoaderV1) return;
  window.__nxBookFocusLoaderV1 = true;
  const load = () => {
    if (window.__nxBookFocusV1 || document.querySelector('script[data-nx-book-focus-v1]')) return;
    const script = document.createElement('script');
    script.src = './js/nexusnova-book-focus-v1.js?v=20260816-1';
    script.defer = true;
    script.dataset.nxBookFocusV1 = '1';
    script.onerror = () => console.warn('NexusNova Book Focus could not load.');
    document.head.appendChild(script);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, {once:true});
  else load();
})();
