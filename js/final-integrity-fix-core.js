/* NexusNova Final Integrity Fix
   Only adds defensive UI behavior. */
(() => {
  "use strict";

  // Remember which normal tab was underneath ALL APPS before a feature opened.
  // This lets Back to ALL APPS close the feature instead of leaving it visible
  // behind the menu, while still returning the user to the tab they came from.
  let allAppsOriginTabId = "";

  function currentActiveTab() {
    return document.querySelector(".tab.active");
  }

  function rememberAllAppsOrigin() {
    const active = currentActiveTab();
    if (active?.id) allAppsOriginTabId = active.id;
  }

  function closeFeatureAndRestoreOrigin() {
    const activeTabs = Array.from(document.querySelectorAll(".tab.active"));
    activeTabs.forEach((tab) => tab.classList.remove("active"));

    let origin = allAppsOriginTabId
      ? document.getElementById(allAppsOriginTabId)
      : null;

    if (!origin || activeTabs.includes(origin)) {
      origin = document.getElementById("tab-home");
    }
    origin?.classList.add("active");
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    const menu = document.getElementById("moreMenu");
    const moreButton = target?.closest?.("#moreBtn");
    const menuItem = target?.closest?.("#moreMenu .more-item");

    if (moreButton && !menu?.classList.contains("show")) {
      rememberAllAppsOrigin();
      return;
    }

    if (menuItem) {
      rememberAllAppsOrigin();
    }
  }, true);

  const premiumNewsLoader = window.__nxPremiumNewsV3 && typeof window.loadNews === "function"
    ? window.loadNews
    : null;

  function assertPremiumNews() {
    if (!premiumNewsLoader) return false;
    if (window.loadNews !== premiumNewsLoader) window.loadNews = premiumNewsLoader;
    return true;
  }

  if (!window.__nxBibleFetchGuard && typeof window.fetch === "function") {
    const nativeFetch = window.fetch.bind(window);
    window.__nxBibleFetchGuard = true;
    window.fetch = function(input, init) {
      const url = typeof input === "string" ? input : String(input?.url || "");
      const isBibleData = /(?:raw\.githubusercontent\.com|cdn\.jsdelivr\.net)\/.*BibleNLP\/ebible/i.test(url);
      if (!isBibleData) return nativeFetch(input, init);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      const options = { ...(init || {}), cache: "force-cache", signal: controller.signal };
      return nativeFetch(input, options).finally(() => clearTimeout(timer));
    };
  }

  function forceAllAppsVisible() {
    const menu = document.getElementById("moreMenu");
    if (!menu) return false;
    menu.style.removeProperty("display");
    menu.classList.add("show");
    if (getComputedStyle(menu).display === "none") menu.style.display = "block";
    document.body.classList.add("nx-allapps-open", "nx-opened-from-allapps");
    document.querySelectorAll(".bottom-dock .dock-item").forEach((item) => item.classList.remove("active"));
    document.getElementById("moreBtn")?.classList.add("active");
    return true;
  }

  function getAllAppsBackButton(target) {
    const button = target?.closest?.("button");
    if (!button) return null;
    if (button.classList.contains("tools-main-back")) return button;
    if (button.closest(".nx-allapps-back")) return button;
    if (button.matches("[data-nx-back-allapps]")) return button;
    const label = String(button.textContent || "").replace(/\s+/g, " ").trim().toUpperCase();
    return label.includes("BACK TO ALL APPS") ? button : null;
  }

  document.addEventListener("click", (event) => {
    const button = getAllAppsBackButton(event.target);
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (button.classList.contains("tools-main-back")) {
      try { window.nexusBackToTools?.(); } catch (_) {}
    }

    closeFeatureAndRestoreOrigin();
    forceAllAppsVisible();
    requestAnimationFrame(forceAllAppsVisible);
    setTimeout(forceAllAppsVisible, 0);
    setTimeout(forceAllAppsVisible, 80);
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (_) {}
  }, true);

  function assertReliableConverter() {
    if (typeof window.nexusFinalConvertCurrency !== "function") return false;
    if (window.convertCurrency?.__nxIntegrityReliable) return true;
    const reliable = function() { return window.nexusFinalConvertCurrency(false); };
    reliable.__nxIntegrityReliable = true;
    window.convertCurrency = reliable;
    return true;
  }

  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.(".more-item,.dock-item,button");
    if (!button) return;
    const label = String(button.textContent || "").toLowerCase();
    if (label.includes("finance") || label.includes("gold") || label.includes("fx")) {
      setTimeout(() => {
        assertReliableConverter();
        window.nexusFinalConvertCurrency?.(false);
      }, 120);
    }
    if (label.includes("news")) {
      setTimeout(() => {
        assertPremiumNews();
        window.loadNews?.();
      }, 120);
    }
  }, true);

  function loadGuard(src, marker) {
    if (document.querySelector(`script[${marker}]`)) return;
    const guard = document.createElement('script');
    guard.src = src;
    guard.setAttribute(marker, '1');
    document.body.appendChild(guard);
  }

  window.addEventListener("load", () => {
    assertPremiumNews();
    [150, 700, 1800, 4500].forEach(ms => setTimeout(assertPremiumNews, ms));

    const refresh = document.querySelector(".refresh-news");
    if (refresh) {
      refresh.addEventListener("click", () => setTimeout(() => {
        assertPremiumNews();
        if (document.getElementById("newsList")) window.loadNews?.();
      }, 50));
    }

    const voiceStatus = document.getElementById("aiVoiceStatus");
    if (voiceStatus && !("speechSynthesis" in window)) {
      voiceStatus.textContent = "Voice output not supported in this browser";
    }

    setTimeout(() => {
      document.querySelectorAll("#tab-bible iframe").forEach((frame) => frame.remove());
    }, 250);

    loadGuard('./js/nexusnova-allapps-order-guard-v5.js', 'data-nx-allapps-guard');
    loadGuard('./js/nexusnova-scripture-source-guard-v2.js', 'data-nx-scripture-guard');
    loadGuard('./js/nexusnova-local-apps-repair-v1.js', 'data-nx-local-apps-repair');
    loadGuard('./js/nexusnova-profile-display-guard-v1.js', 'data-nx-profile-display-guard');
    loadGuard('./js/nexusnova-speed-meter-sync-v2.js?v=2', 'data-nx-speed-meter-v2');
    // Premium ALL APPS identity is owned by core-failsafe.js so this integrity
    // layer does not inject a second copy of nexusnova-allapps-experience-v2.js.
    loadGuard('./js/nexusnova-allapps-visual-polish-v1.js?v=1', 'data-nx-allapps-visual-polish-v1');
    loadGuard('./js/nexusnova-popup-modernizer-v1.js?v=1', 'data-nx-popup-modernizer-v1');
    loadGuard('./js/nexusnova-scripture-reader-polish-v1.js?v=1', 'data-nx-scripture-reader-polish-v1');
    loadGuard('./js/nexusnova-entertainment-live-v1.js?v=1', 'data-nx-entertainment-live-v1');
    loadGuard('./js/nexusnova-settings-premium-dialogs-v1.js?v=1', 'data-nx-settings-premium-dialogs-v1');

    let converterPasses = 0;
    const converterGuard = setInterval(() => {
      assertReliableConverter();
      converterPasses += 1;
      if (converterPasses >= 20) clearInterval(converterGuard);
    }, 2000);
    assertReliableConverter();
  });
})();