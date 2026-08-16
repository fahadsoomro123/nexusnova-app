from pathlib import Path

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www/js')
BOOST = ROOT / 'nexusnova-admob-nexus-pass-v1.js'
VAULT = ROOT / 'nexusnova-nova-vault-v1.js'
for path in (BOOST, VAULT):
    if not path.exists():
        raise SystemExit(f'Missing prepared Android asset: {path}')

boost = BOOST.read_text(encoding='utf-8')
vault = VAULT.read_text(encoding='utf-8')
MARKER = 'nx-test-boost-cooldown-gate-v3'
if MARKER in boost:
    print('TEST boost cooldown gate already applied.')
    raise SystemExit(0)
if 'nx-test-boost-reward-hardening-v2' not in boost:
    raise SystemExit('TEST boost reward hardening v2 must run first.')

# Add a durable marker beside the hardening marker.
boost = boost.replace(
    '  // nx-test-boost-reward-hardening-v2\n',
    '  // nx-test-boost-reward-hardening-v2\n  // nx-test-boost-cooldown-gate-v3\n',
    1
)

# Task-tab button must remain disabled and visibly count down even if the next
# AdMob creative becomes ready before the shared 15-second cooldown expires.
old = """    else if (!kind) label = 'SESSION BOOST LIMIT REACHED';
    else label = testMode ? `TEST AD — ${kindLabel(kind).toUpperCase()} (-2H + VAULT)` : 'MINING BOOST NOT LIVE';
    setButtonText(button, label);
    button.disabled = Boolean(miningState.known && (!kind || !miningState.active || miningState.complete)) || (hasNative() && !rewardedReady);
"""
new = """    else if (!kind) label = 'SESSION BOOST LIMIT REACHED';
    else if (novaCooldownMs() > 0) label = `${kindLabel(kind).toUpperCase()} READY IN ${Math.ceil(novaCooldownMs() / 1000)}s`;
    else label = testMode ? `TEST AD — ${kindLabel(kind).toUpperCase()} (-2H + VAULT)` : 'MINING BOOST NOT LIVE';
    setButtonText(button, label);
    button.disabled = Boolean(miningState.known && (!kind || !miningState.active || miningState.complete)) || novaCooldownMs() > 0 || (hasNative() && !rewardedReady);
"""
if old not in boost:
    raise SystemExit('Task rewarded button cooldown insertion point not found.')
boost = boost.replace(old, new, 1)

# Mining panel buttons: cooldown applies to BOTH stored Vault rewards and
# ad-backed TEST previews, not only the stored-inventory branch.
old = """      boosterBtn.disabled = kind !== 'booster' || miningState.malformed || (stored ? cooldownMs > 0 : !adReady);
      boosterBtn.textContent = miningState.boosterUses >= BOOSTER_LIMIT
        ? 'BOOSTER COMPLETE'
        : stored
          ? cooldownMs > 0 ? `BOOSTER READY IN ${cooldownSeconds}s` : `USE VAULT BOOSTER • -2H (${boosterInventory})`
          : !hasNative() ? 'NO VAULT BOOSTER'
          : rewardedReady ? 'TEST AD • -2H +1 VAULT' : 'PREPARING TEST AD…';
"""
new = """      boosterBtn.disabled = kind !== 'booster' || miningState.malformed || cooldownMs > 0 || (stored ? false : !adReady);
      boosterBtn.textContent = miningState.boosterUses >= BOOSTER_LIMIT
        ? 'BOOSTER COMPLETE'
        : cooldownMs > 0 ? `BOOSTER READY IN ${cooldownSeconds}s`
        : stored
          ? `USE VAULT BOOSTER • -2H (${boosterInventory})`
          : !hasNative() ? 'NO VAULT BOOSTER'
          : rewardedReady ? 'TEST AD • -2H +1 VAULT' : 'PREPARING TEST AD…';
"""
if old not in boost:
    raise SystemExit('Booster panel cooldown insertion point not found.')
boost = boost.replace(old, new, 1)

