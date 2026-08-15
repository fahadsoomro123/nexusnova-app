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
    new = '''            ACTION_REQUEST_CALLER_ROLE -> requestCallerRole()\n\n            ACTION_SHOW_REWARDED_AD -> adManager.showRewarded(\n                rewardPurpose = message.optString("rewardPurpose").trim(),\n                testOnly = message.optBoolean("testOnly", false),\n                userId = message.optString("userId").trim()\n            )\n            ACTION_SHOW_INTERSTITIAL_AD -> adManager.showInterstitial()\n            ACTION_AD_STATUS -> adManager.publishStatus()\n\n            ACTION_OPEN_EXTERNAL -> {'''
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

manager_path.write_text(manager)

required_markers = [
    'gma-next-gen-1.3.0',
    'daily-reward-test',
    'task-watch-ad',
    'TEST_REWARDED_INTERSTITIAL_AD_UNIT_ID',
    'BuildConfig.NEXUS_ADS_TEST_MODE',
    'ServerSideVerificationOptions',
    'pendingRewardUserId',
]
missing = [marker for marker in required_markers if marker not in manager]
if missing:
    raise SystemExit('Next-Gen Ad manager verification failed: ' + ', '.join(missing))

print('GMA Next-Gen ad bridge patch applied with consent-gated production, SSV identity and purpose-safe routing.')
