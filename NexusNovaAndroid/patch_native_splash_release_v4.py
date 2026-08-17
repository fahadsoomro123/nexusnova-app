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
    method = '''    private fun scheduleNativeSplashRelease(view: WebView) {\n        val token = mainFrameWatchdogToken\n        fun releaseAfter(delayMs: Long) {\n            view.postDelayed({\n                if (isFinishing || isDestroyed || token != mainFrameWatchdogToken) return@postDelayed\n                val current = runCatching { Uri.parse(view.url ?: "") }.getOrNull() ?: return@postDelayed\n                if (!isTrustedAppPage(current)) return@postDelayed\n                view.evaluateJavascript(NATIVE_SPLASH_RELEASE_SCRIPT, null)\n            }, delayMs)\n        }\n        releaseAfter(2_600L)\n        releaseAfter(4_800L)\n        releaseAfter(8_000L)\n    }\n\n'''
    text = text[:at] + method + text[at:]

if 'const val NATIVE_SPLASH_RELEASE_SCRIPT' not in text:
    anchor = '        const val MAIN_FRAME_LOAD_TIMEOUT_MS = '
    at = text.find(anchor)
    if at < 0:
        raise SystemExit('Native splash v4 constant anchor missing')
    constant = '''        const val NATIVE_SPLASH_RELEASE_SCRIPT = """\n            (function(){\n              try {\n                var s = document.getElementById('nxSplash');\n                if (!s) return true;\n                s.style.setProperty('pointer-events','none','important');\n                s.style.setProperty('opacity','0','important');\n                s.style.setProperty('visibility','hidden','important');\n                s.style.setProperty('display','none','important');\n                s.classList.add('hide');\n                try { s.remove(); } catch (_) {}\n                return !document.getElementById('nxSplash');\n              } catch (_) { return false; }\n            })();\n        """\n'''
    text = text[:at] + constant + text[at:]

required = [
    CALL_MARKER,
    METHOD_MARKER,
    'releaseAfter(2_600L)',
    'releaseAfter(4_800L)',
    'releaseAfter(8_000L)',
    'const val NATIVE_SPLASH_RELEASE_SCRIPT',
    "s.style.setProperty('display','none','important')",
]
missing = [token for token in required if token not in text]
if missing:
    raise SystemExit('Native splash v4 verification missing: ' + ', '.join(missing))

path.write_text(text, encoding='utf-8')
print('Applied native Android splash release v4: WebView itself releases the branded overlay at 2.6s, 4.8s and 8s independent of web timers.')
