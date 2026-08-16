from pathlib import Path

path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
text = path.read_text()

# Keep this patch separate from patch_viewport.py. The viewport helper is an
# approved/locked UI fix and must remain independently testable.
if 'private lateinit var adManager: NexusAdManager' not in text:
    old = '    private lateinit var webView: WebView\n'
    new = old + '    private lateinit var adManager: NexusAdManager\n'
    if old not in text:
        raise SystemExit('Ad manager field insertion point not found')
    text = text.replace(old, new, 1)

if 'adManager = NexusAdManager(this, webView)' not in text:
    old = '''        configureWebView()\n        installNativeMessageListener()\n\n        // The production GitHub Pages origin'''
    new = '''        configureWebView()\n        installNativeMessageListener()\n        adManager = NexusAdManager(this, webView) { view -> isTrustedAppPage(view) }\n        if (BuildConfig.NEXUS_ADS_TEST_MODE) {\n            // Debug/development APKs always use Google's test inventory.\n            adManager.initialize()\n        } else {\n            // Release APKs cannot initialize/request production ads until UMP\n            // has refreshed consent state and says ad requests are allowed.\n            NexusAdConsentManager(this).gather { canRequestAds ->\n                if (canRequestAds) adManager.initialize()\n            }\n        }\n\n        // The production GitHub Pages origin'''
    if old not in text:
        raise SystemExit('Ad manager initialization insertion point not found')
    text = text.replace(old, new, 1)

# Preserve reward purpose + authenticated Firebase UID coming from the trusted
# top-level web app. The native owner uses them only for Google SSV metadata;
# no client field can directly grant NVX.
if 'ACTION_SHOW_REWARDED_AD -> adManager.showRewarded(' not in text:
    old = '''            ACTION_REQUEST_CALLER_ROLE -> requestCallerRole()\n\n            ACTION_OPEN_EXTERNAL -> {'''
    new = '''            ACTION_REQUEST_CALLER_ROLE -> requestCallerRole()\n\n            ACTION_SHOW_REWARDED_AD -> adManager.showRewarded(\n                rewardPurpose = message.optString("rewardPurpose").trim(),\n                testOnly = message.optBoolean("testOnly", false),\n                userId = message.optString("userId").trim()\n            )\n            ACTION_SHOW_INTERSTITIAL_AD -> adManager.showInterstitial(\n                placement = message.optString("placement", message.optString("reason")).trim(),\n                feature = message.optString("feature").trim(),\n                testOnly = message.optBoolean("testOnly", false)\n            )\n            ACTION_AD_STATUS -> adManager.publishStatus()\n\n            ACTION_OPEN_EXTERNAL -> {'''
    if old not in text:
        raise SystemExit('Ad native-action insertion point not found')
    text = text.replace(old, new, 1)

if 'const val ACTION_SHOW_REWARDED_AD = "showRewardedAd"' not in text:
    old = '''        const val ACTION_REQUEST_CALLER_ROLE = "requestCallerRole"\n        const val ACTION_OPEN_EXTERNAL = "openExternal"\n'''
    new = '''        const val ACTION_REQUEST_CALLER_ROLE = "requestCallerRole"\n        const val ACTION_OPEN_EXTERNAL = "openExternal"\n        const val ACTION_SHOW_REWARDED_AD = "showRewardedAd"\n        const val ACTION_SHOW_INTERSTITIAL_AD = "showInterstitialAd"\n        const val ACTION_AD_STATUS = "adStatus"\n'''
    if old not in text:
        raise SystemExit('Ad action-constant insertion point not found')
    text = text.replace(old, new, 1)

path.write_text(text)

manager_path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NexusAdManager.kt')
manager = manager_path.read_text()

# Test/live inventory is selected by Android build type. Debug can never send a
# production ad request; release can never accidentally use the test flag.
if 'const val TEST_MODE = true' in manager:
    manager = manager.replace(
        'const val TEST_MODE = true',
        'val TEST_MODE = BuildConfig.NEXUS_ADS_TEST_MODE',
        1
    )
if 'gma-next-gen-1.3.0-gam-direct-test' in manager:
    manager = manager.replace(
        'gma-next-gen-1.3.0-gam-direct-test',
        'gma-next-gen-1.3.0',
        1
    )

# Google Next-Gen SSV metadata support. This is additive to the proven v60 ad
# load/show path and is only attached immediately before a production ad shows.
ssv_import = 'import com.google.android.libraries.ads.mobile.sdk.rewarded.ServerSideVerificationOptions\n'
if ssv_import not in manager:
    marker = 'import com.google.android.libraries.ads.mobile.sdk.rewarded.OnUserEarnedRewardListener\n'
    if marker not in manager:
        raise SystemExit('SSV import insertion point not found')
    manager = manager.replace(marker, marker + ssv_import, 1)

