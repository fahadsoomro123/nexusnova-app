/* NexusNova Final Integrity Fix
   Only adds defensive UI behavior. */
(() => {
  "use strict";

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
