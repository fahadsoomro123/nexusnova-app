/* NexusNova FCM Web Push v2
   Real Firebase Cloud Messaging registration for the existing Notifications Center.
   Notification permission is requested only after an explicit user click.
   Premium NexusNova dialogs replace legacy browser alerts.
*/
(() => {
  "use strict";
  if (window.__nxFcmV2) return;
  window.__nxFcmV2 = true;
  window.__nxFcmV1 = true;

  const TOKEN_KEY = "nexusnova_fcm_token_v1";
  const FIREBASE_VERSION = "12.1.0";
  let working = false;
  let uiPromise = null;

  const $ = (id) => document.getElementById(id);

  function status(message, ok = null) {
    const el = $("nxFcmStatus");
    if (!el) return;
    el.textContent = message;
    el.style.color = ok === true ? "#22c55e" : ok === false ? "#ef4444" : "#94a3b8";
  }

  function configuredVapidKey() {
    return String(
      window.NEXUSNOVA_FCM_VAPID_KEY ||
      window.NEXUSNOVA_PUBLIC_CONFIG?.fcmVapidKey ||
      ""
    ).trim();
  }

  function getUI() {
    if (window.NexusNovaUI) return Promise.resolve(window.NexusNovaUI);
    if (uiPromise) return uiPromise;
    uiPromise = new Promise((resolve) => {
      const existing = document.querySelector('script[data-nx-premium-ui],script[data-nx-experience-premium],script[data-nx-popup-premium]');
      const done = () => resolve(window.NexusNovaUI || null);
      if (existing) {
        window.addEventListener('nexusnova:premium-ui-ready', done, {once:true});
        setTimeout(done,1400);
        return;
      }
      const script = document.createElement('script');
      script.src = './js/nexusnova-premium-ui-v1.js?v=1';
      script.dataset.nxPremiumUi = '1';
      script.onload = done;
      script.onerror = done;
      document.body.appendChild(script);
    }).finally(() => { uiPromise = null; });
    return uiPromise;
  }

  async function showError(title, error) {
    const text = String(error?.message || error || 'Push notifications could not complete this action.');
    status(text, false);
    const ui = await getUI().catch(() => null);
    if (ui?.alert) {
      await ui.alert({
        eyebrow:'NEXUSNOVA NOTIFICATIONS',
        title,
        subtitle:'Firebase Cloud Messaging',
        text,
        icon:'security',
        buttonText:'OK'
      });
    }
  }

  async function firebaseParts() {
    const [appMod, authMod, fnMod, messagingMod] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-functions.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-messaging.js`)
    ]);
    return { appMod, authMod, fnMod, messagingMod };
  }

  async function context() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      throw new Error("Push notifications are not supported in this browser.");
    }

    const parts = await firebaseParts();
    if (!(await parts.messagingMod.isSupported())) {
      throw new Error("Firebase web push is not supported on this browser/device.");
    }

    const apps = parts.appMod.getApps();
    if (!apps.length) throw new Error("Firebase app is not initialized.");
    const app = apps[0];
    const auth = parts.authMod.getAuth(app);
    if (!auth.currentUser) throw new Error("Sign in before enabling push notifications.");

    if (typeof window.nexusRequireAppCheck !== "function") {
      throw new Error("App Check is unavailable. Configure App Check before enabling secure push registration.");
    }
    await window.nexusRequireAppCheck();

    return { ...parts, app, auth };
  }

  async function serviceWorkerRegistration() {
    const registration = await navigator.serviceWorker.register("./sw.js");
    if (registration.active) return registration;
    return navigator.serviceWorker.ready;
  }

  async function obtainToken(ctx, requestPermission) {
    let permission = Notification.permission;
    if (permission === "default" && requestPermission) {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      throw new Error("Notification permission was not granted.");
    }

    const registration = await serviceWorkerRegistration();
    const messaging = ctx.messagingMod.getMessaging(ctx.app);
    const options = { serviceWorkerRegistration: registration };
    const vapidKey = configuredVapidKey();
    if (vapidKey) options.vapidKey = vapidKey;

    const token = await ctx.messagingMod.getToken(messaging, options);
    if (!token) {
      throw new Error(
        vapidKey
          ? "Firebase did not return a push token. Check FCM web credentials and the allowed origin."
          : "Firebase did not return a push token. Configure a Web Push VAPID key if the default key is not supported."
      );
    }
    return { token, messaging };
  }

  async function registerCurrentDevice(requestPermission = true) {
    if (working) return;
    working = true;
    status("Connecting secure push notifications…");
    try {
      const ctx = await context();
      const { token } = await obtainToken(ctx, requestPermission);
      const register = ctx.fnMod.httpsCallable(
        ctx.fnMod.getFunctions(ctx.app, "us-central1"),
        "registerPushToken"
      );
      await register({ token, userAgent: navigator.userAgent || "" });
      localStorage.setItem(TOKEN_KEY, token);
      status("Push notifications enabled for this device.", true);
      window.NexusNovaUI?.toast?.('Push notifications enabled for this device.');
      return token;
    } catch (error) {
      console.warn("NexusNova FCM registration:", error);
      status(error?.message || "Push notifications could not be enabled.", false);
      if (requestPermission) await showError('Could Not Enable Push', error);
      throw error;
    } finally {
      working = false;
    }
  }

  async function sendTest() {
    if (working) return;
    working = true;
    status("Preparing a real FCM test…");
    try {
      const ctx = await context();
      const { token } = await obtainToken(ctx, false);
      const register = ctx.fnMod.httpsCallable(
        ctx.fnMod.getFunctions(ctx.app, "us-central1"),
        "registerPushToken"
      );
      await register({ token, userAgent: navigator.userAgent || "" });
      localStorage.setItem(TOKEN_KEY, token);

      const test = ctx.fnMod.httpsCallable(
        ctx.fnMod.getFunctions(ctx.app, "us-central1"),
        "sendPushTest"
      );
      const result = (await test()).data || {};
      const sent = Number(result.sent || 0);
      status(`FCM test sent to ${sent} device(s).`, sent > 0);
      if (sent > 0) window.NexusNovaUI?.toast?.(`Test push sent to ${sent} device(s).`);
    } catch (error) {
      console.warn("NexusNova FCM test:", error);
      await showError('FCM Test Could Not Be Sent', error);
    } finally {
      working = false;
    }
  }

  async function disableCurrentDevice() {
    if (working) return;
    working = true;
    status("Disabling push notifications on this device…");
    try {
      const ctx = await context();
      const stored = String(localStorage.getItem(TOKEN_KEY) || "").trim();
      const current = stored || (await obtainToken(ctx, false)).token;

      try {
        const remove = ctx.fnMod.httpsCallable(
          ctx.fnMod.getFunctions(ctx.app, "us-central1"),
          "removePushToken"
        );
        await remove({ token: current });
      } finally {
        try {
          const messaging = ctx.messagingMod.getMessaging(ctx.app);
          await ctx.messagingMod.deleteToken(messaging);
        } catch (error) {
          console.warn("NexusNova local FCM token delete:", error);
        }
        localStorage.removeItem(TOKEN_KEY);
      }
      status("Push notifications disabled for this device.", true);
      window.NexusNovaUI?.toast?.('Push notifications disabled for this device.');
    } catch (error) {
      console.warn("NexusNova FCM disable:", error);
      await showError('Could Not Disable Push Cleanly', error);
    } finally {
      working = false;
    }
  }

  function installUi() {
    const tab = $("tab-mega-notifications");
    if (!tab) return false;

    getUI().catch(() => {});
    const enable = $("nxMegaNotify");
    if (enable && enable.dataset.nxFcmReady !== "1") {
      enable.dataset.nxFcmReady = "1";
      enable.textContent = "Enable Push Notifications";
      enable.onclick = null;
      enable.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        registerCurrentDevice(true).catch(() => {});
      }, true);
    }

    if (!$("nxFcmPanel")) {
      const panel = document.createElement("div");
      panel.id = "nxFcmPanel";
      panel.className = "card";
      panel.style.marginTop = "12px";
      panel.innerHTML = `
        <h3>Firebase Cloud Messaging</h3>
        <p id="nxFcmStatus" class="integration-note" style="margin:8px 0 12px">Checking push setup…</p>
        <div class="nxmega-grid">
          <button id="nxFcmTest" class="tool-btn primary" type="button">Send Test Push</button>
          <button id="nxFcmDisable" class="tool-btn" type="button">Disable This Device</button>
        </div>
        <div class="integration-note">Closed-app web push uses Firebase Cloud Messaging. Registration and test sends are authenticated and App Check protected.</div>`;
      tab.appendChild(panel);
      $("nxFcmTest")?.addEventListener("click", sendTest);
      $("nxFcmDisable")?.addEventListener("click", disableCurrentDevice);
    }

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      status("This browser does not support web push notifications.", false);
    } else if (Notification.permission === "granted") {
      status("Permission granted. Use Enable Push Notifications to register this device securely.");
    } else if (Notification.permission === "denied") {
      status("Notifications are blocked in browser settings.", false);
    } else {
      status("Push is ready to request permission when you choose Enable.");
    }
    return true;
  }

  window.nexusEnablePushNotifications = () => registerCurrentDevice(true);
  window.nexusDisablePushNotifications = disableCurrentDevice;
  window.nexusSendPushTest = sendTest;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installUi, { once: true });
  } else {
    installUi();
  }
  [600, 1400, 2600, 5000].forEach((ms) => setTimeout(installUi, ms));

  // Refresh an already-granted device silently after startup. This never opens
  // a permission prompt and never writes a token unless Auth + App Check work.
  window.addEventListener("load", () => {
    setTimeout(() => {
      if (Notification.permission === "granted") {
        registerCurrentDevice(false).catch(() => {});
      }
    }, 3500);
  }, { once: true });
})();