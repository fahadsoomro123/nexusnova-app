from pathlib import Path
import shutil

ROOT = Path('.')
ASSETS = ROOT / 'NexusNovaAndroid/app/src/main/assets/www'
MAIN = ROOT / 'NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt'

# Build the Android shell from this branch's exact web snapshot. This rescue
# branch starts at the last confirmed Direct-Test v60 state, so Android cannot
# accidentally render today's later/broken GitHub Pages UI.
if ASSETS.exists():
    shutil.rmtree(ASSETS)
ASSETS.mkdir(parents=True, exist_ok=True)

for name in [
    'index.html', 'page2.html', 'referral.html', 'styles.css',
    'manifest.webmanifest', 'sw.js', 'package.json', 'package-lock.json'
]:
    source = ROOT / name
    if source.exists():
        shutil.copy2(source, ASSETS / name)

for directory in ['css', 'js', 'icons']:
    source = ROOT / directory
    if source.exists():
        shutil.copytree(source, ASSETS / directory)

# The v60 UI itself is preserved. The only HTML behavior added is a deterministic
# splash release so a slow optional resource can never cover login/dashboard
# forever. Service workers are disabled inside this rescue shell to prevent a
# later cached GitHub Pages build from replacing the frozen snapshot.
RESCUE_HEAD = '''<script id="nxV60AndroidRescueBootstrap">
(function(){
  'use strict';
  window.__nexusV60AndroidRescue = true;
  function releaseSplash(){
    try {
      var splash = document.getElementById('nxSplash');
      if(!splash) return false;
      splash.style.setProperty('pointer-events','none','important');
      splash.style.setProperty('opacity','0','important');
      splash.style.setProperty('visibility','hidden','important');
      splash.style.setProperty('display','none','important');
      splash.classList.add('hide');
      setTimeout(function(){ try { splash.remove(); } catch (_) {} }, 80);
      return true;
    } catch (_) { return false; }
  }
  setTimeout(releaseSplash, 4500);
  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){
      setTimeout(releaseSplash, 3600);
    }, {once:true});
  }
  window.__nexusV60ReleaseSplash = releaseSplash;
})();
</script>
'''


def harden_html(path: Path):
    if not path.exists():
        raise SystemExit(f'Missing rescue HTML: {path}')
    text = path.read_text(encoding='utf-8')
    if 'nxV60AndroidRescueBootstrap' not in text:
        marker = '</head>'
        if marker not in text:
            raise SystemExit(f'No </head> marker in {path}')
        text = text.replace(marker, RESCUE_HEAD + marker, 1)

    text = text.replace(
        "if ('serviceWorker' in navigator) {",
        "if (!window.__nexusV60AndroidRescue && 'serviceWorker' in navigator) {",
    )
    text = text.replace(
        'if ("serviceWorker" in navigator) {',
        'if (!window.__nexusV60AndroidRescue && "serviceWorker" in navigator) {',
    )
    path.write_text(text, encoding='utf-8')


harden_html(ASSETS / 'index.html')
harden_html(ASSETS / 'page2.html')
if (ASSETS / 'referral.html').exists():
    harden_html(ASSETS / 'referral.html')

main = MAIN.read_text(encoding='utf-8')

old_intercept = '''                return assetLoader.shouldInterceptRequest(uri)\n                    ?: super.shouldInterceptRequest(view, request)\n'''
new_intercept = '''                return interceptV60Rescue(uri)\n                    ?: assetLoader.shouldInterceptRequest(uri)\n                    ?: super.shouldInterceptRequest(view, request)\n'''
if new_intercept not in main:
    if old_intercept not in main:
        raise SystemExit('V60 rescue request interceptor insertion point not found')
    main = main.replace(old_intercept, new_intercept, 1)

