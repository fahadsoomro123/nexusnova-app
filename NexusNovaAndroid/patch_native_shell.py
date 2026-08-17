from pathlib import Path

main_path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
manager_path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NexusAdManager.kt')
page_path = Path('NexusNovaAndroid/app/src/main/assets/www/page2.html')
main = main_path.read_text(encoding='utf-8')
manager = manager_path.read_text(encoding='utf-8')
page = page_path.read_text(encoding='utf-8')

# 0) The visual splash must never depend on window.load. On a real phone a
# remote Firebase/CDN request can keep load pending long after the local shell
# is already rendered. The root page's splash script sits immediately after
# #nxSplash, so this unconditional timer always has a real element to release.
splash_marker = 'nx-android-splash-hard-failsafe-v1'
if splash_marker not in page:
    old_splash = '''  var minMs = 2800;\n  var start = Date.now();\n'''
    new_splash = '''  var minMs = 2800;\n  var start = Date.now();\n  // nx-android-splash-hard-failsafe-v1\n  // Do not wait forever for window.load when optional remote services are slow.\n  setTimeout(hide, 3600);\n'''
    if old_splash not in page:
        raise SystemExit('Android splash failsafe insertion point not found')
    page = page.replace(old_splash, new_splash, 1)

# 1) Serve the Android web shell from APK assets while retaining the trusted
# github.io document origin. This removes GitHub/network/service-worker shell
# latency from the native app without changing Firebase's configured origin.
old_intercept = '''                return assetLoader.shouldInterceptRequest(uri)\n                    ?: super.shouldInterceptRequest(view, request)\n'''
new_intercept = '''                return interceptNativeShell(uri)\n                    ?: assetLoader.shouldInterceptRequest(uri)\n                    ?: super.shouldInterceptRequest(view, request)\n'''
if new_intercept not in main:
    if old_intercept not in main:
        raise SystemExit('Native shell request-intercept insertion point not found')
    main = main.replace(old_intercept, new_intercept, 1)

if 'private fun interceptNativeShell(uri: Uri): WebResourceResponse?' not in main:
    marker = '    private fun loadProductionApp('
    method = '''    private fun interceptNativeShell(uri: Uri): WebResourceResponse? {\n        if (!isProductionOrigin(uri)) return null\n        val path = uri.path ?: return null\n        if (!path.startsWith(NATIVE_SHELL_PATH)) return null\n\n        var relative = path.removePrefix(NATIVE_SHELL_PATH)\n        if (relative.isBlank() || relative.endsWith("/")) relative += "index.html"\n        relative = relative.trimStart('/')\n        if (relative.isBlank() || relative.contains("..") || relative.contains('\\\\')) return null\n\n        val stream = try {\n            assets.open("www/$relative")\n        } catch (_: Exception) {\n            return null\n        }\n\n        val extension = relative.substringAfterLast('.', "").lowercase(Locale.ROOT)\n        val mime = when (extension) {\n            "html", "htm" -> "text/html"\n            "js", "mjs" -> "application/javascript"\n            "css" -> "text/css"\n            "json", "webmanifest" -> "application/json"\n            "svg" -> "image/svg+xml"\n            "png" -> "image/png"\n            "jpg", "jpeg" -> "image/jpeg"\n            "gif" -> "image/gif"\n            "webp" -> "image/webp"\n            "txt" -> "text/plain"\n            else -> "application/octet-stream"\n        }\n        val encoding = if (mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") || mime.contains("svg")) "UTF-8" else null\n        return WebResourceResponse(mime, encoding, stream).apply {\n            responseHeaders = mapOf(\n                "Cache-Control" to "no-store, max-age=0",\n                "X-Content-Type-Options" to "nosniff"\n            )\n        }\n    }\n\n'''
    at = main.find(marker)
    if at < 0:
        raise SystemExit('Native shell interceptor method insertion point not found')
    main = main[:at] + method + main[at:]

# 2) Use a synthetic path outside the old /nexusnova-app/ service-worker scope.
# Requests stay on fahadsoomro123.github.io for Firebase/Auth/App Check origin
# consistency, but WebView serves them directly from APK assets.
main = main.replace(
    'const val PRODUCTION_APP_URL = "https://fahadsoomro123.github.io/nexusnova-app/"',
    'const val PRODUCTION_APP_URL = "https://fahadsoomro123.github.io/nexusnova-native/index.html?nxAndroid=1"',
    1,
)
main = main.replace(
    'const val PRODUCTION_DASHBOARD_URL = "https://fahadsoomro123.github.io/nexusnova-app/page2.html"',
    'const val PRODUCTION_DASHBOARD_URL = "https://fahadsoomro123.github.io/nexusnova-native/page2.html?nxAndroid=1"',
    1,
)
if 'const val NATIVE_SHELL_PATH = "/nexusnova-native/"' not in main:
    marker = '        const val PRODUCTION_PATH = "/nexusnova-app/"\n'
    if marker not in main:
        raise SystemExit('Native shell trusted-path constant insertion point not found')
    main = main.replace(marker, marker + '        const val NATIVE_SHELL_PATH = "/nexusnova-native/"\n', 1)

