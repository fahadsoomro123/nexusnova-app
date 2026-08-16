/* NexusNova Islamic Library v2
   Additive library + reader UX. Core auth/mining/wallet logic is untouched.
   Religious text is never machine-translated or silently rewritten. */
(() => {
  'use strict';
  if (window.__nxIslamicLibraryV2) return;
  window.__nxIslamicLibraryV2 = true;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[ch]));
  const LAST_HADITH = 'nx_hadith_library_last_v2';

  const HADITH_COLLECTIONS = [
    {id:'bukhari', title:'Sahih al-Bukhari', ar:'صحيح البخاري', ur:'صحیح بخاری'},
    {id:'muslim', title:'Sahih Muslim', ar:'صحيح مسلم', ur:'صحیح مسلم'},
    {id:'abudawud', title:'Sunan Abu Dawud', ar:'سنن أبي داود', ur:'سنن ابو داؤد'},
    {id:'tirmidhi', title:'Jami at-Tirmidhi', ar:'جامع الترمذي', ur:'جامع ترمذی'},
    {id:'nasai', title:'Sunan an-Nasa’i', ar:'سنن النسائي', ur:'سنن نسائی'},
    {id:'ibnmajah', title:'Sunan Ibn Majah', ar:'سنن ابن ماجه', ur:'سنن ابن ماجہ'},
    {id:'malik', title:'Muwatta Imam Malik', ar:'موطأ مالك', ur:'موطا امام مالک'}
  ];

  const FIQH_GROUPS = [
    {
      key:'hanafi', title:'Hanafi', ar:'الفقه الحنفي', ur:'فقہ حنفی',
      books:[
        ['Al-Hidayah','الهداية','الہدایہ'],
        ['Bada’i al-Sana’i','بدائع الصنائع','بدائع الصنائع'],
        ['Radd al-Muhtar','رد المحتار','رد المحتار'],
        ['Fatawa Alamgiri','الفتاوى الهندية','فتاویٰ عالمگیری']
      ]
    },
    {
      key:'shafii', title:'Shafi’i', ar:'الفقه الشافعي', ur:'فقہ شافعی',
      books:[
        ['Al-Umm','الأم','الام'],
        ['Al-Majmu','المجموع شرح المهذب','المجموع'],
        ['Minhaj al-Talibin','منهاج الطالبين','منہاج الطالبین']
      ]
    },
    {
      key:'maliki', title:'Maliki', ar:'الفقه المالكي', ur:'فقہ مالکی',
      books:[
        ['Al-Mudawwana al-Kubra','المدونة الكبرى','المدونۃ الکبریٰ'],
        ['Mukhtasar Khalil','مختصر خليل','مختصر خلیل'],
        ['Bidayat al-Mujtahid','بداية المجتهد','بدایۃ المجتہد']
      ]
    },
    {
      key:'hanbali', title:'Hanbali', ar:'الفقه الحنبلي', ur:'فقہ حنبلی',
      books:[
        ['Al-Mughni','المغني','المغنی'],
        ['Zad al-Mustaqni','زاد المستقنع','زاد المستقنع'],
        ['Kashshaf al-Qina','كشاف القناع','کشاف القناع']
      ]
    }
  ];

  const JAFARI_BOOKS = [
    {title:'Al-Kafi', ar:'الكافي', ur:'الکافی', type:'Core Hadith'},
    {title:'Man La Yahduruhu al-Faqih', ar:'من لا يحضره الفقيه', ur:'من لا یحضرہ الفقیہ', type:'Core Hadith / Fiqh'},
    {title:'Tahdhib al-Ahkam', ar:'تهذيب الأحكام', ur:'تہذیب الاحکام', type:'Core Hadith / Fiqh'},
    {title:'Al-Istibsar', ar:'الاستبصار', ur:'الاستبصار', type:'Core Hadith / Fiqh'},
    {title:'Sharayi al-Islam', ar:'شرائع الإسلام', ur:'شرائع الاسلام', type:'Fiqh'},
    {title:'Al-Urwat al-Wuthqa', ar:'العروة الوثقى', ur:'العروۃ الوثقیٰ', type:'Fiqh'},
    {title:'Tahrir al-Wasilah', ar:'تحرير الوسيلة', ur:'تحریر الوسیلہ', type:'Fiqh'}
  ];

  function ensureStyles() {
    if (document.querySelector('link[data-nx-reader-library-v3]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './css/nexusnova-reader-library-v3.css?v=20260816-3';
    link.dataset.nxReaderLibraryV3 = '1';
    document.head.appendChild(link);
  }

  async function fetchJson(url, timeout = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {cache:'no-store', signal:controller.signal});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function hadithText(data) {
    const item = Array.isArray(data?.hadiths) ? data.hadiths[0] : (data?.hadith || data);
    return String(item?.text || item?.hadith || '').trim();
  }

  function hadithMeta(id) {
    return HADITH_COLLECTIONS.find(x => x.id === id) || HADITH_COLLECTIONS[0];
  }

  function getHadithLast() {
    try {
      const item = JSON.parse(localStorage.getItem(LAST_HADITH) || 'null');
      if (item && HADITH_COLLECTIONS.some(x => x.id === item.collection) && Number(item.number) > 0) return item;
    } catch (_) {}
    return {collection:'bukhari', number:1};
  }

  function saveHadithLast(collection, number) {
    try { localStorage.setItem(LAST_HADITH, JSON.stringify({collection, number})); } catch (_) {}
  }

  async function loadHadith(number) {
    const collection = $('nxHadithCollection')?.value || 'bukhari';
    const n = Math.max(1, Math.floor(Number(number) || 1));
    const input = $('nxHadithNo');
    const status = $('nxHadithStatus');
    const reader = $('nxHadithReader');
    if (!reader || !status) return;
    if (input) input.value = String(n);
    const meta = hadithMeta(collection);
    status.textContent = `Loading ${meta.title}…`;
    reader.innerHTML = '<div class="nxlib-empty">Loading Arabic and Urdu text…</div>';
    try {
      const base = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions';
      const [arabic, urdu] = await Promise.all([
        fetchJson(`${base}/ara-${collection}/${n}.min.json`),
        fetchJson(`${base}/urd-${collection}/${n}.min.json`)
      ]);
      const arText = hadithText(arabic);
      const urText = hadithText(urdu);
      if (!arText && !urText) throw new Error('Hadith text missing');
      reader.innerHTML = `<article class="nx-hadith nxlib-hadith-page">
        <div class="nx-verse-no">${esc(meta.title)} · ${n}</div>
        <div class="nx-arabic">${esc(arText)}</div>
        <div class="nx-urdu">${esc(urText)}</div>
      </article>`;
      status.textContent = `${meta.ur} · حدیث ${n} · Arabic + Urdu`;
      saveHadithLast(collection, n);
      reader.scrollTop = 0;
    } catch (err) {
      console.warn('NexusNova hadith library:', err);
      reader.innerHTML = '<div class="nxlib-empty">This Hadith number could not be loaded. Try another number or check your connection.</div>';
      status.textContent = `${meta.title} · text unavailable for this number`;
    }
  }

  function openSource(url) {
    const safe = String(url || '').trim();
    if (!/^https:\/\//i.test(safe)) return;
    try {
      if (typeof window.openMoreTab === 'function' && typeof window.nxBrowsePreset === 'function') {
        window.openMoreTab('browser');
        setTimeout(() => window.nxBrowsePreset(safe), 120);
        return;
      }
      if (typeof window.nxOpenExternal === 'function') {
        window.nxOpenExternal(safe);
        return;
      }
      window.open(safe, '_blank', 'noopener,noreferrer');
    } catch (_) {}
  }
  window.nxIslamicOpenSource = openSource;

  function archiveSearch(title, urdu = '') {
    const query = [title, urdu, 'Urdu Arabic'].filter(Boolean).join(' ');
    return `https://archive.org/search?query=${encodeURIComponent(query)}`;
  }

  function fiqhPanelHtml() {
    const groups = FIQH_GROUPS.map(group => `
      <section class="nxlib-school" data-school="${group.key}">
        <div class="nxlib-school-head"><div><span>${esc(group.ar)}</span><h4>${esc(group.ur)}</h4></div><small>${esc(group.title)}</small></div>
        <div class="nxlib-book-list">${group.books.map(book => `
          <article class="nxlib-mini-book">
            <div class="nxlib-mini-spine"></div>
            <div class="nxlib-mini-copy"><b>${esc(book[2])}</b><span>${esc(book[1])}</span><small>${esc(book[0])}</small></div>
            <button type="button" data-nx-source="${esc(archiveSearch(book[0], book[2]))}">Find verified edition</button>
          </article>`).join('')}</div>
      </section>`).join('');

    return `<div class="nxlib-section-head"><div><span>FIQH LIBRARY</span><h3>فقہ کی معروف کتب</h3></div><p>Hanafi, Shafi’i, Maliki and Hanbali shelves. Source-hosted editions are opened without altering the religious text.</p></div>
      <div class="nxlib-source-note">NexusNova does not create its own translation of fiqh books. A full Arabic/Urdu text is embedded only when reuse rights and the source are clear; otherwise a source/archive edition opens in NexusNova Browser.</div>
      ${groups}
      <div class="nxlib-wide-actions"><button type="button" data-nx-source="https://islamhouse.com/read/ur">Browse IslamHouse Urdu Reader</button></div>`;
  }

  function jafariPanelHtml() {
    return `<div class="nxlib-section-head"><div><span>JA‘FARI LIBRARY</span><h3>فقہ جعفریہ و علمی ذخیرہ</h3></div><p>Separate Ja‘fari shelf with core Hadith, fiqh and heritage works.</p></div>
      <article class="nxlib-featured-nahj">
        <div class="nxlib-nahj-cover"><small>نهج البلاغة</small><b>نہج البلاغہ</b><span>Imam Ali ibn Abi Talib</span></div>
        <div class="nxlib-nahj-copy"><h4>نہج البلاغہ</h4><p>Khutbat, letters and sayings. The source-hosted edition below provides Arabic text with Urdu translation/commentary.</p><button type="button" data-nx-source="https://balagha.org/index.php?n=1&t=1">Read Arabic + Urdu source</button></div>
      </article>
      <div class="nxlib-book-list nxlib-jafari-list">${JAFARI_BOOKS.map(book => `
        <article class="nxlib-mini-book">
          <div class="nxlib-mini-spine"></div>
          <div class="nxlib-mini-copy"><b>${esc(book.ur)}</b><span>${esc(book.ar)}</span><small>${esc(book.title)} · ${esc(book.type)}</small></div>
          <button type="button" data-nx-source="${esc(archiveSearch(book.title, book.ur))}">Find verified edition</button>
        </article>`).join('')}</div>
      <div class="nxlib-wide-actions"><button type="button" data-nx-source="https://al-islam.org/ur">Browse source-hosted Ja‘fari Urdu library</button></div>
      <div class="nxlib-source-note">For copyrighted Urdu translations, NexusNova links to the source instead of copying text into the app. This prevents incomplete, altered or unlicensed religious editions.</div>`;
  }

  function showFaith(name) {
    const map = {quran:'quran', hadith:'bukhari', fiqh:'fiqh', jafari:'jafari', prayer:'prayer'};
    Object.values(map).forEach(id => {
      const panel = $(`faith-${id}`);
      if (panel) panel.style.display = 'none';
    });
    const target = $(`faith-${map[name] || 'quran'}`);
    if (target) target.style.display = 'block';
    document.querySelectorAll('#tab-mega-islamic .nxlib-launcher').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.library === name);
    });
  }

  function bindSourceButtons(root) {
    root?.querySelectorAll('[data-nx-source]').forEach(button => {
      if (button.dataset.nxSourceBound === '1') return;
      button.dataset.nxSourceBound = '1';
      button.addEventListener('click', () => openSource(button.dataset.nxSource));
    });
  }

  function enhanceHadith() {
    const panel = $('faith-bukhari');
    if (!panel || panel.dataset.nxHadithLibraryV2 === '1') return;
    panel.dataset.nxHadithLibraryV2 = '1';
    const last = getHadithLast();
    panel.innerHTML = `<div class="nxlib-reader-heading nxlib-hadith-heading"><div class="nxlib-reader-mark">ح</div><div><span>COMPLETE COLLECTIONS</span><h3>Hadith Library · کتبِ حدیث</h3><p>Arabic original with Urdu translation, streamed one Hadith at a time.</p></div></div>
      <div class="nx-scripture-controls nxlib-reader-controls">
        <select id="nxHadithCollection" class="tool-input" aria-label="Hadith collection">${HADITH_COLLECTIONS.map(item => `<option value="${item.id}" ${item.id===last.collection?'selected':''}>${esc(item.ur)} · ${esc(item.title)}</option>`).join('')}</select>
        <input id="nxHadithNo" class="tool-input" type="number" min="1" value="${Number(last.number)||1}" inputmode="numeric" aria-label="Hadith number">
        <button id="nxHadithRead" class="tool-btn nxlib-read-action" type="button">Read Hadith</button>
      </div>
      <div class="nxlib-inline-nav"><button id="nxHadithPrev" type="button">← Previous</button><button id="nxHadithLast" type="button">Last Read</button><button id="nxHadithNext" type="button">Next →</button></div>
      <div id="nxHadithStatus" class="tool-muted">Choose a collection and Hadith number.</div>
      <div id="nxHadithReader" class="nx-scripture-reader tool-result nxlib-hadith-reader"><div class="nxlib-empty">Select a Hadith and tap Read Hadith.</div></div>
      <div class="nx-attribution">Complete Arabic and Urdu editions: fawazahmed0/hadith-api (Unlicense). Collections included: Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasa’i, Ibn Majah and Muwatta Malik.</div>`;

    $('nxHadithRead')?.addEventListener('click', () => loadHadith($('nxHadithNo')?.value));
    $('nxHadithPrev')?.addEventListener('click', () => loadHadith(Math.max(1, Number($('nxHadithNo')?.value || 1) - 1)));
    $('nxHadithNext')?.addEventListener('click', () => loadHadith(Number($('nxHadithNo')?.value || 1) + 1));
    $('nxHadithLast')?.addEventListener('click', () => {
      const saved = getHadithLast();
      if ($('nxHadithCollection')) $('nxHadithCollection').value = saved.collection;
      loadHadith(saved.number);
    });
    $('nxHadithCollection')?.addEventListener('change', () => {
      const saved = getHadithLast();
      const selected = $('nxHadithCollection')?.value;
      const n = saved.collection === selected ? saved.number : 1;
      if ($('nxHadithNo')) $('nxHadithNo').value = String(n);
      const meta = hadithMeta(selected);
      if ($('nxHadithStatus')) $('nxHadithStatus').textContent = `${meta.ur} · Arabic + Urdu edition`;
    });
  }

  function enhanceQuran() {
    const panel = $('faith-quran');
    const controls = panel?.querySelector('.nx-scripture-controls');
    if (!panel || !controls) return;
    if (!panel.querySelector('.nxlib-reader-heading')) {
      const head = document.createElement('div');
      head.className = 'nxlib-reader-heading nxlib-quran-heading';
      head.innerHTML = '<div class="nxlib-reader-mark">ق</div><div><span>AL-QURAN</span><h3>القرآن الكريم · قرآن پاک</h3><p>Uthmani Arabic with Urdu translation.</p></div>';
      controls.insertAdjacentElement('beforebegin', head);
    }
    controls.classList.add('nxlib-reader-controls');
    const read = $('nxQuranLoad');
    const save = $('nxQuranBookmark');
    if (read) { read.textContent = 'Read Surah'; read.classList.add('nxlib-read-action'); }
    if (save) save.textContent = 'Save';
  }

  function enhanceBible() {
    const tab = $('tab-bible');
    const hero = tab?.querySelector('.nxmega-hero');
    if (!hero || hero.dataset.nxBookUiV3 === '1') return;
    hero.dataset.nxBookUiV3 = '1';
    const controls = hero.querySelector('.nx-scripture-controls');
    if (controls && !hero.querySelector('.nxlib-reader-heading')) {
      const head = document.createElement('div');
      head.className = 'nxlib-reader-heading nxlib-bible-heading';
      head.innerHTML = '<div class="nxlib-reader-mark">✦</div><div><span>SCRIPTURE READER</span><h3>Holy Bible · بائبل</h3><p>Book and chapter reading in English or Urdu.</p></div>';
      controls.insertAdjacentElement('beforebegin', head);
    }
    controls?.classList.add('nxlib-reader-controls');
    const open = $('nxBibleOpen');
    if (open) { open.textContent = 'Read Chapter'; open.classList.add('nxlib-read-action'); }
    if ($('nxBiblePrev')) $('nxBiblePrev').textContent = '← Previous';
    if ($('nxBibleNext')) $('nxBibleNext').textContent = 'Next →';
  }

  function enhanceIslamic() {
    const tab = $('tab-mega-islamic');
    const hero = tab?.querySelector('.nxmega-hero');
    if (!hero) return false;
    if (hero.dataset.nxIslamicLibraryV2 === '1') {
      enhanceBible();
      return true;
    }
    hero.dataset.nxIslamicLibraryV2 = '1';
    hero.classList.add('nxlib-islamic-hero');

    const oldTabs = hero.querySelector('.nx-scripture-tabs');
    oldTabs?.classList.add('nxlib-legacy-tabs');

    const shelf = document.createElement('div');
    shelf.className = 'nxlib-shell';
    shelf.innerHTML = `<div class="nxlib-intro"><div><span>ISLAMIC DIGITAL LIBRARY</span><h3>کتب خانہ · Read with clarity</h3></div><p>Quran, complete major Hadith collections, fiqh shelves and a separate Ja‘fari library.</p></div>
      <div class="nxlib-shelf" role="navigation" aria-label="Islamic library">
        <button type="button" class="nxlib-launcher active" data-library="quran" data-tone="quran"><i></i><small>QURAN</small><b>قرآن پاک</b><span>Arabic + Urdu</span></button>
        <button type="button" class="nxlib-launcher" data-library="hadith" data-tone="hadith"><i></i><small>HADITH</small><b>کتبِ حدیث</b><span>7 complete collections</span></button>
        <button type="button" class="nxlib-launcher" data-library="fiqh" data-tone="fiqh"><i></i><small>FIQH</small><b>فقہ لائبریری</b><span>Four Sunni schools</span></button>
        <button type="button" class="nxlib-launcher" data-library="jafari" data-tone="jafari"><i></i><small>JA‘FARI</small><b>فقہ جعفریہ</b><span>Nahj + core works</span></button>
        <button type="button" class="nxlib-launcher" data-library="prayer" data-tone="prayer"><i></i><small>SALAH</small><b>نماز کے اوقات</b><span>Location based</span></button>
        <button type="button" class="nxlib-launcher" data-library="qibla" data-tone="qibla"><i></i><small>QIBLA</small><b>قبلہ</b><span>Direction finder</span></button>
      </div>`;
    const h2 = hero.querySelector('h2');
    if (h2) h2.insertAdjacentElement('afterend', shelf); else hero.insertBefore(shelf, hero.firstChild);

    if (!$('faith-fiqh')) {
      const fiqh = document.createElement('div');
      fiqh.id = 'faith-fiqh';
      fiqh.className = 'nxlib-library-panel';
      fiqh.style.display = 'none';
      fiqh.innerHTML = fiqhPanelHtml();
      hero.appendChild(fiqh);
    }
    if (!$('faith-jafari')) {
      const jafari = document.createElement('div');
      jafari.id = 'faith-jafari';
      jafari.className = 'nxlib-library-panel';
      jafari.style.display = 'none';
      jafari.innerHTML = jafariPanelHtml();
      hero.appendChild(jafari);
    }

    shelf.querySelectorAll('.nxlib-launcher').forEach(button => {
      button.addEventListener('click', () => {
        const name = button.dataset.library;
        if (name === 'qibla') {
          if (typeof window.openMoreTab === 'function') window.openMoreTab('qibla');
          return;
        }
        showFaith(name);
      });
    });

    enhanceQuran();
    enhanceHadith();
    bindSourceButtons(hero);
    showFaith('quran');
    enhanceBible();
    return true;
  }

  function install() {
    ensureStyles();
    enhanceIslamic();
    enhanceBible();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install, 1100), {once:true});
  else setTimeout(install, 300);
  [1600, 2800, 4800, 8000, 12000].forEach(ms => setTimeout(install, ms));

  const main = document.querySelector('main.main') || document.querySelector('main');
  if (main) {
    const observer = new MutationObserver(() => {
      clearTimeout(observer.__nxTimer);
      observer.__nxTimer = setTimeout(install, 120);
    });
    observer.observe(main, {childList:true, subtree:true});
  }
})();
