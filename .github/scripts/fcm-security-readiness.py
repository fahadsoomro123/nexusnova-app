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

server = read('functions/notifications.js')
client = read('js/nexusnova-fcm-v1.js')
rules = read('firestore.rules')
sw = read('sw.js')

for marker in [
    'const MAX_TOKENS_PER_USER = 20;',
    'const protectedCallable = (handler) => onCall({ enforceAppCheck: true }, handler);',
    'function verifiedUidOf(req)',
    'req.auth.token?.email_verified !== true',
    'exports.registerPushToken = protectedCallable',
    'exports.removePushToken = protectedCallable',
    'exports.sendPushTest = protectedCallable',
    'const uid = verifiedUidOf(req);',
    '.limit(MAX_TOKENS_PER_USER)',
    'maximum number of push-enabled devices',
    'const TEST_COOLDOWN_MS = 30 * 1000;',
    '.limit(MAX_TOKENS_PER_TEST)',
    'tokenHash(token)',
]:
    if marker not in server:
        errors.append(f'FCM server security marker missing: {marker}')

# All three public notification callables must use the verified UID helper.
if server.count('const uid = verifiedUidOf(req);') < 3:
    errors.append('Not every FCM callable requires a verified Firebase email')

for marker in [
    'Notification.requestPermission()',
    'await user.reload();',
    'await user.getIdToken(true);',
    'if (!user.emailVerified)',
    'await window.nexusRequireAppCheck();',
    'registerPushToken',
    'removePushToken',
    'sendPushTest',
]:
    if marker not in client:
        errors.append(f'FCM client security marker missing: {marker}')

# Permission must stay inside the explicit register flow, not startup boot logic.
if 'registerCurrentDevice(true)' not in client:
    errors.append('Explicit user-click notification permission flow is missing')
if 'registerCurrentDevice(false)' not in client:
    errors.append('Silent refresh path for already-granted permission is missing')

# pushTokens have no client Firestore rule. Admin SDK Functions own the collection;
# the global catch-all deny protects it from client read/write access.
if 'pushTokens' in rules:
    errors.append('Client Firestore rules unexpectedly mention pushTokens; keep tokens backend-owned')
if 'match /{document=**}' not in rules or 'allow read, write: if false;' not in rules:
    errors.append('Firestore global deny needed to protect backend-owned pushTokens is missing')

for marker in [
    'function safeNotificationUrl(raw)',
    'target.origin !== self.location.origin',
    'data: { url: safeNotificationUrl(data.url) }',
]:
    if marker not in sw:
        errors.append(f'Push notification navigation origin lock missing: {marker}')

if errors:
    print('NexusNova FCM security readiness: FAIL')
    for item in errors:
        print(' - ERROR:', item)
    sys.exit(1)

print('NexusNova FCM security readiness: PASS')
print(' - push registration/remove/test: Auth + verified email + App Check')
print(' - per-account push device cap: 20')
print(' - test-send cooldown: 30 seconds; target tokens capped')
print(' - pushTokens: backend-owned, client Firestore access denied')
print(' - permission prompt: explicit user action only')
print(' - notification navigation: same-origin only')