old = """      rainBtn.disabled = kind !== 'rain' || miningState.malformed || (stored ? cooldownMs > 0 : !adReady);
      rainBtn.textContent = miningState.rainUses >= RAIN_LIMIT
        ? 'RAIN COMPLETE'
        : miningState.boosterUses < BOOSTER_LIMIT ? 'UNLOCK AFTER BOOSTER'
        : stored
          ? cooldownMs > 0 ? `RAIN READY IN ${cooldownSeconds}s` : `USE VAULT RAIN • -2H (${rainInventory})`
          : !hasNative() ? 'NO VAULT RAIN'
          : rewardedReady ? 'TEST AD • -2H +1 VAULT' : 'PREPARING TEST AD…';
"""
new = """      rainBtn.disabled = kind !== 'rain' || miningState.malformed || cooldownMs > 0 || (stored ? false : !adReady);
      rainBtn.textContent = miningState.rainUses >= RAIN_LIMIT
        ? 'RAIN COMPLETE'
        : miningState.boosterUses < BOOSTER_LIMIT ? 'UNLOCK AFTER BOOSTER'
        : cooldownMs > 0 ? `RAIN READY IN ${cooldownSeconds}s`
        : stored
          ? `USE VAULT RAIN • -2H (${rainInventory})`
          : !hasNative() ? 'NO VAULT RAIN'
          : rewardedReady ? 'TEST AD • -2H +1 VAULT' : 'PREPARING TEST AD…';
"""
if old not in boost:
    raise SystemExit('Rain panel cooldown insertion point not found.')
boost = boost.replace(old, new, 1)

# Status text should also communicate the cooldown instead of claiming the next
# ad is ready while the reward gate is locked.
old = """              : rewardedReady
                ? `${kindLabel(kind)} ready • TEST MODE • -2H +1 Vault preview`
                : `Preparing rewarded ad…${testMode ? ' • TEST MODE' : ''}`;
"""
new = """              : cooldownMs > 0
                ? `${kindLabel(kind)} cooldown • ${cooldownSeconds}s remaining`
                : rewardedReady
                  ? `${kindLabel(kind)} ready • TEST MODE • -2H +1 Vault preview`
                  : `Preparing rewarded ad…${testMode ? ' • TEST MODE' : ''}`;
"""
if old not in boost:
    raise SystemExit('Boost status cooldown insertion point not found.')
boost = boost.replace(old, new, 1)

# Direct API calls must not bypass the visual button lock.
needle = """    const chosen = String(kind || expectedKind() || '').toLowerCase();
    if (!miningState.known) {
"""
replacement = """    const chosen = String(kind || expectedKind() || '').toLowerCase();
    const cooldownMs = novaCooldownMs();
    if (cooldownMs > 0) {
      const node = statusNode();
      if (node) node.textContent = `${kindLabel(chosen || expectedKind())} ready in ${Math.ceil(cooldownMs / 1000)}s`;
      return { shown:false, reason:'nova-cooldown', remainingMs:cooldownMs };
    }
    if (!miningState.known) {
"""
if needle not in boost:
    raise SystemExit('Direct rewarded cooldown gate insertion point not found.')
boost = boost.replace(needle, replacement, 1)

# If a TEST Vault exists during cooldown, a direct .open() call must not fall
# through to the production secure callable when the local consume is blocked.
old = """  async function openVault() {
    if (state.pending < 1 && testPendingVaults() > 0) {
      if (window.NexusNovaTestRewards?.consumeVault?.()) {
        render();
        await showMessage('TEST Nova Vault Opened', 'Debug Vault flow confirmed. No production NVX or inventory was minted from this TEST Vault.', 'spark');
        return { testOnly:true };
      }
    }
"""
new = """  async function openVault() {
    if (state.pending < 1 && testPendingVaults() > 0) {
      if (cooldownRemainingMs() > 0) return null;
      if (window.NexusNovaTestRewards?.consumeVault?.()) {
        render();
        await showMessage('TEST Nova Vault Opened', 'Debug Vault flow confirmed. No production NVX or inventory was minted from this TEST Vault.', 'spark');
        return { testOnly:true };
      }
      return null;
    }
"""
if old not in vault:
    raise SystemExit('TEST Vault direct-open cooldown gate insertion point not found.')
vault = vault.replace(old, new, 1)

BOOST.write_text(boost, encoding='utf-8')
VAULT.write_text(vault, encoding='utf-8')

checks = [
    (BOOST, MARKER),
    (BOOST, "reason:'nova-cooldown'"),
    (BOOST, 'cooldownMs > 0 || (stored ? false : !adReady)'),
    (BOOST, 'READY IN ${Math.ceil(novaCooldownMs() / 1000)}s'),
    (VAULT, 'if (cooldownRemainingMs() > 0) return null;'),
]
for path, marker in checks:
    if marker not in path.read_text(encoding='utf-8'):
        raise SystemExit(f'Cooldown gate verification failed: {path} -> {marker}')

print('Enforced shared 15s TEST cooldown across panel, Tasks button, direct rewarded API and TEST Vault open path.')
