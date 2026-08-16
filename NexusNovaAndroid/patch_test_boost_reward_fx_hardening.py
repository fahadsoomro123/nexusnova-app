from pathlib import Path

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www')
BOOST = ROOT / 'js/nexusnova-admob-nexus-pass-v1.js'
VAULT = ROOT / 'js/nexusnova-nova-vault-v1.js'
CSS = ROOT / 'css/nexusnova-final-user-fixes-v1.css'

for path in (BOOST, VAULT, CSS):
    if not path.exists():
        raise SystemExit(f'Missing prepared Android asset: {path}')

boost = BOOST.read_text(encoding='utf-8')
vault = VAULT.read_text(encoding='utf-8')
css = CSS.read_text(encoding='utf-8')

MARKER = 'nx-test-boost-reward-hardening-v2'
if MARKER in boost:
    print('TEST boost reward hardening already applied.')
    raise SystemExit(0)
if 'nx-test-boost-reward-fx-v1' not in boost:
    raise SystemExit('Base TEST boost reward FX patch must run first.')

# ---------------------------------------------------------------------------
# 1) Shared 15-second TEST cooldown + durable overlay metadata.
# ---------------------------------------------------------------------------
boost = boost.replace(
    "  const TEST_FX_ID = 'nxTestBoostFxV1';\n  // nx-test-boost-reward-fx-v1\n",
    "  const TEST_FX_ID = 'nxTestBoostFxV1';\n  const TEST_COOLDOWN_MS = 15_000;\n  let rewardedScreenOpen = false;\n  let pendingRewardFxKind = '';\n  // nx-test-boost-reward-fx-v1\n  // nx-test-boost-reward-hardening-v2\n",
    1
)

boost = boost.replace(
    "return { anchorAt:Number(anchorAt)||0, extraUses:0, pendingVaults:0 };",
    "return { anchorAt:Number(anchorAt)||0, extraUses:0, pendingVaults:0, cooldownUntil:0 };"
)
boost = boost.replace(
    "        pendingVaults:Math.max(0, Math.floor(Number(parsed.pendingVaults) || 0))\n",
    "        pendingVaults:Math.max(0, Math.floor(Number(parsed.pendingVaults) || 0)),\n        cooldownUntil:Math.max(0, Number(parsed.cooldownUntil) || 0)\n",
    1
)
boost = boost.replace(
    "      pendingVaults:Math.max(0, Math.floor(Number(next.pendingVaults) || 0))\n",
    "      pendingVaults:Math.max(0, Math.floor(Number(next.pendingVaults) || 0)),\n      cooldownUntil:Math.max(0, Number(next.cooldownUntil) || 0)\n",
    1
)

old = """  function applyStoredTestOverlay(raw = {}) {
"""
new = """  function testCooldownRemainingMs(anchorAt = Number(miningState.anchorAt) || 0) {
    const overlay = readTestRewardOverlay(anchorAt);
    return Math.max(0, Number(overlay.cooldownUntil || 0) - Date.now());
  }

  function startTestCooldown(anchorAt = Number(miningState.anchorAt) || 0) {
    if (!anchorAt) return 0;
    const overlay = readTestRewardOverlay(anchorAt);
    overlay.cooldownUntil = Date.now() + TEST_COOLDOWN_MS;
    writeTestRewardOverlay(overlay);
    return overlay.cooldownUntil;
  }

  function applyStoredTestOverlay(raw = {}) {
"""
if old not in boost:
    raise SystemExit('Could not insert TEST cooldown helpers.')
boost = boost.replace(old, new, 1)

