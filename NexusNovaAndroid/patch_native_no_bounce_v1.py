from pathlib import Path

PATH = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
text = PATH.read_text(encoding='utf-8')
MARKER = 'nx-native-no-bounce-v1'

if MARKER not in text:
    # Helper: /nexusnova-native/ is a deterministic APK asset shell served under
    # the trusted github.io origin. It must never be treated like a failed remote
    # document, otherwise the wrapper reloads it and eventually exposes the old
    # emergency/offline mining screen seen in the recorded regression.
    helper_anchor = '    private fun loadProductionApp('
    helper = '''    // nx-native-no-bounce-v1\n    private fun isDeterministicNativeShell(uri: Uri?): Boolean {\n        if (uri == null || !isProductionOrigin(uri)) return false\n        return uri.path.orEmpty().startsWith(NATIVE_SHELL_PATH)\n    }\n\n'''
    at = text.find(helper_anchor)
    if at < 0:
        raise SystemExit('Native no-bounce helper anchor missing')
    text = text[:at] + helper + text[at:]

    old_started = '''                if (!isProductionOrigin(uri) || usingOfflineFallback) return\n                armMainFrameWatchdog(view ?: return)\n'''
    new_started = '''                if (!isProductionOrigin(uri) || usingOfflineFallback) return\n                if (isDeterministicNativeShell(uri)) {\n                    // Local APK shell: no network page watchdog/reload/fallback.\n                    mainFrameWatchdogToken += 1\n                    finishedWatchdogToken = mainFrameWatchdogToken\n                    webRecoveryAttempts = 0\n                    return\n                }\n                armMainFrameWatchdog(view ?: return)\n'''
    if old_started not in text:
        raise SystemExit('Native no-bounce onPageStarted anchor missing')
    text = text.replace(old_started, new_started, 1)

    old_finished = '''                if (!isProductionOrigin(uri) || usingOfflineFallback) return\n                finishedWatchdogToken = mainFrameWatchdogToken\n                if (resetStaleWebShellOnce(target)) return\n                scheduleBlankScreenCheck(target, mainFrameWatchdogToken)\n                scheduleInteractiveShellCheck(target, mainFrameWatchdogToken)\n'''
    new_finished = '''                if (!isProductionOrigin(uri) || usingOfflineFallback) return\n                if (isDeterministicNativeShell(uri)) {\n                    finishedWatchdogToken = mainFrameWatchdogToken\n                    webRecoveryAttempts = 0\n                    return\n                }\n                finishedWatchdogToken = mainFrameWatchdogToken\n                if (resetStaleWebShellOnce(target)) return\n                scheduleBlankScreenCheck(target, mainFrameWatchdogToken)\n                scheduleInteractiveShellCheck(target, mainFrameWatchdogToken)\n'''
    if old_finished not in text:
        raise SystemExit('Native no-bounce onPageFinished anchor missing')
    text = text.replace(old_finished, new_finished, 1)

    old_error = '''                if (!isProductionOrigin(failed.url)) return\n\n                recoverProductionWebView(view, "main-frame network error")\n'''
    new_error = '''                if (!isProductionOrigin(failed.url)) return\n                if (isDeterministicNativeShell(failed.url)) {\n                    android.util.Log.w("NexusNovaWeb", "Ignoring subresource/network error for deterministic native shell")\n                    return\n                }\n\n                recoverProductionWebView(view, "main-frame network error")\n'''
    if old_error not in text:
        raise SystemExit('Native no-bounce network-error anchor missing')
    text = text.replace(old_error, new_error, 1)

    old_http = '''                if (!isProductionOrigin(failed.url)) return\n                recoverProductionWebView(view, "HTTP $status")\n'''
    new_http = '''                if (!isProductionOrigin(failed.url)) return\n                if (isDeterministicNativeShell(failed.url)) {\n                    android.util.Log.w("NexusNovaWeb", "Ignoring HTTP recovery for deterministic native shell: $status")\n                    return\n                }\n                recoverProductionWebView(view, "HTTP $status")\n'''
    if old_http not in text:
        raise SystemExit('Native no-bounce HTTP-error anchor missing')
    text = text.replace(old_http, new_http, 1)

    old_recover = '''    private fun recoverProductionWebView(view: WebView?, reason: String) {\n        if (usingOfflineFallback || isFinishing || isDestroyed) return\n        val target = view ?: webView\n'''
    new_recover = '''    private fun recoverProductionWebView(view: WebView?, reason: String) {\n        if (usingOfflineFallback || isFinishing || isDestroyed) return\n        val target = view ?: webView\n        val currentUri = runCatching { Uri.parse(target.url ?: "") }.getOrNull()\n        if (isDeterministicNativeShell(currentUri)) {\n            // This is packaged HTML/JS/CSS, not a remote page. Firebase/network\n            // readiness is handled inside the web UI without replacing the shell.\n            webRecoveryAttempts = 0\n            android.util.Log.w("NexusNovaWeb", "Suppressed native-shell recovery: $reason")\n            return\n        }\n'''
    if old_recover not in text:
        raise SystemExit('Native no-bounce recovery anchor missing')
    text = text.replace(old_recover, new_recover, 1)

PATH.write_text(text, encoding='utf-8')

required = [
    MARKER,
    'isDeterministicNativeShell(uri)',
    'Suppressed native-shell recovery',
    'Local APK shell: no network page watchdog/reload/fallback.',
]
missing = [token for token in required if token not in text]
if missing:
    raise SystemExit('Native no-bounce verification failed: ' + ', '.join(missing))

print('Deterministic /nexusnova-native/ shell is now protected from reload/fallback bounce and old offline mining exposure.')