if 'private var pendingRewardUserId = ""' not in manager:
    marker = '    private var pendingTestOnly = false\n'
    addition = marker + '    private var pendingRewardUserId = ""\n    private var pendingRewardCustomData = ""\n'
    if marker not in manager:
        raise SystemExit('SSV pending-field insertion point not found')
    manager = manager.replace(marker, addition, 1)

old_signature = '    fun showRewarded(rewardPurpose: String? = null, testOnly: Boolean = false) {'
new_signature = '    fun showRewarded(rewardPurpose: String? = null, testOnly: Boolean = false, userId: String? = null) {'
if old_signature in manager:
    manager = manager.replace(old_signature, new_signature, 1)

if 'pendingRewardUserId = sanitizeRewardUserId(userId)' not in manager:
    marker = '''            pendingRewardPurpose = purpose\n            pendingTestOnly = testOnly\n'''
    addition = marker + '''            pendingRewardUserId = sanitizeRewardUserId(userId)\n            pendingRewardCustomData = purpose\n'''
    if marker not in manager:
        raise SystemExit('SSV request identity insertion point not found')
    manager = manager.replace(marker, addition, 1)

ssv_block = '''        if (!TEST_MODE && pendingRewardUserId.isNotBlank()) {\n            ad.setServerSideVerificationOptions(\n                ServerSideVerificationOptions(pendingRewardUserId, pendingRewardCustomData)\n            )\n        }\n\n'''
if manager.count(ssv_block) < 2:
    primary_marker = '''        dispatchRewardEvent("rewarded-showing", "rewarded")\n        ad.show(\n'''
    primary_new = '''        dispatchRewardEvent("rewarded-showing", "rewarded")\n''' + ssv_block + '''        ad.show(\n'''
    if primary_marker in manager and ssv_block not in manager[manager.index(primary_marker):manager.index(primary_marker)+800]:
        manager = manager.replace(primary_marker, primary_new, 1)

    fallback_marker = '''        dispatchRewardEvent("rewarded-showing", "rewarded-interstitial-fallback")\n        ad.show(\n'''
    fallback_new = '''        dispatchRewardEvent("rewarded-showing", "rewarded-interstitial-fallback")\n''' + ssv_block + '''        ad.show(\n'''
    if fallback_marker in manager and ssv_block not in manager[manager.index(fallback_marker):manager.index(fallback_marker)+900]:
        manager = manager.replace(fallback_marker, fallback_new, 1)

if 'pendingRewardUserId = ""' in manager and manager.count('pendingRewardUserId = ""') == 1:
    marker = '''        pendingTestOnly = false\n        rewardedRetryRound = 0\n'''
    addition = '''        pendingTestOnly = false\n        pendingRewardUserId = ""\n        pendingRewardCustomData = ""\n        rewardedRetryRound = 0\n'''
    if marker not in manager:
        raise SystemExit('SSV clear-state insertion point not found')
    manager = manager.replace(marker, addition, 1)

if 'REWARD_PURPOSE_WATCH_AD -> REWARD_PURPOSE_WATCH_AD' not in manager:
    marker = '''            REWARD_PURPOSE_DAILY_TEST -> REWARD_PURPOSE_DAILY_TEST\n            REWARD_PURPOSE_MINING -> REWARD_PURPOSE_MINING\n'''
    addition = '''            REWARD_PURPOSE_DAILY_TEST -> REWARD_PURPOSE_DAILY_TEST\n            REWARD_PURPOSE_WATCH_AD -> REWARD_PURPOSE_WATCH_AD\n            REWARD_PURPOSE_MINING -> REWARD_PURPOSE_MINING\n'''
    if marker not in manager:
        raise SystemExit('Reward-purpose insertion point not found')
    manager = manager.replace(marker, addition, 1)

if 'private fun sanitizeRewardUserId' not in manager:
    marker = '    private fun dispatch(event: String, extras: Map<String, Any?> = emptyMap()) {'
    addition = '''    private fun sanitizeRewardUserId(raw: String?): String {\n        val value = raw.orEmpty().trim()\n        return value.takeIf { Regex("^[A-Za-z0-9:_-]{3,128}$").matches(it) }.orEmpty()\n    }\n\n''' + marker
    if marker not in manager:
        raise SystemExit('SSV UID sanitizer insertion point not found')
    manager = manager.replace(marker, addition, 1)