if 'private fun interceptV60Rescue(uri: Uri): WebResourceResponse?' not in main:
    marker = '    private fun installNativeMessageListener() {'
    method = '''    private fun interceptV60Rescue(uri: Uri): WebResourceResponse? {\n        if (!isProductionOrigin(uri)) return null\n        val path = uri.path ?: return null\n        if (!path.startsWith(PRODUCTION_PATH)) return null\n\n        var relative = path.removePrefix(PRODUCTION_PATH)\n        if (relative.isBlank() || relative.endsWith("/")) relative += "index.html"\n        relative = relative.trimStart('/')\n        if (relative.isBlank() || relative.contains("..") || relative.contains('\\\\')) return null\n\n        val stream = try {\n            assets.open("www/$relative")\n        } catch (_: Exception) {\n            return null\n        }\n\n        val extension = relative.substringAfterLast('.', "").lowercase(Locale.ROOT)\n        val mime = when (extension) {\n            "html", "htm" -> "text/html"\n            "js", "mjs" -> "application/javascript"\n            "css" -> "text/css"\n            "json", "webmanifest" -> "application/json"\n            "svg" -> "image/svg+xml"\n            "png" -> "image/png"\n            "jpg", "jpeg" -> "image/jpeg"\n            "gif" -> "image/gif"\n            "webp" -> "image/webp"\n            "txt" -> "text/plain"\n            else -> "application/octet-stream"\n        }\n        val encoding = if (mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") || mime.contains("svg")) "UTF-8" else null\n        return WebResourceResponse(mime, encoding, stream).apply {\n            responseHeaders = mapOf(\n                "Cache-Control" to "no-store, max-age=0",\n                "X-Content-Type-Options" to "nosniff"\n            )\n        }\n    }\n\n'''
    at = main.find(marker)
    if at < 0:
        raise SystemExit('V60 rescue interceptor method insertion point not found')
    main = main[:at] + method + main[at:]

main = main.replace(
    'const val PRODUCTION_PATH = "/nexusnova-app/"',
    'const val PRODUCTION_PATH = "/nexusnova-rescue-v60/"',
    1,
)
main = main.replace(
    'const val PRODUCTION_APP_URL = "https://fahadsoomro123.github.io/nexusnova-app/"',
    'const val PRODUCTION_APP_URL = "https://fahadsoomro123.github.io/nexusnova-rescue-v60/index.html"',
    1,
)
main = main.replace(
    'const val PRODUCTION_DASHBOARD_URL = "https://fahadsoomro123.github.io/nexusnova-app/page2.html"',
    'const val PRODUCTION_DASHBOARD_URL = "https://fahadsoomro123.github.io/nexusnova-rescue-v60/page2.html"',
    1,
)

MAIN.write_text(main, encoding='utf-8')

required_assets = [
    ASSETS / 'index.html', ASSETS / 'page2.html', ASSETS / 'styles.css',
    ASSETS / 'css/index.css', ASSETS / 'css/page2.css',
    ASSETS / 'js/page2.js'
]
missing = [str(path) for path in required_assets if not path.exists()]
if missing:
    raise SystemExit('V60 rescue assets missing: ' + ', '.join(missing))

index = (ASSETS / 'index.html').read_text(encoding='utf-8')
page2 = (ASSETS / 'page2.html').read_text(encoding='utf-8')
main = MAIN.read_text(encoding='utf-8')

for label, text in [('index', index), ('page2', page2)]:
    if 'nxV60AndroidRescueBootstrap' not in text or 'setTimeout(releaseSplash, 4500)' not in text:
        raise SystemExit(f'{label}: deterministic rescue splash release missing')

for token in [
    'interceptV60Rescue(uri)',
    'PRODUCTION_PATH = "/nexusnova-rescue-v60/"',
    'PRODUCTION_APP_URL = "https://fahadsoomro123.github.io/nexusnova-rescue-v60/index.html"',
    'PRODUCTION_DASHBOARD_URL = "https://fahadsoomro123.github.io/nexusnova-rescue-v60/page2.html"',
    'PhonebookStore.hasActiveAccount()',
]:
    if token not in main:
        raise SystemExit('V60 rescue verification missing: ' + token)

if 'nexusnova-native' in main or 'scheduleInteractiveShellCheck' in main:
    raise SystemExit('Later experimental native-shell/watchdog code leaked into v60 rescue build')

print('Prepared frozen Direct-Test v60 Android rescue UI with deterministic splash exit and no later dashboard experiments.')
