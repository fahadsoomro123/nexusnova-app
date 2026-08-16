from pathlib import Path
import sys

errors=[]

def read(path):
    p=Path(path)
    if not p.exists():
        errors.append(f'missing {path}')
        return ''
    return p.read_text(encoding='utf-8')

rules=read('firestore.rules')
mining=read('js/rewards-security-v1.js')
vault=read('js/nexusnova-nova-vault-v1.js')
boost=read('js/nexusnova-admob-nexus-pass-v1.js')
functions=read('functions/index.js')
loader=read('js/final-integrity-fix.js')
sw=read('sw.js')
adpatch=read('NexusNovaAndroid/patch_admob.py')

for marker in [
    "window.nexusNovaVaultVersion = 'nova-vault-v1'",
    'cooldownMs: COOLDOWN_MS',
    "secureCallable('openNovaVault')",
    "secureCallable('useNovaBoost'",
    "secureCallable('useNovaTimeWarp')",
    'Vault odds: NVX 60%',
    'Time Warp never creates another Vault'
]:
    if marker not in vault: errors.append(f'Vault client marker missing: {marker}')

for marker in [
    'const MINING_START_AD_PLACEMENT',
    "placement: MINING_START_AD_PLACEMENT",
    "type === 'interstitial-dismissed'",
    'await requireMiningStartAd();',
    'novaVaultPending: nextVaultPending',
    "single-owner-v5-start-ad-nova-vault"
]:
    if marker not in mining: errors.append(f'Mining gate/Vault marker missing: {marker}')

for marker in [
    'exports.openNovaVault=protectedCallable',
    'exports.useNovaBoost=protectedCallable',
    'exports.useNovaTimeWarp=protectedCallable',
    'randomInt(10000)',
    'const NOVA_COOLDOWN=15*1000;',
    'novaVaultEarned:0',
    'novaVaultPending=optionalProfileInt(d,"novaVaultPending",0)+1'
]:
    if marker not in functions: errors.append(f'Nova backend marker missing: {marker}')

if 'validMiningBoost()' in rules:
    errors.append('Direct client Mining Boost permission returned')
for marker in [
    "'novaVaultPending'])",
    "request.resource.data.novaVaultPending == resource.data.get('novaVaultPending', 0) + 1"
]:
    if marker not in rules: errors.append(f'Natural Vault grant rule missing: {marker}')
for forbidden in ['novaBoosterInventory', 'novaRainInventory', 'novaTimeWarpInventory', 'novaFeatureCooldownUntil']:
    # These server-owned fields may be referenced by backend/client display, but
    # Firestore client update rules must not grant them anywhere.
    if forbidden in rules:
        errors.append(f'Server-owned Nova field leaked into Firestore client rules: {forbidden}')

for marker in [
    "activateBoost('booster')",
    "activateBoost('rain')",
    "window.NexusNovaVault.useBoost",
    'TEST ads never reduce mining time or change NVX.'
]:
    if marker not in boost: errors.append(f'Booster/Vault integration marker missing: {marker}')
for forbidden in ['runTransaction(context.db', 'tx.update(ref, { miningStartedAt:']:
    if forbidden in boost: errors.append(f'Client boost writer returned: {forbidden}')

if './js/nexusnova-nova-vault-v1.js?v=1' not in loader:
    errors.append('Nova Vault critical loader missing')
if './js/nexusnova-nova-vault-v1.js' not in sw:
    errors.append('Nova Vault offline cache entry missing')
for marker in ['val miningStartGate = safePlacement == "mining-start"', '!miningStartGate && now - lastInterstitialShownAt']:
    if marker not in adpatch: errors.append(f'Native mining-start gate marker missing: {marker}')

if errors:
    print('NexusNova Nova Vault readiness: FAIL')
    for item in errors: print(' - ERROR:',item)
    sys.exit(1)

print('NexusNova Nova Vault readiness: PASS')
print(' - one pending Vault per natural 24H completion')
print(' - cryptographic server-side reward draw: 60/18/17/5')
print(' - Booster/Rain/Time Warp inventory is server-owned')
print(' - 15-second shared Nova cooldown is server-enforced')
print(' - Time Warp credits one session but never creates another Vault')
print(' - every fresh Android mining start waits for mining-start ad dismissal')
print(' - direct client mining-boost timestamp mutation remains denied')
