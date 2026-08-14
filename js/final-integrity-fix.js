/* NexusNova development network guard + Spark secure mining fallback.
   - StackBlitz/WebContainer news requests keep their dev proxy behavior.
   - When Cloud Functions are unavailable on Firebase Spark, the mining-only
     callable endpoints are fulfilled by Firestore transactions. Firestore
     Security Rules remain the authority for every value-bearing mutation.
   - Production Cloud Functions can replace this fallback later without
     changing the mining UI contract. */
(async () => {
  "use strict";

  const DAY = 86400000;
  const MINING_REWARD = 24;
  const FUNCTIONS_HOST = "us-central1-nexusnova-6ade2.cloudfunctions.net";

  function callableResponse(data) {
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  function callableError(error) {
    const code = String(error?.code || "internal").replace(/^functions\//, "");
    const statusMap = {
      "unauthenticated": "UNAUTHENTICATED",
      "permission-denied": "PERMISSION_DENIED",
      "failed-precondition": "FAILED_PRECONDITION",
      "not-found": "NOT_FOUND",
      "invalid-argument": "INVALID_ARGUMENT",
      "already-exists": "ALREADY_EXISTS",
      "resource-exhausted": "RESOURCE_EXHAUSTED"
    };
    const status = statusMap[code] || "INTERNAL";
    const message = String(error?.message || "Secure mining sync failed.");
    return new Response(JSON.stringify({ error: { status, message } }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  function numberField(data, field) {
    const value = data?.[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      const error = new Error(`Account data for ${field} needs repair. No value was changed.`);
      error.code = "failed-precondition";
      throw error;
    }
    return value;
  }

  async function sparkMiningTransaction(name) {
    const [{ getApps }, { getAuth }, { getFirestore, doc, runTransaction }] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js")
    ]);

    const apps = getApps();
    if (!apps.length) {
      const error = new Error("Firebase app is not initialized.");
      error.code = "failed-precondition";
      throw error;
    }

    const app = apps[0];
    const user = getAuth(app).currentUser;
    if (!user) {
      const error = new Error("Please sign in first.");
      error.code = "unauthenticated";
      throw error;
    }
    if (!user.emailVerified) {
      const error = new Error("Verify your email before using value-bearing features.");
      error.code = "failed-precondition";
      throw error;
    }

    const userRef = doc(getFirestore(app), "users", user.uid);
    return runTransaction(getFirestore(app), async tx => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) {
        const error = new Error("User profile not found.");
        error.code = "not-found";
        throw error;
      }

      const data = snap.data() || {};
      const now = Date.now();
      const balance = numberField(data, "balance");
      const miningActive = data.miningActive;
      const startedAt = numberField(data, "miningStartedAt");

      if (typeof miningActive !== "boolean") {
        const error = new Error("Account data for miningActive needs repair. No value was changed.");
        error.code = "failed-precondition";
        throw error;
      }

      if (name === "startMiningSession") {
        if (miningActive) {
          if (startedAt <= 0 || startedAt > now + 5 * 60 * 1000) {
            const error = new Error("Account data for mining session needs repair. No value was changed.");
            error.code = "failed-precondition";
            throw error;
          }
          return { started: false, alreadyActive: true, startedAt, balance, miningActive: true };
        }
        if (startedAt !== 0) {
          const error = new Error("Account data for mining session needs repair. No value was changed.");
          error.code = "failed-precondition";
          throw error;
        }

        tx.update(userRef, {
          miningActive: true,
          miningStartedAt: now,
          miningLastUpdate: now
        });
        return { started: true, startedAt: now, balance, miningActive: true };
      }

      if (name === "finishMiningSession") {
        if (!miningActive) {
          if (startedAt !== 0) {
            const error = new Error("Account data for mining session needs repair. No value was changed.");
            error.code = "failed-precondition";
            throw error;
          }
          return { finished: false, balance, earned: 0, miningActive: false };
        }
        if (startedAt <= 0 || startedAt > now + 5 * 60 * 1000) {
          const error = new Error("Account data for mining session needs repair. No value was changed.");
          error.code = "failed-precondition";
          throw error;
        }
        if (now - startedAt < DAY) {
          const error = new Error("Your 24-hour mining session is still active.");
          error.code = "failed-precondition";
          throw error;
        }

        const totalMined = numberField(data, "totalMined");
        const nextBalance = balance + MINING_REWARD;
        const nextTotalMined = totalMined + MINING_REWARD;
        tx.update(userRef, {
          balance: nextBalance,
          totalMined: nextTotalMined,
          miningActive: false,
          miningStartedAt: 0,
          miningLastUpdate: now
        });
        return {
          finished: true,
          balance: nextBalance,
          earned: MINING_REWARD,
          totalMined: nextTotalMined,
          miningActive: false
        };
      }

      const error = new Error("Unknown secure mining action.");
      error.code = "invalid-argument";
      throw error;
    });
  }

  // Install this before the Firebase Functions SDK sends a mining request.
  // The App Check gate in rewards-security-v1.js still runs first. The actual
  // balance write below is accepted only if Firestore Security Rules validate
  // the authenticated 24-hour state transition.
  if (!window.__nxSparkMiningFetchGuard && typeof window.fetch === "function") {
    const previousFetch = window.fetch.bind(window);
    window.__nxSparkMiningFetchGuard = true;
    window.fetch = async function(input, init) {
      const raw = typeof input === "string" ? input : String(input?.url || "");
      try {
        const parsed = new URL(raw, window.location.href);
        if (parsed.hostname === FUNCTIONS_HOST) {
          const action = parsed.pathname.replace(/^\/+/, "");
          if (action === "startMiningSession" || action === "finishMiningSession") {
            try {
              return callableResponse(await sparkMiningTransaction(action));
            } catch (error) {
              console.error(`NexusNova Spark mining ${action}:`, error);
              return callableError(error);
            }
          }
        }
      } catch (_) {}
      return previousFetch(input, init);
    };
  }

  const host = String(window.location.hostname || "").toLowerCase();
  const isDevHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.includes("--3000--") ||
    host.includes("webcontainer") ||
    host.includes("staticblitz") ||
    host.endsWith(".stackblitz.io") ||
    host.endsWith(".stackblitz.com");

  if (isDevHost && !window.__nxDevNewsProxyGuard && typeof window.fetch === "function") {
    const nativeFetch = window.fetch.bind(window);
    window.__nxDevNewsProxyGuard = true;

    window.fetch = function(input, init) {
      const raw = typeof input === "string" ? input : String(input?.url || "");
      let target = "";

      try {
        const parsed = new URL(raw, window.location.href);
        if (parsed.hostname === "api.allorigins.win" && parsed.pathname.startsWith("/raw")) {
          target = parsed.searchParams.get("url") || "";
        } else if (
          parsed.hostname === "api.gdeltproject.org" ||
          parsed.hostname === "api.rss2json.com"
        ) {
          target = parsed.href;
        }
      } catch (_) {}

      if (target) {
        const proxyUrl = "/nx-news-proxy?url=" + encodeURIComponent(target);
        return nativeFetch(proxyUrl, { ...(init || {}), cache: "no-store" });
      }

      return nativeFetch(input, init);
    };
  }

  await import("./final-integrity-fix-core.js?v=2");
})();
