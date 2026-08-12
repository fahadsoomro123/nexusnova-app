/* NexusNova Android Caller ID bridge.
 * Safe no-op on normal web/PWA builds.
 */
(() => {
  "use strict";
  const hasNative = () => typeof window.NexusAndroid !== "undefined";

  window.nexusRequestAndroidCallerRole = function () {
    if (!hasNative()) {
      alert("Android Caller ID is available in the NexusNova Android app.");
      return;
    }
    try {
      window.NexusAndroid.requestCallerRole();
    } catch (e) {
      console.warn("Caller role:", e);
    }
  };

  function updateButton() {
    const b=document.getElementById("androidCallerSetupBtn");
    if (b) b.style.display=hasNative() ? "block" : "none";
  }

  if (document.readyState==="loading") {
    document.addEventListener("DOMContentLoaded",updateButton,{once:true});
  } else updateButton();
})();
