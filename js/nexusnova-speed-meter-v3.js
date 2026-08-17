/* NexusNova Speed Meter v3 compatibility shim.
   The Speed Test is now a standalone ALL APPS utility in v4. */
(() => {
  'use strict';
  if (window.__nxSpeedMeterV3) return;
  window.__nxSpeedMeterV3 = true;
  if (window.__nxSpeedTestAppV4 || document.querySelector('script[data-nx-speedtest-v4-loader]')) return;
  const script = document.createElement('script');
  script.src = './js/nexusnova-speedtest-app-v4.js?v=20260817-1043';
  script.defer = true;
  script.dataset.nxSpeedtestV4Loader = '1';
  script.onerror = () => console.warn('NexusNova standalone Speed Test v4 could not load.');
  document.head.appendChild(script);
})();
