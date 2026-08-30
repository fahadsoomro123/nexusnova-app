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

function installMineSiteBridge() {
  const app = document.getElementById('nx-app');
  const dock = app?.querySelector('.nx-dock');
  if (!app || !dock || app.querySelector('[data-mine-site-bridge]')) return;

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

  app.insertBefore(bridge, dock);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installMineSiteBridge, { once: true });
} else {
  installMineSiteBridge();
}
