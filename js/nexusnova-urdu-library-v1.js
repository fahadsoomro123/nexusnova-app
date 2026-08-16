/* NexusNova Urdu Library v1
   Curated world-famous Urdu literature. Public-domain / CC texts may be read
   in-app from Urdu Wikisource. Copyrighted modern classics are catalogue-only
   and route users to legitimate discovery pages; NexusNova does not mirror
   pirated text. No image assets are required. */
(() => {
  'use strict';
  if (window.__nxUrduLibraryV1) return;
  window.__nxUrduLibraryV1 = true;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[ch]));
  const normalize = value => String(value || '').toLocaleLowerCase('ur-PK').replace(/\s+/g,' ').trim();
  const WIKI = 'https://ur.wikisource.org';
  const LAST_KEY = 'nexusnova_urdu_library_last_v1';

  const BOOKS = [
    {id:'diwan-ghalib', title:'دیوانِ غالب', en:'Diwan-e-Ghalib', author:'مرزا اسد اللہ خان غالب', authorEn:'Mirza Ghalib', type:'Poetry', era:'Classic', source:'wikisource', page:'دیوان غالب', note:'غزل، قصیدہ، مثنوی، رباعیات اور دیگر کلام'},
    {id:'bang-e-dara', title:'بانگِ درا', en:'Bang-e-Dara', author:'علامہ محمد اقبال', authorEn:'Muhammad Iqbal', type:'Poetry', era:'Classic', source:'wikisource', page:'بانگ درا', note:'اقبال کی معروف اردو شاعری کا مجموعہ'},
    {id:'bal-e-jibril', title:'بالِ جبریل', en:'Bal-e-Jibril', author:'علامہ محمد اقبال', authorEn:'Muhammad Iqbal', type:'Poetry', era:'Classic', source:'wikisource', page:'بال جبریل', note:'اقبال کے اہم شعری مجموعوں میں سے ایک'},
    {id:'zarb-e-kalim', title:'ضربِ کلیم', en:'Zarb-e-Kalim', author:'علامہ محمد اقبال', authorEn:'Muhammad Iqbal', type:'Poetry', era:'Classic', source:'wikisource', page:'ضرب کلیم', note:'فکر، تہذیب اور خودی کے موضوعات'},
    {id:'armaghan-hijaz', title:'ارمغانِ حجاز', en:'Armaghan-e-Hijaz', author:'علامہ محمد اقبال', authorEn:'Muhammad Iqbal', type:'Poetry', era:'Classic', source:'wikisource', page:'ارمغان حجاز', note:'اقبال کا آخری شعری مجموعہ'},
    {id:'kulliyat-mir', title:'کلیاتِ میر', en:'Kulliyat-e-Mir', author:'میر تقی میر', authorEn:'Mir Taqi Mir', type:'Poetry', era:'Classic', source:'wikisource', page:'کلیات میر', note:'اردو غزل کے عظیم کلاسیکی شاعر کا منتخب/مجموعی کلام'},
    {id:'aab-e-hayat', title:'آبِ حیات', en:'Aab-e-Hayat', author:'محمد حسین آزاد', authorEn:'Muhammad Husain Azad', type:'Literature', era:'Classic', source:'wikisource', page:'آب حیات', note:'اردو شاعری اور ادبی تاریخ کی معروف کلاسیکی کتاب'},
    {id:'umrao-jaan', title:'امراؤ جان ادا', en:'Umrao Jaan Ada', author:'مرزا ہادی رسوا', authorEn:'Mirza Hadi Ruswa', type:'Novel', era:'Classic', source:'wikisource', page:'امراؤ جان ادا', note:'اردو ناول کی عالمی سطح پر معروف کلاسیک'},
    {id:'mirat-ul-uroos', title:'مراۃ العروس', en:'Mirat-ul-Uroos', author:'ڈپٹی نذیر احمد', authorEn:'Nazir Ahmad Dehlvi', type:'Novel', era:'Classic', source:'wikisource', page:'مراۃ العروس', note:'اردو کے ابتدائی اور اثر انگیز ناولوں میں شمار'},
    {id:'taubat-un-nasuh', title:'توبۃ النصوح', en:'Taubat-un-Nasuh', author:'ڈپٹی نذیر احمد', authorEn:'Nazir Ahmad Dehlvi', type:'Novel', era:'Classic', source:'wikisource', page:'توبۃ النصوح', note:'انیسویں صدی کا معروف اصلاحی ناول'},
    {id:'ibn-ul-waqt', title:'ابن الوقت', en:'Ibn-ul-Waqt', author:'ڈپٹی نذیر احمد', authorEn:'Nazir Ahmad Dehlvi', type:'Novel', era:'Classic', source:'wikisource', page:'ابن الوقت', note:'نوآبادیاتی عہد اور تہذیبی کشمکش پر کلاسیکی ناول'},
    {id:'fasana-azad', title:'فسانۂ آزاد', en:'Fasana-e-Azad', author:'رتن ناتھ سرشار', authorEn:'Ratan Nath Sarshar', type:'Novel', era:'Classic', source:'wikisource', page:'فسانہ آزاد', note:'لکھنوی معاشرت اور طنز و مزاح کی مشہور داستانی نثر'},
    {id:'fasana-ajaib', title:'فسانۂ عجائب', en:'Fasana-e-Ajaib', author:'رجب علی بیگ سرور', authorEn:'Rajab Ali Beg Surur', type:'Literature', era:'Classic', source:'wikisource', page:'فسانۂ عجائب', note:'اردو داستانی نثر کی اہم کلاسیک'},
    {id:'bagh-o-bahar', title:'باغ و بہار', en:'Bagh-o-Bahar', author:'میر امن دہلوی', authorEn:'Mir Amman Dehlvi', type:'Literature', era:'Classic', source:'wikisource', page:'باغ و بہار', note:'قصۂ چہار درویش کی معروف اردو نثر'},

    /* Modern classics remain catalogue-only unless a rights-cleared digital
       edition is supplied by its publisher/rights holder. */
    {id:'aag-ka-darya', title:'آگ کا دریا', en:'Aag Ka Darya', author:'قرۃ العین حیدر', authorEn:'Qurratulain Hyder', type:'Novel', era:'Modern', source:'catalog', note:'برصغیر کی تاریخ و تہذیب پر عالمی شہرت یافتہ ناول'},
    {id:'basti', title:'بستی', en:'Basti', author:'انتظار حسین', authorEn:'Intizar Husain', type:'Novel', era:'Modern', source:'catalog', note:'تقسیم، یادداشت اور ہجرت پر بین الاقوامی طور پر معروف ناول'},
    {id:'raja-gidh', title:'راجہ گدھ', en:'Raja Gidh', author:'بانو قدسیہ', authorEn:'Bano Qudsia', type:'Novel', era:'Modern', source:'catalog', note:'پاکستانی اردو ادب کا مقبول اور اثر انگیز ناول'},
    {id:'udaas-naslain', title:'اداس نسلیں', en:'Udaas Naslain', author:'عبداللہ حسین', authorEn:'Abdullah Hussain', type:'Novel', era:'Modern', source:'catalog', note:'جنگ، سیاست، تقسیم اور نسلوں کی کہانی'},
    {id:'khuda-ki-basti', title:'خدا کی بستی', en:'Khuda Ki Basti', author:'شوکت صدیقی', authorEn:'Shaukat Siddiqui', type:'Novel', era:'Modern', source:'catalog', note:'شہری غربت اور سماجی حقیقت نگاری کا معروف ناول'},
    {id:'dast-e-saba', title:'دستِ صبا', en:'Dast-e-Saba', author:'فیض احمد فیض', authorEn:'Faiz Ahmed Faiz', type:'Poetry', era:'Modern', source:'catalog', note:'فیض کی عالمی شہرت یافتہ شعری روایت کا اہم مجموعہ'},
    {id:'khushbu', title:'خوشبو', en:'Khushbu', author:'پروین شاکر', authorEn:'Parveen Shakir', type:'Poetry', era:'Modern', source:'catalog', note:'جدید اردو شاعری کا نہایت مقبول مجموعہ'},
    {id:'tanha-tanha', title:'تنہا تنہا', en:'Tanha Tanha', author:'احمد فراز', authorEn:'Ahmed Faraz', type:'Poetry', era:'Modern', source:'catalog', note:'احمد فراز کی معروف رومانی و مزاحمتی شاعری'}
  ];

  const TYPE_LABEL = {All:'سب', Novel:'ناول', Poetry:'شاعری', Literature:'ادب', Modern:'جدید کلاسکس'};
  let state = {filter:'All', query:'', active:null, activePage:''};

  function ensureStyleLink() {
    if (document.querySelector('link[data-nx-urdu-library-v1]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './css/nexusnova-urdu-library-v1.css?v=20260816';
    link.dataset.nxUrduLibraryV1 = '1';
    document.head.appendChild(link);
  }

  function bookIcon() {
    return '<span class="mi-icon nx3d-ico nxurdu-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M8 4v16M11 8h5M11 12h5"/></svg></span>';
  }

  function installMenu() {
    const menu = document.querySelector('#moreMenu .more-inner');
    if (!menu || menu.querySelector('[data-nx-urdu-library]')) return false;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'more-item';
    button.dataset.nxUrduLibrary = '1';
    button.dataset.search = 'urdu library اردو لائبریری novels poetry literature books';
    button.innerHTML = `${bookIcon()}<span>Urdu Library</span>`;
    button.addEventListener('click', () => openLibrary());
    const learning = menu.querySelector('[data-nxmega="mega-learning"]');
    if (learning) learning.insertAdjacentElement('afterend', button);
    else menu.appendChild(button);
    return true;
  }

  function installTab() {
    if ($('tab-urdu-library')) return true;
    const main = document.querySelector('main.main') || document.querySelector('main');
    if (!main) return false;
    const tab = document.createElement('section');
    tab.id = 'tab-urdu-library';
    tab.className = 'tab nxurdu-tab';
    tab.innerHTML = `
      <div id="nxUrduLibraryHome" class="nxurdu-shell">
        <header class="nxurdu-hero">
          <div class="nxurdu-hero-book" aria-hidden="true"><span>اردو</span></div>
          <div>
            <div class="nxurdu-kicker">NEXUSNOVA • CLASSIC READING</div>
            <h2>اردو لائبریری</h2>
            <p>دنیا بھر میں معروف اردو ناول، ادب اور شاعری — خوبصورت کتابی انداز میں۔</p>
          </div>
        </header>

        <div class="nxurdu-searchbar">
          <span aria-hidden="true">⌕</span>
          <input id="nxUrduLibrarySearch" type="search" autocomplete="off" placeholder="کتاب، مصنف یا English title تلاش کریں…">
          <button id="nxUrduLastRead" type="button">آخری مطالعہ</button>
        </div>

        <div id="nxUrduFilters" class="nxurdu-filters" role="tablist" aria-label="Urdu library categories">
          ${['All','Novel','Poetry','Literature','Modern'].map(key => `<button type="button" data-nxurdu-filter="${key}" class="${key==='All'?'active':''}">${TYPE_LABEL[key]}</button>`).join('')}
        </div>

        <div class="nxurdu-library-note">
          <b>مکمل متن:</b> پبلک ڈومین / Creative Commons کتابیں اردو ویکی ماخذ سے in-app پڑھی جا سکتی ہیں۔ جدید copyrighted کتابیں صرف catalog میں دکھائی جاتی ہیں اور pirated متن NexusNova میں شامل نہیں کیا جاتا۔
        </div>

        <div id="nxUrduBookGrid" class="nxurdu-grid" aria-live="polite"></div>
      </div>

      <div id="nxUrduReader" class="nxurdu-reader" hidden>
        <div class="nxurdu-reader-topbar">
          <button id="nxUrduReaderBack" type="button" class="nxurdu-reader-back">← لائبریری</button>
          <div class="nxurdu-reader-actions">
            <button id="nxUrduReaderBookmark" type="button">Bookmark</button>
            <button id="nxUrduReaderSource" type="button">اصل ماخذ</button>
          </div>
        </div>
        <div class="nxurdu-reader-coverline">
          <div class="nxurdu-reader-mini-book" aria-hidden="true">کتاب</div>
          <div>
            <div id="nxUrduReaderEyebrow" class="nxurdu-reader-eyebrow">URDU CLASSIC</div>
            <h2 id="nxUrduReaderTitle">اردو کتاب</h2>
            <div id="nxUrduReaderAuthor" class="nxurdu-reader-author"></div>
          </div>
        </div>
        <div id="nxUrduReaderStatus" class="nxurdu-reader-status">Loading…</div>
        <article id="nxUrduReaderPage" class="nxurdu-paper" dir="rtl"></article>
      </div>`;
    main.appendChild(tab);

    $('nxUrduLibrarySearch')?.addEventListener('input', event => {
      state.query = event.target.value || '';
      renderBooks();
    });
    $('nxUrduFilters')?.addEventListener('click', event => {
      const button = event.target.closest('[data-nxurdu-filter]');
      if (!button) return;
      state.filter = button.dataset.nxurduFilter || 'All';
      document.querySelectorAll('[data-nxurdu-filter]').forEach(node => node.classList.toggle('active', node === button));
      renderBooks();
    });
    $('nxUrduReaderBack')?.addEventListener('click', showHome);
    $('nxUrduReaderBookmark')?.addEventListener('click', saveLastRead);
    $('nxUrduReaderSource')?.addEventListener('click', openCurrentSource);
    $('nxUrduLastRead')?.addEventListener('click', resumeLastRead);
    renderBooks();
    return true;
  }

  function openLibrary() {
    installTab();
    document.getElementById('moreMenu')?.classList.remove('show');
    if (typeof window.switchTab === 'function') {
      try { window.switchTab('urdu-library', null); } catch (_) {}
    }
    const tab = $('tab-urdu-library');
    if (tab && !tab.classList.contains('active')) {
      document.querySelectorAll('.tab').forEach(node => node.classList.remove('active'));
      tab.classList.add('active');
    }
    document.body.classList.add('nx-opened-from-allapps');
    showHome(false);
    window.scrollTo({top:0, behavior:'smooth'});
  }

  function filteredBooks() {
    const q = normalize(state.query);
    return BOOKS.filter(book => {
      const category = state.filter === 'All' ||
        (state.filter === 'Modern' ? book.era === 'Modern' : book.type === state.filter);
      if (!category) return false;
      if (!q) return true;
      return normalize([book.title, book.en, book.author, book.authorEn, book.type, book.note].join(' ')).includes(q);
    });
  }

  function renderBooks() {
    const grid = $('nxUrduBookGrid');
    if (!grid) return;
    const rows = filteredBooks();
    grid.innerHTML = rows.map((book, index) => {
      const full = book.source === 'wikisource';
      const palette = (BOOKS.indexOf(book) % 6) + 1;
      return `<article class="nxurdu-book-card nxurdu-palette-${palette}" data-book-id="${esc(book.id)}">
        <div class="nxurdu-book-cover" aria-hidden="true"><span class="nxurdu-cover-rule"></span><b>${esc(book.title)}</b><small>${esc(book.author)}</small></div>
        <div class="nxurdu-book-info">
          <div class="nxurdu-badges"><span>${esc(book.type === 'Novel' ? 'ناول' : book.type === 'Poetry' ? 'شاعری' : 'ادب')}</span><span class="${full?'full':'catalog'}">${full?'Full text source':'Catalog'}</span></div>
          <h3>${esc(book.title)}</h3>
          <div class="nxurdu-en-title">${esc(book.en)}</div>
          <p class="nxurdu-author">${esc(book.author)} <span>• ${esc(book.authorEn)}</span></p>
          <p class="nxurdu-desc">${esc(book.note)}</p>
          <button type="button" class="nxurdu-read-btn" data-read-book="${esc(book.id)}">${full?'مطالعہ کریں':'قانونی نسخہ تلاش کریں'} <span>←</span></button>
        </div>
      </article>`;
    }).join('') || '<div class="nxurdu-empty">کوئی کتاب اس تلاش سے نہیں ملی۔</div>';

    grid.querySelectorAll('[data-read-book]').forEach(button => {
      button.addEventListener('click', () => openBook(button.dataset.readBook));
    });
  }

  async function openBook(id) {
    const book = BOOKS.find(row => row.id === id);
    if (!book) return;
    if (book.source !== 'wikisource') {
      openLegalDiscovery(book);
      return;
    }
    state.active = book;
    state.activePage = book.page;
    $('nxUrduLibraryHome').hidden = true;
    $('nxUrduReader').hidden = false;
    $('nxUrduReaderTitle').textContent = book.title;
    $('nxUrduReaderAuthor').textContent = `${book.author} • ${book.en}`;
    $('nxUrduReaderEyebrow').textContent = book.type === 'Poetry' ? 'URDU POETRY CLASSIC' : book.type === 'Novel' ? 'URDU NOVEL CLASSIC' : 'URDU LITERARY CLASSIC';
    $('nxUrduReaderPage').innerHTML = '<div class="nxurdu-loading"><i></i><span>کتاب لوڈ ہو رہی ہے…</span></div>';
    $('nxUrduReaderStatus').textContent = 'Urdu Wikisource سے مکمل دستیاب متن لوڈ کیا جا رہا ہے…';
    window.scrollTo({top:0, behavior:'smooth'});
    await loadWikiPage(book.page, book);
  }

  async function findWikiTitle(wanted) {
    const exactUrl = `${WIKI}/w/api.php?action=query&titles=${encodeURIComponent(wanted)}&format=json&formatversion=2&origin=*`;
    const exactResponse = await fetch(exactUrl, {cache:'no-store'});
    if (!exactResponse.ok) throw new Error(`Wikisource HTTP ${exactResponse.status}`);
    const exactJson = await exactResponse.json();
    const exactPage = exactJson?.query?.pages?.[0];
    if (exactPage && !exactPage.missing && exactPage.title) return exactPage.title;

    const searchUrl = `${WIKI}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(wanted)}&srnamespace=0&srlimit=8&format=json&formatversion=2&origin=*`;
    const response = await fetch(searchUrl, {cache:'no-store'});
    if (!response.ok) throw new Error(`Wikisource search HTTP ${response.status}`);
    const json = await response.json();
    const results = json?.query?.search || [];
    const normalizedWanted = normalize(wanted);
    const exact = results.find(row => normalize(row.title) === normalizedWanted);
    return (exact || results[0])?.title || '';
  }

  function sanitizeWikiHtml(html) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    doc.querySelectorAll('script,style,iframe,object,embed,form,input,button,textarea,select,noscript,.mw-editsection,.navbox,.metadata,.sistersitebox,.catlinks,.printfooter,.authority-control').forEach(node => node.remove());
    const allowed = new Set(['P','DIV','SPAN','H1','H2','H3','H4','H5','H6','BR','UL','OL','LI','BLOCKQUOTE','HR','B','STRONG','I','EM','U','SUP','SUB','A','TABLE','THEAD','TBODY','TR','TD','TH']);

    function cleanNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue || '');
      if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
      const tag = node.tagName.toUpperCase();
      if (!allowed.has(tag)) {
        const frag = document.createDocumentFragment();
        Array.from(node.childNodes).forEach(child => frag.appendChild(cleanNode(child)));
        return frag;
      }
      const out = document.createElement(tag.toLowerCase());
      if (tag === 'A') {
        const raw = String(node.getAttribute('href') || '');
        if (raw.startsWith('/wiki/')) {
          out.href = WIKI + raw;
          out.dataset.nxUrduWikiLink = '1';
        } else if (/^https:\/\/ur\.wikisource\.org\/wiki\//i.test(raw)) {
          out.href = raw;
          out.dataset.nxUrduWikiLink = '1';
        } else if (/^https?:\/\//i.test(raw)) {
          out.href = raw;
          out.target = '_blank';
          out.rel = 'noopener noreferrer';
        }
      }
      Array.from(node.childNodes).forEach(child => out.appendChild(cleanNode(child)));
      return out;
    }

    const container = document.createElement('div');
    Array.from(doc.body.childNodes).forEach(child => container.appendChild(cleanNode(child)));
    return container.innerHTML;
  }

  async function loadWikiPage(requestedTitle, book = state.active) {
    const page = $('nxUrduReaderPage'), status = $('nxUrduReaderStatus');
    if (!page || !status || !book) return;
    try {
      const title = await findWikiTitle(requestedTitle);
      if (!title) throw new Error('یہ مکمل عنوان اردو ویکی ماخذ میں نہیں ملا۔');
      const url = `${WIKI}/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text|displaytitle&format=json&formatversion=2&origin=*`;
      const response = await fetch(url, {cache:'no-store'});
      if (!response.ok) throw new Error(`Wikisource HTTP ${response.status}`);
      const json = await response.json();
      if (json?.error || !json?.parse?.text) throw new Error(json?.error?.info || 'کتاب کا متن دستیاب نہیں۔');
      state.activePage = title;
      const safe = sanitizeWikiHtml(json.parse.text);
      page.innerHTML = safe || '<div class="nxurdu-reader-error">اس صفحے پر قابلِ مطالعہ متن نہیں ملا۔</div>';
      status.textContent = `${book.title} • ${title} • Source: Urdu Wikisource (CC / source licensing applies)`;
      page.scrollTop = 0;
      page.querySelectorAll('a[data-nx-urdu-wiki-link="1"]').forEach(link => {
        link.addEventListener('click', event => {
          event.preventDefault();
          const href = new URL(link.href, WIKI);
          let next = decodeURIComponent(href.pathname.replace(/^\/wiki\//,''));
          next = next.replace(/_/g,' ');
          if (!next) return;
          page.innerHTML = '<div class="nxurdu-loading"><i></i><span>اگلا صفحہ لوڈ ہو رہا ہے…</span></div>';
          status.textContent = 'Loading page…';
          loadWikiPage(next, book);
          window.scrollTo({top:0,behavior:'smooth'});
        });
      });
      saveLastRead(false);
    } catch (error) {
      console.warn('NexusNova Urdu Library:', error);
      page.innerHTML = `<div class="nxurdu-reader-error"><b>یہ متن ابھی in-app لوڈ نہیں ہو سکا۔</b><span>${esc(error.message || 'Source unavailable')}</span><button id="nxUrduFallbackSource" type="button">اردو ویکی ماخذ پر تلاش کریں</button></div>`;
      status.textContent = 'Full-text source temporarily unavailable.';
      $('nxUrduFallbackSource')?.addEventListener('click', () => {
        openExternal(`${WIKI}/w/index.php?search=${encodeURIComponent(book.title)}`);
      });
    }
  }

  function saveLastRead(showFeedback = true) {
    if (!state.active) return;
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify({id:state.active.id, page:state.activePage || state.active.page, at:Date.now()}));
      if (showFeedback) {
        const status = $('nxUrduReaderStatus');
        if (status) {
          const old = status.textContent;
          status.textContent = '✓ Bookmark محفوظ ہوگیا';
          setTimeout(() => { if (status.textContent.includes('Bookmark')) status.textContent = old; }, 1400);
        }
      }
    } catch (_) {}
  }

  function resumeLastRead() {
    let last = null;
    try { last = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch (_) {}
    const book = BOOKS.find(row => row.id === last?.id);
    if (!book) {
      const button = $('nxUrduLastRead');
      if (button) {
        const old = button.textContent;
        button.textContent = 'ابھی کوئی Bookmark نہیں';
        setTimeout(() => button.textContent = old, 1500);
      }
      return;
    }
    openBook(book.id).then(() => {
      if (last.page && last.page !== book.page) loadWikiPage(last.page, book);
    });
  }

  function showHome(scroll = true) {
    const home = $('nxUrduLibraryHome'), reader = $('nxUrduReader');
    if (home) home.hidden = false;
    if (reader) reader.hidden = true;
    if (scroll) window.scrollTo({top:0,behavior:'smooth'});
  }

  function openCurrentSource() {
    if (!state.active) return;
    openExternal(`${WIKI}/wiki/${encodeURIComponent((state.activePage || state.active.page).replace(/ /g,'_'))}`);
  }

  function openLegalDiscovery(book) {
    const title = encodeURIComponent(`${book.title} ${book.author}`);
    /* Rekhta's ebooks library is used only as a discovery destination. No
       copyrighted book text is scraped or mirrored by NexusNova. */
    openExternal(`https://www.rekhta.org/search/ebooks?q=${title}`);
  }

  function openExternal(url) {
    if (typeof window.nxOpenExternal === 'function') window.nxOpenExternal(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  }

  function install() {
    ensureStyleLink();
    installMenu();
    installTab();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install, 1000), {once:true});
  else setTimeout(install, 300);
  [1200,2400,4200,7000,11000].forEach(ms => setTimeout(install, ms));

  window.NexusNovaUrduLibrary = {
    version:'1.0.0',
    open:openLibrary,
    books:BOOKS.map(({id,title,en,author,type,era,source}) => ({id,title,en,author,type,era,source}))
  };
})();
