from pathlib import Path

path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
text = path.read_text()

# Clear a genuinely stale GitHub Pages service-worker/cache only once per
# recovery epoch. Android remains on the approved /nexusnova-app/ production
# shell; this helper never changes the app URL or substitutes a packaged UI.
if 'private var webShellResetStarted = false' not in text:
    marker = '    private var webRecoveryAttempts = 0\n'
    if marker not in text:
        raise SystemExit('Web shell reset field insertion point not found')
    text = text.replace(marker, marker + '    private var webShellResetStarted = false\n', 1)

old_finished = '''                finishedWatchdogToken = mainFrameWatchdogToken\n                scheduleBlankScreenCheck(target, mainFrameWatchdogToken)\n'''
new_finished = '''                finishedWatchdogToken = mainFrameWatchdogToken\n                if (resetStaleWebShellOnce(target)) return\n                scheduleBlankScreenCheck(target, mainFrameWatchdogToken)\n'''
if new_finished not in text:
    if old_finished not in text:
        raise SystemExit('Web shell reset onPageFinished insertion point not found')
    text = text.replace(old_finished, new_finished, 1)

if 'private fun resetStaleWebShellOnce(view: WebView): Boolean' not in text:
    marker = '    private fun armMainFrameWatchdog(view: WebView) {\n'
    method = '''    private fun resetStaleWebShellOnce(view: WebView): Boolean {\n        if (webShellResetStarted || usingOfflineFallback || isFinishing || isDestroyed) return false\n        val preferences = getSharedPreferences(WEB_SHELL_RECOVERY_PREFERENCES, MODE_PRIVATE)\n        if (preferences.getString(WEB_SHELL_RECOVERY_KEY, "") == WEB_SHELL_RECOVERY_EPOCH) return false\n\n        webShellResetStarted = true\n        preferences.edit().putString(WEB_SHELL_RECOVERY_KEY, WEB_SHELL_RECOVERY_EPOCH).apply()\n        view.clearCache(true)\n        view.evaluateJavascript(WEB_SHELL_RESET_SCRIPT) {\n            view.postDelayed({\n                if (!isFinishing && !isDestroyed && !usingOfflineFallback) {\n                    loadProductionApp(forceFresh = true)\n                }\n            }, WEB_SHELL_RESET_RELOAD_DELAY_MS)\n        }\n        return true\n    }\n\n'''
    if marker not in text:
        raise SystemExit('Web shell reset method insertion point not found')
    text = text.replace(marker, method + marker, 1)

if 'const val WEB_SHELL_RECOVERY_EPOCH = "approved-live-dashboard-v1"' not in text:
    marker = '        const val MAIN_FRAME_LOAD_TIMEOUT_MS = 12_000L\n'
    constants = '''        const val WEB_SHELL_RECOVERY_PREFERENCES = "web_shell_recovery"\n        const val WEB_SHELL_RECOVERY_KEY = "epoch"\n        const val WEB_SHELL_RECOVERY_EPOCH = "approved-live-dashboard-v1"\n        const val WEB_SHELL_RESET_RELOAD_DELAY_MS = 900L\n        const val WEB_SHELL_RESET_SCRIPT = """\n            (function(){\n              try {\n                var jobs = [];\n                if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {\n                  jobs.push(navigator.serviceWorker.getRegistrations().then(function(regs){\n                    return Promise.all(regs.map(function(reg){ return reg.unregister(); }));\n                  }));\n                }\n                if (window.caches && caches.keys) {\n                  jobs.push(caches.keys().then(function(keys){\n                    return Promise.all(keys.map(function(key){ return caches.delete(key); }));\n                  }));\n                }\n                Promise.allSettled(jobs).catch(function(){});\n                return true;\n              } catch (_) {\n                return false;\n              }\n            })();\n        """\n\n'''
    if marker not in text:
        raise SystemExit('Web shell reset constant insertion point not found')
    text = text.replace(marker, constants + marker, 1)

path.write_text(text)
print('One-time stale-cache reset retained for approved live /nexusnova-app/ shell without synthetic native-shell routing.')