if 'const val REWARD_PURPOSE_WATCH_AD = "task-watch-ad"' not in manager:
    marker = '        const val REWARD_PURPOSE_DAILY_TEST = "daily-reward-test"\n'
    addition = marker + '        const val REWARD_PURPOSE_WATCH_AD = "task-watch-ad"\n'
    if marker not in manager:
        raise SystemExit('Watch-ad constant insertion point not found')
    manager = manager.replace(marker, addition, 1)

# Capability handshake prevents an older APK (not aware of task-watch-ad) from
# silently downgrading the request to Mining Boost. The web layer must see this
# flag before enabling the secure +2.5 NVX Watch Ad route.
if '"ssvIdentityReady" to true' not in manager:
    marker = '''                "sdkReady" to initialized,\n                "sdkFamily" to SDK_FAMILY,\n'''
    addition = '''                "sdkReady" to initialized,\n                "ssvIdentityReady" to true,\n                "sdkFamily" to SDK_FAMILY,\n'''
    if marker not in manager:
        raise SystemExit('SSV capability status insertion point not found')
    manager = manager.replace(marker, addition, 1)


# Interstitial hardening. Keep full-screen ads on natural transitions only,
# preserve placement/feature context for diagnostics, and recover from transient
# production no-fill instead of getting stuck permanently after one failed load.
if 'private var interstitialRetryRound = 0' not in manager:
    marker = '    private var interstitialLoading = false\n'
    addition = marker + '''    private var interstitialRetryRound = 0\n    private var interstitialRetryScheduled = false\n    private var interstitialRetryNotBeforeAt = 0L\n\n    private var activeInterstitialPlacement = ""\n    private var activeInterstitialFeature = ""\n'''
    if marker not in manager:
        raise SystemExit('Interstitial retry field insertion point not found')
    manager = manager.replace(marker, addition, 1)

old_interstitial = '''    fun showInterstitial() {\n        mainHandler.post {\n            if (!initialized) {\n                initialize()\n                dispatch("interstitial-unavailable", mapOf("reason" to "sdk-initializing"))\n                return@post\n            }\n\n            val now = System.currentTimeMillis()\n            if (now - lastInterstitialShownAt < INTERSTITIAL_COOLDOWN_MS) {\n                dispatch("interstitial-skipped", mapOf("reason" to "cooldown"))\n                return@post\n            }\n\n            val ad = interstitialAd\n            if (ad == null) {\n                dispatch("interstitial-unavailable", mapOf("reason" to "loading-or-no-fill"))\n                loadInterstitial()\n                return@post\n            }\n\n            interstitialAd = null\n            lastInterstitialShownAt = now\n            dispatch("interstitial-showing")\n            ad.show(activity)\n        }\n    }\n'''
new_interstitial = '''    fun showInterstitial(placement: String? = null, feature: String? = null, testOnly: Boolean = false) {\n        mainHandler.post {\n            val safePlacement = sanitizePlacement(placement)\n            val safeFeature = sanitizeFeature(feature)\n            val context = mapOf(\n                "placement" to safePlacement,\n                "feature" to safeFeature,\n                "testOnly" to testOnly\n            )\n            val miningStartGate = safePlacement == "mining-start"\n\n            if (!miningStartGate && safeFeature.isNotBlank() && safeFeature !in INTERSTITIAL_ALLOWED_FEATURES) {\n                dispatch("interstitial-skipped", context + mapOf("reason" to "protected-or-ineligible"))\n                return@post\n            }\n\n            if (showingRewarded || pendingRewardedShow) {\n                dispatch("interstitial-skipped", context + mapOf("reason" to "rewarded-active"))\n                return@post\n            }\n\n            if (!initialized) {\n                initialize()\n                dispatch("interstitial-unavailable", context + mapOf("reason" to "sdk-initializing"))\n                return@post\n            }\n\n            val now = System.currentTimeMillis()\n            if (!miningStartGate && now - lastInterstitialShownAt < INTERSTITIAL_COOLDOWN_MS) {\n                dispatch("interstitial-skipped", context + mapOf("reason" to "cooldown"))\n                return@post\n            }\n\n            val ad = interstitialAd\n            if (ad == null) {\n                dispatch("interstitial-unavailable", context + mapOf("reason" to "loading-or-no-fill"))\n                loadInterstitial()\n                return@post\n            }\n\n            interstitialAd = null\n            activeInterstitialPlacement = safePlacement\n            activeInterstitialFeature = safeFeature\n            lastInterstitialShownAt = now\n            dispatch("interstitial-showing", context)\n            ad.show(activity)\n        }\n    }\n'''
if old_interstitial in manager:
    manager = manager.replace(old_interstitial, new_interstitial, 1)
