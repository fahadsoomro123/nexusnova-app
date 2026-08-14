/* NexusNova Browser v2
   Premium NexusNova visual shell + in-app browsing behavior.
   Web/PWA keeps HTTPS pages inside the existing NexusNova iframe when allowed.
   Android delegates to the dedicated NexusNova Browser Activity.
*/
(() => {
  'use strict';
  if (window.__nxNexusBrowserV2) return;
  window.__nxNexusBrowserV2 = true;
  window.__nxNexusBrowserV1 = true;
  window.nexusBrowserVersion = 'in-app-browser-v2';

  const HOME = 'https://www.google.com/';
  const MAX_URL = 2000;
  const stack = [];
  let stackIndex = -1;
  const $ = id => document.getElementById(id);

  const ICONS = {
    back:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5 7.5 12l7 7"/><path d="M8 12h9"/></svg>',
    forward:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 5 7 7-7 7"/><path d="M16 12H7"/></svg>',
    reload:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 1-2.05-4.95L20 10"/></svg>',
    home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 11 8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/></svg>',
    search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>',
    shield:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 2.7 7.8 7 10 4.3-2.2 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/></svg>',
    globe:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    open:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5h6v6"/><path d="m19 5-8 8"/><path d="M18 13v6H5V6h6"/></svg>',
    play:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="4"/><path d="m10 9 5 3-5 3V9Z"/></svg>',
    book:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22V5.5Z"/><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22V5.5Z"/></svg>',
    news:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h12v14H4z"/><path d="M16 8h4v11a2 2 0 0 1-2 2H6"/><path d="M7 9h6M7 13h6M7 17h4"/></svg>',
    map:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></svg>'
  };

  function safeHttps(raw) {
    const text = String(raw || '').trim().slice(0, MAX_URL);
    if (!text) return '';
    if (/^(?:javascript|data|file|blob|intent|content):/i.test(text)) return '';

    let candidate = text;
    const looksLikeSearch = /\s/.test(candidate) || (!candidate.includes('.') && !/^https?:\/\//i.test(candidate));
    if (looksLikeSearch) candidate = 'https://www.google.com/search?q=' + encodeURIComponent(text);
    else if (!/^https?:\/\//i.test(candidate)) candidate = 'https://' + candidate;

    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:') {
        if (url.protocol === 'http:') url.protocol = 'https:';
        else return '';
      }
      return url.href.slice(0, MAX_URL);
    } catch (_) {
      return '';
    }
  }

  function browserSection() {
    return $('nxBrowserUrl')?.closest('section') || null;
  }

  function status(message, tone = 'normal') {
    const node = $('nxBrowserStatus');
    if (!node) return;
    node.textContent = message;
    node.dataset.nxBrowserTone = tone;
    node.classList.remove('nx-browser-pulse');
    if (tone === 'loading') requestAnimationFrame(() => node.classList.add('nx-browser-pulse'));
  }

  function nativeAvailable() {
    return typeof window.NexusBrowserAndroid?.postMessage === 'function';
  }

  function postNative(url) {
    if (!nativeAvailable()) return false;
    try {
      window.NexusBrowserAndroid.postMessage(JSON.stringify({ action:'open', url }));
      return true;
    } catch (error) {
      console.warn('NexusNova Browser native bridge:', error);
      return false;
    }
  }

  function remember(url) {
    if (stack[stackIndex] === url) return;
    stack.splice(stackIndex + 1);
    stack.push(url);
    if (stack.length > 40) stack.shift();
    stackIndex = stack.length - 1;
    syncNav();
  }

  function setFrameBusy(busy) {
    browserSection()?.classList.toggle('nx-browser-loading', Boolean(busy));
  }

  function frameNavigate(url, rememberEntry = true) {
    const frame = $('nxBrowserFrame');
    const input = $('nxBrowserUrl');
    if (!frame) {
      status('NexusNova Browser frame is unavailable on this screen.', 'error');
      return false;
    }
    if (input) input.value = url;
    if (rememberEntry) remember(url);
    setFrameBusy(true);
    frame.src = url;
    status('Opening securely inside NexusNova…', 'loading');
    return true;
  }

  function openInApp(raw, rememberEntry = true) {
    const url = safeHttps(raw);
    if (!url) {
      status('Enter a website or search term. NexusNova Browser allows secure HTTPS destinations.', 'error');
      return false;
    }
    const input = $('nxBrowserUrl');
    if (input) input.value = url;

    if (postNative(url)) {
      if (rememberEntry) remember(url);
      status('Opened in the native NexusNova Browser window.', 'success');
      return true;
    }
    return frameNavigate(url, rememberEntry);
  }

  function manualExternal(raw) {
    const url = safeHttps(raw);
    if (!url) {
      status('Enter a valid website first.', 'error');
      return false;
    }
    try {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      status('Opened in your system browser by your choice.', 'normal');
      return true;
    } catch (_) {
      status('System browser could not be opened.', 'error');
      return false;
    }
  }

  function back() {
    if (nativeAvailable()) {
      status('Use the Back control inside the opened NexusNova Browser window.', 'normal');
      return;
    }
    if (stackIndex <= 0) return;
    stackIndex -= 1;
    frameNavigate(stack[stackIndex], false);
    syncNav();
  }

  function forward() {
    if (nativeAvailable()) {
      status('Use the Forward control inside the opened NexusNova Browser window.', 'normal');
      return;
    }
    if (stackIndex >= stack.length - 1) return;
    stackIndex += 1;
    frameNavigate(stack[stackIndex], false);
    syncNav();
  }

  function reload() {
    if (nativeAvailable()) {
      status('Use Reload inside the opened NexusNova Browser window.', 'normal');
      return;
    }
    const frame = $('nxBrowserFrame');
    if (!frame) return;
    setFrameBusy(true);
    try { frame.src = frame.src || HOME; } catch (_) {}
    status('Refreshing page…', 'loading');
  }

  function home() { openInApp(HOME); }

  function syncNav() {
    const backBtn = document.querySelector('[data-nx-browser-back]');
    const nextBtn = document.querySelector('[data-nx-browser-forward]');
    if (backBtn) backBtn.disabled = !nativeAvailable() && stackIndex <= 0;
    if (nextBtn) nextBtn.disabled = !nativeAvailable() && stackIndex >= stack.length - 1;
  }

  function installStyle() {
    if ($('nxBrowserStyleV2')) return;
    const style = document.createElement('style');
    style.id = 'nxBrowserStyleV2';
    style.textContent = `
      #tab-browser.nx-browser-shell{--nxb-blue:#2f8cff;--nxb-blue2:#58b5ff;--nxb-deep:#071426;--nxb-line:rgba(82,165,255,.28);position:relative;isolation:isolate;overflow:hidden}
      #tab-browser.nx-browser-shell::before{content:"";position:absolute;inset:-180px -120px auto;z-index:-2;height:520px;background:radial-gradient(circle at 25% 30%,rgba(32,126,255,.25),transparent 35%),radial-gradient(circle at 80% 18%,rgba(45,190,255,.13),transparent 28%);filter:blur(6px);pointer-events:none}
      #tab-browser.nx-browser-shell>.card{position:relative;overflow:hidden;border:1px solid var(--nxb-line)!important;border-radius:28px!important;background:linear-gradient(155deg,rgba(13,32,58,.96),rgba(3,9,18,.98) 56%,rgba(4,14,27,.99))!important;box-shadow:0 28px 70px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.025) inset,0 0 42px rgba(35,126,255,.10)!important;padding:18px!important}
      #tab-browser.nx-browser-shell>.card::before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(120deg,rgba(255,255,255,.05),transparent 28%,transparent 72%,rgba(75,170,255,.035))}
      #tab-browser .hub-hero{position:relative;margin:-2px 0 15px!important;padding:16px!important;border:1px solid rgba(76,157,255,.18);border-radius:22px;background:radial-gradient(260px 120px at 15% 0%,rgba(48,136,255,.18),transparent 74%),linear-gradient(135deg,rgba(7,21,39,.92),rgba(5,13,25,.70));overflow:hidden}
      #tab-browser .hub-hero::after{content:"NEXUS // WEB GRID";position:absolute;right:14px;bottom:9px;font-size:8px;letter-spacing:.22em;font-weight:900;color:rgba(130,190,255,.33)}
      #tab-browser .hub-kicker{display:flex;align-items:center;gap:8px;color:#8fc7ff!important;font-size:9px!important;letter-spacing:.22em!important;font-weight:950!important}
      #tab-browser .hub-kicker::before{content:"";width:7px;height:7px;border-radius:50%;background:#4da3ff;box-shadow:0 0 0 5px rgba(77,163,255,.09),0 0 18px rgba(77,163,255,.7)}
      #tab-browser .hub-hero h2{margin-top:5px!important;font-size:clamp(22px,4vw,31px)!important;letter-spacing:-.035em!important;text-shadow:0 0 24px rgba(70,160,255,.18)}
      #tab-browser .hub-hero p{max-width:680px;color:#a9c4e7!important;line-height:1.6!important;font-size:12px!important}
      #tab-browser .hub-orb{width:72px!important;height:72px!important;border-radius:24px!important;border:1px solid rgba(92,176,255,.32)!important;background:radial-gradient(circle at 35% 28%,rgba(106,190,255,.38),transparent 28%),linear-gradient(145deg,#123a69,#071426)!important;box-shadow:0 18px 35px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.15),0 0 28px rgba(40,132,255,.20)!important;color:#d9efff!important;transform:rotate(-5deg)}
      #tab-browser .hub-orb svg{width:34px!important;height:34px!important;filter:drop-shadow(0 0 9px rgba(78,169,255,.6))}
      .nx-browser-mode-line{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 11px;padding:10px 12px;border:1px solid rgba(73,151,255,.14);border-radius:15px;background:rgba(4,12,24,.72)}
      .nx-browser-mode{display:flex;align-items:center;gap:8px;color:#d9ebff;font-size:10px;font-weight:800}.nx-browser-mode svg{width:15px;height:15px;fill:none;stroke:#63b8ff;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      .nx-browser-badge{font-size:8px;font-weight:950;letter-spacing:.12em;padding:6px 9px;border-radius:999px;border:1px solid rgba(90,180,255,.26);color:#92d3ff;background:linear-gradient(135deg,rgba(13,83,162,.28),rgba(6,31,63,.62));box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
      #tab-browser .tool-row:has(#nxBrowserUrl){position:relative;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important;align-items:center!important;margin:0 0 11px!important;padding:7px!important;border-radius:20px!important;border:1px solid rgba(72,157,255,.28)!important;background:linear-gradient(180deg,rgba(15,36,64,.96),rgba(6,17,32,.96))!important;box-shadow:0 13px 32px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.06),0 0 22px rgba(42,128,255,.08)}
      .nx-browser-search-icon{position:absolute;left:18px;top:50%;transform:translateY(-50%);z-index:2;display:grid;place-items:center;color:#6bbaff;pointer-events:none}.nx-browser-search-icon svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
      #nxBrowserUrl{height:48px!important;border:0!important;border-radius:14px!important;padding:0 14px 0 42px!important;background:rgba(2,9,18,.82)!important;color:#fff!important;font-size:13px!important;font-weight:650!important;letter-spacing:.005em;outline:none!important;box-shadow:inset 0 0 0 1px rgba(91,167,255,.12)!important;transition:box-shadow .18s ease,background .18s ease!important}
      #nxBrowserUrl:focus{background:rgba(3,12,24,.98)!important;box-shadow:inset 0 0 0 1px rgba(91,176,255,.45),0 0 0 3px rgba(43,139,255,.09),0 0 24px rgba(32,124,255,.12)!important}
      #tab-browser .tool-row:has(#nxBrowserUrl) .tool-btn.primary{height:48px!important;min-width:94px!important;border-radius:14px!important;padding:0 17px!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;font-size:11px!important;font-weight:950!important;letter-spacing:.08em!important;text-transform:uppercase;background:linear-gradient(135deg,#0d67f8,#52b5ff)!important;box-shadow:0 10px 25px rgba(25,118,255,.32),inset 0 1px 0 rgba(255,255,255,.2)!important}
      #tab-browser .tool-row:has(#nxBrowserUrl) .tool-btn.primary svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .nx-browser-toolbar{display:grid;grid-template-columns:repeat(4,46px) minmax(0,1fr);gap:8px;align-items:center;margin:10px 0 12px}.nx-browser-nav{position:relative;display:grid;place-items:center;width:46px;height:44px;padding:0!important;border-radius:14px!important;border:1px solid rgba(83,164,255,.22)!important;background:linear-gradient(160deg,rgba(21,48,80,.92),rgba(5,16,30,.96))!important;color:#cfe8ff!important;cursor:pointer;box-shadow:0 8px 19px rgba(0,0,0,.27),inset 0 1px 0 rgba(255,255,255,.055)!important;transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease!important}.nx-browser-nav:hover{transform:translateY(-1px);border-color:rgba(93,180,255,.48)!important;box-shadow:0 10px 24px rgba(0,0,0,.32),0 0 20px rgba(47,140,255,.10)!important}.nx-browser-nav:disabled{opacity:.3;cursor:not-allowed;transform:none}.nx-browser-nav svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.nx-browser-toolbar .nx-browser-badge{justify-self:end}
      .browser-links{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px!important;margin:0 0 12px!important}.browser-links button{min-height:58px!important;padding:8px 5px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:5px!important;border-radius:15px!important;border:1px solid rgba(79,157,255,.15)!important;background:linear-gradient(160deg,rgba(18,39,66,.84),rgba(4,13,25,.94))!important;color:#bcd8f7!important;font-size:9px!important;font-weight:850!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 7px 17px rgba(0,0,0,.22)!important}.browser-links button:hover{color:#fff!important;border-color:rgba(83,172,255,.38)!important;background:linear-gradient(160deg,rgba(24,58,98,.93),rgba(5,17,33,.98))!important}.browser-links button .nx-browser-link-icon{display:grid;place-items:center;width:25px;height:25px;border-radius:9px;background:rgba(38,126,235,.13);color:#68b8ff}.browser-links button svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      .browser-frame-wrap{position:relative;overflow:hidden!important;border-radius:22px!important;border:1px solid rgba(76,157,255,.25)!important;background:linear-gradient(180deg,#071426,#030812)!important;box-shadow:0 24px 48px rgba(0,0,0,.44),inset 0 1px 0 rgba(255,255,255,.05),0 0 35px rgba(28,112,240,.08)!important}.browser-frame-wrap::before{content:"NEXUSNOVA SECURE VIEW";position:absolute;top:9px;left:12px;z-index:3;pointer-events:none;font-size:7px;font-weight:950;letter-spacing:.18em;color:rgba(137,198,255,.28)}.browser-frame-wrap::after{content:"";position:absolute;inset:0;z-index:4;pointer-events:none;opacity:0;background:linear-gradient(180deg,rgba(70,166,255,.08),transparent 17%)}.nx-browser-loading .browser-frame-wrap::after{opacity:1;animation:nxBrowserSweep 1.3s ease-in-out infinite}.browser-frame-wrap iframe{display:block!important;width:100%!important;min-height:62vh!important;border:0!important;background:#fff!important}
      @keyframes nxBrowserSweep{0%,100%{transform:translateY(-8%);opacity:.08}50%{transform:translateY(8%);opacity:.45}}
      #nxBrowserStatus{position:relative;margin:11px 0 0!important;padding:10px 12px 10px 34px!important;border:1px solid rgba(81,158,255,.13)!important;border-radius:14px!important;background:rgba(4,14,27,.68)!important;color:#91afd0!important;font-size:9.5px!important;line-height:1.5!important}.nx-browser-shell #nxBrowserStatus::before{content:"";position:absolute;left:14px;top:14px;width:7px;height:7px;border-radius:50%;background:#4da3ff;box-shadow:0 0 0 4px rgba(77,163,255,.07)}#nxBrowserStatus[data-nx-browser-tone="error"]{color:#ffb3bd!important;border-color:rgba(255,86,111,.18)!important}#nxBrowserStatus[data-nx-browser-tone="error"]::before{background:#ff6277}#nxBrowserStatus[data-nx-browser-tone="success"]{color:#9be8c4!important;border-color:rgba(57,212,143,.17)!important}#nxBrowserStatus[data-nx-browser-tone="success"]::before{background:#45d79a}.nx-browser-pulse::before{animation:nxBrowserDot 1s ease-in-out infinite}@keyframes nxBrowserDot{50%{transform:scale(1.45);box-shadow:0 0 0 7px rgba(77,163,255,0)}}
      .nx-browser-native-note,.nx-browser-security-note{display:flex;gap:9px;align-items:flex-start;margin:10px 0;padding:10px 12px;border-radius:14px;border:1px solid rgba(76,157,255,.13);background:linear-gradient(135deg,rgba(7,28,54,.7),rgba(4,12,23,.7));font-size:9px;line-height:1.55;color:#8faecc}.nx-browser-native-note svg,.nx-browser-security-note svg{flex:0 0 auto;width:16px;height:16px;fill:none;stroke:#5eb4ff;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      #tab-browser .tool-btn.ghost[onclick*="nxOpenBrowserExternal"]{width:100%!important;min-height:42px!important;margin-top:10px!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;border-radius:14px!important;background:rgba(7,22,40,.72)!important;color:#9fc8f3!important;border-color:rgba(75,154,255,.17)!important;font-size:10px!important;font-weight:850!important}#tab-browser .tool-btn.ghost[onclick*="nxOpenBrowserExternal"] svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      @media(max-width:760px){.browser-links{grid-template-columns:repeat(3,minmax(0,1fr))!important}.nx-browser-toolbar{grid-template-columns:repeat(4,42px) minmax(0,1fr)}.nx-browser-nav{width:42px;height:42px}}
      @media(max-width:520px){#tab-browser.nx-browser-shell>.card{padding:13px!important;border-radius:23px!important}#tab-browser .hub-hero{padding:13px!important}.nx-browser-toolbar{grid-template-columns:repeat(4,39px) minmax(0,1fr);gap:6px}.nx-browser-nav{width:39px;height:39px;border-radius:12px!important}.nx-browser-toolbar .nx-browser-badge{font-size:7px;padding:5px 7px}.browser-links{gap:6px!important}.browser-links button{min-height:54px!important}.browser-frame-wrap iframe{min-height:58vh!important}#tab-browser .tool-row:has(#nxBrowserUrl){grid-template-columns:minmax(0,1fr) 74px!important}#tab-browser .tool-row:has(#nxBrowserUrl) .tool-btn.primary{min-width:74px!important;padding:0 9px!important}}
    `;
    document.head.appendChild(style);
  }

  function decorateQuickLinks(section) {
    const icons = [ICONS.search, ICONS.play, ICONS.book, ICONS.play, ICONS.news, ICONS.map];
    section.querySelectorAll('.browser-links button').forEach((button, index) => {
      if (button.dataset.nxBrowserDecorated === '1') return;
      const label = String(button.textContent || '').trim();
      button.innerHTML = `<span class="nx-browser-link-icon">${icons[index] || ICONS.globe}</span><span>${label}</span>`;
      button.dataset.nxBrowserDecorated = '1';
    });
  }

  function renameUi() {
    const section = browserSection();
    if (!section) return;
    section.classList.add('nx-browser-shell');

    const kicker = section.querySelector('.hub-kicker');
    if (kicker) kicker.textContent = 'NEXUSNOVA BROWSER';

    const heading = section.querySelector('h2');
    if (heading && !heading.dataset.nxBrowserNamed) {
      heading.innerHTML = `${ICONS.globe}<span>NexusNova Browser</span>`;
      heading.querySelector('svg')?.classList.add('mi-icon');
      heading.dataset.nxBrowserNamed = '1';
    }

    const heroText = section.querySelector('.hub-hero p');
    if (heroText) heroText.textContent = 'A private-looking NexusNova web workspace with secure HTTPS navigation, branded controls and an in-app Android browsing window.';

    const orb = section.querySelector('.hub-orb');
    if (orb) orb.innerHTML = ICONS.globe;

    const frame = $('nxBrowserFrame');
    if (frame) {
      frame.title = 'NexusNova Browser';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
    }

    const input = $('nxBrowserUrl');
    const row = input?.parentElement;
    if (row && !row.querySelector('.nx-browser-search-icon')) {
      const searchIcon = document.createElement('span');
      searchIcon.className = 'nx-browser-search-icon';
      searchIcon.innerHTML = ICONS.search;
      row.insertBefore(searchIcon, input);
    }

    const goButton = Array.from(section.querySelectorAll('button')).find(button =>
      String(button.getAttribute('onclick') || '').includes('nxBrowse()')
    );
    if (goButton) goButton.innerHTML = `${ICONS.search}<span>Browse</span>`;

    const external = Array.from(section.querySelectorAll('button')).find(button =>
      String(button.getAttribute('onclick') || '').includes('nxOpenBrowserExternal()')
    );
    if (external) external.innerHTML = `${ICONS.open}<span>Open in system browser</span>`;

    decorateQuickLinks(section);

    document.querySelectorAll('.more-item span').forEach(span => {
      if (String(span.textContent || '').trim().toUpperCase() === 'BROWSER') span.textContent = 'NEXUSNOVA BROWSER';
    });
  }

  function installModeLine() {
    const section = browserSection();
    const row = $('nxBrowserUrl')?.parentElement;
    if (!section || !row || section.querySelector('.nx-browser-mode-line')) return;
    const line = document.createElement('div');
    line.className = 'nx-browser-mode-line';
    line.innerHTML = `<span class="nx-browser-mode">${ICONS.shield}<span>Protected HTTPS navigation</span></span><span class="nx-browser-badge">${nativeAvailable() ? 'ANDROID • IN APP' : 'WEB • IN APP'}</span>`;
    row.parentElement?.insertBefore(line, row);
  }

  function installToolbar() {
    const frame = $('nxBrowserFrame');
    const wrap = frame?.parentElement;
    if (!wrap || document.querySelector('[data-nx-browser-toolbar]')) return;
    const toolbar = document.createElement('div');
    toolbar.className = 'nx-browser-toolbar';
    toolbar.dataset.nxBrowserToolbar = '1';
    toolbar.innerHTML = `
      <button type="button" class="nx-browser-nav" data-nx-browser-back aria-label="Back" title="Back">${ICONS.back}</button>
      <button type="button" class="nx-browser-nav" data-nx-browser-forward aria-label="Forward" title="Forward">${ICONS.forward}</button>
      <button type="button" class="nx-browser-nav" data-nx-browser-reload aria-label="Reload" title="Reload">${ICONS.reload}</button>
      <button type="button" class="nx-browser-nav" data-nx-browser-home aria-label="Home" title="Home">${ICONS.home}</button>
      <span class="nx-browser-badge">NEXUS SECURE VIEW</span>`;
    wrap.parentElement?.insertBefore(toolbar, wrap);
    toolbar.querySelector('[data-nx-browser-back]')?.addEventListener('click', back);
    toolbar.querySelector('[data-nx-browser-forward]')?.addEventListener('click', forward);
    toolbar.querySelector('[data-nx-browser-reload]')?.addEventListener('click', reload);
    toolbar.querySelector('[data-nx-browser-home]')?.addEventListener('click', home);

    if (nativeAvailable() && !document.querySelector('.nx-browser-native-note')) {
      const note = document.createElement('div');
      note.className = 'nx-browser-native-note';
      note.innerHTML = `${ICONS.globe}<span><strong>Android native mode.</strong> Websites open inside the dedicated NexusNova Browser window rather than Chrome. Navigation controls remain inside NexusNova.</span>`;
      wrap.parentElement?.insertBefore(note, toolbar.nextSibling);
    }
    syncNav();
  }

  function installSecurityNote() {
    const section = browserSection();
    const external = Array.from(section?.querySelectorAll('button') || []).find(button =>
      String(button.getAttribute('onclick') || '').includes('nxOpenBrowserExternal()')
    );
    if (!external || section.querySelector('.nx-browser-security-note')) return;
    const note = document.createElement('div');
    note.className = 'nx-browser-security-note';
    note.innerHTML = `${ICONS.shield}<span>NexusNova blocks unsafe local/data URLs here and upgrades normal HTTP input to HTTPS. Some websites still refuse iframe embedding on the web version; Android native mode is designed for those sites.</span>`;
    external.parentElement?.insertBefore(note, external);
  }

  function installHandlers() {
    const input = $('nxBrowserUrl');
    const section = browserSection();
    if (!input || !section || input.dataset.nxBrowserReady === '1') return;
    input.dataset.nxBrowserReady = '1';
    input.placeholder = 'Search the web or enter a secure website';
    input.autocomplete = 'off';
    input.spellcheck = false;

    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        openInApp(input.value);
      }
    });

    const frame = $('nxBrowserFrame');
    if (frame && frame.dataset.nxBrowserLoad !== '1') {
      frame.dataset.nxBrowserLoad = '1';
      frame.addEventListener('load', () => {
        setFrameBusy(false);
        const src = String(frame.getAttribute('src') || '');
        if (!src || src === 'about:blank') return;
        status('Page loaded inside NexusNova Browser.', 'success');
      });
    }
  }

  function install() {
    if (!$('nxBrowserUrl')) return false;
    installStyle();
    renameUi();
    installModeLine();
    installToolbar();
    installSecurityNote();
    installHandlers();
    status(nativeAvailable()
      ? 'NexusNova Browser ready • Android native in-app mode detected.'
      : 'NexusNova Browser ready • secure web/PWA in-app mode.');
    return true;
  }

  window.nxBrowse = () => openInApp($('nxBrowserUrl')?.value || '');
  window.nxBrowsePreset = url => {
    if ($('nxBrowserUrl')) $('nxBrowserUrl').value = url;
    return openInApp(url);
  };
  window.nxOpenBrowserExternal = () => manualExternal($('nxBrowserUrl')?.value || '');
  window.nexusOpenInAppBrowser = openInApp;

  window.NexusNovaBrowser = Object.freeze({
    version:'in-app-browser-v2',
    install,
    open:openInApp,
    normalize:safeHttps,
    back,
    forward,
    reload,
    home,
    nativeAvailable
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install, 120), {once:true});
  else setTimeout(install, 120);
  [500,1200,2400,4200].forEach(ms => setTimeout(install, ms));
})();