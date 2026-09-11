from pathlib import Path
import sys

ROOT = Path('.')
errors = []
warnings = []


def read(path):
    p = ROOT / path
    if not p.exists():
        errors.append(f'missing required file: {path}')
        return ''
    return p.read_text(encoding='utf-8')


manifest = read('NexusNovaAndroid/app/src/main/AndroidManifest.xml')
main = read('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
browser = read('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/BrowserActivity.kt')
phonebook = read('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/PhonebookStore.kt')

# Current manifest contract. Caller-screening activities/services belonged to an
# older Android composition and must not be required by this readiness guard.
for marker in [
    'android:allowBackup="false"',
    'android:usesCleartextTraffic="false"',
    'android:name=".BrowserActivity"',
    'android:exported="false"',
]:
    if marker not in manifest:
        errors.append(f'Android manifest security marker missing: {marker}')

# Main app WebView owns native bridges, so its local/remote boundary must stay tight.
for marker in [
    'settings.allowFileAccess = false',
    'settings.allowContentAccess = false',
    'settings.allowFileAccessFromFileURLs = false',
    'settings.allowUniversalAccessFromFileURLs = false',
    'settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW',
    'settings.safeBrowsingEnabled = true',
    'WebViewFeature.WEB_MESSAGE_LISTENER',
    'if (isMainFrame && isTrustedOrigin(sourceOrigin))',
    'WebViewCompat.addWebMessageListener',
    'const val PRODUCTION_HOST = "fahadsoomro123.github.io"',
    'const val PRODUCTION_PATH = "/nexusnova-app/"',
    'const val MAX_BRIDGE_MESSAGE_CHARS = 8_192',
]:
    if marker not in main:
        errors.append(f'Main WebView security marker missing: {marker}')

if 'addJavascriptInterface' in main:
    errors.append('Legacy addJavascriptInterface bridge detected in MainActivity')
if 'uri.port == -1 || uri.port == 443' not in main:
    errors.append('Trusted WebView origins are not pinned to HTTPS default port')
if 'payload.length > MAX_BRIDGE_MESSAGE_CHARS' not in main:
    errors.append('Native bridge payload is no longer bounded before JSON parsing')

# Dedicated browser intentionally has no NexusNova native bridge and accepts HTTPS pages only.
for marker in [
    'settings.allowFileAccess = false',
    'settings.allowContentAccess = false',
    'settings.allowFileAccessFromFileURLs = false',
    'settings.allowUniversalAccessFromFileURLs = false',
    'settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW',
    'settings.javaScriptCanOpenWindowsAutomatically = false',
    'settings.setSupportMultipleWindows(false)',
    'settings.safeBrowsingEnabled = true',
    'private fun isAllowedWebUri(uri: Uri): Boolean = uri.scheme.equals("https", ignoreCase = true)',
    'text.startsWith("javascript:", true)',
    'text.startsWith("data:", true)',
    'text.startsWith("file:", true)',
    'text.startsWith("content:", true)',
    'text.startsWith("intent:", true)',
    'text.startsWith("blob:", true)',
]:
    if marker not in browser:
        errors.append(f'Browser WebView security marker missing: {marker}')

if 'addJavascriptInterface' in browser or 'addWebMessageListener' in browser:
    errors.append('Dedicated remote browser must not expose a NexusNova native bridge')

# Local phonebook data is account-isolated and input-bounded before persistence.
for marker in [
    'MAX_ACCOUNT_ID_CHARS = 128',
    'MAX_CONTACT_ID_CHARS = 128',
    'MAX_PHONE_DIGITS = 15',
    'if (activeAccountIdLocked() != cleanAccountId) return false',
    'private fun cleanContactId(value: String): String?',
]:
    if marker not in phonebook:
        errors.append(f'Phonebook isolation marker missing: {marker}')

# Third-party cookies are currently an explicit compatibility trade-off for the
# user-facing browser. Report it instead of pretending this is a privacy browser.
if 'setAcceptThirdPartyCookies(webView, true)' in browser:
    warnings.append('Dedicated browser accepts third-party cookies for site compatibility; consider a user-facing privacy toggle later')

if errors:
    print('NexusNova Android WebView security readiness: FAIL')
    for item in errors:
        print(' - ERROR:', item)
    for item in warnings:
        print(' - WARNING:', item)
    sys.exit(1)

print('NexusNova Android WebView security readiness: PASS')
print(' - manifest backups + cleartext traffic: blocked')
print(' - main WebView file/content/mixed-content access: blocked')
print(' - native bridge: origin-bound main-frame WebMessageListener with bounded payload')
print(' - remote browser: HTTPS-only, dangerous schemes rejected, no native bridge')
print(' - local phonebook: bounded + active-account isolated')
for item in warnings:
    print(' - PRIVACY NOTE:', item)
