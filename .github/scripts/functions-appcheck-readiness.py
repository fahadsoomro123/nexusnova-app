from pathlib import Path
import re
import sys

ROOT = Path('functions')
errors = []
passes = []


def read(name):
    path = ROOT / name
    if not path.is_file():
        errors.append(f'missing Functions source: {name}')
        return ''
    return path.read_text(encoding='utf-8')


sources = {p.name: p.read_text(encoding='utf-8') for p in ROOT.glob('*.js') if p.is_file()}

# Every directly exported callable must carry enforceAppCheck:true in its onCall
# options. Wrapper-based callables are checked separately below.
direct_export = re.compile(r'exports\.(\w+)\s*=\s*onCall\s*\(', re.M)
for name, text in sources.items():
    for match in direct_export.finditer(text):
        fn = match.group(1)
        tail = text[match.end():match.end() + 500]
        option_end = tail.find('},')
        options = tail[:option_end + 1] if option_end >= 0 else tail[:250]
        if not re.search(r'enforceAppCheck\s*:\s*true', options):
            errors.append(f'direct callable lacks enforceAppCheck:true: {name} -> {fn}')
        else:
            passes.append(f'{name}:{fn}')

# Wrapper-based secure callables must retain an App-Check-protected wrapper and
# their value-bearing exports must continue to use it.
wrapped_expectations = {
    'index.js': [
        'getSecureAccount', 'finishMiningSession', 'claimDailyReward',
        'completeTaskReward', 'openNovaVault', 'useNovaBoost',
        'useNovaTimeWarp', 'getDepositAddress', 'requestWithdrawal'
    ],
    'notifications.js': ['registerPushToken', 'removePushToken', 'sendPushTest'],
    'novaVault10x.js': ['openNovaVaultBoosted'],
}

for name, exports in wrapped_expectations.items():
    text = read(name)
    if not re.search(r'protectedCallable\s*=.*?onCall\s*\(\s*\{\s*enforceAppCheck\s*:\s*true\s*\}', text, re.S):
        errors.append(f'App Check protectedCallable wrapper missing/changed: {name}')
        continue
    for fn in exports:
        if not re.search(rf'exports\.{re.escape(fn)}\s*=\s*protectedCallable\s*\(', text):
            errors.append(f'expected protected callable export missing: {name} -> {fn}')
        else:
            passes.append(f'{name}:{fn}')

# External ad-network server-to-server callbacks are intentionally onRequest,
# because Google/ayeT cannot present Firebase App Check tokens. They must retain
# cryptographic provider verification and replay/idempotency defenses.
ayet = read('rewardedAds.js')
for marker in [
    "defineSecret('AYET_PUBLISHER_API_KEY')",
    "X-Ayetstudios-Security-Hash",
    'verifyAyetHmac',
    "crypto.createHmac('sha256'",
    'timingSafeEqual',
    'transactionDocId',
    "collection('rewardedAdTransactions')",
]:
    if marker not in ayet:
        errors.append(f'ayeT S2S security marker missing: {marker}')

# admobRewardedSsv.js remains a legacy compatibility module. The canonical
# handler is v2 because index.js deliberately loads it last. Validate provider
# verification, replay defense, and the no-value fulfillment on that winning
# handler rather than requiring the legacy module to duplicate the same code.
admob_v2 = read('admobRewardedSsvV2.js')
for marker in [
    'verifyGoogleSignature',
    "crypto.verify('sha256'",
    'EXPECTED_AD_UNIT',
    'transaction_id',
    'txDocId',
    "collection('admobRewardTransactions')",
    "fulfillment:'no-value-release-safe'",
    'directNvx:false',
    'vaultBoostCredit:false',
    "reason:'ads_do_not_grant_mining_or_token_value'",
]:
    if marker not in admob_v2:
        errors.append(f'canonical AdMob SSV v2 security marker missing: {marker}')

# Main export order intentionally loads v2 after legacy SSV exports so the
# signed, no-value handler is the exported admobRewardedSsv implementation.
main = read('main.js')
index = read('index.js')
if 'Object.assign(exports, require("./index"));' not in main:
    errors.append('functions/main.js no longer exports the secured core index')
legacy_pos = index.find('Object.assign(exports, require("./admobRewardedSsv"));')
v2_marker = 'Object.assign(exports, require("./admobRewardedSsvV2"));'
v2_pos = index.rfind(v2_marker)
if v2_pos < 0:
    errors.append('functions/index.js no longer loads canonical AdMob SSV v2')
elif legacy_pos >= 0 and v2_pos <= legacy_pos:
    errors.append('functions/index.js must load AdMob SSV v2 after the legacy SSV export')
elif index[v2_pos + len(v2_marker):].strip():
    errors.append('functions/index.js must keep canonical AdMob SSV v2 as the final export assignment')

if errors:
    print('NexusNova Functions App Check readiness: FAIL')
    for item in errors:
        print(' - ERROR:', item)
    sys.exit(1)

print('NexusNova Functions App Check readiness: PASS')
print(f' - protected callable checks: {len(passes)}')
print(' - direct onCall exports require enforceAppCheck:true')
print(' - wrapper-based value callables require enforceAppCheck:true')
print(' - external ayeT callback retains HMAC verification + idempotency')
print(' - canonical AdMob SSV v2 retains Google signature verification + idempotency')
print(' - canonical AdMob SSV v2 grants no NVX, Vault credit, or mining acceleration')
print(' - App Check console/product enforcement may remain OFF until phone rollout verification is complete')
