from pathlib import Path
import shutil

ROOT = Path('.')
ASSETS = ROOT / 'NexusNovaAndroid/app/src/main/assets/www'


def copy_required_shell():
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


NATIVE_HEAD = '''<script id="nxAndroidNativeShellBootstrap">
(function(){
  'use strict';
  window.__nexusAndroidShell = true;
  window.__nexusInteractiveReady = false;
  window.__nexusEmergencyAppassets = location.origin === 'https://appassets.androidplatform.net';

  function byId(id){ return document.getElementById(id); }
  function activate(name, button){
    var target = byId('tab-' + name);
    if (!target) return false;
    document.querySelectorAll('.tab').forEach(function(tab){ tab.classList.remove('active'); });
    target.classList.add('active');
    document.querySelectorAll('.bottom-dock .dock-item').forEach(function(item){ item.classList.remove('active'); });
    if (button && button.classList && button.classList.contains('dock-item')) button.classList.add('active');
    else if (!['home','wallet','tasks','market'].includes(name)) byId('moreBtn')?.classList.add('active');
    var menu = byId('moreMenu');
    if (menu) { menu.classList.remove('show'); menu.style.removeProperty('display'); }
    document.body?.classList.remove('nx-allapps-open');
    try { window.scrollTo(0, 0); } catch (_) {}
    return true;
  }

  window.switchTab = window.switchTab || function(name, button){ return activate(name, button || null); };
  window.openMoreTab = window.openMoreTab || function(name){ return activate(name, null); };
  window.toggleMore = window.toggleMore || function(){
    var menu = byId('moreMenu');
    if (!menu) return false;
    menu.style.removeProperty('display');
    menu.classList.toggle('show');
    var open = menu.classList.contains('show');
    document.body?.classList.toggle('nx-allapps-open', open);
    document.querySelectorAll('.bottom-dock .dock-item').forEach(function(item){ item.classList.remove('active'); });
    byId('moreBtn')?.classList.toggle('active', open);
    return open;
  };

  function markReady(){
    var dock = document.querySelector('.bottom-dock');
    var home = byId('tab-home');
    if (!dock || !home || typeof window.switchTab !== 'function' || typeof window.toggleMore !== 'function') return;
    window.__nexusInteractiveReady = true;
    document.documentElement.dataset.nxInteractiveReady = '1';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', markReady, {once:true});
  else markReady();
  setTimeout(markReady, 250);
  setTimeout(markReady, 1000);
})();
</script>
'''


def patch_html(path: Path, dashboard: bool):
    if not path.exists():
        return
    text = path.read_text(encoding='utf-8')
    if 'nxAndroidNativeShellBootstrap' not in text:
        marker = '<head>'
        if marker not in text:
            raise SystemExit(f'{path}: <head> marker missing')
        injection = NATIVE_HEAD if dashboard else '''<script id="nxAndroidNativeShellBootstrap">window.__nexusAndroidShell=true;window.__nexusEmergencyAppassets=location.origin==='https://appassets.androidplatform.net';</script>\n'''
        text = text.replace(marker, marker + '\n' + injection, 1)

    text = text.replace(
        'if ("serviceWorker" in navigator) {',
        'if (!window.__nexusAndroidShell && "serviceWorker" in navigator) {',
    )
    text = text.replace(
        "if ('serviceWorker' in navigator) {",
        "if (!window.__nexusAndroidShell && 'serviceWorker' in navigator) {",
    )
    path.write_text(text, encoding='utf-8')


