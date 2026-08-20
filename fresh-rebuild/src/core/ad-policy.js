import { nativeAds } from './native-ads.js';

const SESSION_KEY = 'nx_fresh_ad_policy_session_v1';
const HUB_PLACEMENT = 'hub-app-open';
const MINING_PLACEMENT = 'mining-start';
const REQUEST_ACK_TIMEOUT_MS = 2_500;
const DISMISS_FAILSAFE_MS = 90_000;
const INTERSTITIAL_MIN_GAP_MS = 180_000;
const INTERSTITIAL_SESSION_MAX = 4;
const ELIGIBLE_BREAKS_BEFORE_FIRST = 3;

const PROTECTED_APPS = new Set([
  'wallet','tasks','profile','bmi','qibla','prayer-times','location','documents',
  'islamic','quran','hadith','urdu-library','health','contacts','caller-id','family',
  'emergency','savings','nova-vault','file-vault','security','notifications','settings',
  'chat','growth','market'
]);

// Fresh Nova Hub removed the legacy umbrella Tools/Money/etc screens. Map only
// approved, non-sensitive direct apps back to the native allowlist categories.
const FEATURE_ALIAS = Object.freeze({
  notes:'tools',
  todo:'tools',
  calculator:'tools',
  'unit-converter':'tools',
  expenses:'tools',
  pomodoro:'tools',
  tip:'tools',
  'world-clock':'tools',
  qr:'tools',
  weather:'mega-weather',
  'speed-test':'tools',
  pakistan:'mega-pakistan',
  'nova-drive':'travel',
  'nova-track':'travel',
  ai:'ai',
  smart:'smart',
  browser:'browser',
  travel:'travel',
  learning:'learn',
  teacher:'mega-teacher',
  entertainment:'entertainment',
  calendar:'mega-calendar',
  reminders:'mega-reminders',
  finance:'finance',
  budget:'money',
  bills:'money',
  shopping:'shopping',
  marketplace:'marketplace',
  orders:'mega-orders'
});

let lastInterstitialAt = 0;
let sessionInterstitialCount = 0;
let eligibleBreakCount = 0;
let inFlight = null;

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function readSession() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
    lastInterstitialAt = Math.max(0, Number(raw.lastInterstitialAt) || 0);
    sessionInterstitialCount = Math.max(0, Number(raw.sessionInterstitialCount) || 0);
    eligibleBreakCount = Math.max(0, Number(raw.eligibleBreakCount) || 0);
  } catch (_) {}
}

function persist() {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      lastInterstitialAt,
      sessionInterstitialCount,
      eligibleBreakCount
    }));
  } catch (_) {}
}

function adFeatureFor(appId) {
  const id = normalize(appId);
  return FEATURE_ALIAS[id] || '';
}

function isProtected(appId) {
  const id = normalize(appId);
  if (!id || PROTECTED_APPS.has(id)) return true;
  return /(?:wallet|payment|checkout|security|password|emergency|health|quran|hadith|bukhari|bible|islamic|caller|profile|login|auth|file-vault|document)/i.test(id);
}

function isEligibleHubApp(appId) {
  const id = normalize(appId);
  return !isProtected(id) && Boolean(adFeatureFor(id));
}

function clearTimers(active) {
  if (!active) return;
  clearTimeout(active.ackTimer);
  clearTimeout(active.dismissTimer);
}

function finish(reason = 'complete') {
  const active = inFlight;
  if (!active) return;
  clearTimers(active);
  inFlight = null;
  try { active.resolve({ shown: active.adStarted, reason }); } catch (_) {}
  if (typeof active.continue === 'function') {
    setTimeout(() => {
      try { active.continue(); } catch (error) { console.error('[NexusNova Fresh] ad continuation:', error); }
    }, 0);
  }
}

function markAdStarted() {
  const active = inFlight;
  if (!active || active.adStarted) return;
  active.adStarted = true;
  clearTimeout(active.ackTimer);
  active.ackTimer = null;
  lastInterstitialAt = Date.now();
  sessionInterstitialCount = Math.min(INTERSTITIAL_SESSION_MAX, sessionInterstitialCount + 1);
  eligibleBreakCount = 0;
  persist();
  active.dismissTimer = setTimeout(() => finish('dismiss-failsafe-timeout'), DISMISS_FAILSAFE_MS);
}

