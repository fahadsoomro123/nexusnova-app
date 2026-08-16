from pathlib import Path
import re
import sys

ROOT = Path('.')
errors = []
warnings = []
SITE_KEY = '6LfEc4QtAAAAAOohkqSv0p76iwPTeHI98hqVlwIs'

def read(path):
    p = ROOT / path
    if not p.exists():
        errors.append(f'missing required file: {path}')
        return ''
    return p.read_text(encoding='utf-8')

rules = read('firestore.rules')
index = read('index.html')
page2core = read('js/page2-core.js')
page2 = read('js/page2.js')
functions = read('functions/index.js')
daily_bridge = read('js/nexusnova-daily-secure-claim-v1.js')
mining = read('js/rewards-security-v1.js')

# Global deny must remain present so new collections are private by default.
if 'match /{document=**}' not in rules or 'allow read, write: if false;' not in rules:
    errors.append('Firestore catch-all deny is missing')

# Daily Reward must be server-authoritative. The helper may remain in the file
# temporarily, but it must never be reachable from /users update permissions.
user_match = re.search(r"match /users/\{uid\} \{(.*?)\n\s*\}", rules, re.S)
if not user_match:
    errors.append('Could not locate /users/{uid} Firestore rule block')
else:
    user_block = user_match.group(1)
    if 'validDailyReward()' in user_block:
        errors.append('Direct client Daily Reward write is still allowed')

if 'exports.claimDailyReward=protectedCallable' not in functions:
    errors.append('Daily Reward callable is not App Check protected')
if 'verifiedUidOf(req)' not in functions:
    errors.append('Verified-email server guard is missing')
if 'window.nexusSecureClaimDaily' not in daily_bridge:
    errors.append('Secure Daily Reward client bridge is missing')
if 'nexusRequireAppCheck' not in daily_bridge or 'getIdToken(true)' not in daily_bridge:
    errors.append('Daily Reward bridge does not refresh Auth + require App Check')

# App Check should use the same production Enterprise site key on login and dashboard.
for path, text in [('index.html', index), ('js/page2-core.js', page2core)]:
    if 'initializeAppCheck' not in text or 'ReCaptchaEnterpriseProvider' not in text:
        errors.append(f'App Check Enterprise initialization missing in {path}')
if SITE_KEY not in index:
    errors.append('Login/signup App Check site key is blank or mismatched')
if SITE_KEY not in page2:
    errors.append('Dashboard App Check site key is blank or mismatched')

# Sensitive backend-owned collections must not be client writable.
withdrawal = re.search(r"match /withdrawalRequests/\{id\} \{(.*?)\n\s*\}", rules, re.S)
if not withdrawal or 'allow create, update, delete: if false;' not in withdrawal.group(1):
    errors.append('withdrawalRequests must remain server-write-only')

# Public-facing write surfaces must require a verified Firebase Auth email.
verified_write_markers = {
    'chat create': 'request.auth.token.email_verified == true && validChatMessage()',
    'marketplace listing create': 'request.auth.token.email_verified == true && validListingCreate()',
    'marketplace listing update': 'request.auth.token.email_verified == true && validListingUpdate()',
    'marketplace listing delete': 'request.auth.token.email_verified == true && request.auth.uid == resource.data.sellerUid',
    'marketplace order create': 'request.auth.token.email_verified == true && validOrderCreate()',
    'marketplace order update': 'request.auth.token.email_verified == true && validOrderUpdate()',
}
for label, marker in verified_write_markers.items():
    if marker not in rules:
        errors.append(f'{label} lost its verified-email requirement')

# Login anti-bot checkbox still uses Google's public reCAPTCHA v2 test key.
# Keep this visible as a deployment blocker rather than silently treating it as production protection.
if '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI' in index:
    warnings.append('Login/signup checkbox still uses Google reCAPTCHA v2 TEST site key; replace it with a real registered key before public production signup')

# Mining remains a known migration item on the free/Spark architecture. Do not
# pretend it is server-authoritative while rules still permit client transitions.
if user_match:
    block = user_match.group(1)
    direct_mining = [name for name in [
        'validMiningStart()', 'validMiningBoost()', 'validMiningFinish()',
        'validMiningRollover()', 'validMiningRepair()'
    ] if name in block]
    if direct_mining:
        warnings.append(
            'Mining still permits direct authenticated Firestore transitions: ' + ', '.join(direct_mining)
        )
        if 'nexusRequireAppCheck' not in mining or 'getIdToken(true)' not in mining:
            errors.append('Temporary client-owned mining lacks Auth refresh/App Check guard')

if errors:
    print('NexusNova Firebase security readiness: FAIL')
    for item in errors:
        print(' - ERROR:', item)
    for item in warnings:
        print(' - WARNING:', item)
    sys.exit(1)

print('NexusNova Firebase security readiness: PASS')
print(' - Daily Reward: server-authoritative + App Check guarded')
print(' - Login/dashboard App Check Enterprise key: consistent')
print(' - Chat and marketplace writes: verified-email only')
print(' - Withdrawal requests: client create/update/delete denied')
print(' - Default Firestore policy: deny unknown collections')
for item in warnings:
    print(' - MIGRATION/DEPLOYMENT BLOCKER:', item)
