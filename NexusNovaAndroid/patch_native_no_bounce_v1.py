from pathlib import Path

PATH = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
text = PATH.read_text(encoding='utf-8')
MARKER = 'nx-native-no-bounce-v1'

# The synthetic /nexusnova-native/ document is served from APK assets by
# interceptNativeShell(). It is deterministic local content under the trusted
# github.io origin. Network/Firebase delays must therefore never replace it with
# the old emergency appassets shell.
if MARKER not in text:
    recover_at = text.find('    private fun recoverProductionWebView(')
    if recover_at < 0:
        raise SystemExit('recoverProductionWebView not found')

    target_needle = '        val target = view ?: webView\n'
    target_at = text.find(target_needle, recover_at)
    if target_at < 0:
        raise SystemExit('Recovery target line not found')

    insert_at = target_at + len(target_needle)
    guard = '''        // nx-native-no-bounce-v1\n        val currentPath = runCatching { Uri.parse(target.url ?: "").path.orEmpty() }.getOrDefault("")\n        if (currentPath.startsWith(NATIVE_SHELL_PATH)) {\n            webRecoveryAttempts = 0\n            android.util.Log.w("NexusNovaWeb", "Suppressed native-shell recovery: $reason")\n            return\n        }\n'''
    text = text[:insert_at] + guard + text[insert_at:]

PATH.write_text(text, encoding='utf-8')

required = [
    MARKER,
    'currentPath.startsWith(NATIVE_SHELL_PATH)',
    'Suppressed native-shell recovery',
    'interceptNativeShell',
    'NATIVE_SHELL_PATH = "/nexusnova-native/"',
]
missing = [token for token in required if token not in text]
if missing:
    raise SystemExit('Native no-bounce verification failed: ' + ', '.join(missing))

print('Native shell recovery suppression applied: deterministic APK shell will not reload/fallback to the old offline mining UI.')