old = """  function applyTestReward(kind = 'booster') {
    if (!testMode || !miningState.active || miningState.complete || miningState.malformed) return false;
    if (miningState.uses >= TOTAL_LIMIT) return false;
    const anchorAt = Number(miningState.anchorAt) || 0;
    if (anchorAt <= 0) return false;
    const overlay = readTestRewardOverlay(anchorAt);
    overlay.extraUses = Math.min(TOTAL_LIMIT, overlay.extraUses + 1);
    overlay.pendingVaults += 1;
    writeTestRewardOverlay(overlay);

    const effectiveStartedAt = Number(miningState.startedAt) - BOOST_MS;
"""
new = """  function applyTestReward(kind = 'booster') {
    if (!testMode || !miningState.active || miningState.complete || miningState.malformed) return false;
    if (miningState.uses >= TOTAL_LIMIT) return false;
    if (String(kind || '') !== expectedKind()) return false;
    const anchorAt = Number(miningState.anchorAt) || 0;
    if (anchorAt <= 0 || testCooldownRemainingMs(anchorAt) > 0) return false;
    const effectiveStartedAt = Number(miningState.startedAt) - BOOST_MS;
    // A local TEST preview must never make Firestore look claimable before the
    // real authoritative session is complete. Production/server boosts do not
    // have this limitation because they update the authoritative timestamp.
    if (Date.now() - effectiveStartedAt >= DAY) return false;
    const overlay = readTestRewardOverlay(anchorAt);
    overlay.extraUses = Math.min(TOTAL_LIMIT, overlay.extraUses + 1);
    overlay.pendingVaults += 1;
    overlay.cooldownUntil = Date.now() + TEST_COOLDOWN_MS;
    writeTestRewardOverlay(overlay);

"""
if old not in boost:
    raise SystemExit('Could not harden applyTestReward.')
boost = boost.replace(old, new, 1)

# FX must appear after the full-screen ad closes, not behind it.
boost = boost.replace(
    "    playBoostFx(kind, { test:true, pendingVaults:overlay.pendingVaults });\n    return true;\n",
    "    pendingRewardFxKind = kind;\n    return true;\n",
    1
)

# Expose cooldown to Nova Vault and enforce it on consuming a TEST Vault.
old = """    status: () => {
      const anchorAt = Number(miningState.anchorAt) || 0;
      return Object.freeze({...readTestRewardOverlay(anchorAt)});
    },
    consumeVault: () => {
      const anchorAt = Number(miningState.anchorAt) || 0;
      const overlay = readTestRewardOverlay(anchorAt);
      if (overlay.pendingVaults < 1) return false;
      overlay.pendingVaults -= 1;
      writeTestRewardOverlay(overlay);
      return true;
    }
"""
new = """    status: () => {
      const anchorAt = Number(miningState.anchorAt) || 0;
      return Object.freeze({...readTestRewardOverlay(anchorAt)});
    },
    cooldownRemainingMs: () => testCooldownRemainingMs(),
    consumeVault: () => {
      const anchorAt = Number(miningState.anchorAt) || 0;
      const overlay = readTestRewardOverlay(anchorAt);
      if (overlay.pendingVaults < 1 || testCooldownRemainingMs(anchorAt) > 0) return false;
      overlay.pendingVaults -= 1;
      overlay.cooldownUntil = Date.now() + TEST_COOLDOWN_MS;
      writeTestRewardOverlay(overlay);
      return true;
    }
"""
if old not in boost:
    raise SystemExit('Could not harden NexusNovaTestRewards contract.')
boost = boost.replace(old, new, 1)

# One native ad request => at most one earned reward. Never fall back to the
# next expected kind on a duplicate/late rewarded-earned callback.
old = """    const kind = pendingKind || expectedKind();
    pendingKind = '';
    if (!kind) {
      await premiumMessage('Boost Not Applied', 'No eligible active mining boost was pending. No mining value was changed.', 'security');
      return;
    }
"""
new = """    const kind = pendingKind;
    pendingKind = '';
    if (!kind) return;
"""
if old not in boost:
    raise SystemExit('Could not make rewarded-earned idempotent.')
boost = boost.replace(old, new, 1)

