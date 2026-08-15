import fs from 'node:fs';

const placements = fs.readFileSync('js/nexusnova-ad-placements-v1.js','utf8');
const watchAd = fs.readFileSync('js/nexusnova-watch-ad-reward-v1.js','utf8');
const adPrivacy = fs.readFileSync('js/nexusnova-ad-privacy-v1.js','utf8');
const page2 = fs.readFileSync('js/page2.js','utf8');
const ssv = fs.readFileSync('functions/admobRewardedSsv.js','utf8');
const gradle = fs.readFileSync('NexusNovaAndroid/app/build.gradle.kts','utf8');
const manifest = fs.readFileSync('NexusNovaAndroid/app/src/main/AndroidManifest.xml','utf8');
const patch = fs.readFileSync('NexusNovaAndroid/patch_admob.py','utf8');
const privacyPatch = fs.readFileSync('NexusNovaAndroid/patch_ad_privacy.py','utf8');
const consent = fs.readFileSync('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NexusAdConsentManager.kt','utf8');
const hosting = fs.readFileSync('firebase.json','utf8');
const appAds = fs.readFileSync('firebase-public/app-ads.txt','utf8');

function requireText(src, token, label) {
  if (!src.includes(token)) throw new Error(`${label} missing: ${token}`);
}
function forbid(src, regex, label) {
  if (regex.test(src)) throw new Error(label);
}

// Interstitial frequency + protected-screen invariants.
requireText(placements, 'INTERSTITIAL_MIN_GAP_MS = 180_000', '3-minute interstitial cap');
requireText(placements, 'INTERSTITIAL_SESSION_MAX = 4', 'session interstitial cap');
requireText(placements, 'ELIGIBLE_BREAKS_BEFORE_FIRST = 3', 'interstitial warmup');
for (const protectedName of [
  'wallet','profile','tasks','emergency','health','qibla','mega-islamic','quran',
  'bukhari','bible','mega-security','mega-file-vault','security','file-vault','contacts'
]) {
  requireText(placements, `'${protectedName}'`, `protected ad screen ${protectedName}`);
}
for (const sensitivePattern of ['payment','checkout','password','login','auth']) {
  requireText(placements, sensitivePattern, `sensitive ad exclusion ${sensitivePattern}`);
}
requireText(placements, "maybeInterstitial('allapps-return'", 'natural-break interstitial trigger');
requireText(placements, "maybeInterstitial('content-return'", 'outbound content-return interstitial trigger');
requireText(placements, "noteEngagement('news','article-open')", 'news non-interrupting engagement');
requireText(placements, "noteEngagement('entertainment','provider-open')", 'entertainment non-interrupting engagement');
requireText(placements, "noteEngagement('browser','site-open')", 'browser non-interrupting engagement');
requireText(placements, "'money'", 'Money utilities monetizable allow-list');
requireText(placements, "'ai'", 'AI utility monetizable allow-list');
requireText(placements, "noteEngagement(feature,'utility-action')", 'generic All Apps utility engagement warming');
requireText(placements, 'pendingReturnSawHidden', 'genuine app-background return gate');

