from pathlib import Path

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www')
AUTH = ROOT / 'js/nexusnova-auth-page-v2.js'
CORE = ROOT / 'js/nexusnova-page2-core-launch-v2.js'
AFTER = ROOT / 'js/nexusnova-page2-after-core-v2.js'
LAUNCHER = ROOT / 'js/page2.js'
SETTINGS = ROOT / 'js/nexusnova-account-deletion-settings-v1.js'
GRADLE = Path('NexusNovaAndroid/app/build.gradle.kts')

for path in (AUTH, CORE, AFTER, LAUNCHER, SETTINGS, GRADLE):
    if not path.exists():
        raise SystemExit(f'Missing family-demo input: {path}')

# ---------------------------------------------------------------------------
# 1) Auth: make persistence explicit and hand the native wrapper the account UID
# immediately after Auth succeeds. Firestore profile creation is retried later by
# page2-core, so a temporary profile-network delay must not strand a signed-in user
# on the login page.
# ---------------------------------------------------------------------------
auth = AUTH.read_text(encoding='utf-8')
if 'nx-family-auth-persistence-v1' not in auth:
    anchor = "const db = fsMod.getFirestore(app);\n"
    block = '''const db = fsMod.getFirestore(app);\n\n// nx-family-auth-persistence-v1\nconst authPersistenceReady = authMod.setPersistence(\n  auth,\n  authMod.browserLocalPersistence\n).catch(error => {\n  console.warn('NexusNova auth persistence:', error);\n});\n'''
    if anchor not in auth:
        raise SystemExit('Auth persistence anchor missing')
    auth = auth.replace(anchor, block, 1)

if 'function markNativeActiveAccount' not in auth:
    anchor = "const nativeShell = typeof window.NexusAndroid?.postMessage === 'function';\n"
    block = anchor + '''\nfunction markNativeActiveAccount(user) {\n  if (!nativeShell || !user?.uid) return;\n  try {\n    window.NexusAndroid.postMessage(JSON.stringify({\n      action: 'setActiveAccount',\n      accountId: String(user.uid)\n    }));\n  } catch (error) {\n    console.warn('NexusNova native account handoff:', error);\n  }\n}\n\nasync function ensureUserProfile(user) {\n  try {\n    await createUserProfile(user);\n    return true;\n  } catch (error) {\n    // Auth is already authoritative. page2-core retries profile hydration, so do\n    // not turn a successful login/signup into a false login failure here.\n    console.warn('NexusNova profile bootstrap deferred:', error);\n    return false;\n  }\n}\n'''
    if anchor not in auth:
        raise SystemExit('Native auth handoff anchor missing')
    auth = auth.replace(anchor, block, 1)

auth = auth.replace(
    "  document.documentElement.classList.add('nx-auth-redirecting');\n  window.location.replace('./page2.html');",
    "  document.documentElement.classList.add('nx-auth-redirecting');\n  markNativeActiveAccount(auth.currentUser);\n  window.location.replace('./page2.html');",
    1,
)
auth = auth.replace('await createUserProfile(user);', 'await ensureUserProfile(user);')
auth = auth.replace('await createUserProfile(result.user);', 'await ensureUserProfile(result.user);')

if 'await authPersistenceReady;\n    let user;' not in auth:
    old = '''  try {\n    let user;\n'''
    new = '''  try {\n    await authPersistenceReady;\n    let user;\n'''
    if old not in auth:
        raise SystemExit('Email auth persistence wait anchor missing')
    auth = auth.replace(old, new, 1)

if '// nx-family-auth-restore-wait-v1' not in auth:
    old = '''// Restore Firebase persistence before exposing the form. If the account is\n// already signed in, skip the login screen instead of flashing it and bouncing.\ntry {\n'''
    new = '''// Restore Firebase persistence before exposing the form. If the account is\n// already signed in, skip the login screen instead of flashing it and bouncing.\n// nx-family-auth-restore-wait-v1\ntry {\n  await authPersistenceReady;\n'''
    if old not in auth:
        raise SystemExit('Auth restore persistence anchor missing')
    auth = auth.replace(old, new, 1)

AUTH.write_text(auth, encoding='utf-8')

# ---------------------------------------------------------------------------
# 2) Dashboard Auth restoration: explicit local persistence must settle before
# page2-core is allowed to interpret a null Firebase user as a logout.
# ---------------------------------------------------------------------------
core = CORE.read_text(encoding='utf-8')
if 'nx-family-dashboard-persistence-v1' not in core:
    anchor = "      const auth = authMod.getAuth(app);\n"
    block = anchor + '''      // nx-family-dashboard-persistence-v1\n      try {\n        await authMod.setPersistence(auth, authMod.browserLocalPersistence);\n      } catch (error) {\n        console.warn('NexusNova dashboard auth persistence:', error);\n      }\n'''
    if anchor not in core:
        raise SystemExit('Dashboard persistence anchor missing')
    core = core.replace(anchor, block, 1)
CORE.write_text(core, encoding='utf-8')

