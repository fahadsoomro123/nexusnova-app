/* NexusNova Final Integrity Fix
   Only adds defensive UI behavior. */
(() => {
  "use strict";

  function forceAllAppsVisible() {
    const menu = document.getElementById("moreMenu");
    if (!menu) return false;

    // Some older recovery/navigation code writes inline display:none.
    // Clear it and then explicitly assert the visible state.
    menu.style.removeProperty("display");
    menu.classList.add("show");
    if (getComputedStyle(menu).display === "none") {
      menu.style.display = "block";
    }

    document.body.classList.add("nx-allapps-open");
    document.body.classList.add("nx-opened-from-allapps");

    document.querySelectorAll(".bottom-dock .dock-item").forEach((item) => {
      item.classList.remove("active");
    });
    document.getElementById("moreBtn")?.classList.add("active");
    return true;
  }

  function getAllAppsBackButton(target) {
    const button = target?.closest?.("button");
    if (!button) return null;

    if (button.classList.contains("tools-main-back")) return button;
    if (button.closest(".nx-allapps-back")) return button;
    if (button.matches("[data-nx-back-allapps]")) return button;

    // Last-resort coverage for any existing/dynamically-created button that
    // visibly says Back to ALL APPS but was not given one of the standard classes.
    const label = String(button.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
    return label.includes("BACK TO ALL APPS") ? button : null;
  }

  /*
     Root-cause hotfix for ALL APPS return buttons:
     page2.js has a document-level outside-click listener that closes #moreMenu.
     A Back button used to open #moreMenu and then the SAME click bubbled to that
     listener, which immediately closed it again. The button therefore looked dead.

     Handle these clicks in capture phase, stop that same click before it reaches
     the old outside-click listener, then open ALL APPS once and re-assert it after
     synchronous/late legacy handlers have had a chance to run.
  */
  document.addEventListener(
    "click",
    (event) => {
      const button = getAllAppsBackButton(event.target);
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      try {
        if (typeof window.nexusBackToTools === "function") {
          window.nexusBackToTools();
        }
      } catch (_) {}

      try {
        if (typeof window.nexusBackToAllApps === "function") {
          window.nexusBackToAllApps(event);
        }
      } catch (error) {
        console.warn("ALL APPS back handler:", error);
      }

      forceAllAppsVisible();
      requestAnimationFrame(forceAllAppsVisible);
      setTimeout(forceAllAppsVisible, 0);
      setTimeout(forceAllAppsVisible, 80);

      try {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (_) {}
    },
    true
  );

  window.addEventListener("load", () => {
    // Never leave the news tab permanently stuck on the initial loader.
    const refresh = document.querySelector(".refresh-news");
    if (refresh && typeof window.loadNews === "function") {
      refresh.addEventListener("click", () => {
        setTimeout(() => {
          if (document.getElementById("newsList")) window.loadNews();
        }, 50);
      });
    }

    // Keep AI voice status truthful.
    const voiceStatus = document.getElementById("aiVoiceStatus");
    if (voiceStatus && !("speechSynthesis" in window)) {
      voiceStatus.textContent = "Voice output not supported in this browser";
    }
  });
})();