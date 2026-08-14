/* NexusNova Browser guard v1
   Re-asserts the in-app browser public handlers after legacy regional scripts
   finish loading. This prevents the old automatic external-browser launcher
   from taking ownership again. */
(() => {
  'use strict';
  if (window.__nxNexusBrowserGuardV1) return;
  window.__nxNexusBrowserGuardV1 = true;

  const $ = id => document.getElementById(id);

  function apply() {
    const browser = window.NexusNovaBrowser;
    if (!browser || typeof browser.open !== 'function') return false;

    window.nxBrowse = () => browser.open($('nxBrowserUrl')?.value || '');
    window.nxBrowsePreset = url => {
      if ($('nxBrowserUrl')) $('nxBrowserUrl').value = url;
      return browser.open(url);
    };
    window.nexusOpenInAppBrowser = browser.open;
    browser.install?.();
    return true;
  }

  [0,250,700,1400,2600,4500,7000].forEach(ms => setTimeout(apply, ms));
  window.addEventListener('load', () => [100,600,1800].forEach(ms => setTimeout(apply, ms)), {once:true});
})();