function readyForHubInterstitial() {
  if (inFlight) return false;
  if (sessionInterstitialCount >= INTERSTITIAL_SESSION_MAX) return false;
  if (Date.now() - lastInterstitialAt < INTERSTITIAL_MIN_GAP_MS) return false;
  return nativeAds.status().interstitialReady === true;
}

function startGate({ placement, feature = '', requestedFeature = '', continue: continuation, requireWarmup = false } = {}) {
  if (inFlight) return Promise.resolve({ shown:false, reason:'transition-pending' });

  if (requireWarmup) {
    eligibleBreakCount = Math.min(ELIGIBLE_BREAKS_BEFORE_FIRST, eligibleBreakCount + 1);
    persist();
    if (eligibleBreakCount < ELIGIBLE_BREAKS_BEFORE_FIRST) {
      continuation?.();
      return Promise.resolve({ shown:false, reason:'warmup' });
    }
    if (!readyForHubInterstitial()) {
      continuation?.();
      return Promise.resolve({ shown:false, reason:'frequency-or-not-ready' });
    }
  } else if (nativeAds.status().interstitialReady !== true) {
    // Mining renewal is a locked natural break, but never block the next secure
    // session when Google inventory/native readiness is unavailable.
    nativeAds.requestStatus();
    continuation?.();
    return Promise.resolve({ shown:false, reason:'not-ready' });
  }

  const posted = nativeAds.showInterstitial({ placement, feature });
  if (!posted) {
    continuation?.();
    return Promise.resolve({ shown:false, reason:'native-unavailable' });
  }

  return new Promise(resolve => {
    inFlight = {
      placement,
      feature:normalize(feature),
      requestedFeature:normalize(requestedFeature),
      continue:continuation,
      resolve,
      adStarted:false,
      requestedAt:Date.now(),
      ackTimer:null,
      dismissTimer:null
    };
    inFlight.ackTimer = setTimeout(() => {
      if (!inFlight || inFlight.adStarted) return;
      finish('request-ack-timeout');
    }, REQUEST_ACK_TIMEOUT_MS);
  });
}

function gateHubApp(appId, open) {
  const id = normalize(appId);
  if (!isEligibleHubApp(id)) {
    open?.();
    return Promise.resolve({ shown:false, reason:'protected-or-ineligible' });
  }
  // Ignore an accidental second card tap while the first ad transition owns
  // navigation. The first requested app remains the exact continuation target.
  if (inFlight) return Promise.resolve({ shown:false, reason:'transition-pending' });
  return startGate({
    placement:HUB_PLACEMENT,
    feature:adFeatureFor(id),
    requestedFeature:id,
    continue:open,
    requireWarmup:true
  });
}

function gateMiningRenewal(continueMining) {
  // A full-screen transition is already satisfying the natural break. Never
  // leave the completed-session button locked behind a second pending ad.
  if (inFlight) {
    continueMining?.();
    return Promise.resolve({ shown:false, reason:'transition-pending' });
  }
  return startGate({
    placement:MINING_PLACEMENT,
    feature:'',
    requestedFeature:'mine',
    continue:continueMining,
    requireWarmup:false
  });
}

nativeAds.subscribe(detail => {
  if (!inFlight) return;
  if (String(detail?.provider || '') !== 'admob') return;
  const type = String(detail?.event || '');
  if (!type.startsWith('interstitial-')) return;

  const placement = String(detail?.placement || '');
  const feature = normalize(detail?.feature || '');
  if (placement && placement !== inFlight.placement) return;
  if (feature && inFlight.feature && feature !== inFlight.feature) return;

  if (type === 'interstitial-showing' || type === 'interstitial-opened') {
    markAdStarted();
    return;
  }
  if (type === 'interstitial-dismissed') {
    finish('dismissed');
    return;
  }
  if ([
    'interstitial-unavailable',
    'interstitial-failed',
    'interstitial-load-failed',
    'interstitial-skipped'
  ].includes(type)) finish(type);
});

readSession();
nativeAds.requestStatus();

export const adPolicy = Object.freeze({
  gateHubApp,
  gateMiningRenewal,
  isProtected,
  isEligibleHubApp,
  adFeatureFor,
  status() {
    return Object.freeze({
      inFlight:Boolean(inFlight),
      lastInterstitialAt,
      sessionInterstitialCount,
      sessionMax:INTERSTITIAL_SESSION_MAX,
      minGapMs:INTERSTITIAL_MIN_GAP_MS,
      eligibleBreakCount,
      warmupTarget:ELIGIBLE_BREAKS_BEFORE_FIRST,
      native:nativeAds.status()
    });
  }
});