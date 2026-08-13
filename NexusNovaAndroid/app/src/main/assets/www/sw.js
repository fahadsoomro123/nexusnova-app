/* NexusNova Service Worker - fresh-code first, offline fallback */
const CACHE = "nexusnova-shell-v7-user-batch";

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
  "./js/core-failsafe.js",
  "./js/aux-v8.js",
  "./js/news-fix.js",
  "./js/wallet-connect-fix-v2.js",
  "./js/wallet-onchain-sync-v3.js",
  "./js/final-integrity-fix.js",
  "./js/nexusnova-ultimate-upgrade.js",
  "./js/family-hub-v1.js",
  "./js/voice-commands-v1.js",
  "./js/wallet-actions-v2.js",
  "./js/rewards-security-v1.js",
  "./js/nexusnova-natural-voice-v1.js",
  "./js/nexusnova-new-features-v1.js",
  "./js/nexusnova-allinone-hub-v1.js",
  "./js/nexusnova-tools-hub-v1.js",
  "./js/nexusnova-android-callerid-v1.js",
  "./js/nexusnova-regional-qibla-browser-v1.js",
  "./js/nexusnova-super-app-v1.js",
  "./js/nexusnova-mega-merge-v1.js",
  "./js/nexusnova-top100-live-fix-v3.js",
  "./js/nexusnova-final-user-fixes-v1.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => {
        // A single optional/unavailable asset must not discard the entire
        // offline shell on first install.
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
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
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
