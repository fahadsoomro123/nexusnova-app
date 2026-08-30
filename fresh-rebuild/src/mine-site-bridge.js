const NEXUSNOVA_TOOLS_URL = 'https://nexusnovatools.com/';

function openInNovaBrowser(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ''));
    if (url.protocol !== 'https:') return false;

    if (typeof window.NexusBrowserAndroid?.postMessage === 'function') {
      window.NexusBrowserAndroid.postMessage(JSON.stringify({ action: 'open', url: url.href }));
      return true;
    }

    if (typeof window.nexusPostNativeAction === 'function' &&
        window.nexusPostNativeAction('openExternal', { url: url.href })) {
      return true;
    }

    window.open(url.href, '_blank', 'noopener,noreferrer');
    return true;
  } catch (error) {
    console.warn('[NexusNova Mine] site bridge:', error);
    return false;
  }
}

function createMineSiteBridge() {
  const bridge = document.createElement('button');
  bridge.type = 'button';
  bridge.className = 'nx-mine-site-bridge';
  bridge.dataset.mineSiteBridge = '';
  bridge.setAttribute('aria-label', 'Open nexusnovatools.com in Nova Browser');
  bridge.innerHTML = `
    <span class="nx-mine-site-bridge__lamp" aria-hidden="true"></span>
    <span class="nx-mine-site-bridge__mark" aria-hidden="true">N</span>
    <span class="nx-mine-site-bridge__copy">
      <small>NEXUSNOVA NETWORK / WEB PORTAL</small>
      <strong>NEXUSNOVA <em>TOOLS</em></strong>
      <span>nexusnovatools.com</span>
    </span>
    <span class="nx-mine-site-bridge__cta">OPEN <b aria-hidden="true">›</b></span>
  `;
  bridge.addEventListener('click', () => openInNovaBrowser(NEXUSNOVA_TOOLS_URL));
  return bridge;
}

function startMineSiteBridge() {
  const app = document.getElementById('nx-app');
  const stage = document.getElementById('nx-stage');
  const dock = app?.querySelector('.nx-dock');
  if (!app || !stage || !dock) return;

  let bridge = null;

  const sync = () => {
    const onMine = stage.dataset.route === 'mine';

    if (!onMine) {
      bridge?.remove();
      bridge = null;
      return;
    }

    if (bridge?.isConnected) return;
    bridge = createMineSiteBridge();
    app.insertBefore(bridge, dock);
  };

  const observer = new MutationObserver(sync);
  observer.observe(stage, { attributes: true, attributeFilter: ['data-route'] });
  sync();

  window.addEventListener('pagehide', () => {
    observer.disconnect();
    bridge?.remove();
    bridge = null;
  }, { once: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startMineSiteBridge, { once: true });
} else {
  startMineSiteBridge();
}