# ---------------------------------------------------------------------------
# 3) Presentation readiness first: Nova Hub code itself is untouched. We only load
# its already-approved local module and the small Settings cleanup before slower
# ad/privacy/network extras. The dashboard shield can then wait for presentation +
# authoritative mining instead of the entire optional stack.
# ---------------------------------------------------------------------------
after = AFTER.read_text(encoding='utf-8')
if 'nx-family-presentation-first-v1' not in after:
    anchor = '''  void (async () => {\n'''
    block = '''  void (async () => {\n    // nx-family-presentation-first-v1\n    try { await import('./nexusnova-navigation-stability-v1.js?v=1'); }\n    catch (error) { console.warn('NexusNova navigation stability:', error); }\n    try { await import('./nexusnova-allapps-scroll-fix-v1.js?v=1'); }\n    catch (error) { console.warn('NexusNova ALL APPS scroll fix:', error); }\n    try { await import('./nexusnova-nova-hub-nav-v1.js?v=1'); }\n    catch (error) { console.warn('NexusNova Nova Hub navigation readiness:', error); }\n    try { await import('./nexusnova-account-deletion-settings-v1.js?v=3'); }\n    catch (error) { console.warn('NexusNova essential Settings:', error); }\n    window.__nxPage2PresentationReadyV3 = true;\n    window.dispatchEvent(new Event('nexusnova:presentation-ready'));\n'''
    if anchor not in after:
        raise SystemExit('After-core presentation anchor missing')
    after = after.replace(anchor, block, 1)
AFTER.write_text(after, encoding='utf-8')

# ---------------------------------------------------------------------------
# 4) Startup shield: never reveal default 0.0000/SYNCING placeholders. In Android
# it replaces the older HTML splash, so there is exactly one startup surface per
# launch. It releases only when presentation is ready and Firestore mining state
# is authoritative.
# ---------------------------------------------------------------------------
launcher = LAUNCHER.read_text(encoding='utf-8')
launcher = launcher.replace(
    'if (window.__nxPage2AfterCoreReadyV2 !== true) return false;',
    'if (window.__nxPage2PresentationReadyV3 !== true) return false;',
    1,
)
if 'nx-family-single-startup-surface-v1' not in launcher:
    anchor = '''    document.body.appendChild(shield);\n    shield.querySelector('#nxSecureStartupRetryV3')?.addEventListener('click', () => window.location.reload());\n'''
    block = '''    document.body.appendChild(shield);\n    // nx-family-single-startup-surface-v1\n    const nativeShell = window.__nexusAndroidShell === true ||\n      location.pathname.startsWith('/nexusnova-native/') ||\n      new URLSearchParams(location.search).get('nxAndroid') === '1';\n    if (nativeShell) {\n      const oldSplash = document.getElementById('nxSplash');\n      if (oldSplash) {\n        oldSplash.style.setProperty('display','none','important');\n        oldSplash.style.setProperty('visibility','hidden','important');\n        oldSplash.style.setProperty('pointer-events','none','important');\n        oldSplash.remove();\n      }\n    }\n    shield.querySelector('#nxSecureStartupRetryV3')?.addEventListener('click', () => window.location.reload());\n'''
    if anchor not in launcher:
        raise SystemExit('Startup single-surface anchor missing')
    launcher = launcher.replace(anchor, block, 1)
if "window.addEventListener('nexusnova:presentation-ready', checkReady);" not in launcher:
    anchor = "  window.addEventListener('nexusnova:after-core-ready', checkReady);\n"
    if anchor not in launcher:
        raise SystemExit('Startup readiness event anchor missing')
    launcher = launcher.replace(anchor, anchor + "  window.addEventListener('nexusnova:presentation-ready', checkReady);\n", 1)
LAUNCHER.write_text(launcher, encoding='utf-8')

