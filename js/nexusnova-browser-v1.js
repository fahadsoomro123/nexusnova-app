/* NexusNova Browser v3
   Opera/Firefox-inspired NexusNova browser shell.
   Web/PWA launches real pages in a secure browser tab because most public sites
   block iframe embedding. Android delegates to the dedicated NexusNova Browser Activity.
*/
(() => {
  'use strict';
  if (window.__nxNexusBrowserV3) return;
  window.__nxNexusBrowserV3 = true;
  window.__nxNexusBrowserV2 = true;
  window.__nxNexusBrowserV1 = true;
  window.nexusBrowserVersion = 'nexus-browser-v3';

  const MAX_URL = 2000;
  const HOME_SEARCH = 'https://www.google.com/search?q=';
  const RECENT_KEY = 'nexusnova_browser_recent_v3';
  const $ = (sel, root = document) => root.querySelector(sel);

  const ICONS = {
    globe:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 4.1 6.2 4.1 9S15 17.8 12 21M12 3c-3 3.2-4.1 6.2-4.1 9S9 17.8 12 21"/></svg>',
    search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.6 15.6 4.4 4.4"/></svg>',
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
    ['Google', 'Search', 'https://www.google.com/', 'G'],
    ['YouTube', 'Video', 'https://www.youtube.com/', 'Y'],
    ['Wikipedia', 'Knowledge', 'https://www.wikipedia.org/', 'W'],
    ['BBC', 'News', 'https://www.bbc.com/', 'B'],
    ['Maps', 'Places', 'https://www.google.com/maps/', 'M'],
    ['GitHub', 'Code', 'https://github.com/', 'GH'],
    ['ChatGPT', 'AI', 'https://chatgpt.com/', 'AI'],
    ['Gmail', 'Mail', 'https://mail.google.com/', 'GM']
  ];

  function safeUrl(raw) {
    const text = String(raw || '').trim().slice(0, MAX_URL);
    if (!text) return '';
    if (/^(?:javascript|data|file|blob|intent|content):/i.test(text)) return '';
    const looksLikeSearch = /\s/.test(text) || (!text.includes('.') && !/^https?:\/\//i.test(text) && !/^localhost(?::\d+)?(?:\/|$)/i.test(text));
    if (looksLikeSearch) return HOME_SEARCH + encodeURIComponent(text);
    let candidate = text;
    if (!/^https?:\/\//i.test(candidate)) candidate = 'https://' + candidate;
    try {
      const url = new URL(candidate);
      if (!['https:', 'http:'].includes(url.protocol) || !url.hostname) return '';
      return url.href.slice(0, MAX_URL);
    } catch (_) { return ''; }
  }

  function hostLabel(url) {
    try { return new URL(url).hostname.replace(/^www\./, '').slice(0, 48); }
    catch (_) { return 'website'; }
  }

  function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function nativeAvailable() { return typeof window.NexusBrowserAndroid?.postMessage === 'function'; }

  function postNative(url) {
    if (!nativeAvailable()) return false;
    try {
      window.NexusBrowserAndroid.postMessage(JSON.stringify({ action:'open', url }));
      return true;
    } catch (error) {
      console.warn('NexusNova native browser bridge:', error);
      return false;
    }
  }

  function status(message, tone = 'normal') {
    const node = $('#nxBrowserStatus');
    if (!node) return;
    node.textContent = message;
    node.dataset.tone = tone;
  }

  function setTabTitle(value) {
    const title = $('[data-nx-browser-tab-title]');
    if (title) title.textContent = value || 'New Tab';
  }

  function loadRecent() {
    try {
      const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(x => x && x.url).slice(0, 8) : [];
    } catch (_) { return []; }
  }

  function remember(url) {
    const recent = loadRecent().filter(x => x.url !== url);
    recent.unshift({ url, host:hostLabel(url), at:Date.now() });
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 8))); } catch (_) {}
    renderRecent();
  }

  function launchWeb(url) {
    try {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      return true;
    } catch (error) {
      console.warn('NexusNova Browser launch:', error);
      return false;
    }
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
    setTabTitle(hostLabel(url));
    remember(url);
    if (postNative(url)) {
      status('NexusNova Android Browser khul gaya — page app ke andar load ho raha hai.', 'success');
      return true;
    }
    const opened = launchWeb(url);
    status(opened ? 'Website real browser tab mein khol di gayi. GitHub Pages ke andar Google jaisi sites iframe allow nahi kartin.' : 'Browser ne new tab block kar diya. Address bar se dobara Browse dabao.', opened ? 'success' : 'error');
    return opened;
  }

  function openExternal(raw) {
    const url = safeUrl(raw);
    if (!url) { status('Pehle valid website ya search term likho.', 'error'); return false; }
    return launchWeb(url);
  }

  function renderRecent() {
    const host = $('[data-nx-browser-recent]');
    if (!host) return;
    const items = loadRecent();
    if (!items.length) {
      host.innerHTML = '<div class="nx-browser-empty">Abhi koi recent website nahi. Upar search karo ya Speed Dial use karo.</div>';
      return;
    }
    host.innerHTML = items.map(item => `<button type="button" class="nx-recent-item" data-nx-recent-url="${escapeHtml(item.url)}"><span class="nx-recent-icon">${escapeHtml(item.host.slice(0,2).toUpperCase())}</span><span><strong>${escapeHtml(item.host)}</strong><small>${escapeHtml(item.url)}</small></span>${ICONS.external}</button>`).join('');
    host.querySelectorAll('[data-nx-recent-url]').forEach(btn => btn.addEventListener('click', () => openUrl(btn.dataset.nxRecentUrl || '')));
  }

  function installStyle() {
    if ($('#nxBrowserStyleV3')) return;
    const style = document.createElement('style');
    style.id = 'nxBrowserStyleV3';
    style.textContent = `
      body.nx-browser-open{background:#03060c!important}
      body.nx-browser-open .top-header,body.nx-browser-open .ticker-wrap{display:none!important}
      body.nx-browser-open .main{width:100%!important;max-width:none!important;margin:0!important;padding:8px 12px 96px!important}
      #tab-browser.nx-browser-shell{--nxb-panel:#0b111c;--nxb-line:rgba(134,180,255,.16);--nxb-text:#f3f8ff;width:100%!important;max-width:none!important;margin:0!important;padding:0!important}
      #tab-browser.nx-browser-shell.active{display:block!important}
      #tab-browser .nx-browser-window{width:100%;min-height:calc(100vh - 118px);overflow:hidden;border:1px solid var(--nxb-line);border-radius:18px;background:linear-gradient(180deg,#090f19,#05080d);box-shadow:0 24px 80px rgba(0,0,0,.48);color:var(--nxb-text)}
      #tab-browser .nx-browser-window *{box-sizing:border-box}#tab-browser .nx-browser-window svg{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      #tab-browser .nx-browser-tabbar{display:flex;align-items:center;gap:8px;min-height:50px;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,.055);background:linear-gradient(180deg,#101827,#0a111c)}
      #tab-browser .nx-browser-brand{display:flex;align-items:center;gap:8px;flex:0 0 auto;margin-right:4px}.nx-browser-logo{display:grid;place-items:center;width:32px;height:32px;border-radius:11px;background:linear-gradient(145deg,#1768d7,#61c6ff);box-shadow:0 8px 24px rgba(30,124,255,.28),inset 0 1px 0 rgba(255,255,255,.28);font-size:15px;font-weight:1000;color:#fff}
      #tab-browser .nx-browser-brand-copy strong{display:block;font-size:11px;letter-spacing:.02em}#tab-browser .nx-browser-brand-copy small{display:block;color:#6f88a8;font-size:6.7px;letter-spacing:.18em;font-weight:900}
      #tab-browser .nx-browser-tab{display:flex;align-items:center;gap:8px;min-width:170px;max-width:330px;height:36px;padding:0 10px;border:1px solid rgba(103,168,255,.17);border-radius:11px 11px 8px 8px;background:linear-gradient(180deg,#182438,#111a29)}
      #tab-browser .nx-browser-tab>svg{width:15px;height:15px;color:#67b9ff;flex:0 0 auto}#tab-browser .nx-browser-tab span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:800;flex:1}.nx-browser-tab-close{width:22px;height:22px;border:0;border-radius:7px;background:transparent;color:#71839d;font-size:14px;cursor:pointer}
      #tab-browser .nx-browser-icon-btn{display:grid;place-items:center;width:36px;height:36px;padding:0;border:1px solid transparent;border-radius:11px;background:transparent;color:#a8b7ca;cursor:pointer}#tab-browser .nx-browser-icon-btn:hover{border-color:rgba(104,173,255,.18);background:rgba(75,149,236,.08);color:#e8f4ff}#tab-browser .nx-browser-icon-btn svg{width:17px;height:17px}
      #tab-browser .nx-browser-spacer{flex:1}#tab-browser .nx-browser-engine{display:flex;align-items:center;gap:6px;padding:6px 9px;border:1px solid rgba(77,164,255,.18);border-radius:999px;background:rgba(33,95,160,.11);color:#83caff;font-size:7.5px;font-weight:950;letter-spacing:.09em}#tab-browser .nx-browser-engine i{width:6px;height:6px;border-radius:50%;background:#49caff;box-shadow:0 0 12px #49caff}
      #tab-browser .nx-browser-toolbar{display:flex!important;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.05);background:#0a111c}#tab-browser .nx-browser-nav{display:grid;place-items:center;flex:0 0 36px;width:36px;height:36px;padding:0;border:1px solid transparent;border-radius:11px;background:transparent;color:#9eb0c7;cursor:pointer}#tab-browser .nx-browser-nav:hover{background:#121d2d;border-color:rgba(104,168,245,.12);color:white}#tab-browser .nx-browser-nav svg{width:17px;height:17px}
      #tab-browser .nx-omnibox{display:flex;align-items:center;gap:8px;min-width:180px;flex:1;height:42px;padding:0 6px 0 11px;border:1px solid rgba(110,163,230,.17);border-radius:21px;background:#111a27}.nx-omnibox:focus-within{border-color:rgba(83,177,255,.5)!important;box-shadow:0 0 0 3px rgba(64,154,255,.08)}#tab-browser .nx-lock{display:grid;place-items:center;color:#65c7ff}#tab-browser .nx-lock svg{width:15px;height:15px}
      #tab-browser #nxBrowserUrl{min-width:0;flex:1;height:38px!important;padding:0!important;border:0!important;outline:0!important;background:transparent!important;box-shadow:none!important;color:#eaf4ff!important;font-size:11px!important;font-family:inherit!important}#tab-browser #nxBrowserUrl::placeholder{color:#6e7f96}
      #tab-browser .nx-go{display:grid;place-items:center;flex:0 0 32px;width:32px;height:32px;border:0;border-radius:16px;background:linear-gradient(145deg,#267deb,#55bdff);color:white;box-shadow:0 7px 18px rgba(36,125,236,.3);cursor:pointer}#tab-browser .nx-go svg{width:15px;height:15px}#tab-browser .nx-browser-badge{flex:0 0 auto;padding:7px 10px;border:1px solid rgba(83,169,255,.17);border-radius:999px;background:rgba(32,102,175,.11);color:#82c9ff;font-size:7px;font-weight:950;letter-spacing:.08em}
      #tab-browser .nx-browser-progress{height:2px;background:#08101b;overflow:hidden}#tab-browser .nx-browser-progress i{display:block;width:34%;height:100%;background:linear-gradient(90deg,transparent,#4ea8ff,#72d8ff,transparent)}
      #tab-browser .nx-browser-page{min-height:calc(100vh - 270px);padding:34px 24px 26px;background:radial-gradient(800px 340px at 50% -20%,rgba(36,116,220,.18),transparent 68%),radial-gradient(420px 230px at 88% 16%,rgba(57,190,255,.07),transparent 70%),#070b12}.nx-start{width:min(980px,100%);margin:0 auto}.nx-start-hero{text-align:center;padding:20px 0 24px}
      #tab-browser .nx-start-mark{position:relative;display:grid;place-items:center;width:76px;height:76px;margin:0 auto 15px;border-radius:26px;background:linear-gradient(145deg,#1457b6,#66caff);box-shadow:0 24px 55px rgba(27,120,245,.28),inset 0 1px 0 rgba(255,255,255,.34);font-size:35px;font-weight:1000;color:white}#tab-browser .nx-start h2{margin:0;font-size:clamp(28px,4vw,44px);letter-spacing:-.045em;color:#f5f9ff}#tab-browser .nx-start h2 span{color:#5ebcff}#tab-browser .nx-start-hero p{margin:8px auto 0;max-width:620px;color:#7e91ab;font-size:11px;line-height:1.65}
      #tab-browser .nx-home-search{display:flex;align-items:center;gap:9px;width:min(720px,100%);height:52px;margin:21px auto 0;padding:0 7px 0 16px;border:1px solid rgba(119,174,244,.19);border-radius:26px;background:#101926;box-shadow:0 16px 38px rgba(0,0,0,.24)}#tab-browser .nx-home-search svg{width:18px;height:18px;color:#6dbfff;flex:0 0 auto}#tab-browser .nx-home-search input{min-width:0;flex:1;height:46px;border:0!important;outline:0!important;background:transparent!important;color:#eaf4ff!important;font-size:12px!important;box-shadow:none!important}#tab-browser .nx-home-search button{height:38px;padding:0 18px;border:0;border-radius:19px;background:linear-gradient(145deg,#1973e7,#62c9ff);color:white;font-size:9px;font-weight:950;cursor:pointer}
      #tab-browser .nx-section-label{display:flex;align-items:center;justify-content:space-between;margin:28px 2px 10px;color:#90a6c2;font-size:8px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}#tab-browser .nx-section-label span:last-child{color:#58708e;font-size:7px}#tab-browser .nx-speed-grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:10px}
      #tab-browser .nx-speed{min-width:0;padding:13px 8px 11px;border:1px solid rgba(105,158,222,.12);border-radius:15px;background:linear-gradient(160deg,#101a28,#0b121d);color:#cfe1f5;text-align:center;cursor:pointer;transition:.18s ease}#tab-browser .nx-speed:hover{transform:translateY(-2px);border-color:rgba(83,177,255,.32);background:linear-gradient(160deg,#14243a,#0d1724)}#tab-browser .nx-speed-icon{display:grid;place-items:center;width:38px;height:38px;margin:0 auto 8px;border-radius:13px;background:linear-gradient(145deg,rgba(41,120,220,.45),rgba(23,49,79,.9));color:#8fd2ff;font-size:10px;font-weight:1000}#tab-browser .nx-speed strong{display:block;font-size:9px}#tab-browser .nx-speed small{display:block;margin-top:2px;color:#627894;font-size:7px}
      #tab-browser .nx-recent-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.nx-recent-item{display:flex;align-items:center;gap:10px;min-width:0;padding:10px 11px;border:1px solid rgba(105,158,222,.1);border-radius:14px;background:#0d1521;color:#dceaf8;text-align:left;cursor:pointer}.nx-recent-icon{display:grid;place-items:center;flex:0 0 32px;width:32px;height:32px;border-radius:10px;background:linear-gradient(145deg,#153f70,#1a2e49);color:#82caff;font-size:8px;font-weight:1000}.nx-recent-item>span:nth-child(2){min-width:0;flex:1}.nx-recent-item strong,.nx-recent-item small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nx-recent-item strong{font-size:9px}.nx-recent-item small{margin-top:2px;color:#5f7590;font-size:7px}.nx-recent-item>svg{width:14px;height:14px;color:#5b7998}.nx-browser-empty{grid-column:1/-1;padding:18px;border:1px dashed rgba(112,164,226,.15);border-radius:15px;color:#60758f;text-align:center;font-size:9px}
      #tab-browser .nx-browser-info{display:flex;align-items:center;gap:10px;margin-top:20px;padding:11px 13px;border:1px solid rgba(87,156,229,.12);border-radius:14px;background:rgba(15,29,47,.68);color:#7990aa;font-size:8.5px;line-height:1.55}#tab-browser .nx-browser-info svg{width:18px;height:18px;flex:0 0 auto;color:#66bdff}
      #tab-browser .nx-browser-statusbar{display:flex;align-items:center;gap:7px;min-height:31px;padding:7px 12px;border-top:1px solid rgba(255,255,255,.045);background:#080d15;color:#687d98;font-size:7.5px}#tab-browser .nx-browser-statusbar::before{content:"";width:6px;height:6px;border-radius:50%;background:#5d7997}.nx-browser-statusbar[data-tone="success"]{color:#78bca8!important}.nx-browser-statusbar[data-tone="success"]::before{background:#45d5a7!important}.nx-browser-statusbar[data-tone="error"]{color:#d99aa2!important}.nx-browser-statusbar[data-tone="error"]::before{background:#ff6f7c!important}
      #tab-browser .nx-browser-bottom{display:none}
      @media(max-width:980px){#tab-browser .nx-speed-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
      @media(max-width:720px){body.nx-browser-open .main{padding:0 0 78px!important}#tab-browser .nx-browser-window{min-height:calc(100vh - 78px);border-width:0;border-radius:0}#tab-browser .nx-browser-brand-copy,#tab-browser .nx-browser-engine{display:none}#tab-browser .nx-browser-tab{min-width:0;max-width:none;flex:1}#tab-browser .nx-browser-toolbar>.nx-browser-nav:nth-of-type(2),#tab-browser .nx-browser-toolbar>.nx-browser-nav:nth-of-type(4){display:none}#tab-browser .nx-browser-badge{display:none}#tab-browser .nx-browser-page{min-height:calc(100vh - 235px);padding:24px 14px 20px}#tab-browser .nx-start-mark{width:64px;height:64px;border-radius:22px;font-size:29px}#tab-browser .nx-start h2{font-size:30px}#tab-browser .nx-speed-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}#tab-browser .nx-recent-grid{grid-template-columns:1fr}#tab-browser .nx-browser-bottom{display:grid;grid-template-columns:repeat(5,1fr);gap:3px;padding:6px 8px;border-top:1px solid rgba(255,255,255,.05);background:#0a101a}#tab-browser .nx-bottom-btn{display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 2px;border:0;background:transparent;color:#778ba6;font-size:6.5px;font-weight:850;cursor:pointer}#tab-browser .nx-bottom-btn svg{width:17px;height:17px}#tab-browser .nx-bottom-btn.primary{color:#71c6ff}}
      @media(max-width:420px){#tab-browser .nx-speed-grid{grid-template-columns:repeat(4,minmax(0,1fr))}#tab-browser .nx-omnibox{min-width:110px}}
    `;
    document.head.appendChild(style);
  }

  function browserMarkup() {
    const dials = SPEED_DIALS.map(([name,type,url,mark]) => `<button type="button" class="nx-speed" data-nx-speed="${escapeHtml(url)}"><span class="nx-speed-icon">${escapeHtml(mark)}</span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(type)}</small></button>`).join('');
    return `<div class="nx-browser-window" data-nx-browser-window>
      <div class="nx-browser-tabbar"><div class="nx-browser-brand"><div class="nx-browser-logo">N</div><div class="nx-browser-brand-copy"><strong>NexusNova</strong><small>NEURAL WEB</small></div></div><div class="nx-browser-tab">${ICONS.globe}<span data-nx-browser-tab-title>New Tab</span><button type="button" class="nx-browser-tab-close" data-nx-browser-new title="New tab">×</button></div><button type="button" class="nx-browser-icon-btn" data-nx-browser-new title="New tab">${ICONS.plus}</button><div class="nx-browser-spacer"></div><div class="nx-browser-engine"><i></i>${nativeAvailable() ? 'ANDROID ENGINE' : 'WEB LAUNCH MODE'}</div><button type="button" class="nx-browser-icon-btn" data-nx-browser-extensions-local title="Extensions & Apps">${ICONS.puzzle}</button><button type="button" class="nx-browser-icon-btn" data-nx-browser-menu title="Browser menu">${ICONS.menu}</button></div>
      <div class="nx-browser-toolbar" data-nx-browser-toolbar><button type="button" class="nx-browser-nav" data-nx-browser-home title="Home">${ICONS.home}</button><button type="button" class="nx-browser-nav" data-nx-browser-back title="Back">${ICONS.back}</button><button type="button" class="nx-browser-nav" data-nx-browser-forward title="Forward">${ICONS.forward}</button><button type="button" class="nx-browser-nav" data-nx-browser-reload title="Reload">${ICONS.reload}</button><div class="nx-omnibox"><span class="nx-lock">${ICONS.shield}</span><input id="nxBrowserUrl" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="Search or enter website"><button type="button" class="nx-go" data-nx-browser-go aria-label="Browse">${ICONS.search}</button></div><span class="nx-browser-badge">${nativeAvailable() ? 'NEXUS NATIVE' : 'REAL PAGE • NEW TAB'}</span></div>
      <div class="nx-browser-progress"><i></i></div>
      <div class="nx-browser-page"><div class="nx-start"><div class="nx-start-hero"><div class="nx-start-mark">N</div><h2>Nexus<span>Nova</span> Browser</h2><p>Opera/Firefox inspired browser layout with NexusNova styling. Search, speed dial, recent sites, extensions hub and native Android browsing — without the broken blank iframe.</p><form class="nx-home-search" data-nx-home-search>${ICONS.search}<input type="text" data-nx-home-query autocomplete="off" placeholder="Search the web with NexusNova"><button type="submit">SEARCH</button></form></div><div class="nx-section-label"><span>Speed Dial</span><span>Quick access</span></div><div class="nx-speed-grid">${dials}</div><div class="nx-section-label"><span>Recent</span><span>Stored on this device</span></div><div class="nx-recent-grid" data-nx-browser-recent></div><div class="nx-browser-info">${ICONS.shield}<span>${nativeAvailable() ? 'Android mode detected: websites open inside the dedicated NexusNova Browser window with real WebView navigation.' : 'Web/PWA mode: public sites such as Google block iframe embedding. NexusNova now opens the real website in a new browser tab instead of showing a broken white frame.'}</span></div></div></div>
      <div id="nxBrowserStatus" class="nx-browser-statusbar" data-tone="normal">${nativeAvailable() ? 'NexusNova native browser ready.' : 'NexusNova web launcher ready — search or choose a Speed Dial.'}</div>
      <div class="nx-browser-bottom"><button type="button" class="nx-bottom-btn" data-nx-browser-back>${ICONS.back}<span>Back</span></button><button type="button" class="nx-bottom-btn primary" data-nx-browser-home>${ICONS.home}<span>Home</span></button><button type="button" class="nx-bottom-btn" data-nx-browser-new>${ICONS.plus}<span>New</span></button><button type="button" class="nx-bottom-btn" data-nx-browser-tabs>${ICONS.tabs}<span>Tabs</span></button><button type="button" class="nx-bottom-btn" data-nx-browser-menu>${ICONS.menu}<span>Menu</span></button></div>
    </div>`;
  }

  function resetHome() {
    const input = $('#nxBrowserUrl'), homeInput = $('[data-nx-home-query]');
    if (input) input.value = '';
    if (homeInput) homeInput.value = '';
    setTabTitle('New Tab');
    status(nativeAvailable() ? 'NexusNova native browser ready.' : 'New NexusNova tab ready.');
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function installHandlers(section) {
    const input = $('#nxBrowserUrl', section);
    input?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); openUrl(input.value); } });
    $('[data-nx-browser-go]', section)?.addEventListener('click', () => openUrl(input?.value || ''));
    $('[data-nx-home-search]', section)?.addEventListener('submit', event => { event.preventDefault(); openUrl($('[data-nx-home-query]', section)?.value || ''); });
    section.querySelectorAll('[data-nx-speed]').forEach(btn => btn.addEventListener('click', () => openUrl(btn.dataset.nxSpeed || '')));
    section.querySelectorAll('[data-nx-browser-home],[data-nx-browser-new]').forEach(btn => btn.addEventListener('click', resetHome));
    section.querySelectorAll('[data-nx-browser-reload]').forEach(btn => btn.addEventListener('click', () => { const current=input?.value?.trim(); current ? openUrl(current) : resetHome(); }));
    section.querySelectorAll('[data-nx-browser-back]').forEach(btn => btn.addEventListener('click', () => { const recent=loadRecent(); recent[1] ? openUrl(recent[1].url) : status('Back history native Android browser mein available hai.'); }));
    section.querySelectorAll('[data-nx-browser-forward]').forEach(btn => btn.addEventListener('click', () => status('Forward history real Android browser window mein available hai.')));
    section.querySelectorAll('[data-nx-browser-tabs]').forEach(btn => btn.addEventListener('click', () => status('Web launcher ek NexusNova start tab use karta hai. Android browser mein real page history active hai.')));
    section.querySelectorAll('[data-nx-browser-extensions-local]').forEach(btn => btn.addEventListener('click', () => { if (typeof window.nxOpenBrowserExtensions === 'function') window.nxOpenBrowserExtensions(); else if (window.NexusNovaBrowserExtensions?.open) window.NexusNovaBrowserExtensions.open(); else status('Extensions & Apps Hub load ho raha hai — ek second baad dobara dabao.'); }));
    section.querySelectorAll('[data-nx-browser-menu]').forEach(btn => btn.addEventListener('click', () => status(nativeAvailable() ? 'Android browser: real in-app pages, Desktop Site, navigation aur Extensions & Apps controls available hain.' : 'Web mode: sites real new tab mein khulti hain. Full in-app browsing Android NexusNova Browser mein hoti hai.')));
  }

  function syncOpenState(section) { document.body.classList.toggle('nx-browser-open', section.classList.contains('active')); }

  function install() {
    const section = document.getElementById('tab-browser');
    if (!section) return false;
    installStyle();
    section.classList.add('nx-browser-shell');
    if (section.dataset.nxBrowserV3 !== '1') {
      section.dataset.nxBrowserV3 = '1';
      section.innerHTML = browserMarkup();
      installHandlers(section);
      renderRecent();
      const observer = new MutationObserver(() => syncOpenState(section));
      observer.observe(section,{attributes:true,attributeFilter:['class']});
      syncOpenState(section);
    }
    if (window.NexusNovaBrowserExtensions?.install) { try { window.NexusNovaBrowserExtensions.install(); } catch (_) {} }
    return true;
  }

  window.nxBrowse = () => openUrl($('#nxBrowserUrl')?.value || '');
  window.nxBrowsePreset = url => openUrl(url);
  window.nxOpenBrowserExternal = () => openExternal($('#nxBrowserUrl')?.value || '');
  window.nexusOpenInAppBrowser = openUrl;
  window.nxOpenBrowserExtensions = () => { if (window.NexusNovaBrowserExtensions?.open) { window.NexusNovaBrowserExtensions.open(); return true; } status('Extensions & Apps Hub abhi load ho raha hai.'); return false; };
  window.NexusNovaBrowser = Object.freeze({version:'nexus-browser-v3',install,open:openUrl,normalize:safeUrl,home:resetHome,nativeAvailable});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install,80), {once:true}); else setTimeout(install,80);
  [450,1000,1800,3200].forEach(ms => setTimeout(install,ms));
})();