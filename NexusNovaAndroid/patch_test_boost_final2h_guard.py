from pathlib import Path
import runpy

BOOST = Path('NexusNovaAndroid/app/src/main/assets/www/js/nexusnova-admob-nexus-pass-v1.js')
if not BOOST.exists():
    raise SystemExit(f'Missing prepared Android asset: {BOOST}')
boost = BOOST.read_text(encoding='utf-8')
MARKER = 'nx-test-boost-final2h-guard-v4'
if MARKER in boost:
    print('TEST final-2h guard already applied.')
    runpy.run_path('NexusNovaAndroid/patch_android_ux_reward_reveal.py', run_name='__main__')
    raise SystemExit(0)
if 'nx-test-boost-cooldown-gate-v3' not in boost:
    raise SystemExit('TEST cooldown gate v3 must run first.')

boost = boost.replace(
    '  // nx-test-boost-cooldown-gate-v3\n',
    '  // nx-test-boost-cooldown-gate-v3\n  // nx-test-boost-final2h-guard-v4\n',
    1
)

needle = """  function kindLabel(kind) {
    return kind === 'rain' ? 'Nova Rain' : 'Nova Booster';
  }

"""
replacement = """  function kindLabel(kind) {
    return kind === 'rain' ? 'Nova Rain' : 'Nova Booster';
  }

  function testPreviewWouldCrossCompletion() {
    if (!testMode || !miningState.active || miningState.complete || miningState.startedAt <= 0) return false;
    return Date.now() - (Number(miningState.startedAt) - BOOST_MS) >= DAY;
  }

"""
if needle not in boost:
    raise SystemExit('Final-2h helper insertion point not found.')
boost = boost.replace(needle, replacement, 1)

# Task tab: do not let a user watch an ad that cannot safely be represented by
# the local TEST preview.
old = """    else if (!kind) label = 'SESSION BOOST LIMIT REACHED';
    else if (novaCooldownMs() > 0) label = `${kindLabel(kind).toUpperCase()} READY IN ${Math.ceil(novaCooldownMs() / 1000)}s`;
    else label = testMode ? `TEST AD — ${kindLabel(kind).toUpperCase()} (-2H + VAULT)` : 'MINING BOOST NOT LIVE';
    setButtonText(button, label);
    button.disabled = Boolean(miningState.known && (!kind || !miningState.active || miningState.complete)) || novaCooldownMs() > 0 || (hasNative() && !rewardedReady);
"""
new = """    else if (!kind) label = 'SESSION BOOST LIMIT REACHED';
    else if (testPreviewWouldCrossCompletion()) label = 'TEST BOOST PAUSED • FINAL 2H';
    else if (novaCooldownMs() > 0) label = `${kindLabel(kind).toUpperCase()} READY IN ${Math.ceil(novaCooldownMs() / 1000)}s`;
    else label = testMode ? `TEST AD — ${kindLabel(kind).toUpperCase()} (-2H + VAULT)` : 'MINING BOOST NOT LIVE';
    setButtonText(button, label);
    button.disabled = Boolean(miningState.known && (!kind || !miningState.active || miningState.complete)) || testPreviewWouldCrossCompletion() || novaCooldownMs() > 0 || (hasNative() && !rewardedReady);
"""
if old not in boost:
    raise SystemExit('Task final-2h gate insertion point not found.')
boost = boost.replace(old, new, 1)

# Home boost buttons: disable before opening an ad.
boost = boost.replace(
    "boosterBtn.disabled = kind !== 'booster' || miningState.malformed || cooldownMs > 0 || (stored ? false : !adReady);",
    "boosterBtn.disabled = kind !== 'booster' || miningState.malformed || (!stored && testPreviewWouldCrossCompletion()) || cooldownMs > 0 || (stored ? false : !adReady);",
    1
)
boost = boost.replace(
    "        : cooldownMs > 0 ? `BOOSTER READY IN ${cooldownSeconds}s`\n        : stored\n",
    "        : (!stored && testPreviewWouldCrossCompletion()) ? 'TEST BOOST PAUSED • FINAL 2H'\n        : cooldownMs > 0 ? `BOOSTER READY IN ${cooldownSeconds}s`\n        : stored\n",
    1
)
boost = boost.replace(
    "rainBtn.disabled = kind !== 'rain' || miningState.malformed || cooldownMs > 0 || (stored ? false : !adReady);",
    "rainBtn.disabled = kind !== 'rain' || miningState.malformed || (!stored && testPreviewWouldCrossCompletion()) || cooldownMs > 0 || (stored ? false : !adReady);",
    1
)
boost = boost.replace(
    "        : cooldownMs > 0 ? `RAIN READY IN ${cooldownSeconds}s`\n        : stored\n",
    "        : (!stored && testPreviewWouldCrossCompletion()) ? 'TEST BOOST PAUSED • FINAL 2H'\n        : cooldownMs > 0 ? `RAIN READY IN ${cooldownSeconds}s`\n        : stored\n",
    1
)

# Status copy explains why TEST ad is paused.
old = """              : cooldownMs > 0
                ? `${kindLabel(kind)} cooldown • ${cooldownSeconds}s remaining`
                : rewardedReady
"""
new = """              : testPreviewWouldCrossCompletion()
                ? 'TEST boost paused in final 2h • production server boost can complete a session safely'
                : cooldownMs > 0
                  ? `${kindLabel(kind)} cooldown • ${cooldownSeconds}s remaining`
                  : rewardedReady
"""
if old not in boost:
    raise SystemExit('Status final-2h gate insertion point not found.')
boost = boost.replace(old, new, 1)

# Direct API calls also return before any native ad request is posted.
needle = """    const chosen = String(kind || expectedKind() || '').toLowerCase();
    const cooldownMs = novaCooldownMs();
"""
replacement = """    const chosen = String(kind || expectedKind() || '').toLowerCase();
    if (testPreviewWouldCrossCompletion() && vaultInventory(chosen || expectedKind()) < 1) {
      const node = statusNode();
      if (node) node.textContent = 'TEST boost paused in final 2h; no ad was opened.';
      return { shown:false, reason:'test-final-2h' };
    }
    const cooldownMs = novaCooldownMs();
"""
if needle not in boost:
    raise SystemExit('Direct final-2h gate insertion point not found.')
boost = boost.replace(needle, replacement, 1)

BOOST.write_text(boost, encoding='utf-8')

checks = [
    MARKER,
    'function testPreviewWouldCrossCompletion()',
    "reason:'test-final-2h'",
    'TEST BOOST PAUSED • FINAL 2H',
]
final = BOOST.read_text(encoding='utf-8')
for marker in checks:
    if marker not in final:
        raise SystemExit(f'Final-2h guard verification failed: {marker}')
print('TEST final-2h guard applied: no rewarded ad is wasted when a local preview cannot safely cross authoritative completion.')

runpy.run_path('NexusNovaAndroid/patch_android_ux_reward_reveal.py', run_name='__main__')