def patch_fcm():
    path = ASSETS / 'js/nexusnova-fcm-v1.js'
    if not path.exists():
        return
    text = path.read_text(encoding='utf-8')
    if 'const NX_ANDROID_SHELL' not in text:
        marker = '  "use strict";\n'
        if marker not in text:
            raise SystemExit('FCM native-shell insertion point missing')
        text = text.replace(marker, marker + '  const NX_ANDROID_SHELL = window.__nexusAndroidShell === true;\n', 1)

    old = '''  async function serviceWorkerRegistration() {\n    const registration = await navigator.serviceWorker.register("./sw.js");\n'''
    new = '''  async function serviceWorkerRegistration() {\n    if (NX_ANDROID_SHELL) {\n      throw new Error("Web push service worker is disabled inside the NexusNova Android shell.");\n    }\n    const registration = await navigator.serviceWorker.register("./sw.js");\n'''
    if new not in text:
        if old not in text:
            raise SystemExit('FCM service-worker registration block missing')
        text = text.replace(old, new, 1)

    text = text.replace(
        '      if (Notification.permission === "granted") {\n        registerCurrentDevice(false).catch(() => {});\n      }',
        '      if (!NX_ANDROID_SHELL && Notification.permission === "granted") {\n        registerCurrentDevice(false).catch(() => {});\n      }',
        1,
    )
    path.write_text(text, encoding='utf-8')


def patch_emergency_rewards_guard():
    """Keep synthetic github.io native shell fully functional, but make the
    last-resort appassets origin explicitly read-only for all NVX mining.
    This prevents emergency fallback from becoming a second value owner."""
    path = ASSETS / 'js/rewards-security-v1.js'
    if not path.exists():
        return
    text = path.read_text(encoding='utf-8')
    marker = "  'use strict';\n"
    guard_marker = 'android-appassets-readonly-guard-v2'
    if guard_marker in text:
        return
    if marker not in text:
        raise SystemExit('Rewards emergency guard insertion point missing')

    guard = '''  // android-appassets-readonly-guard-v2\n  if (location.origin === 'https://appassets.androidplatform.net') {\n    window.__nexusSecureRewardsSingleOwner = true;\n    window.nexusMiningEngineVersion = 'android-appassets-readonly-guard-v2';\n    const renderOfflineMining = () => {\n      const button = document.getElementById('mineBtn');\n      const label = document.getElementById('btnText');\n      const timer = document.getElementById('timer');\n      if (button) { button.disabled = true; button.dataset.state = 'offline'; }\n      if (label) label.textContent = 'ONLINE MINING REQUIRED';\n      if (timer) timer.textContent = 'RECONNECT TO SECURE NEXUSNOVA';\n    };\n    window.nexusSecureStartMining = async () => { renderOfflineMining(); return false; };\n    window.nexusSecureRenderMining = () => renderOfflineMining();\n    window.nexusSecureMiningState = () => Object.freeze({known:false,active:false,offline:true});\n    if (document.readyState === 'loading') {\n      document.addEventListener('DOMContentLoaded', renderOfflineMining, {once:true});\n    } else {\n      renderOfflineMining();\n    }\n    return;\n  }\n'''
    text = text.replace(marker, marker + guard, 1)
    path.write_text(text, encoding='utf-8')


copy_required_shell()
patch_html(ASSETS / 'page2.html', dashboard=True)
patch_html(ASSETS / 'index.html', dashboard=False)
patch_html(ASSETS / 'referral.html', dashboard=False)
patch_fcm()
patch_emergency_rewards_guard()

required = [
    ASSETS / 'index.html',
    ASSETS / 'page2.html',
    ASSETS / 'js/core-failsafe.js',
    ASSETS / 'js/page2.js',
    ASSETS / 'js/rewards-security-v1.js',
    ASSETS / 'css/page2.css',
]
missing = [str(path) for path in required if not path.exists()]
if missing:
    raise SystemExit('Android shell sync missing: ' + ', '.join(missing))

page2 = (ASSETS / 'page2.html').read_text(encoding='utf-8')
rewards = (ASSETS / 'js/rewards-security-v1.js').read_text(encoding='utf-8')
if 'window.__nexusAndroidShell = true' not in page2 or 'window.__nexusInteractiveReady = true' not in page2:
    raise SystemExit('Android interactive bootstrap was not embedded')
if 'if (!window.__nexusAndroidShell && "serviceWorker" in navigator)' not in page2:
    raise SystemExit('Android service-worker bypass was not embedded')
if 'android-appassets-readonly-guard-v2' not in rewards or 'ONLINE MINING REQUIRED' not in rewards:
    raise SystemExit('Android emergency appassets rewards guard was not embedded')

print('Prepared deterministic NexusNova Android web shell with read-only emergency fallback.')
