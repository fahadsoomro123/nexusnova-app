/* NexusNova Core Failsafe bootstrap
   Initializes the canonical Firebase DEFAULT app once, with the exact same
   options used by page2-core, then loads the original failsafe implementation. */
(async () => {
  "use strict";

  // Keep the flagship splash visible long enough to feel intentional on mobile.
  // The original page timer may add .hide earlier; this guard holds it until
  // ~3.8s from navigation start, then lets the normal fade complete.
  const splash = document.getElementById("nxSplash");
  if (splash) {
    splash.dataset.nxFastExit = "1";
    splash.classList.add("nx-startup-hold");

    const originalRemove = splash.remove.bind(splash);
    splash.remove = function(){
      if (splash.classList.contains("nx-startup-hold")) return;
      originalRemove();
    };

    const elapsed = Number(performance?.now?.() || 0);
    const remaining = Math.max(0, 3800 - elapsed);
    setTimeout(() => {
      if (!splash.isConnected) return;
      splash.classList.remove("nx-startup-hold");
      splash.classList.add("hide");
      setTimeout(() => {
        try { originalRemove(); } catch (_) {}
      }, 560);
    }, remaining);
  }

  if (!document.getElementById("nxStartupTimingGuard")) {
    const startupStyle = document.createElement("style");
    startupStyle.id = "nxStartupTimingGuard";
    startupStyle.textContent = `
      #nxSplash{animation:none!important;min-height:100dvh!important;height:100dvh!important}
      #nxSplash.nx-startup-hold.hide{opacity:1!important;visibility:visible!important;pointer-events:auto!important}
      @media(max-width:700px){
        #nxSplash{
          padding:max(12px,env(safe-area-inset-top)) 16px calc(4vh + max(18px,env(safe-area-inset-bottom)))!important;
        }
      }
    `;
    document.head.appendChild(startupStyle);
  }

  // UI-only polish is intentionally isolated from wallet/provider logic.
  if (!document.querySelector('script[data-nx-mobile-wallet-polish]')) {
    const polish = document.createElement("script");
    polish.src = "./js/nexusnova-mobile-wallet-polish-v1.js?v=1";
    polish.setAttribute("data-nx-mobile-wallet-polish", "1");
    polish.onerror = () => console.warn("NexusNova mobile wallet polish failed to load");
    document.body.appendChild(polish);
  }

  // ALL APPS repair/visual layer is isolated from feature business logic.
  // It installs after window.load so the canonical navigation functions exist first.
  if (!document.querySelector('script[data-nx-allapps-experience]')) {
    const experience = document.createElement("script");
    experience.src = "./js/nexusnova-allapps-experience-v2.js?v=2";
    experience.setAttribute("data-nx-allapps-experience", "2");
    experience.onerror = () => console.warn("NexusNova ALL APPS experience failed to load");
    document.body.appendChild(experience);
  }

  const FIREBASE_APP_URL = "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
  const config = {
    apiKey: "AIzaSyBU75WYp5ioaMD1LrNcDyAvROFW2wrTil0",
    authDomain: "nexusnova-6ade2.firebaseapp.com",
    projectId: "nexusnova-6ade2",
    storageBucket: "nexusnova-6ade2.firebasestorage.app",
    messagingSenderId: "49791194817",
    appId: "1:49791194817:web:07f28326e0f15979536640",
    measurementId: "G-YLPFKWSS12"
  };

  try {
    const { initializeApp, getApps, deleteApp } = await import(FIREBASE_APP_URL);
    const current = getApps().find(app => app?.name === "[DEFAULT]") || null;

    if (current) {
      const opts = current.options || {};
      const sameCanonicalConfig =
        String(opts.apiKey || "") === config.apiKey &&
        String(opts.authDomain || "") === config.authDomain &&
        String(opts.projectId || "") === config.projectId &&
        String(opts.storageBucket || "") === config.storageBucket &&
        String(opts.messagingSenderId || "") === config.messagingSenderId &&
        String(opts.appId || "") === config.appId &&
        String(opts.measurementId || "") === config.measurementId;

      if (!sameCanonicalConfig) {
        await deleteApp(current);
        initializeApp(config);
      }
    } else {
      initializeApp(config);
    }
  } catch (error) {
    console.error("NexusNova Firebase bootstrap:", error);
  }

  await import("./core-failsafe-core.js?v=4");
})();
