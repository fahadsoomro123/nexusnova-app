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
app = read('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NexusApp.kt')
app_check = read('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NexusNativeAppCheck.kt')

# Current application-level hardening.
for marker in [
    'android:name=".NexusApp"',
    'android:allowBackup="false"',
    'android:usesCleartextTraffic="false"',
    'android:name=".BrowserActivity"',
    'android:name=".NovaVpnActivity"',
    'android:name=".MainActivity"',
    'android:value="${admobAppId}"',
]:
    if marker not in manifest:
        errors.append(f'Android manifest security marker missing: {marker}')

if 'android:name=".BrowserActivity"\n            android:exported="false"' not in manifest:
    errors.append('BrowserActivity must remain non-exported')
if 'android:name=".NovaVpnActivity"\n            android:exported="false"' not in manifest:
    errors.append('NovaVpnActivity must remain non-exported')

# A network security config remains tracked for recovery/reference. The current
# manifest also independently blocks cleartext using usesCleartextTraffic=false.
if '<base-config cleartextTrafficPermitted="false">' not in network:
    errors.append('Network security config no longer blocks cleartext traffic')
if '<certificates src="system" />' not in network:
    errors.append('Network trust anchors changed away from system certificates')
if 'android:networkSecurityConfig="@xml/network_security_config"' not in manifest:
    warnings.append('network_security_config.xml is not attached in the manifest; cleartext is still blocked by usesCleartextTraffic=false')

# Main app WebView owns privileged bridges, so file/content access and origin
# boundaries must remain narrow.
for marker in [
    'settings.allowFileAccess = false',
    'settings.allowContentAccess = false',
    'settings.allowFileAccessFromFileURLs = false',
    'settings.allowUniversalAccessFromFileURLs = false',
    'settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW',
    'settings.safeBrowsingEnabled = true',
    'WebViewFeature.WEB_MESSAGE_LISTENER',
    'if (isMainFrame && isTrustedOrigin(sourceOrigin))',
    'if (isMainFrame && isLocalOrigin(sourceOrigin))',
    'WebViewCompat.addWebMessageListener',
    'setOf(LOCAL_APP_ORIGIN)',
    'const val PRODUCTION_HOST = "fahadsoomro123.github.io"',
    'const val PRODUCTION_PATH = "/nexusnova-app/"',
    'const val MAX_BRIDGE_MESSAGE_CHARS = 8_192',
    'const val MAX_EXTERNAL_URL_CHARS = 2_000',
    'const val MAX_PICKED_FILE_BYTES = 20L * 1024L * 1024L',
    'if (uri.scheme != ContentResolver.SCHEME_CONTENT) return null',
]:
    if marker not in main:
        errors.append(f'Main WebView security marker missing: {marker}')

if 'addJavascriptInterface' in main:
    errors.append('Legacy addJavascriptInterface bridge detected in MainActivity')
if 'uri.scheme.equals("https", ignoreCase = true) && (uri.port == -1 || uri.port == 443)' not in main:
    errors.append('Trusted WebView origins are not pinned to HTTPS default port')

# Native App Check bridge must remain local-origin-only. The implementation is
# separate from the generic native bridge so remote pages cannot request tokens.
for marker in [
    'NexusNativeAppCheck.initialize(this)',
    'NexusNativeAppCheck.handleMessage(message.data, replyProxy)',
    'NexusNativeAppCheck.JS_BRIDGE_NAME',
]:
    if marker not in main:
        errors.append(f'Native App Check integration marker missing: {marker}')
if 'JS_BRIDGE_NAME' not in app_check or 'getAppCheckToken' not in app_check:
    errors.append('Native App Check bridge implementation is incomplete')

# Dedicated remote browser: HTTPS browsing, no privileged native bridge, no
# file/content WebView access, and dangerous input schemes rejected.
for marker in [
    'settings.allowFileAccess = false',
    'settings.allowContentAccess = false',
    'settings.allowFileAccessFromFileURLs = false',
    'settings.allowUniversalAccessFromFileURLs = false',
    'settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW',
    'settings.javaScriptCanOpenWindowsAutomatically = false',
    'settings.setSupportMultipleWindows(false)',
    'settings.safeBrowsingEnabled = true',
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
    errors.append('Dedicated remote BrowserActivity must not expose a NexusNova native bridge')
if '"https" -> uri.toString()' not in browser or '"http" -> uri.buildUpon().scheme("https")' not in browser:
    errors.append('Browser input normalization no longer upgrades/restricts navigation to HTTPS')

# NexusApp may install an origin-bound browser-launch bridge on the main app
# WebView only. It must not broaden trusted origins or allow non-HTTPS URLs.
for marker in [
    'WebViewFeature.WEB_MESSAGE_LISTENER',
    'setOf(PRODUCTION_ORIGIN, LOCAL_ORIGIN)',
    'if (!isMainFrame || !isTrustedOrigin(sourceOrigin))',
    'if (!isSafeHttps(uri))',
]:
    if marker not in app:
        errors.append(f'NexusApp bridge security marker missing: {marker}')

if 'setAcceptThirdPartyCookies(webView, true)' in browser:
    warnings.append('Dedicated browser accepts third-party cookies for compatibility; keep this as an explicit privacy trade-off')

if errors:
    print('NexusNova Android WebView security readiness: FAIL')
    for item in errors:
        print(' - ERROR:', item)
    for item in warnings:
        print(' - WARNING:', item)
    sys.exit(1)

print('NexusNova Android WebView security readiness: PASS')
print(' - application backups: disabled')
print(' - cleartext traffic: blocked')
print(' - main WebView file/content/mixed-content access: blocked')
print(' - privileged native bridge: origin-bound + main-frame only')
print(' - App Check token bridge: local app origin only')
print(' - remote BrowserActivity: HTTPS-normalized, dangerous schemes rejected, no privileged bridge')
print(' - BrowserActivity and NovaVpnActivity: non-exported')
for item in warnings:
    print(' - PRIVACY/CONFIG NOTE:', item)
