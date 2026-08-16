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
network = read('NexusNovaAndroid/app/src/main/res/xml/network_security_config.xml')
main = read('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
browser = read('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/BrowserActivity.kt')
phonebook = read('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/PhonebookStore.kt')

manifest_markers = [
    'android:allowBackup="false"',
    'android:usesCleartextTraffic="false"',
    'android:networkSecurityConfig="@xml/network_security_config"',
    'android:name=".BrowserActivity"',
    'android:name=".CallerSetupActivity"',
    'android:name=".IncomingCallActivity"',
    'android:permission="android.permission.BIND_SCREENING_SERVICE"',
]
for marker in manifest_markers:
    if marker not in manifest:
        errors.append(f'Android manifest security marker missing: {marker}')

if '<base-config cleartextTrafficPermitted="false">' not in network:
    errors.append('Network security config no longer blocks cleartext traffic')
if '<certificates src="system" />' not in network:
    errors.append('Network trust anchors changed away from system certificates')

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
    'const val MAX_BRIDGE_MESSAGE_CHARS = 2_048',
]:
    if marker not in main:
        errors.append(f'Main WebView security marker missing: {marker}')

if 'addJavascriptInterface' in main:
    errors.append('Legacy addJavascriptInterface bridge detected in MainActivity')
if 'uri.port == -1 || uri.port == 443' not in main:
    errors.append('Trusted WebView origins are not pinned to HTTPS default port')

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

# Local caller-ID data is account-isolated and input-bounded before persistence.
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
# user-facing browser. Report it instead of silently pretending this is a privacy browser.
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
print(' - cleartext traffic: blocked')
print(' - main WebView file/content/mixed-content access: blocked')
print(' - native bridge: origin-bound main-frame WebMessageListener')
print(' - remote browser: HTTPS-only, dangerous schemes rejected, no native bridge')
print(' - local phonebook: bounded + active-account isolated')
for item in warnings:
    print(' - PRIVACY NOTE:', item)
