/* NexusNova Service Worker - offline shell cache */
const CACHE = "nexusnova-shell-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./page2.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./js/page2.js",
  "./js/core-failsafe.js",
  "./js/nexusnova-tools-hub-v1.js",
  "./js/nexusnova-new-features-v1.js",
  "./js/nexusnova-ultimate-upgrade.js",
  "./js/family-hub-v1.js",
  "./js/voice-commands-v1.js",
  "./js/aux-v8.js",
  "./js/news-fix.js",
  "./js/wallet-connect-fix-v2.js",
  "./js/wallet-onchain-sync-v3.js",
  "./js/final-integrity-fix.js",
  "./js/rewards-security-v1.js",
  "./js/nexusnova-natural-voice-v1.js",
  "./js/nexusnova-allinone-hub-v1.js",
  "./js/wallet-actions-v2.js",
  "./css/style.css",
  "./css/page2.css",
  "./css/index.css",];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Network-first for APIs, cache-first for same-origin shell
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetched = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || fetched;
      })
    );
  }
});
