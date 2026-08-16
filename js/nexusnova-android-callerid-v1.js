/* NexusNova Android Caller ID bridge.
 * Safe no-op on normal web/PWA builds.
 */
(() => {
  "use strict";
  const ACCOUNT_SCOPED_ACTIONS = new Set(["saveContact", "deleteContact"]);
  const hasNative = () =>
    typeof window.NexusAndroid?.postMessage === "function";
  const activeAccountId = () => {
    const accountId = String(window.nexusAccountId || "").trim();
    return accountId.length <= 128 ? accountId : "";
  };

  window.nexusPostNativeAction = function (action, payload = {}) {
    if (!hasNative()) return false;
    try {
      const message = { action, ...payload };
      if (ACCOUNT_SCOPED_ACTIONS.has(action)) {
        const accountId = activeAccountId();
        if (!accountId) return false;
        message.accountId = accountId;
      }
      window.NexusAndroid.postMessage(JSON.stringify(message));
      return true;
    } catch (error) {
      console.warn("NexusNova native bridge:", error);
      return false;
    }
  };

  window.nexusRequestAndroidCallerRole = function () {
    if (!window.nexusPostNativeAction("requestCallerRole")) {
      alert("Android Caller ID is available in the NexusNova Android app.");
    }
  };

  function updateButton() {
    const b=document.getElementById("androidCallerSetupBtn");
    if (b) b.style.display=hasNative() ? "block" : "none";
  }

  if (document.readyState==="loading") {
    document.addEventListener("DOMContentLoaded",updateButton,{once:true});
  } else updateButton();

  // Do not clear the native same-device account marker merely because Firebase
  // has not finished restoring yet. That early clear caused a Back -> reopen
  // cycle to start on the login page even though the Firebase session persisted.
  function syncActiveAccount({allowClear=false} = {}) {
    const accountId = activeAccountId();
    if (accountId) {
      window.nexusPostNativeAction("setActiveAccount", { accountId });
    } else if (allowClear) {
      window.nexusPostNativeAction("clearActiveAccount");
    }
  }

  // page2 assigns its logout function on window. Wrapping that assignment lets
  // the native caller store clear only after the existing handler removes the UID.
  function installLogoutClearHook() {
    const descriptor = Object.getOwnPropertyDescriptor(window, "handleLogout");
    if (descriptor && !descriptor.configurable) return;
    let current = descriptor?.value;
    const wrap = handler => {
      if (typeof handler !== "function" || handler.__nexusNativeLogoutWrapped) return handler;
      const wrapped = async function (...args) {
        const accountId = activeAccountId();
        const result = await handler.apply(this, args);
        if (accountId && !activeAccountId()) {
          window.nexusPostNativeAction("clearActiveAccount", { accountId });
        }
        return result;
      };
      Object.defineProperty(wrapped, "__nexusNativeLogoutWrapped", { value: true });
      return wrapped;
    };
    Object.defineProperty(window, "handleLogout", {
      configurable: true,
      enumerable: descriptor?.enumerable ?? true,
      get: () => current,
      set: value => { current = wrap(value); }
    });
    current = wrap(current);
  }

  installLogoutClearHook();
  window.addEventListener("nexusaccountready", () => syncActiveAccount());
  window.addEventListener("nexusaccountcleared", () => syncActiveAccount({allowClear:true}));
  // On initial page boot the auth state can still be unresolved. Set a marker
  // only when a UID is already known; never erase a valid previous marker here.
  syncActiveAccount();
})();