// Watch Ad must be SSV-only for value. The web controller may read Firestore
// balance to confirm server credit, but it must never write balance/reward docs.
requireText(watchAd, "const PURPOSE = 'task-watch-ad'", 'Watch Ad purpose');
requireText(watchAd, 'ssvIdentityReady', 'old-APK SSV capability gate');
requireText(watchAd, 'const PRODUCTION_SSV_ENABLED = false', 'SSV production kill switch before deployment');
requireText(watchAd, 'getDoc(ref)', 'server-credit balance confirmation');
requireText(watchAd, "NexusNovaAds.requestRewarded(PURPOSE, { userId: activeUid })", 'UID-bound rewarded request');
forbid(watchAd, /\b(?:setDoc|updateDoc|addDoc|runTransaction|writeBatch)\s*\(/, 'Watch Ad web layer must never write Firestore value.');
forbid(watchAd, /balance\s*[:=]\s*(?:[^;\n]*\+\s*2\.5|[^;\n]*REWARD_NVX)/, 'Watch Ad web layer must never client-credit +2.5 NVX.');

requireText(page2, "import('./nexusnova-ad-placements-v1.js?v=2')", 'central ad placement loader');
requireText(page2, "import('./nexusnova-watch-ad-reward-v1.js?v=1')", 'secure Watch Ad loader');
requireText(page2, "import('./nexusnova-ad-privacy-v1.js?v=1')", 'UMP privacy Settings loader');

// UMP privacy options must be publisher-rendered only when Google reports REQUIRED.
requireText(consent, 'privacyOptionsRequirementStatus', 'UMP privacy requirement status');
requireText(consent, 'showPrivacyOptionsForm', 'UMP privacy options form');
requireText(privacyPatch, 'ACTION_AD_PRIVACY_STATUS', 'native privacy status bridge');
requireText(privacyPatch, 'ACTION_SHOW_AD_PRIVACY_OPTIONS', 'native privacy form bridge');
requireText(privacyPatch, 'nexusnova:ad-privacy-event', 'native privacy status event');
requireText(adPrivacy, 'card.hidden = !required || testMode', 'privacy control hidden unless required');
requireText(adPrivacy, "postNative('showAdPrivacyOptions')", 'privacy form user-action trigger');

// Server SSV signature, idempotency and fixed-reward invariants.
requireText(ssv, 'https://www.gstatic.com/admob/reward/verifier-keys.json', 'Google SSV key source');
requireText(ssv, "crypto.verify(", 'Google ECDSA signature verification');
requireText(ssv, "const EXPECTED_AD_UNIT = '7194148596'", 'production rewarded-unit binding');
requireText(ssv, "const EXPECTED_PURPOSE = 'task-watch-ad'", 'SSV purpose binding');
requireText(ssv, 'const REWARD_NVX = 2.5', 'fixed Watch Ad reward');
requireText(ssv, "collection('admobRewardTransactions').doc(txDocId(transactionId))", 'SSV transaction idempotency');
requireText(ssv, 'if (rewardSnap.exists)', 'SSV duplicate guard');
requireText(ssv, 'db.runTransaction', 'atomic SSV reward transaction');

// Debug must never use production inventory; release must be explicitly live.
requireText(gradle, 'NEXUS_ADS_TEST_MODE", "true"', 'debug test-mode build flag');
requireText(gradle, 'NEXUS_ADS_TEST_MODE", "false"', 'release production build flag');
requireText(gradle, 'ca-app-pub-3940256099942544~3347511713', 'Google sample debug App ID');
requireText(gradle, 'ca-app-pub-5070673529890078~1824799663', 'NexusNova production App ID');
requireText(manifest, 'android:value="${admobAppId}"', 'build-specific AdMob manifest placeholder');
requireText(patch, 'NexusAdConsentManager(this).gather', 'UMP production consent gate');
requireText(patch, 'placement = message.optString("placement", message.optString("reason"))', 'native interstitial placement context');
requireText(patch, 'feature = message.optString("feature")', 'native interstitial feature context');
requireText(patch, 'INTERSTITIAL_ALLOWED_FEATURES', 'native protected-screen interstitial guard');
requireText(patch, 'scheduleInterstitialRetry()', 'interstitial no-fill retry scheduler');
requireText(patch, 'INTERSTITIAL_RETRY_BASE_MS = 15_000L', 'interstitial retry base');
requireText(patch, 'INTERSTITIAL_RETRY_MAX_MS = 120_000L', 'interstitial retry cap');
requireText(patch, 'ServerSideVerificationOptions', 'native SSV identity');
requireText(patch, '"ssvIdentityReady" to true', 'native SSV capability handshake');

// Root developer-site ownership file must remain isolated from the app bundle.
requireText(hosting, '"public": "firebase-public"', 'dedicated Firebase developer site');
requireText(appAds, 'google.com, pub-5070673529890078, DIRECT, f08c47fec0942fa0', 'app-ads publisher declaration');

console.log('NexusNova monetization security regression guard passed.');