elif 'fun showInterstitial(placement: String? = null, feature: String? = null, testOnly: Boolean = false)' not in manager:
    raise SystemExit('Interstitial show method patch point not found')

if 'System.currentTimeMillis() < interstitialRetryNotBeforeAt' not in manager:
    marker = '''    private fun loadInterstitial() {\n        if (!initialized || interstitialLoading || interstitialAd != null || activity.isFinishing || activity.isDestroyed) return\n        interstitialLoading = true\n'''
    addition = '''    private fun loadInterstitial() {\n        if (!initialized || interstitialLoading || interstitialAd != null || activity.isFinishing || activity.isDestroyed) return\n        if (System.currentTimeMillis() < interstitialRetryNotBeforeAt) return\n        interstitialLoading = true\n'''
    if marker not in manager:
        raise SystemExit('Interstitial load retry gate insertion point not found')
    manager = manager.replace(marker, addition, 1)

if 'interstitialRetryRound = 0\n                        interstitialRetryScheduled = false' not in manager:
    marker = '''                        interstitialLoading = false\n                        interstitialAd = ad\n'''
    addition = '''                        interstitialLoading = false\n                        interstitialRetryRound = 0\n                        interstitialRetryScheduled = false\n                        interstitialRetryNotBeforeAt = 0L\n                        interstitialAd = ad\n'''
    if marker not in manager:
        raise SystemExit('Interstitial success reset insertion point not found')
    manager = manager.replace(marker, addition, 1)

if '"placement" to activeInterstitialPlacement' not in manager:
    marker = '''                            override fun onAdShowedFullScreenContent() {\n                                dispatch("interstitial-opened")\n                            }\n'''
    addition = '''                            override fun onAdShowedFullScreenContent() {\n                                dispatch(\n                                    "interstitial-opened",\n                                    mapOf(\n                                        "placement" to activeInterstitialPlacement,\n                                        "feature" to activeInterstitialFeature\n                                    )\n                                )\n                            }\n'''
    if marker not in manager:
        raise SystemExit('Interstitial opened context insertion point not found')
    manager = manager.replace(marker, addition, 1)

if '"interstitial-dismissed",\n                                        mapOf(' not in manager:
    marker = '''                                    interstitialAd = null\n                                    dispatch("interstitial-dismissed")\n                                    loadInterstitial()\n'''
    addition = '''                                    interstitialAd = null\n                                    dispatch(\n                                        "interstitial-dismissed",\n                                        mapOf(\n                                            "placement" to activeInterstitialPlacement,\n                                            "feature" to activeInterstitialFeature\n                                        )\n                                    )\n                                    activeInterstitialPlacement = ""\n                                    activeInterstitialFeature = ""\n                                    loadInterstitial()\n'''
    if marker not in manager:
        raise SystemExit('Interstitial dismissed context insertion point not found')
    manager = manager.replace(marker, addition, 1)

if '"message" to safeMessage(error.message),\n                                            "placement" to activeInterstitialPlacement' not in manager:
    marker = '''                                    interstitialAd = null\n                                    dispatch(\n                                        "interstitial-failed",\n                                        mapOf(\n                                            "codeName" to error.code.toString(),\n                                            "message" to safeMessage(error.message)\n                                        )\n                                    )\n                                    loadInterstitial()\n'''
    addition = '''                                    interstitialAd = null\n                                    dispatch(\n                                        "interstitial-failed",\n                                        mapOf(\n                                            "codeName" to error.code.toString(),\n                                            "message" to safeMessage(error.message),\n                                            "placement" to activeInterstitialPlacement,\n                                            "feature" to activeInterstitialFeature\n                                        )\n                                    )\n                                    activeInterstitialPlacement = ""\n                                    activeInterstitialFeature = ""\n                                    loadInterstitial()\n'''
    if marker not in manager:
        raise SystemExit('Interstitial failed context insertion point not found')
    manager = manager.replace(marker, addition, 1)

