from pathlib import Path
import re
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
index = read('fresh-rebuild/index.html')
auth = read('fresh-rebuild/src/core/auth-service.js')
backend = read('fresh-rebuild/src/core/firebase-backend.js')

def require(text, marker, label):
    if marker not in text:
        errors.append(f'{label}: missing {marker}')

# Current production web client uses the fresh-rebuild source tree.
for marker in [
    "projectId: 'nexusnova-6ade2'",
    'signInWithEmailAndPassword',
    'createUserWithEmailAndPassword',
    'onAuthStateChanged',
    'signOut',
]:
    require(auth, marker, 'Real Firebase Auth')
for marker in [
    'initializeAppCheck',
    'ReCaptchaEnterpriseProvider',
    'CustomProvider',
    'requireFreshAppCheck',
    'getIdToken(true)',
    "doc(firestoreDb, 'users', active.uid)",
    'runTransaction',
]:
    require(backend, marker, 'Firebase backend/App Check')

site_match = re.search(r'<meta\s+name="nexusnova-app-check-site-key"\s+content="([^"]+)"', index)
if not site_match or not site_match.group(1).strip():
    errors.append('App Check site key missing from fresh-rebuild/index.html')
else:
    key = site_match.group(1).strip()
    if len(key) < 20:
        errors.append('App Check site key is implausibly short')
    if key != '6LfEc4Q1AAAAAOohkqSv0p76iwPTeHI98hqVIwls':
        warnings.append('App Check site key differs from the previously recorded legacy key; current fresh-rebuild key is used by the backend')

# Unknown Firestore collections remain denied by default.
if 'match /{document=**}' not in rules or 'allow read, write: if false;' not in rules:
    errors.append('Firestore catch-all deny is missing')

# Client-side Daily Reward writes must remain absent.
if 'function validDailyReward()' in rules:
    errors.append('Legacy client-side Daily Reward rule helper still exists')

# Native WebView security must not be replaced by public QA shims.
for needle in ['public-qa-', 'public-qa-local', 'nexusnova_public_qa_user_v1', 'PUBLIC_DISABLED_ERROR', 'public-mirror auth shim']:
    for path in ['fresh-rebuild/src', 'NexusNovaAndroid/app/src/main/assets/www']:
        for p in (ROOT / path).rglob('*') if (ROOT / path).exists() else []:
            if p.is_file() and p.suffix in {'.js','.html','.kt','.json','.ts'}:
                try:
                    if needle in p.read_text(encoding='utf-8', errors='ignore'):
                        errors.append(f'Forbidden QA marker {needle} found in {p}')
                except OSError:
                    pass

# Mining remains Firestore-authoritative at the application transaction layer.
# Rules currently contain legacy transition validators; record that honestly rather than
# weakening production code or claiming server-only enforcement.
user_match = re.search(r"match /users/\{uid\} \{(.*?)\n\s*\}", rules, re.S)
if user_match:
    block = user_match.group(1)
    direct = [n for n in ['validMiningStart()', 'validMiningFinish()', 'validMiningRollover()', 'validMiningRepair()'] if n in block]
    if direct:
        warnings.append('Mining rules still expose direct authenticated transition validators: ' + ', '.join(direct))
else:
    errors.append('Could not locate /users/{uid} Firestore rule block')

# Do not silently accept embedded provider secrets.
for path in ['fresh-rebuild/src', 'NexusNovaAndroid/app/src/main/assets/www']:
    base = ROOT / path
    if not base.exists():
        continue
    for p in base.rglob('*'):
        if not p.is_file() or p.suffix not in {'.js','.html','.kt','.json','.ts'}:
            continue
        text = p.read_text(encoding='utf-8', errors='ignore')
        if re.search(r'-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----', text):
            errors.append(f'Private key material found in {p}')
        if re.search(r'FLIGHTAPI_API_KEY\s*[:=]\s*["\'][A-Za-z0-9_-]{20,}', text):
            errors.append(f'Embedded FlightAPI credential found in {p}')

if errors:
    print('NexusNova Firebase security readiness: FAIL')
    for item in errors: print(' - ERROR:', item)
    for item in warnings: print(' - WARNING:', item)
    sys.exit(1)

print('NexusNova Firebase security readiness: PASS')
print(' - Real Firebase Auth: enabled in fresh-rebuild auth service')
print(' - Firebase project: nexusnova-6ade2')
print(' - App Check: native CustomProvider or ReCaptcha Enterprise, token refresh enforced')
print(' - Firestore user profile: users/{uid}')
print(' - Mining: Firestore transaction path present; rule transition validators reported honestly')
print(' - Unknown Firestore collections: denied by default')
for item in warnings: print(' - MIGRATION NOTE:', item)
