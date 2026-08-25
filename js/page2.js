/* NexusNova dashboard launcher v4
   Single startup owner: page2.html owns the only branded visual splash.
   This module never creates a second full-screen readiness overlay.

   Keep only the bounded Firebase/Auth core on the page-load critical path.
   Optional modules start detached so slow networks cannot hold Android startup.
*/
if (!window.__nxFastDashboardLauncherV4) {
  window.__nxFastDashboardLauncherV4 = true;
  // Compatibility markers for older diagnostics; v4 intentionally has no shield.
  window.__nxFastDashboardLauncherV3 = true;
  window.__nxSingleStartupOwnerV4 = true; // nx-single-startup-owner-v4
  // nx-android-dashboard-no-secondary-shield-v1: compatibility contract only;
  // there is no secondary shield implementation in this launcher.

  try {
    await import('./nexusnova-page2-core-launch-v2.js?v=1');
  } catch (error) {
    console.error('NexusNova core dashboard bootstrap:', error);
    window.dispatchEvent(new CustomEvent('nexusnova:dashboard-bootstrap-failed', {
      detail: { message: String(error?.message || error || '') }
    }));
  }

  // Premium Nova Hub icons are presentation-only and never block dashboard readiness.
  void import('./nexusnova-nova-hub-icons-v1.js?v=1').catch(error => {
    console.error('NexusNova Nova Hub premium icons:', error);
  });

  // Keep only the Search box above Nova Hub categories/cards.
  void import('./nexusnova-nova-hub-search-only-top-v1.js?v=1').catch(error => {
    console.error('NexusNova Nova Hub search-only top:', error);
  });

  // Start optional features without blocking the document/module completion path.
  void import('./nexusnova-page2-after-core-v2.js?v=1').catch(error => {
    console.error('NexusNova detached after-core bootstrap:', error);
    window.dispatchEvent(new CustomEvent('nexusnova:dashboard-bootstrap-failed', {
      detail: { message: String(error?.message || error || '') }
    }));
  });
}