if 'private fun scheduleInterstitialRetry()' not in manager:
    event_at = manager.find('"interstitial-load-failed"')
    if event_at < 0:
        raise SystemExit('Interstitial load-failed block not found')
    status_at = manager.find('    private fun publishStatusWithoutReload() {\n', event_at)
    if status_at < 0:
        raise SystemExit('Interstitial retry scheduler insertion point not found')
    before = manager[:status_at]
    if 'scheduleInterstitialRetry()' not in before[event_at:]:
        publish_marker = '                        publishStatusWithoutReload()\n'
        publish_at = before.rfind(publish_marker, event_at)
        if publish_at < 0:
            raise SystemExit('Interstitial failure publish marker not found')
        before = before[:publish_at] + '                        scheduleInterstitialRetry()\n' + before[publish_at:]
    method = '''    private fun scheduleInterstitialRetry() {\n        if (interstitialRetryScheduled || interstitialAd != null || activity.isFinishing || activity.isDestroyed) return\n        val exponent = interstitialRetryRound.coerceAtMost(3)\n        val delayMs = (INTERSTITIAL_RETRY_BASE_MS * (1L shl exponent)).coerceAtMost(INTERSTITIAL_RETRY_MAX_MS)\n        interstitialRetryRound = (interstitialRetryRound + 1).coerceAtMost(4)\n        interstitialRetryScheduled = true\n        interstitialRetryNotBeforeAt = System.currentTimeMillis() + delayMs\n        dispatch(\n            "interstitial-retrying",\n            mapOf("retryInMs" to delayMs, "retryRound" to interstitialRetryRound)\n        )\n        mainHandler.postDelayed({\n            interstitialRetryScheduled = false\n            interstitialRetryNotBeforeAt = 0L\n            loadInterstitial()\n        }, delayMs)\n    }\n\n'''
    manager = before + method + manager[status_at:]

if '"interstitialRetrying" to interstitialRetryScheduled' not in manager:
    marker = '''                "interstitialReady" to (interstitialAd != null),\n                "rewardPurpose"'''
    addition = '''                "interstitialReady" to (interstitialAd != null),\n                "interstitialRetrying" to interstitialRetryScheduled,\n                "interstitialRetryRound" to interstitialRetryRound,\n                "rewardPurpose"'''
    if marker not in manager:
        raise SystemExit('Interstitial retry status insertion point not found')
    manager = manager.replace(marker, addition, 1)

if 'private fun sanitizePlacement' not in manager:
    marker = '    private fun sanitizePurpose(raw: String?): String {\n'
    addition = '''    private fun sanitizePlacement(raw: String?): String =\n        raw.orEmpty().trim().lowercase().replace(Regex("[^a-z0-9:_-]"), "-").take(80)\n\n    private fun sanitizeFeature(raw: String?): String =\n        raw.orEmpty().trim().lowercase().removePrefix("tab-").replace(Regex("[^a-z0-9:_-]"), "-").take(80)\n\n''' + marker
    if marker not in manager:
        raise SystemExit('Interstitial sanitizer insertion point not found')
    manager = manager.replace(marker, addition, 1)

if 'INTERSTITIAL_ALLOWED_FEATURES = setOf(' not in manager:
    marker = '        const val INTERSTITIAL_COOLDOWN_MS = 3L * 60L * 1000L\n'
    addition = '''        val INTERSTITIAL_ALLOWED_FEATURES = setOf(\n            "tools", "finance", "money", "news", "learn", "travel", "smart", "ai",\n            "entertainment", "browser", "mega-tools", "mega-finance", "mega-calendar",\n            "mega-reminders", "mega-weather", "mega-learning", "mega-pakistan",\n            "mega-shopping", "mega-marketplace", "mega-orders", "mega-teacher",\n            "marketplace", "shopping"\n        )\n\n        const val INTERSTITIAL_COOLDOWN_MS = 3L * 60L * 1000L\n        const val INTERSTITIAL_RETRY_BASE_MS = 15_000L\n        const val INTERSTITIAL_RETRY_MAX_MS = 120_000L\n'''
    if marker not in manager:
        raise SystemExit('Interstitial hardening constants insertion point not found')
    manager = manager.replace(marker, addition, 1)

manager_path.write_text(manager)

required_markers = [
    'gma-next-gen-1.3.0',
    'daily-reward-test',
    'task-watch-ad',
    'TEST_REWARDED_INTERSTITIAL_AD_UNIT_ID',
    'BuildConfig.NEXUS_ADS_TEST_MODE',
    'ServerSideVerificationOptions',
    'pendingRewardUserId',
    'ssvIdentityReady',
    'INTERSTITIAL_ALLOWED_FEATURES',
    'scheduleInterstitialRetry',
    'INTERSTITIAL_RETRY_BASE_MS',
    'mining-start',
    '!miningStartGate && now - lastInterstitialShownAt',
]
missing = [marker for marker in required_markers if marker not in manager]
if missing:
    raise SystemExit('Next-Gen Ad manager verification failed: ' + ', '.join(missing))

print('GMA Next-Gen ad bridge patch applied with consent-gated production, SSV identity, capability handshake and purpose-safe routing.')
