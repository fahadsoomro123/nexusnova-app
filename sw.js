/* NexusNova Service Worker - fresh-code first, bounded network + offline fallback + FCM web push */
const CACHE = "nexusnova-shell-v20-ux-simplify";

const ASSETS = [
  "./",
  "./index.html",
  "./page2.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./css/style.css",
  "./css/index.css",
  "./css/page2.css",
  "./css/nexusnova-mega-merge-v1.css",
  "./css/nexusnova-button-safety-v1.css",
  "./css/nexusnova-premium-blue-v1.css",
  "./css/nexusnova-final-user-fixes-v1.css",
  "./js/page2.js",
  "./js/page2-core.js",
  "./js/core-failsafe.js",
  "./js/aux-v8.js",
  "./js/news-fix.js",
  "./js/wallet-connect-fix-v2.js",
  "./js/wallet-onchain-sync-v3.js",
  "./js/final-integrity-fix.js",
  "./js/final-integrity-fix-core.js",
  "./js/nexusnova-ultimate-upgrade.js",
  "./js/family-hub-v1.js",
  "./js/voice-commands-v1.js",
  "./js/wallet-actions-v2.js",
  "./js/rewards-security-v1.js",
  "./js/nexusnova-rewards-spark-v1.js",
  "./js/nexusnova-nova-vault-v1.js",
  "./js/nexusnova-rewarded-ads-config-v1.js",
  "./js/nexusnova-rewarded-ads-v1.js",
  "./js/nexusnova-rewarded-ads-button-guard-v1.js",
  "./js/nexusnova-daily-ad-test-v1.js?v=5",
  "./js/nexusnova-daily-secure-claim-v1.js?v=1",
  "./js/nexusnova-ad-placements-v1.js?v=3",
  "./js/nexusnova-watch-ad-reward-v1.js?v=1",
  "./js/nexusnova-existing-app-ad-hotfix-v2.js?v=20260817-0926",
  "./js/nexusnova-ux-simplify-v1.js?v=20260817-1013",
  "./js/nexusnova-ad-privacy-v1.js?v=1",
  "./js/nexusnova-admob-diagnostics-v1.js",
  /* Compatibility filename; implementation is the AdMob Mining Boost bridge. */
  "./js/nexusnova-admob-nexus-pass-v1.js",
  "./js/nexusnova-natural-voice-v1.js",
  "./js/nexusnova-new-features-v1.js",
  "./js/nexusnova-allinone-hub-v1.js",
  "./js/nexusnova-tools-hub-v1.js",
  "./js/nexusnova-android-callerid-v1.js",
  "./js/nexusnova-regional-qibla-browser-v1.js",
  "./js/nexusnova-super-app-v1.js",
  "./js/nexusnova-mega-merge-v1.js",
  "./js/nexusnova-top100-live-fix-v3.js",
  "./js/nexusnova-final-user-fixes-v1.js",
  "./js/nexusnova-premium-ui-v1.js",
  "./js/nexusnova-allapps-order-guard-v5.js",
  "./js/nexusnova-allapps-experience-v2.js",
  "./js/nexusnova-allapps-visual-polish-v1.js",
  "./js/nexusnova-popup-modernizer-v1.js",
  "./js/nexusnova-scripture-source-guard-v2.js",
  "./js/nexusnova-scripture-reader-polish-v1.js",
  "./js/nexusnova-entertainment-live-v1.js",
  "./js/nexusnova-settings-premium-dialogs-v1.js",
  "./js/nexusnova-fcm-v1.js"
];

try {
  importScripts(
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging-compat.js"
  );

  firebase.initializeApp({
    apiKey: "AIzaSyBU75WYp5ioaMD1LrNcDyAvROFW2wrTil0",
    authDomain: "nexusnova-6ade2.firebaseapp.com",
    projectId: "nexusnova-6ade2",
    storageBucket: "nexusnova-6ade2.firebasestorage.app",
    messagingSenderId: "49791194817",
    appId: "1:49791194817:web:07f28326e0f15979536640"
  });

  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const data = payload?.data || {};
    if (data.nexusnova !== "1") return;
    return self.registration.showNotification(data.title || "NexusNova", {
      body: data.body || "You have a new NexusNova update.",
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      data: { url: safeNotificationUrl(data.url) }
    });
  });
} catch (error) {
  console.warn("NexusNova FCM service-worker bootstrap unavailable:", error);
}

function safeNotificationUrl(raw) {
  try {
    const target = new URL(String(raw || "./page2.html"), self.location.origin);
    if (target.origin !== self.location.origin) return "./page2.html";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch (_) {
    return "./page2.html";
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification?.close();
  const target = safeNotificationUrl(event.notification?.data?.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      try {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      } catch (_) {}
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => {
        await Promise.allSettled(
          ASSETS.map(async (asset) => {
            const response = await fetch(asset, { cache: "no-store" });
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${asset}`);
            await cache.put(asset, response);
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const controller = new AbortController();
  const isDocument = request.mode === "navigate" || request.destination === "document";
  const timeoutMs = isDocument ? 7000 : 4500;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(request, { cache: "no-store", signal: controller.signal });
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const destination = request.destination;
  const isFreshCode =
    request.mode === "navigate" ||
    destination === "document" ||
    destination === "script" ||
    destination === "style" ||
    /\.(?:html?|js|css)(?:\?|$)/i.test(url.pathname + url.search);

  event.respondWith(isFreshCode ? networkFirst(request) : cacheFirst(request));
});
