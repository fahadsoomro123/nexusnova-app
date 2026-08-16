from pathlib import Path
import sys

ROOT = Path('.')
errors = []

def read(path):
    p = ROOT / path
    if not p.exists():
        errors.append(f'missing required file: {path}')
        return ''
    return p.read_text(encoding='utf-8')

rules = read('firestore.rules')
boost = read('js/nexusnova-admob-nexus-pass-v1.js')
loader = read('js/nexusnova-rewarded-ads-v1.js')
config = read('js/nexusnova-rewarded-ads-config-v1.js')
sync_patch = read('NexusNovaAndroid/patch_mining_boost_sync.py')

if 'validMiningBoost()' in rules or 'function validMiningBoost()' in rules:
    errors.append('Firestore still allows a direct client Mining Boost timestamp transition')
for required in ['function validMiningStart()', 'function validMiningFinish()', 'function validMiningRollover()']:
    if required not in rules:
        errors.append(f'Normal mining rule was accidentally removed: {required}')

for forbidden in [
    'runTransaction(context.db',
    'tx.update(ref, { miningStartedAt:',
    'window.nexusSecureAdoptMiningState(result);',
]:
    if forbidden in boost:
        errors.append(f'Mining Boost direct client value writer/sync marker remains: {forbidden}')

for required in [
    'const SERVER_VERIFIED_BOOST_ENABLED = false;',
    "boostKind:expected, testOnly:true",
    'TEST ads never reduce mining time or change NVX.',
    'Mining Boost value changes are disabled until server-verified ad proof is deployed.',
    "reason:'server-proof-required'",
]:
    if required not in boost:
        errors.append(f'Mining Boost proof-only marker missing: {required}')

for required in [
    "rewardLabel: 'TEST mining boost flow — no time change'",
    'serverVerifiedValueEnabled: false',
]:
    if required not in config:
        errors.append(f'Rewarded ads public config overstates Mining Boost value: {required}')

if 'real 2-hour mining boost' in loader:
    errors.append('Rewarded compatibility loader still advertises a live 2-hour value reward')
if 'Mining-time value changes remain OFF until server-verified ad proof exists.' not in loader:
    errors.append('Rewarded compatibility loader is missing the server-proof value-off disclosure')

if 'Prepared Mining Boost bridge still contains a direct value writer.' not in sync_patch:
    errors.append('Android mining sync patch does not reject a reintroduced client boost writer')
if "(BOOST, 'SERVER_VERIFIED_BOOST_ENABLED = false')" not in sync_patch:
    errors.append('Android mining sync patch does not verify the boost safety switch')

if errors:
    print('NexusNova Mining Boost security readiness: FAIL')
    for item in errors:
        print(' - ERROR:', item)
    sys.exit(1)

print('NexusNova Mining Boost security readiness: PASS')
print(' - normal mining start/finish/rollover: preserved')
print(' - direct client 2h timestamp boost: denied')
print(' - debug rewarded ad: TEST UX only, no mining/NVX change')
print(' - release/live boost: disabled until server-verified proof exists')
print(' - public reward config/loader: truthfully report value OFF')
