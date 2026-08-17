from pathlib import Path

main_path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
manager_path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NexusAdManager.kt')
main = main_path.read_text(encoding='utf-8')
manager = manager_path.read_text(encoding='utf-8')

# Keep the user-approved production GitHub Pages UI as the Android top-level
# shell. Do not rewrite it to a synthetic /nexusnova-native/ path or intercept
# production requests from packaged assets: that makes the APK drift from the
# approved dashboard and can trigger reload recovery over a rendered screen.
for forbidden in [
    'NATIVE_SHELL_PATH = "/nexusnova-native/"',
    'private fun interceptNativeShell(uri: Uri): WebResourceResponse?',
    'private fun scheduleInteractiveShellCheck',
]:
    if forbidden in main:
        raise SystemExit('Synthetic native-shell code already present before restore patch: ' + forbidden)

# Recovery/reload paths should return to the correct same-device screen. The
# Firebase dashboard remains the real auth gate; PhonebookStore is only a local
# hint that lets Android try page2 first instead of flashing the login page.
old_recovery = '                    loadProductionApp(forceFresh = true)\n'
new_recovery = '                    loadProductionApp(startUrl = if (PhonebookStore.hasActiveAccount()) PRODUCTION_DASHBOARD_URL else PRODUCTION_APP_URL, forceFresh = true)\n'
if old_recovery in main:
    main = main.replace(old_recovery, new_recovery)

# Let the approved dashboard become interactive before starting Google Mobile
# Ads work. Explicit rewarded/interstitial actions can still initialize on
# demand, but startup status polling must not compete with first render.
old_ad_block = '''        if (BuildConfig.NEXUS_ADS_TEST_MODE) {\n            // Debug/development APKs always use Google's test inventory.\n            adManager.initialize()\n        } else {\n            // Release APKs cannot initialize/request production ads until UMP\n            // has refreshed consent state and says ad requests are allowed.\n            adConsentManager.gather { canRequestAds ->\n                if (canRequestAds) adManager.initialize()\n                publishAdPrivacyStatus()\n            }\n        }\n'''
new_ad_block = '''        scheduleNativeAdInitialization()\n'''
if new_ad_block not in main:
    if old_ad_block not in main:
        raise SystemExit('Deferred ad initialization block not found')
    main = main.replace(old_ad_block, new_ad_block, 1)

if 'private fun scheduleNativeAdInitialization()' not in main:
    marker = '    private fun loadProductionApp('
    method = '''    private fun scheduleNativeAdInitialization() {\n        webView.postDelayed({\n            if (isFinishing || isDestroyed || !::adManager.isInitialized || !::adConsentManager.isInitialized) return@postDelayed\n            if (BuildConfig.NEXUS_ADS_TEST_MODE) {\n                adManager.initialize()\n            } else {\n                adConsentManager.gather { canRequestAds ->\n                    if (canRequestAds) adManager.initialize()\n                    publishAdPrivacyStatus()\n                }\n            }\n        }, NATIVE_AD_INIT_DELAY_MS)\n    }\n\n'''
    at = main.find(marker)
    if at < 0:
        raise SystemExit('Deferred ad initialization insertion point not found')
    main = main[:at] + method + main[at:]

# Several web modules ask for ad status during startup. A status request should
# report state only; it must not eagerly initialize/preload all ad formats.
old_status = '''    fun publishStatus() {\n        mainHandler.post {\n            if (!initialized) initialize()\n            if (initialized) ensureAdsLoaded()\n            publishStatusWithoutReload()\n        }\n    }\n'''
new_status = '''    fun publishStatus() {\n        mainHandler.post {\n            publishStatusWithoutReload()\n        }\n    }\n'''
if new_status not in manager:
    if old_status not in manager:
        raise SystemExit('Ad status polling block not found')
    manager = manager.replace(old_status, new_status, 1)

# Stagger initial full-screen ad requests rather than hitting WebView/main
# looper with several formats at the same moment.
old_ensure = '''    private fun ensureAdsLoaded() {\n        ensureRewardedLoaded()\n        loadInterstitial()\n    }\n\n    private fun ensureRewardedLoaded() {\n        loadPrimaryRewarded()\n        if (TEST_MODE) loadFallbackRewarded()\n    }\n'''
new_ensure = '''    private fun ensureAdsLoaded() {\n        ensureRewardedLoaded()\n        mainHandler.postDelayed({ loadInterstitial() }, INTERSTITIAL_STARTUP_STAGGER_MS)\n    }\n\n    private fun ensureRewardedLoaded() {\n        loadPrimaryRewarded()\n        if (TEST_MODE) mainHandler.postDelayed({ loadFallbackRewarded() }, REWARDED_FALLBACK_STAGGER_MS)\n    }\n'''
if new_ensure not in manager:
    if old_ensure not in manager:
        raise SystemExit('Ad preload staggering insertion point not found')
    manager = manager.replace(old_ensure, new_ensure, 1)

if 'const val NATIVE_AD_INIT_DELAY_MS' not in main:
    marker = '        const val MAIN_FRAME_LOAD_TIMEOUT_MS = 12_000L\n'
    if marker not in main:
        raise SystemExit('Native ad delay constant insertion point not found')
    main = main.replace(marker, '        const val NATIVE_AD_INIT_DELAY_MS = 4_500L\n' + marker, 1)

if 'const val INTERSTITIAL_STARTUP_STAGGER_MS' not in manager:
    marker = '        const val INTERSTITIAL_COOLDOWN_MS = 3L * 60L * 1000L\n'
    constants = '''        const val REWARDED_FALLBACK_STAGGER_MS = 650L\n        const val INTERSTITIAL_STARTUP_STAGGER_MS = 1_250L\n'''
    if marker not in manager:
        raise SystemExit('Ad stagger constant insertion point not found')
    manager = manager.replace(marker, constants + marker, 1)

main_path.write_text(main, encoding='utf-8')
manager_path.write_text(manager, encoding='utf-8')

required_main = [
    'PRODUCTION_PATH = "/nexusnova-app/"',
    'PRODUCTION_APP_URL = "https://fahadsoomro123.github.io/nexusnova-app/"',
    'PRODUCTION_DASHBOARD_URL = "https://fahadsoomro123.github.io/nexusnova-app/page2.html"',
    'scheduleNativeAdInitialization()',
    'PhonebookStore.hasActiveAccount()',
]
required_manager = [
    'REWARDED_FALLBACK_STAGGER_MS',
    'INTERSTITIAL_STARTUP_STAGGER_MS',
    'fun publishStatus()',
]
missing = [item for item in required_main if item not in main] + [item for item in required_manager if item not in manager]
if missing:
    raise SystemExit('Approved-dashboard restore verification failed: ' + ', '.join(missing))

for forbidden in [
    'nexusnova-native',
    'NATIVE_SHELL_PATH',
    'interceptNativeShell',
    'scheduleInteractiveShellCheck',
    'INTERACTIVE_SHELL_PROBE',
]:
    if forbidden in main:
        raise SystemExit('Forbidden synthetic native-shell marker survived restore: ' + forbidden)

print('Preserved approved live GitHub Pages dashboard, same-device recovery, and deferred/staggered AdMob startup without synthetic native-shell interception.')