old_trust = '        isProductionOrigin(uri) -> uri.path?.startsWith(PRODUCTION_PATH) == true\n'
new_trust = '''        isProductionOrigin(uri) -> {\n            val path = uri.path.orEmpty()\n            path.startsWith(PRODUCTION_PATH) || path.startsWith(NATIVE_SHELL_PATH)\n        }\n'''
if new_trust not in main:
    if old_trust not in main:
        raise SystemExit('Native shell trusted-page insertion point not found')
    main = main.replace(old_trust, new_trust, 1)

# 3) A rendered page is not enough: v76/v78 proved that. The native watchdog now
# checks the actual dashboard interaction contract before calling startup healthy.
old_finished = '''                finishedWatchdogToken = mainFrameWatchdogToken\n                if (resetStaleWebShellOnce(target)) return\n                scheduleBlankScreenCheck(target, mainFrameWatchdogToken)\n'''
new_finished = '''                finishedWatchdogToken = mainFrameWatchdogToken\n                if (resetStaleWebShellOnce(target)) return\n                scheduleBlankScreenCheck(target, mainFrameWatchdogToken)\n                scheduleInteractiveShellCheck(target, mainFrameWatchdogToken)\n'''
if new_finished not in main:
    if old_finished not in main:
        raise SystemExit('Interactive shell watchdog onPageFinished insertion point not found')
    main = main.replace(old_finished, new_finished, 1)

if 'private fun scheduleInteractiveShellCheck' not in main:
    marker = '    private fun recoverProductionWebView('
    method = '''    private fun scheduleInteractiveShellCheck(view: WebView, token: Int) {\n        val current = runCatching { Uri.parse(view.url ?: "") }.getOrNull() ?: return\n        if (!isProductionOrigin(current) || !current.path.orEmpty().startsWith(NATIVE_SHELL_PATH)) return\n        if (!current.path.orEmpty().endsWith("page2.html")) return\n\n        view.postDelayed({\n            if (isFinishing || isDestroyed || usingOfflineFallback) return@postDelayed\n            if (token != mainFrameWatchdogToken || finishedWatchdogToken != token) return@postDelayed\n            view.evaluateJavascript(INTERACTIVE_SHELL_PROBE) { result ->\n                if (token != mainFrameWatchdogToken || usingOfflineFallback) return@evaluateJavascript\n                if (result == "true") return@evaluateJavascript\n                recoverProductionWebView(view, "dashboard interaction contract not ready")\n            }\n        }, INTERACTIVE_SHELL_GRACE_MS)\n    }\n\n'''
    at = main.find(marker)
    if at < 0:
        raise SystemExit('Interactive shell watchdog method insertion point not found')
    main = main[:at] + method + main[at:]

# Recovery should return to the correct same-device screen instead of always
# falling back to the login document.
main = main.replace(
    '                    loadProductionApp(forceFresh = true)\n',
    '                    loadProductionApp(startUrl = if (PhonebookStore.hasActiveAccount()) PRODUCTION_DASHBOARD_URL else PRODUCTION_APP_URL, forceFresh = true)\n',
)
if 'const val LOCAL_DASHBOARD_URL' not in main:
    marker = '        const val LOCAL_APP_URL = "https://appassets.androidplatform.net/assets/www/index.html"\n'
    if marker not in main:
        raise SystemExit('Local dashboard constant insertion point not found')
    main = main.replace(marker, marker + '        const val LOCAL_DASHBOARD_URL = "https://appassets.androidplatform.net/assets/www/page2.html"\n', 1)
main = main.replace(
    '        target.loadUrl(LOCAL_APP_URL)\n',
    '        target.loadUrl(if (PhonebookStore.hasActiveAccount()) LOCAL_DASHBOARD_URL else LOCAL_APP_URL)\n',
    1,
)

# 4) Let WebView become interactive before starting the native ad workload.
# Explicit rewarded/interstitial user actions can still initialize on demand.
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
        raise SystemExit('Deferred ad init method insertion point not found')
    main = main[:at] + method + main[at:]

