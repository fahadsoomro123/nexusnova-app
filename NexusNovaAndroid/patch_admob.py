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

# Preserve the reward purpose coming from the web layer. Daily Reward and
# Mining Boost share one native ad owner, but their callbacks must never be
# mislabeled or consumed by the wrong feature.
if 'ACTION_SHOW_REWARDED_AD -> adManager.showRewarded(' not in text:
    old = '''            ACTION_REQUEST_CALLER_ROLE -> requestCallerRole()\n\n            ACTION_OPEN_EXTERNAL -> {'''
    new = '''            ACTION_REQUEST_CALLER_ROLE -> requestCallerRole()\n\n            ACTION_SHOW_REWARDED_AD -> adManager.showRewarded(\n                rewardPurpose = message.optString("rewardPurpose").trim(),\n                testOnly = message.optBoolean("testOnly", false)\n            )\n            ACTION_SHOW_INTERSTITIAL_AD -> adManager.showInterstitial()\n            ACTION_AD_STATUS -> adManager.publishStatus()\n\n            ACTION_OPEN_EXTERNAL -> {'''
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
manager_path.write_text(manager)

required_markers = [
    'gma-next-gen-1.3.0',
    'daily-reward-test',
    'TEST_REWARDED_INTERSTITIAL_AD_UNIT_ID',
    'BuildConfig.NEXUS_ADS_TEST_MODE',
]
missing = [marker for marker in required_markers if marker not in manager]
if missing:
    raise SystemExit('Next-Gen Ad manager verification failed: ' + ', '.join(missing))

print('GMA Next-Gen ad bridge patch applied with consent-gated production and purpose-safe routing.')
