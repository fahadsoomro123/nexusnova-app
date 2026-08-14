/* NexusNova Browser v4 — native-first, NexusNova branded, no automatic external redirects */
(() => {
  'use strict';
  if (window.__nxNexusBrowserV4) return;
  window.__nxNexusBrowserV4 = true;
  window.__nxNexusBrowserV3 = true;
  window.__nxNexusBrowserV2 = true;
  window.__nxNexusBrowserV1 = true;
  window.nexusBrowserVersion = 'nexus-browser-v4';

  const MAX_URL = 2000;
  const SEARCH_URL = 'https://www.google.com/search?q=';
  const HOME_URL = 'https://www.google.com/';
  const $ = (sel, root = document) => root.querySelector(sel);

  const ICONS = {
    globe:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 4.1 6.2 4.1 9S15 17.8 12 21M12 3c-3 3.2-4.1 6.2-4.1 9S9 17.8 12 21"/></svg>',
    search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.2"/><path d="m15.2 15.2 4.8 4.8"/></svg>',
    back:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/><path d="M8 12h10"/></svg>',
    forward:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 5 7 7-7 7"/><path d="M16 12H6"/></svg>',
    reload:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 1-2.1-5L20 10"/></svg>',
    home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 11 8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/></svg>',
    shield:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.6 2.7 7.8 7 10 4.3-2.2 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/></svg>',
    plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    tabs:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 2h6M22 9v6M2 9v6"/></svg>',
    menu:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>',
    puzzle:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 4H4v4.5a2.5 2.5 0 1 0 0 5V20h4.5a2.5 2.5 0 1 1 5 0H20v-6.5a2.5 2.5 0 1 0 0-5V4h-6.5a2.5 2.5 0 1 0-5 0Z"/></svg>',
    external:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5h6v6"/><path d="m19 5-8 8"/><path d="M18 13v6H5V6h6"/></svg>'
  };

  const SPEED_DIALS = [
    ['Google','Search','https://www.google.com/','G'],
    ['YouTube','Video','https://www.youtube.com/','Y'],
    ['Wikipedia','Knowledge','https://www.wikipedia.org/','W'],
    ['BBC','News','https://www.bbc.com/','B'],
    ['Maps','Places','https://www.google.com/maps/','M'],
    ['GitHub','Code','https://github.com/','GH'],
    ['ChatGPT','AI','https://chatgpt.com/','AI'],
    ['Gmail','Mail','https://mail.google.com/','GM']
  ];

  function safeUrl(raw) {
    const text = String(raw || '').trim().slice(0, MAX_URL);
    if (!text) return '';
    if (/^(?:javascript|data|file|blob|intent|content):/i.test(text)) return '';
    const search = /\s/.test(text) || (!text.includes('.') && !/^https?:\/\//i.test(text) && !/^localhost(?::\d+)?(?:\/|$)/i.test(text));
    if (search) return SEARCH_URL + encodeURIComponent(text);
    let candidate = text;
    if (!/^https?:\/\//i.test(candidate)) candidate = 'https://' + candidate;
    try {
      const url = new URL(candidate);
      if (!['https:','http:'].includes(url.protocol) || !url.hostname) return '';
      return url.href.slice(0, MAX_URL);
    } catch (_) { return ''; }
  }

  function hostLabel(url) {
    try { return new URL(url).hostname.replace(/^www\./,'').slice(0,48); }
    catch (_) { return 'website'; }
  }

  function nativeAvailable() {
    return typeof window.NexusBrowserAndroid?.postMessage === 'function';
  }

  function postNative(url) {
    if (!nativeAvailable()) return false;
    try {
      window.NexusBrowserAndroid.postMessage(JSON.stringify({action:'open',url}));
      return true;
    } catch (error) {
      console.warn('NexusNova native browser bridge:', error);
      return false;
    }
  }

  function status(message, tone='normal') {
    const node = $('#nxBrowserStatus');
    if (!node) return;
    node.textContent = message;
    node.dataset.tone = tone;
  }

  function launchExternalExplicit(url) {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    } catch (_) { return false; }
  }

  function showWebLimitation(url) {
    const page = $('[data-nx-browser-page]');
    if (!page) return;
    const host = hostLabel(url);
    page.innerHTML = `<div class="nx-web-limit">
      <div class="nx-web-limit-mark">N</div>
      <h2>NexusNova Browser</h2>
      <p><strong>${host}</strong> ko NexusNova ke Android browser ke andar kholne ke liye native browser engine chahiye.</p>
      <p class="muted">Yeh GitHub Pages preview khud Chrome ke andar chal rahi hai. Google aur bohat si websites X-Frame-Options/CSP ki wajah se doosri website ke andar load hone ko block karti hain. Isliye NexusNova ab tumhe bina pooche Chrome me redirect nahi karega.</p>
      <button type="button" class="nx-native-note" data-nx-explicit-external>${ICONS.external}<span>Open externally (web preview only)</span></button>
    </div>`;
    $('[data-nx-explicit-external]', page)?.addEventListener('click', () => launchExternalExplicit(url));
  }

  function openUrl(raw) {
    const url = safeUrl(raw);
    const input = $('#nxBrowserUrl');
    if (!url) {
      status('Website ya search term likho.', 'error');
      input?.focus();
      return false;
    }
    if (input) input.value = url;
    const tabTitle = $('[data-nx-browser-tab-title]');
    if (tabTitle) tabTitle.textContent = hostLabel(url);

    if (postNative(url)) {
      status('NexusNova Browser me page load ho raha hai — Chrome redirect nahi.', 'success');
      return true;
    }

    showWebLimitation(url);
    status('Web preview me automatic Chrome redirect band hai. Full in-app browsing NexusNova Android app me chalegi.', 'warn');
    return false;
  }

  function resetHome() {
    const section = $('#tab-browser');
    const page = $('[data-nx-browser-page]', section || document);
    if (page) page.innerHTML = startMarkup();
    const input = $('#nxBrowserUrl');
    if (input) input.value = '';
    const title = $('[data-nx-browser-tab-title]');
    if (title) title.textContent = 'New Tab';
    bindStartHandlers(section);
    status(nativeAvailable() ? 'NexusNova native browser ready.' : 'NexusNova web preview ready. Android app me real in-app browsing available hai.');
  }

  function startMarkup() {
    const dials = SPEED_DIALS.map(([name,type,url,mark]) => `<button type="button" class="nx-speed" data-nx-speed="${url}"><span class="nx-speed-icon">${mark}</span><strong>${name}</strong><small>${type}</small></button>`).join('');
    return `<div class="nx-start">
      <div class="nx-start-hero">
        <div class="nx-start-mark">N</div>
        <h2>Nexus<span>Nova</span> Browser</h2>
        <p>Fast, private-feeling NexusNova web navigation with a dedicated Android browser engine.</p>
        <form class="nx-home-search" data-nx-home-search>${ICONS.search}<input type="text" data-nx-home-query autocomplete="off" placeholder="Search the web with NexusNova"><button type="submit">SEARCH</button></form>
      </div>
      <div class="nx-section-label"><span>Speed Dial</span><span>Quick access</span></div>
      <div class="nx-speed-grid">${dials}</div>
      <div class="nx-browser-info">${ICONS.shield}<span>${nativeAvailable() ? 'Nexus native engine detected — websites stay inside NexusNova BrowserActivity.' : 'Web preview detected. Automatic external redirect is disabled.'}</span></div>
    </div>`;
  }

  function browserMarkup() {
    return `<div class="nx-browser-window" data-nx-browser-window>
      <div class="nx-browser-tabbar">
        <div class="nx-browser-brand"><div class="nx-browser-logo">N</div><div class="nx-browser-brand-copy"><strong>NexusNova</strong><small>NEURAL WEB</small></div></div>
        <div class="nx-browser-tab">${ICONS.globe}<span data-nx-browser-tab-title>New Tab</span><button type="button" class="nx-browser-tab-close" data-nx-browser-new>×</button></div>
        <button type="button" class="nx-browser-icon-btn" data-nx-browser-new>${ICONS.plus}</button>
        <div class="nx-browser-spacer"></div>
        <div class="nx-browser-engine"><i></i>${nativeAvailable() ? 'NEXUS NATIVE' : 'WEB PREVIEW'}</div>
        <button type="button" class="nx-browser-icon-btn" data-nx-browser-extensions-local>${ICONS.puzzle}</button>
        <button type="button" class="nx-browser-icon-btn" data-nx-browser-menu>${ICONS.menu}</button>
      </div>
      <div class="nx-browser-toolbar">
        <button type="button" class="nx-browser-nav" data-nx-browser-home>${ICONS.home}</button>
        <button type="button" class="nx-browser-nav" data-nx-browser-back>${ICONS.back}</button>
        <button type="button" class="nx-browser-nav" data-nx-browser-forward>${ICONS.forward}</button>
        <button type="button" class="nx-browser-nav" data-nx-browser-reload>${ICONS.reload}</button>
        <div class="nx-omnibox"><span class="nx-lock">${ICONS.shield}</span><input id="nxBrowserUrl" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="Search or enter website"><button type="button" class="nx-go" data-nx-browser-go>${ICONS.search}</button></div>
      </div>
      <div class="nx-browser-progress"><i></i></div>
      <div class="nx-browser-page" data-nx-browser-page>${startMarkup()}</div>
      <div id="nxBrowserStatus" class="nx-browser-statusbar">${nativeAvailable() ? 'NexusNova native browser ready.' : 'Web preview ready — automatic Chrome redirect disabled.'}</div>
      <div class="nx-browser-bottom"><button type="button" class="nx-bottom-btn" data-nx-browser-back>${ICONS.back}<span>Back</span></button><button type="button" class="nx-bottom-btn primary" data-nx-browser-home>${ICONS.home}<span>Home</span></button><button type="button" class="nx-bottom-btn" data-nx-browser-new>${ICONS.plus}<span>New</span></button><button type="button" class="nx-bottom-btn" data-nx-browser-tabs>${ICONS.tabs}<span>Tabs</span></button><button type="button" class="nx-bottom-btn" data-nx-browser-menu>${ICONS.menu}<span>Menu</span></button></div>
    </div>`;
  }

  function installStyle() {
    if ($('#nxBrowserStyleV4')) return;
    const style = document.createElement('style');
    style.id = 'nxBrowserStyleV4';
    style.textContent = `
      /* Browser launcher: static branding only. No reordering, no menu observer. */
      #moreMenu .more-item[onclick*="openMoreTab('browser')"] .mi-icon{background:linear-gradient(145deg,#ff324e,#8d1531)!important;border-color:rgba(255,115,135,.72)!important;box-shadow:0 9px 28px rgba(255,38,74,.30),inset 0 1px 0 rgba(255,255,255,.28)!important;color:#fff!important}
      #moreMenu .more-item[onclick*="openMoreTab('browser')"] .mi-icon svg{stroke:#fff!important}
      #moreMenu .more-item[onclick*="openMoreTab('browser')"]>span:last-child{font-size:0!important}
      #moreMenu .more-item[onclick*="openMoreTab('browser')"]>span:last-child:after{content:'NexusNova';font-size:11px;font-weight:800;color:inherit}
      body.nx-browser-open{background:#03060c!important}
      body.nx-browser-open .top-header,body.nx-browser-open .ticker-wrap{display:none!important}
      body.nx-browser-open .main{width:100%!important;max-width:none!important;margin:0!important;padding:8px 12px 96px!important}
      #tab-browser.nx-browser-shell{--line:rgba(134,180,255,.16);width:100%!important;max-width:none!important;margin:0!important;padding:0!important}
      #tab-browser.nx-browser-shell.active{display:block!important}
      #tab-browser .nx-browser-window{width:100%;min-height:calc(100vh - 118px);overflow:hidden;border:1px solid var(--line);border-radius:20px;background:linear-gradient(180deg,#090f19,#05080d);box-shadow:0 24px 80px rgba(0,0,0,.48);color:#f3f8ff}
      #tab-browser .nx-browser-window *{box-sizing:border-box}#tab-browser .nx-browser-window svg{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      #tab-browser .nx-browser-tabbar{display:flex;align-items:center;gap:8px;min-height:52px;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,.055);background:linear-gradient(180deg,#101827,#0a111c)}
      #tab-browser .nx-browser-brand{display:flex;align-items:center;gap:8px;flex:0 0 auto}.nx-browser-logo{display:grid;place-items:center;width:34px;height:34px;border-radius:12px;background:linear-gradient(145deg,#ff324e,#89162f);box-shadow:0 8px 24px rgba(255,45,76,.28),inset 0 1px 0 rgba(255,255,255,.28);font-size:16px;font-weight:1000;color:#fff}
      #tab-browser .nx-browser-brand-copy strong{display:block;font-size:11px}#tab-browser .nx-browser-brand-copy small{display:block;color:#7d91ad;font-size:6.7px;letter-spacing:.18em;font-weight:900}
      #tab-browser .nx-browser-tab{display:flex;align-items:center;gap:8px;min-width:160px;max-width:330px;height:36px;padding:0 10px;border:1px solid rgba(103,168,255,.17);border-radius:11px;background:#131e2e}#tab-browser .nx-browser-tab>svg{width:15px;height:15px;color:#7bcaff}#tab-browser .nx-browser-tab span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:800;flex:1}
      .nx-browser-tab-close,.nx-browser-icon-btn,.nx-browser-nav{border:0;background:transparent;color:#a8b7ca;cursor:pointer}.nx-browser-tab-close{width:24px;height:24px;border-radius:7px}.nx-browser-icon-btn,.nx-browser-nav{display:grid;place-items:center;width:36px;height:36px;border-radius:11px}.nx-browser-icon-btn:hover,.nx-browser-nav:hover{background:#152033;color:#fff}.nx-browser-icon-btn svg,.nx-browser-nav svg{width:17px;height:17px}
      #tab-browser .nx-browser-spacer{flex:1}.nx-browser-engine{display:flex;align-items:center;gap:6px;padding:6px 9px;border:1px solid rgba(255,75,104,.22);border-radius:999px;background:rgba(255,45,78,.08);color:#ff8397;font-size:7px;font-weight:950;letter-spacing:.09em}.nx-browser-engine i{width:6px;height:6px;border-radius:50%;background:#ff4968;box-shadow:0 0 12px #ff4968}
      #tab-browser .nx-browser-toolbar{display:flex!important;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.05);background:#0a111c}
      #tab-browser .nx-omnibox{display:flex;align-items:center;gap:8px;min-width:180px;flex:1;height:44px;padding:0 6px 0 12px;border:1px solid rgba(110,163,230,.19);border-radius:24px;background:#111a27}.nx-omnibox:focus-within{border-color:rgba(80,178,255,.55)!important;box-shadow:0 0 0 3px rgba(64,154,255,.08)}.nx-lock{display:grid;place-items:center;color:#6ad2ff}.nx-lock svg{width:15px;height:15px}
      #tab-browser #nxBrowserUrl{min-width:0;flex:1;height:40px!important;padding:0!important;border:0!important;outline:0!important;background:transparent!important;box-shadow:none!important;color:#eef7ff!important;font-size:12px!important}.nx-go{display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:18px;background:linear-gradient(145deg,#1684ff,#53c8ff);color:#fff;cursor:pointer}.nx-go svg{width:16px;height:16px}
      .nx-browser-progress{height:2px;background:#07101c}.nx-browser-progress i{display:block;width:22%;height:100%;background:linear-gradient(90deg,#ff3454,#50c8ff);opacity:.85}
      .nx-browser-page{min-height:560px;padding:28px 18px;background:radial-gradient(760px 330px at 50% -10%,rgba(37,125,255,.17),transparent 66%),#070b12}.nx-start{max-width:920px;margin:auto}.nx-start-hero{text-align:center;padding:26px 0 24px}.nx-start-mark,.nx-web-limit-mark{display:grid;place-items:center;width:74px;height:74px;margin:0 auto 15px;border-radius:24px;background:linear-gradient(145deg,#ff3455,#8c1731);box-shadow:0 16px 45px rgba(255,45,76,.22),inset 0 1px 0 rgba(255,255,255,.25);font-size:34px;font-weight:1000}.nx-start h2,.nx-web-limit h2{font-size:30px;margin:0 0 7px}.nx-start h2 span{color:#63ccff}.nx-start p,.nx-web-limit p{color:#9cb0c9;line-height:1.6;margin:0 auto 18px;max-width:680px}
      .nx-home-search{display:flex;align-items:center;gap:10px;max-width:670px;margin:20px auto 0;height:52px;padding:0 5px 0 16px;border:1px solid rgba(109,168,235,.18);border-radius:26px;background:#111b29}.nx-home-search>svg{width:18px;color:#6bcaff}.nx-home-search input{min-width:0;flex:1;border:0!important;background:transparent!important;outline:0!important;color:#fff!important;box-shadow:none!important}.nx-home-search button{height:42px;padding:0 20px;border:0;border-radius:21px;background:linear-gradient(145deg,#ff3455,#c22043);color:#fff;font-size:10px;font-weight:900;cursor:pointer}
      .nx-section-label{display:flex;justify-content:space-between;margin:22px 2px 10px;color:#8fa5bf;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.08em}.nx-speed-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.nx-speed{display:flex;flex-direction:column;align-items:center;gap:6px;padding:15px 8px;border:1px solid rgba(113,164,223,.12);border-radius:16px;background:#0d1521;color:#eef7ff;cursor:pointer}.nx-speed:hover{transform:translateY(-1px);background:#111c2b}.nx-speed-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:14px;background:linear-gradient(145deg,#1c7fff,#5ac9ff);font-size:11px;font-weight:950}.nx-speed strong{font-size:11px}.nx-speed small{font-size:8px;color:#778da7}.nx-browser-info{display:flex;align-items:flex-start;gap:9px;margin-top:18px;padding:12px;border:1px solid rgba(94,171,255,.13);border-radius:14px;background:rgba(30,93,158,.08);color:#8fa7c1;font-size:9px;line-height:1.55}.nx-browser-info svg{width:17px;color:#65ccff;flex:0 0 auto}
      .nx-browser-statusbar{min-height:34px;padding:10px 14px;border-top:1px solid rgba(255,255,255,.04);background:#080e17;color:#7f94ae;font-size:9px}.nx-browser-statusbar[data-tone="success"]{color:#7ee6b8}.nx-browser-statusbar[data-tone="error"]{color:#ff8797}.nx-browser-statusbar[data-tone="warn"]{color:#ffc875}
      .nx-browser-bottom{display:flex;align-items:center;justify-content:center;gap:4px;padding:7px 10px;background:#080d15;border-top:1px solid rgba(255,255,255,.05)}.nx-bottom-btn{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:62px;padding:7px 10px;border:0;border-radius:11px;background:transparent;color:#8397b0;cursor:pointer}.nx-bottom-btn.primary{color:#fff;background:rgba(42,128,255,.12)}.nx-bottom-btn svg{width:17px;height:17px}.nx-bottom-btn span{font-size:7px;font-weight:850}
      .nx-web-limit{max-width:720px;margin:55px auto;text-align:center;padding:30px;border:1px solid rgba(255,104,126,.18);border-radius:24px;background:linear-gradient(180deg,#111827,#0b1019)}.nx-web-limit .muted{font-size:12px}.nx-native-note{display:inline-flex;align-items:center;gap:8px;padding:12px 17px;border:1px solid rgba(102,183,255,.25);border-radius:14px;background:#102036;color:#dff2ff;cursor:pointer}.nx-native-note svg{width:17px}
      @media(max-width:720px){#tab-browser .nx-browser-brand-copy{display:none}#tab-browser .nx-browser-tab{min-width:100px}.nx-browser-engine{display:none}.nx-speed-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.nx-browser-page{padding:18px 10px}.nx-start h2{font-size:25px}.nx-browser-toolbar .nx-browser-nav:nth-of-type(2),.nx-browser-toolbar .nx-browser-nav:nth-of-type(3){display:none}.nx-home-search button{padding:0 13px}.nx-bottom-btn{min-width:0;flex:1}}
    `;
    document.head.appendChild(style);
  }

  function bindStartHandlers(section) {
    if (!section) return;
    $('[data-nx-home-search]', section)?.addEventListener('submit', e => { e.preventDefault(); openUrl($('[data-nx-home-query]',section)?.value || ''); });
    section.querySelectorAll('[data-nx-speed]').forEach(btn => btn.addEventListener('click', () => openUrl(btn.dataset.nxSpeed || '')));
  }

  function installHandlers(section) {
    const input = $('#nxBrowserUrl', section);
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); openUrl(input.value); } });
    $('[data-nx-browser-go]', section)?.addEventListener('click', () => openUrl(input?.value || ''));
    section.querySelectorAll('[data-nx-browser-home],[data-nx-browser-new]').forEach(btn => btn.addEventListener('click', resetHome));
    section.querySelectorAll('[data-nx-browser-reload]').forEach(btn => btn.addEventListener('click', () => input?.value ? openUrl(input.value) : resetHome()));
    section.querySelectorAll('[data-nx-browser-back]').forEach(btn => btn.addEventListener('click', () => status('Back/Forward real history NexusNova Android BrowserActivity me available hai.')));
    section.querySelectorAll('[data-nx-browser-forward]').forEach(btn => btn.addEventListener('click', () => status('Back/Forward real history NexusNova Android BrowserActivity me available hai.')));
    section.querySelectorAll('[data-nx-browser-tabs]').forEach(btn => btn.addEventListener('click', () => status('Native Android browser me real page navigation active hai.')));
    section.querySelectorAll('[data-nx-browser-menu]').forEach(btn => btn.addEventListener('click', () => status(nativeAvailable() ? 'NexusNova native browser engine active.' : 'Web preview: automatic Chrome redirect disabled.')));
    section.querySelectorAll('[data-nx-browser-extensions-local]').forEach(btn => btn.addEventListener('click', () => {
      if (typeof window.nxOpenBrowserExtensions === 'function' && window.nxOpenBrowserExtensions !== openExtensions) window.nxOpenBrowserExtensions();
      else if (window.NexusNovaBrowserExtensions?.open) window.NexusNovaBrowserExtensions.open();
      else status('Extensions & Apps Hub load ho raha hai.');
    }));
    bindStartHandlers(section);
  }

  function openExtensions() {
    if (window.NexusNovaBrowserExtensions?.open) { window.NexusNovaBrowserExtensions.open(); return true; }
    status('Extensions & Apps Hub load ho raha hai.');
    return false;
  }

  function brandLauncher() {
    const launcher = document.querySelector('#moreMenu .more-item[onclick*="openMoreTab(\'browser\')"]');
    if (!launcher || launcher.dataset.nxBrowserV4 === '1') return;
    launcher.dataset.nxBrowserV4 = '1';
    launcher.title = 'Open NexusNova Browser';
    /* Native app: clicking the launcher opens BrowserActivity immediately. Web keeps the preview tab. */
    launcher.addEventListener('click', event => {
      if (!nativeAvailable()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      postNative(HOME_URL);
    }, true);
  }

  function install() {
    installStyle();
    brandLauncher();
    const section = $('#tab-browser');
    if (!section) return false;
    section.classList.add('nx-browser-shell');
    if (section.dataset.nxBrowserBuilt !== 'v4') {
      section.innerHTML = browserMarkup();
      section.dataset.nxBrowserBuilt = 'v4';
      installHandlers(section);
    }
    document.body.classList.toggle('nx-browser-open', section.classList.contains('active'));
    if (!section.__nxBrowserClassObserver) {
      section.__nxBrowserClassObserver = new MutationObserver(() => document.body.classList.toggle('nx-browser-open', section.classList.contains('active')));
      section.__nxBrowserClassObserver.observe(section,{attributes:true,attributeFilter:['class']});
    }
    if (window.NexusNovaBrowserExtensions?.install) { try { window.NexusNovaBrowserExtensions.install(); } catch (_) {} }
    return true;
  }

  window.nxBrowse = () => openUrl($('#nxBrowserUrl')?.value || '');
  window.nxBrowsePreset = url => openUrl(url);
  window.nxOpenBrowserExternal = () => {
    const url = safeUrl($('#nxBrowserUrl')?.value || '');
    if (!url) return false;
    return launchExternalExplicit(url);
  };
  window.nexusOpenInAppBrowser = openUrl;
  window.nxOpenBrowserExtensions = openExtensions;
  window.NexusNovaBrowser = Object.freeze({version:'nexus-browser-v4',install,open:openUrl,normalize:safeUrl,home:resetHome,nativeAvailable});

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install,40), {once:true});
  else setTimeout(install,40);
  setTimeout(install,650);
})();