# Status polling from several web modules must not defeat the startup delay.
old_status = '''    fun publishStatus() {\n        mainHandler.post {\n            if (!initialized) initialize()\n            if (initialized) ensureAdsLoaded()\n            publishStatusWithoutReload()\n        }\n    }\n'''
new_status = '''    fun publishStatus() {\n        mainHandler.post {\n            publishStatusWithoutReload()\n        }\n    }\n'''
if new_status not in manager:
    if old_status not in manager:
        raise SystemExit('Ad status polling block not found')
    manager = manager.replace(old_status, new_status, 1)

# Spread the three debug preload calls slightly on low-end devices instead of
# hitting WebView/main looper with three ad formats at the same instant.
old_ensure = '''    private fun ensureAdsLoaded() {\n        ensureRewardedLoaded()\n        loadInterstitial()\n    }\n\n    private fun ensureRewardedLoaded() {\n        loadPrimaryRewarded()\n        if (TEST_MODE) loadFallbackRewarded()\n    }\n'''
new_ensure = '''    private fun ensureAdsLoaded() {\n        ensureRewardedLoaded()\n        mainHandler.postDelayed({ loadInterstitial() }, INTERSTITIAL_STARTUP_STAGGER_MS)\n    }\n\n    private fun ensureRewardedLoaded() {\n        loadPrimaryRewarded()\n        if (TEST_MODE) mainHandler.postDelayed({ loadFallbackRewarded() }, REWARDED_FALLBACK_STAGGER_MS)\n    }\n'''
if new_ensure not in manager:
    if old_ensure not in manager:
        raise SystemExit('Ad preload staggering insertion point not found')
    manager = manager.replace(old_ensure, new_ensure, 1)

if 'const val NATIVE_AD_INIT_DELAY_MS' not in main:
    marker = '        const val MAIN_FRAME_LOAD_TIMEOUT_MS = 12_000L\n'
    constants = '''        const val NATIVE_AD_INIT_DELAY_MS = 4_500L\n        const val INTERACTIVE_SHELL_GRACE_MS = 5_500L\n        const val INTERACTIVE_SHELL_PROBE = """\n            (function(){\n              try {\n                var dock = document.querySelector('.bottom-dock');\n                var wallet = document.querySelector('.bottom-dock .dock-item:nth-child(2)');\n                var more = document.getElementById('moreBtn');\n                var splash = document.getElementById('nxSplash');\n                var splashBlocking = false;\n                if (splash) {\n                  var ss = getComputedStyle(splash);\n                  splashBlocking = ss.pointerEvents !== 'none' && ss.visibility !== 'hidden' && Number(ss.opacity || 1) > 0;\n                }\n                return window.__nexusInteractiveReady === true &&\n                  typeof window.switchTab === 'function' &&\n                  typeof window.toggleMore === 'function' &&\n                  !!dock && !!wallet && !!more && !splashBlocking;\n              } catch (_) { return false; }\n            })();\n        """\n'''
    if marker not in main:
        raise SystemExit('Native startup constant insertion point not found')
    main = main.replace(marker, constants + marker, 1)

if 'const val INTERSTITIAL_STARTUP_STAGGER_MS' not in manager:
    marker = '        const val INTERSTITIAL_COOLDOWN_MS = 3L * 60L * 1000L\n'
    constants = '''        const val REWARDED_FALLBACK_STAGGER_MS = 650L\n        const val INTERSTITIAL_STARTUP_STAGGER_MS = 1_250L\n'''
    if marker not in manager:
        raise SystemExit('Ad stagger constant insertion point not found')
    manager = manager.replace(marker, constants + marker, 1)

page_path.write_text(page, encoding='utf-8')
main_path.write_text(main, encoding='utf-8')
manager_path.write_text(manager, encoding='utf-8')

required_main = [
    'interceptNativeShell(uri)',
    'NATIVE_SHELL_PATH = "/nexusnova-native/"',
    'nexusnova-native/page2.html?nxAndroid=1',
    'scheduleInteractiveShellCheck',
    'INTERACTIVE_SHELL_PROBE',
    'scheduleNativeAdInitialization()',
]
required_manager = [
    'REWARDED_FALLBACK_STAGGER_MS',
    'INTERSTITIAL_STARTUP_STAGGER_MS',
    'fun publishStatus()',
]
missing = [x for x in required_main if x not in main] + [x for x in required_manager if x not in manager]
if splash_marker not in page:
    missing.append(splash_marker)
if missing:
    raise SystemExit('Native shell stabilization verification failed: ' + ', '.join(missing))

print('Applied deterministic native shell, hard splash release, interaction watchdog, and staggered Android ad startup.')