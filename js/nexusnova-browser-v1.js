/* NexusNova Browser v1
   Web/PWA: loads HTTPS pages inside the existing NexusNova iframe when the
   destination allows embedding. Never auto-redirects to Chrome/Edge.
   Android: asks the dedicated origin-bound browser bridge to open the native
   NexusNova Browser Activity so normal websites stay inside the app even when
   they block iframe embedding.
*/
(() => {
  'use strict';
  if (window.__nxNexusBrowserV1) return;
  window.__nxNexusBrowserV1 = true;
  window.nexusBrowserVersion = 'in-app-browser-v1';

  const HOME = 'https://www.google.com/';
  const MAX_URL = 2000;
  const stack = [];
  let stackIndex = -1;

  const $ = id => document.getElementById(id);

  function safeHttps(raw) {
    const text = String(raw || '').trim().slice(0, MAX_URL);
    if (!text) return '';
    if (/^(?:javascript|data|file|blob|intent):/i.test(text)) return '';

    let candidate = text;
    const looksLikeSearch = /\s/.test(candidate) || (!candidate.includes('.') && !/^https?:\/\//i.test(candidate));
    if (looksLikeSearch) {
      candidate = 'https://www.google.com/search?q=' + encodeURIComponent(text);
    } else if (!/^https?:\/\//i.test(candidate)) {
      candidate = 'https://' + candidate;
    }

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

  function frameNavigate(url, rememberEntry = true) {
    const frame = $('nxBrowserFrame');
    const input = $('nxBrowserUrl');
    if (!frame) {
      status('NexusNova Browser frame is unavailable on this screen.', 'error');
      return false;
    }
    if (input) input.value = url;
    if (rememberEntry) remember(url);
    frame.src = url;
    status('Opening inside NexusNova Browser… If a site shows “refused to connect”, that website blocks embedding on the web version. The Android app uses the native NexusNova Browser instead.', 'loading');
    return true;
  }

  function openInApp(raw, rememberEntry = true) {
    const url = safeHttps(raw);
    if (!url) {
      status('Enter a website or search term. Only secure HTTPS browsing is allowed.', 'error');
      return false;
    }
    const input = $('nxBrowserUrl');
    if (input) input.value = url;

    if (postNative(url)) {
      if (rememberEntry) remember(url);
      status('Opened inside the NexusNova Browser app window — not Chrome.', 'success');
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
      status('Opened in your system browser by your explicit choice.', 'normal');
      return true;
    } catch (_) {
      status('System browser could not be opened.', 'error');
      return false;
    }
  }

  function back() {
    if (nativeAvailable()) {
      status('Use ← inside the opened NexusNova Browser window for page history.', 'normal');
      return;
    }
    if (stackIndex <= 0) return;
    stackIndex -= 1;
    frameNavigate(stack[stackIndex], false);
    syncNav();
  }

  function forward() {
    if (nativeAvailable()) {
      status('Use → inside the opened NexusNova Browser window for page history.', 'normal');
      return;
    }
    if (stackIndex >= stack.length - 1) return;
    stackIndex += 1;
    frameNavigate(stack[stackIndex], false);
    syncNav();
  }

  function reload() {
    if (nativeAvailable()) {
      status('Use ↻ inside the opened NexusNova Browser window to reload the current site.', 'normal');
      return;
    }
    const frame = $('nxBrowserFrame');
    if (!frame) return;
    try { frame.src = frame.src || HOME; } catch (_) {}
    status('Reloading inside NexusNova Browser…', 'loading');
  }

  function home() {
    openInApp(HOME);
  }

  function syncNav() {
    const backBtn = document.querySelector('[data-nx-browser-back]');
    const nextBtn = document.querySelector('[data-nx-browser-forward]');
    if (backBtn) backBtn.disabled = !nativeAvailable() && stackIndex <= 0;
    if (nextBtn) nextBtn.disabled = !nativeAvailable() && stackIndex >= stack.length - 1;
  }

  function installStyle() {
    if ($('nxBrowserStyleV1')) return;
    const style = document.createElement('style');
    style.id = 'nxBrowserStyleV1';
    style.textContent = `
      .nx-browser-toolbar{display:grid;grid-template-columns:repeat(4,42px) minmax(0,1fr);gap:7px;align-items:center;margin:10px 0}.nx-browser-nav{height:40px;border-radius:12px;border:1px solid rgba(148,163,184,.18);background:#0b1729;color:#dcecff;font-weight:900;cursor:pointer}.nx-browser-nav:disabled{opacity:.35;cursor:not-allowed}.nx-browser-badge{justify-self:end;font-size:9px;font-weight:900;padding:7px 9px;border-radius:999px;border:1px solid rgba(34,211,238,.25);color:#8de8ff;background:rgba(8,47,73,.28)}#nxBrowserStatus[data-nx-browser-tone="error"]{color:#fda4af}#nxBrowserStatus[data-nx-browser-tone="success"]{color:#86efac}.nx-browser-native-note{margin:9px 0;padding:10px 12px;border-radius:12px;border:1px solid rgba(56,189,248,.14);background:rgba(3,105,161,.08);font-size:10px;line-height:1.55;color:#8ea7c1}.browser-frame-wrap iframe{min-height:62vh}
      @media(max-width:520px){.nx-browser-toolbar{grid-template-columns:repeat(4,38px) 1fr}.nx-browser-nav{height:38px}.nx-browser-badge{font-size:8px;padding:6px 7px}}
    `;
    document.head.appendChild(style);
  }

  function renameUi() {
    const section = browserSection();
    if (!section) return;

    const kicker = section.querySelector('.hub-kicker');
    if (kicker) kicker.textContent = 'NEXUSNOVA BROWSER';

    const heading = section.querySelector('h2');
    if (heading && !heading.dataset.nxBrowserNamed) {
      const icon = heading.querySelector('.mi-icon')?.cloneNode(true);
      heading.innerHTML = '';
      if (icon) heading.appendChild(icon);
      heading.appendChild(document.createTextNode(' NexusNova Browser'));
      heading.dataset.nxBrowserNamed = '1';
    }

    const heroText = section.querySelector('.hub-hero p');
    if (heroText) {
      heroText.textContent = 'Browse websites inside NexusNova. Android uses a dedicated native WebView; the web/PWA version uses an embedded viewer when the destination permits it.';
    }

    const frame = $('nxBrowserFrame');
    if (frame) {
      frame.title = 'NexusNova Browser';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
    }

    const external = Array.from(section.querySelectorAll('button')).find(button =>
      /open externally/i.test(String(button.textContent || ''))
    );
    if (external) external.textContent = '↗ Open in system browser';

    document.querySelectorAll('.more-item span').forEach(span => {
      if (String(span.textContent || '').trim().toUpperCase() === 'BROWSER') {
        span.textContent = 'NEXUSNOVA BROWSER';
      }
    });
  }

  function installToolbar() {
    const frame = $('nxBrowserFrame');
    const wrap = frame?.parentElement;
    if (!wrap || document.querySelector('[data-nx-browser-toolbar]')) return;
    const toolbar = document.createElement('div');
    toolbar.className = 'nx-browser-toolbar';
    toolbar.dataset.nxBrowserToolbar = '1';
    toolbar.innerHTML = `
      <button type="button" class="nx-browser-nav" data-nx-browser-back aria-label="Back">←</button>
      <button type="button" class="nx-browser-nav" data-nx-browser-forward aria-label="Forward">→</button>
      <button type="button" class="nx-browser-nav" data-nx-browser-reload aria-label="Reload">↻</button>
      <button type="button" class="nx-browser-nav" data-nx-browser-home aria-label="Home">⌂</button>
      <span class="nx-browser-badge">${nativeAvailable() ? 'ANDROID • IN APP' : 'WEB • IN APP'}</span>`;
    wrap.parentElement?.insertBefore(toolbar, wrap);
    toolbar.querySelector('[data-nx-browser-back]')?.addEventListener('click', back);
    toolbar.querySelector('[data-nx-browser-forward]')?.addEventListener('click', forward);
    toolbar.querySelector('[data-nx-browser-reload]')?.addEventListener('click', reload);
    toolbar.querySelector('[data-nx-browser-home]')?.addEventListener('click', home);

    if (nativeAvailable()) {
      const note = document.createElement('div');
      note.className = 'nx-browser-native-note';
      note.textContent = 'Android mode: websites open in the dedicated NexusNova Browser WebView, not Chrome. Use the toolbar inside that browser window for Back, Forward, Reload and Home.';
      wrap.parentElement?.insertBefore(note, toolbar.nextSibling);
    }
    syncNav();
  }

  function installHandlers() {
    const input = $('nxBrowserUrl');
    const section = browserSection();
    if (!input || !section || input.dataset.nxBrowserReady === '1') return;
    input.dataset.nxBrowserReady = '1';

    input.placeholder = 'Search or enter website';
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        openInApp(input.value);
      }
    });

    const goButton = Array.from(section.querySelectorAll('button')).find(button =>
      String(button.getAttribute('onclick') || '').includes('nxBrowse()') ||
      String(button.textContent || '').trim().toLowerCase() === 'go'
    );
    if (goButton) goButton.textContent = 'Open';

    const frame = $('nxBrowserFrame');
    if (frame && frame.dataset.nxBrowserLoad !== '1') {
      frame.dataset.nxBrowserLoad = '1';
      frame.addEventListener('load', () => {
        const src = String(frame.getAttribute('src') || '');
        if (!src || src === 'about:blank') return;
        status('Loaded inside NexusNova Browser. If the page itself says it cannot be displayed, that website blocks iframe embedding on the web version.', 'success');
      });
    }
  }

  function install() {
    if (!$('nxBrowserUrl')) return false;
    installStyle();
    renameUi();
    installToolbar();
    installHandlers();
    status(nativeAvailable()
      ? 'NexusNova Browser ready. Websites will open inside the Android app, not Chrome.'
      : 'NexusNova Browser ready. Websites will stay inside this page when the destination allows web embedding.');
    return true;
  }

  // Override the old launcher behavior. These functions never auto-open an
  // external browser; only nxOpenBrowserExternal remains an explicit escape hatch.
  window.nxBrowse = () => openInApp($('nxBrowserUrl')?.value || '');
  window.nxBrowsePreset = url => {
    if ($('nxBrowserUrl')) $('nxBrowserUrl').value = url;
    return openInApp(url);
  };
  window.nxOpenBrowserExternal = () => manualExternal($('nxBrowserUrl')?.value || '');
  window.nexusOpenInAppBrowser = openInApp;

  window.NexusNovaBrowser = Object.freeze({
    version:'in-app-browser-v1',
    install,
    open:openInApp,
    normalize:safeHttps,
    back,
    forward,
    reload,
    home,
    nativeAvailable
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(install, 200), {once:true});
  } else {
    setTimeout(install, 200);
  }
  [800,1800,3500].forEach(ms => setTimeout(install, ms));
})();