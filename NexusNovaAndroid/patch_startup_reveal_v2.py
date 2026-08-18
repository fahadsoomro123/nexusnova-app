from pathlib import Path

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www')
LAUNCHER = ROOT / 'js/page2.js'
REWARDS = ROOT / 'js/rewards-security-v1.js'
AUTH = ROOT / 'js/nexusnova-auth-page-v2.js'
GRADLE = Path('NexusNovaAndroid/app/build.gradle.kts')

for path in (LAUNCHER, REWARDS, AUTH, GRADLE):
    if not path.exists():
        raise SystemExit(f'Missing startup-v2 input: {path}')

# ---------------------------------------------------------------------------
# 1) Login logic only: keep the current sign-in UI/design completely untouched.
#    Guard against the accidental recursive profile helper produced by the older
#    family-demo patch. Auth success must never be blocked by Firestore bootstrap.
# ---------------------------------------------------------------------------
auth = AUTH.read_text(encoding='utf-8')
recursive = """async function ensureUserProfile(user) {\n  try {\n    await ensureUserProfile(user);\n"""
fixed = """async function ensureUserProfile(user) {\n  try {\n    await createUserProfile(user);\n"""
if recursive in auth:
    auth = auth.replace(recursive, fixed, 1)
if fixed not in auth:
    raise SystemExit('Startup v2: auth profile helper is not in the expected safe shape')
AUTH.write_text(auth, encoding='utf-8')

# ---------------------------------------------------------------------------
# 2) Full-screen startup shield must NOT wait forever for Firestore mining state.
#    It now waits only for: authenticated account + approved presentation layer +
#    secure mining engine installed. The mining engine itself owns its own visible
#    SYNCING/RETRY state while Firestore catches up. This prevents the exact bug
#    where login succeeds but the dashboard/mining screen never appears.
# ---------------------------------------------------------------------------
launcher = LAUNCHER.read_text(encoding='utf-8')
old_gate = """    if (window.__nxPage2PresentationReadyV3 !== true) return false;\n    if (window.__nexusSecureRewardsSingleOwner !== true) return false;\n    if (!button?.classList.contains('nx-future-miner')) return false;\n    if (!text) return false;\n    if (text.includes('SYNCING MINING')) return false;\n    if (timer.includes('CHECKING SECURE SESSION')) return false;\n    return true;\n"""
new_gate = """    // nx-startup-reveal-v2: never hold the whole app behind Firestore sync.\n    // Account restoration, presentation readiness and secure mining ownership are\n    // enough to reveal the dashboard. Mining keeps its own safe sync UI until the\n    // authoritative document arrives.\n    if (window.__nxPage2PresentationReadyV3 !== true) return false;\n    if (window.__nexusSecureRewardsSingleOwner !== true) return false;\n    if (!window.nexusAccountId) return false;\n    if (!button?.classList.contains('nx-future-miner')) return false;\n    return true;\n"""
if old_gate in launcher:
    launcher = launcher.replace(old_gate, new_gate, 1)
elif 'nx-startup-reveal-v2' not in launcher:
    raise SystemExit('Startup v2: launcher gate shape not found')

# Make delayed copy accurate: the user is waiting for account restoration, not a
# fake claim that mining data has already been replaced.
launcher = launcher.replace(
    "Still connecting securely… your mining data has not been replaced.",
    "Still restoring your secure account…",
    1,
)
LAUNCHER.write_text(launcher, encoding='utf-8')

# ---------------------------------------------------------------------------
# 3) Never expose the HTML's fake/default 0.0000 while secure mining is unknown.
#    Once either page2-core or the secure mining listener reads Firestore, the real
#    balance replaces these placeholders automatically.
# ---------------------------------------------------------------------------
rewards = REWARDS.read_text(encoding='utf-8')
old_unknown = """    if (!miningState.known) {\n      button.dataset.state = syncError ? 'error' : 'ready';\n      button.classList.remove('active');\n      text.textContent = syncError ? 'RETRY SECURE SYNC' : 'SYNCING MINING';\n      timer.classList.toggle('nx-error', Boolean(syncError));\n      timer.textContent = syncError ? 'SESSION SYNC DELAYED • TAP TO RETRY' : 'CHECKING SECURE SESSION';\n      return;\n    }\n"""
new_unknown = """    if (!miningState.known) {\n      // nx-startup-reveal-v2: hide stale HTML defaults while Firestore restores.\n      if (el('balance')) el('balance').textContent = '—';\n      if (el('usdValue')) el('usdValue').textContent = 'SYNCING SECURE BALANCE';\n      if (el('walletBalance')) el('walletBalance').textContent = '— NVX';\n      if (el('walletUsd')) el('walletUsd').textContent = 'SYNCING';\n      button.dataset.state = syncError ? 'error' : 'ready';\n      button.classList.remove('active');\n      text.textContent = syncError ? 'RETRY SECURE SYNC' : 'SYNCING MINING';\n      timer.classList.toggle('nx-error', Boolean(syncError));\n      timer.textContent = syncError ? 'SESSION SYNC DELAYED • TAP TO RETRY' : 'CHECKING SECURE SESSION';\n      return;\n    }\n"""
if old_unknown in rewards:
    rewards = rewards.replace(old_unknown, new_unknown, 1)
elif 'nx-startup-reveal-v2: hide stale HTML defaults' not in rewards:
    raise SystemExit('Startup v2: secure mining unknown-state renderer not found')

# Useful diagnostic event; no value mutation.
old_adopt_tail = """    renderMiningAuthoritative();\n  }\n\n  function getAccountId()"""
new_adopt_tail = """    renderMiningAuthoritative();\n    window.dispatchEvent(new CustomEvent('nexusnova:mining-authoritative', {\n      detail:{ active:miningState.active, startedAt:miningState.startedAt }\n    }));\n  }\n\n  function getAccountId()"""
if old_adopt_tail in rewards:
    rewards = rewards.replace(old_adopt_tail, new_adopt_tail, 1)
REWARDS.write_text(rewards, encoding='utf-8')

# ---------------------------------------------------------------------------
# 4) Distinguish this corrective APK from the broken v1.1.0 test build.
# ---------------------------------------------------------------------------
gradle = GRADLE.read_text(encoding='utf-8')
gradle = gradle.replace('versionCode = 2', 'versionCode = 3', 1)
gradle = gradle.replace('versionName = "1.1.0-stability"', 'versionName = "1.1.1-startup-fix"', 1)
GRADLE.write_text(gradle, encoding='utf-8')

checks = {
    AUTH: ['await createUserProfile(user);'],
    LAUNCHER: ['nx-startup-reveal-v2', 'if (!window.nexusAccountId) return false;'],
    REWARDS: ['nx-startup-reveal-v2: hide stale HTML defaults', "el('balance').textContent = '—'"],
    GRADLE: ['versionCode = 3', 'versionName = "1.1.1-startup-fix"'],
}
for path, tokens in checks.items():
    data = path.read_text(encoding='utf-8')
    missing = [token for token in tokens if token not in data]
    if missing:
        raise SystemExit(f'Startup v2 verification failed for {path}: {missing}')

print('Startup reveal v2 applied: sign-in UI untouched, no infinite splash, no stale 0.0000 reveal.')