# ---------------------------------------------------------------------------
# 5) Settings: deliberately tiny. Keep only account essentials + one Theme row.
# Delete/Privacy always open the real public pages, not the synthetic APK path.
# ---------------------------------------------------------------------------
settings = r'''/* NexusNova Essential Settings v3 - Android family/demo build */
(() => {
  'use strict';
  if (window.__nxEssentialSettingsV3) return;
  window.__nxEssentialSettingsV3 = true;

  const PUBLIC_BASE = 'https://fahadsoomro123.github.io/nexusnova-app/';
  const DELETE_ID = 'nxAccountDeletionSettingsRow';
  const PRIVACY_ID = 'nxPrivacyPolicySettingsRow';

  function openPublic(file) {
    const url = new URL(file, PUBLIC_BASE).href;
    try {
      if (typeof window.NexusBrowserAndroid?.postMessage === 'function') {
        window.NexusBrowserAndroid.postMessage(JSON.stringify({ action:'open', url }));
        return;
      }
    } catch (_) {}
    try {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (opened) return;
    } catch (_) {}
    window.location.href = url;
  }

  window.openNexusPrivacyPolicy = () => openPublic('privacy-policy.html');
  window.openNexusAccountDeletion = () => openPublic('account-deletion.html');

  const text = el => String(el?.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
  const cards = settings => Array.from(settings.querySelectorAll('.settings-card'));
  const cardBy = (settings, name) => cards(settings).find(card => text(card.querySelector('h2,h3')).includes(name)) || null;
  const rowBy = (card, label) => Array.from(card?.querySelectorAll('.settings-row') || []).find(row => text(row.querySelector('strong')) === label) || null;

  function addRow(card, id, title, copy, buttonText, handler, danger=false) {
    if (!card || document.getElementById(id)) return;
    const row = document.createElement('div');
    row.id = id;
    row.className = 'settings-row';
    row.innerHTML = `<div><strong>${title}</strong><small>${copy}</small></div><button type="button" class="settings-btn ${danger ? 'settings-logout' : 'settings-reset'}">${buttonText}</button>`;
    row.querySelector('button')?.addEventListener('click', handler);
    card.appendChild(row);
  }

  function installStyle() {
    if (document.getElementById('nxEssentialSettingsV3Style')) return;
    const style = document.createElement('style');
    style.id = 'nxEssentialSettingsV3Style';
    style.textContent = `
      #tab-about .settings-hero{padding:13px 15px!important;margin-bottom:9px!important;border-radius:17px!important}
      #tab-about .settings-hero h2{font-size:17px!important;margin:0!important}
      #tab-about .settings-hero .settings-muted{font-size:9px!important;margin-top:3px!important}
      #tab-about .settings-card{padding:11px 13px!important;margin-bottom:9px!important;border-radius:16px!important}
      #tab-about .settings-card>h3{font-size:12px!important;margin:0 0 3px!important}
      #tab-about .settings-row{padding:8px 0!important;min-height:0!important;gap:8px!important}
      #tab-about .settings-row strong{font-size:10.5px!important;line-height:1.2!important}
      #tab-about .settings-row small{font-size:8.5px!important;line-height:1.3!important;margin-top:2px!important}
      #tab-about .settings-btn,#tab-about .settings-select{font-size:8.5px!important;min-height:29px!important;padding:6px 8px!important;border-radius:9px!important}
      #${DELETE_ID}{border-top:1px solid rgba(255,120,145,.18)!important}
      #${DELETE_ID} strong{color:#ffb1bf!important}
    `;
    document.head.appendChild(style);
  }

  function simplify() {
    const settings = document.getElementById('tab-about');
    if (!settings) return false;
    installStyle();

    const hero = settings.querySelector('.settings-hero');
    if (hero) {
      const h = hero.querySelector('h2');
      const p = hero.querySelector('.settings-muted');
      if (h) h.textContent = '⚙️ Settings';
      if (p) p.textContent = 'Account and essential preferences.';
    }

    const account = cardBy(settings, 'account');
    const appearance = cardBy(settings, 'appearance');
    if (account) {
      addRow(account, PRIVACY_ID, 'Privacy Policy', 'Read NexusNova privacy information.', 'Open', window.openNexusPrivacyPolicy);
      addRow(account, DELETE_ID, 'Delete Account', 'Request permanent account and data deletion.', 'Delete', window.openNexusAccountDeletion, true);
      const signout = rowBy(account, 'sign out');
      if (signout) account.appendChild(signout);
    }

    if (appearance) {
      const heading = appearance.querySelector('h3');
      if (heading) heading.textContent = 'Appearance';
      Array.from(appearance.querySelectorAll('.settings-row')).forEach(row => {
        if (text(row.querySelector('strong')) !== 'theme') row.remove();
      });
    }

    cards(settings).forEach(card => {
      if (card !== account && card !== appearance) card.remove();
    });

    document.documentElement.dataset.nxSettingsSimple = '3';
    return Boolean(account);
  }

  function boot() {
    simplify();
    [150,450,1000,2200].forEach(ms => setTimeout(simplify, ms));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
'''
SETTINGS.write_text(settings, encoding='utf-8')

# Bump the test APK so users can distinguish it from the old package.
gradle = GRADLE.read_text(encoding='utf-8')
gradle = gradle.replace('versionCode = 1', 'versionCode = 2', 1)
gradle = gradle.replace('versionName = "1.0.0"', 'versionName = "1.1.0-stability"', 1)
GRADLE.write_text(gradle, encoding='utf-8')

checks = {
    AUTH: ['nx-family-auth-persistence-v1', 'markNativeActiveAccount', 'ensureUserProfile'],
    CORE: ['nx-family-dashboard-persistence-v1', 'browserLocalPersistence'],
    AFTER: ['nx-family-presentation-first-v1', '__nxPage2PresentationReadyV3'],
    LAUNCHER: ['nx-family-single-startup-surface-v1', '__nxPage2PresentationReadyV3'],
    SETTINGS: ['NexusNova Essential Settings v3', 'account-deletion.html', "dataset.nxSettingsSimple = '3'"],
    GRADLE: ['versionCode = 2', 'versionName = "1.1.0-stability"'],
}
for path, tokens in checks.items():
    data = path.read_text(encoding='utf-8')
    missing = [token for token in tokens if token not in data]
    if missing:
        raise SystemExit(f'Family-demo verification failed for {path}: {missing}')

print('Family/demo web stability patch applied: persistent auth, one startup surface, authoritative mining reveal, tiny Settings, public deletion/privacy links, latest Nova Hub preserved.')
