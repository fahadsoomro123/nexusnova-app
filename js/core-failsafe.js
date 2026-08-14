/* NexusNova Core Failsafe bootstrap
   Initializes the canonical Firebase DEFAULT app once, with the exact same
   options used by page2-core, then loads the original failsafe implementation. */
(async () => {
  "use strict";

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
