/* NexusNova Core Failsafe bootstrap
   Critical UI navigation is installed synchronously BEFORE any network/Firebase
   dependency. Firebase remains optional for rendering and data sync; it can never
   make the visible app feel untouchable again. */
(() => {
  "use strict";

  const byId = id => document.getElementById(id);

  function showTabNow(name, button = null) {
    if (!name) return false;
    const target = byId("tab-" + name);
    if (!target) return false;

    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    target.classList.add("active");

    document.querySelectorAll(".bottom-dock .dock-item").forEach(item => item.classList.remove("active"));
    if (button?.classList?.contains("dock-item")) button.classList.add("active");

    const menu = byId("moreMenu");
    if (menu) {
      menu.classList.remove("show");
      menu.style.removeProperty("display");
    }
    document.body.classList.remove("nx-allapps-open");

    try { window.scrollTo({ top:0, behavior:"auto" }); } catch (_) { try { window.scrollTo(0,0); } catch (_) {} }
    return true;
  }

  // Install synchronous lifelines before Firebase imports. Canonical page2-core
  // may wrap these later; until then the visible UI is already tappable.
  if (typeof window.switchTab !== "function") {
    window.switchTab = function(name, button) {
      return showTabNow(name, button || null);
    };
  }

  if (typeof window.openMoreTab !== "function") {
    window.openMoreTab = function(name) {
      const ok = showTabNow(name, null);
      if (ok) byId("moreBtn")?.classList.add("active");
      return ok;
    };
  }

  if (typeof window.toggleMore !== "function") {
    window.toggleMore = function() {
      const menu = byId("moreMenu");
      if (!menu) return false;
      menu.style.removeProperty("display");
      menu.classList.toggle("show");
      const opening = menu.classList.contains("show");
      document.body.classList.toggle("nx-allapps-open", opening);
      document.querySelectorAll(".bottom-dock .dock-item").forEach(item => item.classList.remove("active"));
      byId("moreBtn")?.classList.toggle("active", opening);
      return opening;
    };
  }

  // Splash is branding only. Never add a startup-hold class and never override
  // Element.remove(): those mechanisms can turn a cosmetic splash into a full-screen
  // blocker when WebView/Firebase work is delayed. Keep the branded splash visible
  // for its normal presentation window, then force-release it independently of
  // window.load, Firebase, market, ads, fonts, or any other network dependency.
  const splash = byId("nxSplash");
  if (splash) {
    splash.dataset.nxFastExit = "3";
    splash.classList.remove("nx-startup-hold");

    const releaseSplash = () => {
      if (!splash.isConnected) return;
      splash.classList.remove("nx-startup-hold");
      splash.classList.add("hide");
      splash.style.setProperty("pointer-events", "none", "important");
      splash.style.setProperty("visibility", "hidden", "important");
      splash.style.setProperty("opacity", "0", "important");
      splash.style.setProperty("display", "none", "important");
      setTimeout(() => { try { splash.remove(); } catch (_) {} }, 80);
    };

    // Normal branded presentation is ~2.8s. 3.2s is the deterministic hard
    // release; 5s is a redundant fallback. Neither waits for window.load.
    setTimeout(releaseSplash, 3200);
    setTimeout(releaseSplash, 5000);
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) releaseSplash();
    }, { once:true });
  }

  if (!byId("nxStartupTimingGuard")) {
    const startupStyle = document.createElement("style");
    startupStyle.id = "nxStartupTimingGuard";
    startupStyle.textContent = `
      #nxSplash{min-height:100dvh!important;height:100dvh!important}
      #nxSplash.hide{opacity:0!important;visibility:hidden!important;pointer-events:none!important;display:none!important}
      #nxSplash:not(.nx-startup-hold){pointer-events:none}
      @media(max-width:700px){#nxSplash{padding:max(12px,env(safe-area-inset-top)) 16px calc(4vh + max(18px,env(safe-area-inset-bottom)))!important}}
    `;
    document.head.appendChild(startupStyle);
  }

  // Optional visual layers can load without blocking core navigation.
  if (!document.querySelector('script[data-nx-mobile-wallet-polish]')) {
    const polish = document.createElement("script");
    polish.src = "./js/nexusnova-mobile-wallet-polish-v1.js?v=2";
    polish.setAttribute("data-nx-mobile-wallet-polish", "1");
    polish.onerror = () => console.warn("NexusNova mobile wallet polish failed to load");
    document.body.appendChild(polish);
  }

  if (!document.querySelector('script[data-nx-allapps-experience]')) {
    const experience = document.createElement("script");
    experience.src = "./js/nexusnova-allapps-experience-v2.js?v=2";
    experience.setAttribute("data-nx-allapps-experience", "2");
    experience.onerror = () => console.warn("NexusNova ALL APPS experience failed to load");
    document.body.appendChild(experience);
  }

  // Firebase bootstrap runs asynchronously after the UI lifeline is alive.
  (async () => {
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

    // Legacy core-failsafe-core still contains a universal recovery block that
    // unconditionally overwrites toggleMore(). Preserve whichever modern handler
    // is live at import time (basic lifeline or ALL APPS v2 wrapper) and restore it.
    const protectedToggleMore = typeof window.toggleMore === "function" ? window.toggleMore : null;
    const protectedSwitchTab = typeof window.switchTab === "function" ? window.switchTab : null;
    const protectedOpenMoreTab = typeof window.openMoreTab === "function" ? window.openMoreTab : null;
    try {
      await import("./core-failsafe-core.js?v=6");
    } catch (error) {
      console.error("NexusNova extended failsafe unavailable; critical UI lifeline remains active:", error);
    } finally {
      if (protectedToggleMore) window.toggleMore = protectedToggleMore;
      if (protectedSwitchTab && typeof window.switchTab !== "function") window.switchTab = protectedSwitchTab;
      if (protectedOpenMoreTab && typeof window.openMoreTab !== "function") window.openMoreTab = protectedOpenMoreTab;
    }
  })();
})();