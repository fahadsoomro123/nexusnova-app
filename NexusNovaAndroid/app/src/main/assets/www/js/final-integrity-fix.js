/* NexusNova Final Integrity Fix
   Only adds defensive UI behavior. */
(() => {
  "use strict";

  const premiumNewsLoader = window.__nxPremiumNewsV3 && typeof window.loadNews === "function"
    ? window.loadNews
    : null;

  function assertPremiumNews() {
    if (!premiumNewsLoader) return false;
    if (window.loadNews !== premiumNewsLoader) window.loadNews = premiumNewsLoader;
    return true;
  }

  // Bible English/Urdu corpora are large verse-aligned text files. Older code
  // aborts every source after 15 seconds, which can fail on slower connections.
  // Give only these known BibleNLP resources a longer finite window and allow
  // normal browser caching; all other application fetches remain untouched.
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
    document.body.classList.add("nx-allapps-open");
    document.body.classList.add("nx-opened-from-allapps");
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
    try { window.nexusBackToTools?.(); } catch (_) {}
    try { window.nexusBackToAllApps?.(event); } catch (error) { console.warn("ALL APPS back handler:", error); }
    forceAllAppsVisible();
    requestAnimationFrame(forceAllAppsVisible);
    setTimeout(forceAllAppsVisible, 0);
    setTimeout(forceAllAppsVisible, 80);
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (_) {}
  }, true);

  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.(".more-item,.dock-item,button");
    if (!button) return;
    const label = String(button.textContent || "").toLowerCase();
    if (label.includes("news")) {
      setTimeout(() => {
        assertPremiumNews();
        window.loadNews?.();
      }, 120);
    }
  }, true);

  window.addEventListener("load", () => {
    assertPremiumNews();
    [150,700,1800,4500].forEach(ms => setTimeout(assertPremiumNews, ms));

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
  });
})();