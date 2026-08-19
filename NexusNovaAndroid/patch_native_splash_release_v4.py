from pathlib import Path

path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
text = path.read_text(encoding='utf-8')

CALL_MARKER = 'scheduleNativeSplashRelease(target) // nx-native-splash-release-v4'
if CALL_MARKER not in text:
    old = '''                armMainFrameWatchdog(view ?: return)\n'''
    new = '''                val target = view ?: return\n                armMainFrameWatchdog(target)\n                scheduleNativeSplashRelease(target) // nx-native-splash-release-v4\n'''
    if old not in text:
        raise SystemExit('Native splash v4 onPageStarted anchor missing')
    text = text.replace(old, new, 1)

METHOD_MARKER = 'private fun scheduleNativeSplashRelease(view: WebView)'
if METHOD_MARKER not in text:
    anchor = '    private fun loadProductionApp('
    at = text.find(anchor)
    if at < 0:
        raise SystemExit('Native splash v4 method anchor missing')
    method = '''    private fun scheduleNativeSplashRelease(view: WebView) {\n        val token = mainFrameWatchdogToken\n        fun primeAfter(delayMs: Long) {\n            view.postDelayed({\n                if (isFinishing || isDestroyed || token != mainFrameWatchdogToken) return@postDelayed\n                val current = runCatching { Uri.parse(view.url ?: "") }.getOrNull() ?: return@postDelayed\n                if (!isTrustedAppPage(current)) return@postDelayed\n                view.evaluateJavascript(NATIVE_SPLASH_PRIME_SCRIPT, null)\n            }, delayMs)\n        }\n        fun releaseAfter(delayMs: Long) {\n            view.postDelayed({\n                if (isFinishing || isDestroyed || token != mainFrameWatchdogToken) return@postDelayed\n                val current = runCatching { Uri.parse(view.url ?: "") }.getOrNull() ?: return@postDelayed\n                if (!isTrustedAppPage(current)) return@postDelayed\n                view.evaluateJavascript(NATIVE_SPLASH_RELEASE_SCRIPT, null)\n            }, delayMs)\n        }\n        // Prime only the existing HTML splash; never create a second shield.\n        primeAfter(180L)\n        primeAfter(520L)\n        // Independent hard releases prevent any network/Auth stall trapping UI.\n        releaseAfter(2_600L)\n        releaseAfter(4_800L)\n        releaseAfter(8_000L)\n    }\n\n'''
    text = text[:at] + method + text[at:]

# Existing MainActivity trees can already contain the older v4 method. Upgrade
# that one method in place; never add a second splash owner.
if 'primeAfter(180L)' not in text:
    old_method = '''    private fun scheduleNativeSplashRelease(view: WebView) {\n        val token = mainFrameWatchdogToken\n        fun releaseAfter(delayMs: Long) {\n            view.postDelayed({\n                if (isFinishing || isDestroyed || token != mainFrameWatchdogToken) return@postDelayed\n                val current = runCatching { Uri.parse(view.url ?: "") }.getOrNull() ?: return@postDelayed\n                if (!isTrustedAppPage(current)) return@postDelayed\n                view.evaluateJavascript(NATIVE_SPLASH_RELEASE_SCRIPT, null)\n            }, delayMs)\n        }\n        releaseAfter(2_600L)\n        releaseAfter(4_800L)\n        releaseAfter(8_000L)\n    }\n'''
    new_method = '''    private fun scheduleNativeSplashRelease(view: WebView) {\n        val token = mainFrameWatchdogToken\n        fun primeAfter(delayMs: Long) {\n            view.postDelayed({\n                if (isFinishing || isDestroyed || token != mainFrameWatchdogToken) return@postDelayed\n                val current = runCatching { Uri.parse(view.url ?: "") }.getOrNull() ?: return@postDelayed\n                if (!isTrustedAppPage(current)) return@postDelayed\n                view.evaluateJavascript(NATIVE_SPLASH_PRIME_SCRIPT, null)\n            }, delayMs)\n        }\n        fun releaseAfter(delayMs: Long) {\n            view.postDelayed({\n                if (isFinishing || isDestroyed || token != mainFrameWatchdogToken) return@postDelayed\n                val current = runCatching { Uri.parse(view.url ?: "") }.getOrNull() ?: return@postDelayed\n                if (!isTrustedAppPage(current)) return@postDelayed\n                view.evaluateJavascript(NATIVE_SPLASH_RELEASE_SCRIPT, null)\n            }, delayMs)\n        }\n        primeAfter(180L)\n        primeAfter(520L)\n        releaseAfter(2_600L)\n        releaseAfter(4_800L)\n        releaseAfter(8_000L)\n    }\n'''
    if old_method not in text:
        raise SystemExit('Native splash v4 existing method upgrade anchor missing')
    text = text.replace(old_method, new_method, 1)

# Insert release first. Prime intentionally anchors before release, so the patch
# also works on a pristine MainActivity where neither constant exists yet.
if 'const val NATIVE_SPLASH_RELEASE_SCRIPT' not in text:
    anchor = '        const val MAIN_FRAME_LOAD_TIMEOUT_MS = '
    at = text.find(anchor)
    if at < 0:
        raise SystemExit('Native splash v4 constant anchor missing')
    constant = '''        const val NATIVE_SPLASH_RELEASE_SCRIPT = """\n            (function(){\n              try {\n                var s = document.getElementById('nxSplash');\n                if (!s) return true;\n                s.style.setProperty('pointer-events','none','important');\n                s.style.setProperty('opacity','0','important');\n                s.style.setProperty('visibility','hidden','important');\n                s.style.setProperty('display','none','important');\n                s.classList.add('hide');\n                try { s.remove(); } catch (_) {}\n                return !document.getElementById('nxSplash');\n              } catch (_) { return false; }\n            })();\n        """\n'''
    text = text[:at] + constant + text[at:]

if 'const val NATIVE_SPLASH_PRIME_SCRIPT' not in text:
    anchor = '        const val NATIVE_SPLASH_RELEASE_SCRIPT = '
    at = text.find(anchor)
    if at < 0:
        raise SystemExit('Native splash prime constant anchor missing')
    constant = '''        const val NATIVE_SPLASH_PRIME_SCRIPT = """\n            (function(){\n              try {\n                var s = document.getElementById('nxSplash');\n                if (!s) return false;\n                s.classList.remove('hide');\n                s.style.setProperty('pointer-events','none','important');\n                s.style.removeProperty('display');\n                s.style.setProperty('visibility','visible','important');\n                s.style.setProperty('opacity','1','important');\n                return true;\n              } catch (_) { return false; }\n            })();\n        """\n\n'''
    text = text[:at] + constant + text[at:]

required = [
    CALL_MARKER,
    METHOD_MARKER,
    'primeAfter(180L)',
    'primeAfter(520L)',
    'releaseAfter(2_600L)',
    'releaseAfter(4_800L)',
    'releaseAfter(8_000L)',
    'const val NATIVE_SPLASH_PRIME_SCRIPT',
    'const val NATIVE_SPLASH_RELEASE_SCRIPT',
    "s.style.setProperty('pointer-events','none','important')",
    "s.style.setProperty('display','none','important')",
]
missing = [token for token in required if token not in text]
if missing:
    raise SystemExit('Native splash v4 verification missing: ' + ', '.join(missing))

path.write_text(text, encoding='utf-8')
print('Applied native branded splash safety: existing HTML splash is primed, touch-safe, and hard-released at bounded times.')
