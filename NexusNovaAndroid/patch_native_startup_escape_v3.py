from pathlib import Path

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www')
LAUNCHER = ROOT / 'js/page2.js'
PAGE = ROOT / 'page2.html'
GRADLE = Path('NexusNovaAndroid/app/build.gradle.kts')

for path in (LAUNCHER, PAGE, GRADLE):
    if not path.exists():
        raise SystemExit(f'Missing native-startup-v3 input: {path}')

# ---------------------------------------------------------------------------
# The previous startup fix still allowed the full-screen startup shield to wait
# on JS/Firebase readiness predicates. On a real Android WebView one of those
# predicates can arrive late even though login already succeeded, leaving the
# user trapped behind the splash forever.
#
# Native v3 keeps the shield as a short presentation surface only. It is NEVER a
# readiness gate: Android releases it after a bounded 3.8 seconds no matter what.
# Secure mining then owns its own SYNCING/RETRY state on the visible dashboard.
# Sign-in/login HTML and its design are not touched by this patch.
# ---------------------------------------------------------------------------
launcher = LAUNCHER.read_text(encoding='utf-8')
if 'nx-native-startup-escape-v3' not in launcher:
    old = """  function bootShield() {\n    installShield();\n    checkReady();\n    pollTimer = window.setInterval(checkReady, 140);\n    window.setTimeout(() => showDelayed('Still restoring your secure account…'), 12000);\n  }\n"""
    if old not in launcher:
        # Accept the pre-v2 delayed copy too, so the patch is deterministic if an
        # older prepared shell reaches this step.
        old = """  function bootShield() {\n    installShield();\n    checkReady();\n    pollTimer = window.setInterval(checkReady, 140);\n    window.setTimeout(() => showDelayed('Still connecting securely… your mining data has not been replaced.'), 12000);\n  }\n"""
    new = """  function bootShield() {\n    installShield();\n    checkReady();\n    pollTimer = window.setInterval(checkReady, 140);\n\n    // nx-native-startup-escape-v3\n    // A splash is presentation, never an authentication/mining readiness lock.\n    // On Android always reveal the dashboard after a short bounded interval.\n    const nativeShell = typeof window.NexusAndroid?.postMessage === 'function' ||\n      window.__nexusAndroidShell === true ||\n      location.pathname.startsWith('/nexusnova-native/') ||\n      new URLSearchParams(location.search).get('nxAndroid') === '1';\n    if (nativeShell) {\n      window.setTimeout(releaseShield, 3800);\n    } else {\n      window.setTimeout(() => showDelayed('Still restoring your secure account…'), 12000);\n    }\n  }\n"""
    if old not in launcher:
        raise SystemExit('Native startup v3: bootShield anchor not found')
    launcher = launcher.replace(old, new, 1)

# A second independent escape protects against future changes to bootShield.
# If the shield somehow survives, this event-driven fallback removes it once the
# DOM has existed for four seconds. It does not reload or navigate anywhere.
if 'nx-native-startup-hardstop-v3' not in launcher:
    anchor = """  window.NexusNovaStartupV3 = { checkReady, showDelayed };\n})();\n"""
    block = """  window.NexusNovaStartupV3 = { checkReady, showDelayed };\n\n  // nx-native-startup-hardstop-v3\n  const nativeHardStop = typeof window.NexusAndroid?.postMessage === 'function' ||\n    window.__nexusAndroidShell === true ||\n    location.pathname.startsWith('/nexusnova-native/') ||\n    new URLSearchParams(location.search).get('nxAndroid') === '1';\n  if (nativeHardStop) {\n    window.setTimeout(() => {\n      try { releaseShield(); } catch (_) {}\n      const stale = document.getElementById(SHIELD_ID);\n      if (stale) stale.remove();\n      const oldSplash = document.getElementById('nxSplash');\n      if (oldSplash) {\n        oldSplash.classList.add('hide');\n        oldSplash.style.setProperty('pointer-events','none','important');\n        window.setTimeout(() => oldSplash.remove(), 420);\n      }\n    }, 4200);\n  }\n})();\n"""
    if anchor not in launcher:
        raise SystemExit('Native startup v3: launcher hard-stop anchor not found')
    launcher = launcher.replace(anchor, block, 1)
LAUNCHER.write_text(launcher, encoding='utf-8')

# ---------------------------------------------------------------------------
# Safe initial mining placeholders. If Firebase is still restoring when the
# bounded splash exits, never expose the stale HTML 0.0000 / START MINING state.
# The secure mining engine replaces these as soon as authoritative state arrives.
# ---------------------------------------------------------------------------
page = PAGE.read_text(encoding='utf-8')
page = page.replace(
    '<div class="balance-amount" id="balance">0.0000</div>',
    '<div class="balance-amount" id="balance">—</div>',
    1,
)
page = page.replace(
    '<div class="balance-usd" id="usdValue">$ 0.00 USD</div>',
    '<div class="balance-usd" id="usdValue">SYNCING SECURE BALANCE</div>',
    1,
)
page = page.replace(
    '<span id="btnText">START MINING</span>',
    '<span id="btnText">SYNCING MINING</span>',
    1,
)
page = page.replace(
    '        MINER OFFLINE\n',
    '        CHECKING SECURE SESSION\n',
    1,
)
PAGE.write_text(page, encoding='utf-8')

# Version this corrective APK separately from the failed v1.1.1 phone test.
gradle = GRADLE.read_text(encoding='utf-8')
gradle = gradle.replace('versionCode = 3', 'versionCode = 4', 1)
gradle = gradle.replace('versionName = "1.1.1-startup-fix"', 'versionName = "1.1.2-startup-escape"', 1)
GRADLE.write_text(gradle, encoding='utf-8')

checks = {
    LAUNCHER: ['nx-native-startup-escape-v3', 'window.setTimeout(releaseShield, 3800)', 'nx-native-startup-hardstop-v3'],
    PAGE: ['id="balance">—</div>', 'SYNCING SECURE BALANCE', 'SYNCING MINING', 'CHECKING SECURE SESSION'],
    GRADLE: ['versionCode = 4', 'versionName = "1.1.2-startup-escape"'],
}
for path, tokens in checks.items():
    data = path.read_text(encoding='utf-8')
    missing = [token for token in tokens if token not in data]
    if missing:
        raise SystemExit(f'Native startup v3 verification failed for {path}: {missing}')

print('Native startup escape v3 applied: splash is bounded, dashboard always reveals, stale mining defaults hidden, sign-in UI untouched.')
