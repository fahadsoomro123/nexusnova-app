from pathlib import Path
import sys

ROOT = Path('.')
errors = []
warnings = []


def read(path):
    p = ROOT / path
    if not p.exists():
        errors.append(f'missing required file: {path}')
        return ''
    return p.read_text(encoding='utf-8')

rules = read('firestore.rules')
growth = read('js/nexusnova-growth-center-v1.js')
capture = read('js/nexusnova-referral-capture-v1.js')
link = read('js/nexusnova-growth-referral-link-v1.js')
landing = read('referral.html')

for marker in [
    "request.resource.data.referrerUid != referredUid",
    "exists(/databases/$(database)/documents/referralCodes/$(request.resource.data.code))",
    "get(/databases/$(database)/documents/referralCodes/$(request.resource.data.code)).data.ownerUid == request.resource.data.referrerUid",
    "request.time <= userSource(referredUid).createdAt + duration.value(24, 'h')",
    "return verifiedOwner(referredUid)",
    "resource.data.status == 'pending'",
    ".hasOnly(['status','verifiedAt'])",
    "userSource(referredUid).totalMined >= 24",
    "allow update, delete: if false;",
    "allow delete: if false;",
]:
    if marker not in rules:
        errors.append(f'referral Firestore security marker missing: {marker}')

for marker in [
    'No referral NVX or mining multiplier is minted client-side.',
    'Referral mining multipliers and referral NVX rewards are intentionally OFF',
    "status:'verified'",
    'await user.reload();',
    'await user.getIdToken(true);',
    'num(profile.totalMined) < 24',
]:
    if marker not in growth:
        errors.append(f'Growth referral safety marker missing: {marker}')

# Growth/referral front-end modules must never write NexusNova monetary value.
for path, text in [
    ('growth center', growth),
    ('referral capture', capture),
    ('referral link guard', link),
    ('referral landing', landing),
]:
    for forbidden in [
        'balance:', 'balance +', 'FieldValue.increment', 'rewardNvx',
        'miningRate', 'miningMultiplier', 'totalMined:'
    ]:
        if forbidden in text:
            errors.append(f'{path} contains forbidden referral value-mint marker: {forbidden}')

for marker in [
    "const KEY = 'nexusnova_pending_referral_v1';",
    "const codePattern = /^NVX-[A-Z0-9]{8,16}$/;",
    "if (createdMs && Date.now() - createdMs > 24 * 60 * 60 * 1000)",
    "if (!referrerUid || referrerUid === user.uid)",
    "status:'pending'",
    'createdAt:fs.serverTimestamp()',
]:
    if marker not in capture:
        errors.append(f'referral attribution capture marker missing: {marker}')

for marker in [
    'const CODE_RE=/^NVX-[A-Z0-9]{8,16}$/;',
    "window.location.pathname.replace(/[^/]*$/,'referral.html')",
    'encodeURIComponent(code)',
]:
    if marker not in link:
        errors.append(f'referral link guard marker missing: {marker}')

for marker in [
    "const KEY='nexusnova_pending_referral_v1';",
    "const valid=/^NVX-[A-Z0-9]{8,16}$/.test(code);",
    "localStorage.setItem(KEY,code)",
    "location.replace('./index.html')",
]:
    if marker not in landing:
        errors.append(f'referral landing safety marker missing: {marker}')

# Current Spark/client architecture cannot prove a globally one-code-per-owner
# invariant without adding an immutable per-user code mapping or a server writer.
if 'allow create: if validReferralCodeCreate(code);' in rules:
    warnings.append('Referral code documents are client-created; one verified account can reserve multiple formatted codes. Monetary referral rewards must remain OFF until a one-code-per-owner authority is added.')

if errors:
    print('NexusNova referral security readiness: FAIL')
    for item in errors:
        print(' - ERROR:', item)
    for item in warnings:
        print(' - WARNING:', item)
    sys.exit(1)

print('NexusNova referral security readiness: PASS')
print(' - referral NVX/multipliers: OFF; no client value writer')
print(' - self-referral: denied')
print(' - attribution: immutable + referral-code owner checked')
print(' - existing-account attachment: limited to first 24 hours')
print(' - verification: verified email + first 24 NVX mining-cycle threshold')
for item in warnings:
    print(' - ARCHITECTURE NOTE:', item)