# Track full-screen ad lifecycle and play queued FX only after dismissal.
boost = boost.replace(
    "      case 'rewarded-showing':\n      case 'rewarded-opened':\n        rewardedReady = false;\n        break;\n",
    "      case 'rewarded-showing':\n      case 'rewarded-opened':\n        rewardedReady = false;\n        rewardedScreenOpen = true;\n        break;\n",
    1
)
boost = boost.replace(
    "      case 'rewarded-dismissed':\n        break;\n",
    "      case 'rewarded-dismissed':\n        rewardedScreenOpen = false;\n        pendingKind = '';\n        if (pendingRewardFxKind) {\n          const fxKind = pendingRewardFxKind;\n          pendingRewardFxKind = '';\n          startTestCooldown();\n          setTimeout(() => playBoostFx(fxKind, { test:true }), 90);\n        }\n        break;\n",
    1
)
# Fallback: if an SDK/device sends earned after the ad is already closed, show FX now.
boost = boost.replace(
    "      if (!applyTestReward(kind)) {\n        await premiumMessage('Boost Not Applied', 'The TEST reward could not be attached to the current mining session.', 'security');\n      }\n      return;\n",
    "      if (!applyTestReward(kind)) {\n        await premiumMessage('Boost Not Applied', 'The TEST reward could not be attached to the current mining session.', 'security');\n      } else if (!rewardedScreenOpen && pendingRewardFxKind) {\n        const fxKind = pendingRewardFxKind;\n        pendingRewardFxKind = '';\n        startTestCooldown();\n        playBoostFx(fxKind, { test:true });\n      }\n      return;\n",
    1
)

# Button/status cooldown must include the local TEST reward cooldown.
old = """  function novaCooldownMs() {
    return Math.max(0, Number(window.NexusNovaVault?.cooldownRemainingMs?.()) || 0);
  }
"""
new = """  function novaCooldownMs() {
    return Math.max(
      0,
      Number(window.NexusNovaVault?.cooldownRemainingMs?.()) || 0,
      testCooldownRemainingMs()
    );
  }
"""
if old not in boost:
    raise SystemExit('Could not merge TEST cooldown into boost UI.')
boost = boost.replace(old, new, 1)

# ---------------------------------------------------------------------------
# 2) Nova Vault UI must honor the same local TEST cooldown.
# ---------------------------------------------------------------------------
old = "  const cooldownRemainingMs = () => Math.max(0, Number(state.cooldownUntil || 0) - Date.now());\n"
new = """  const cooldownRemainingMs = () => Math.max(
    0,
    Number(state.cooldownUntil || 0) - Date.now(),
    Number(window.NexusNovaTestRewards?.cooldownRemainingMs?.()) || 0
  );
"""
if old not in vault:
    raise SystemExit('Could not merge TEST cooldown into Nova Vault UI.')
vault = vault.replace(old, new, 1)

# ---------------------------------------------------------------------------
# 3) Android mobile safe scroll: lower Nova Vault actions must be scrollable
# fully above the fixed bottom dock on tall and short phone viewports.
# ---------------------------------------------------------------------------
SAFE_MARKER = 'nx-android-bottom-dock-safe-scroll-v1'
if SAFE_MARKER not in css:
    css += """

/* nx-android-bottom-dock-safe-scroll-v1
   Keep the last Mine/Nova Vault controls fully scrollable above the fixed dock. */
html body{padding-bottom:calc(190px + env(safe-area-inset-bottom))!important}
body .main{padding-bottom:calc(190px + env(safe-area-inset-bottom))!important}
"""

BOOST.write_text(boost, encoding='utf-8')
VAULT.write_text(vault, encoding='utf-8')
CSS.write_text(css, encoding='utf-8')

checks = [
    (BOOST, MARKER),
    (BOOST, 'TEST_COOLDOWN_MS = 15_000'),
    (BOOST, "const kind = pendingKind;"),
    (BOOST, "pendingKind = '';\n        if (pendingRewardFxKind)"),
    (BOOST, 'cooldownRemainingMs: () => testCooldownRemainingMs()'),
    (BOOST, 'if (Date.now() - effectiveStartedAt >= DAY) return false;'),
    (VAULT, 'window.NexusNovaTestRewards?.cooldownRemainingMs?.()'),
    (CSS, SAFE_MARKER),
]
for path, marker in checks:
    if marker not in path.read_text(encoding='utf-8'):
        raise SystemExit(f'Hardening verification failed: {path} -> {marker}')

print('Hardened TEST boost rewards: one reward/ad, 15s shared cooldown, post-dismiss FX, final-2h preview guard, and bottom-dock safe scroll.')
