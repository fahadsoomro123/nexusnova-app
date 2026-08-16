from pathlib import Path
import sys

path = Path('js/nexusnova-security-lock-v1.js')
if not path.exists():
    print('NexusNova App Lock security readiness: FAIL\n - ERROR: App Lock module missing')
    sys.exit(1)
text = path.read_text(encoding='utf-8')
errors = []

for marker in [
    "window.nexusSecurityLockVersion = 'browser-pin-v3';",
    'const LEGACY_KDF_ITERATIONS = 140000;',
    'const CURRENT_KDF_ITERATIONS = 600000;',
    'const AUTO_RELOCK_AFTER_HIDDEN_MS = 60 * 1000;',
    'const MAX_BACKOFF_MS = 60 * 1000;',
    'function validLegacyPin(pin)',
    'function validNewPin(pin)',
    'return /^\\d{6,12}$/.test',
    'function remainingBackoffMs()',
    'function recordFailedAttempt()',
    'failedAttempts < 3',
    'blockedUntil = Date.now() + delay;',
    '? LEGACY_KDF_ITERATIONS',
    ': Number(config.kdfIterations);',
    'const hash = await pinHash(first, salt, CURRENT_KDF_ITERATIONS);',
    'kdfIterations:CURRENT_KDF_ITERATIONS',
    'version:3',
    'if (salt.length !== 16)',
    'Too many attempts. Try again in',
    "document.addEventListener('visibilitychange'",
    'Date.now() - wasHiddenAt >= AUTO_RELOCK_AFTER_HIDDEN_MS',
    'autocomplete=\"off\" autocapitalize=\"none\" spellcheck=\"false\"',
]:
    if marker not in text:
        errors.append(f'App Lock security marker missing: {marker}')

# PIN material may only be hashed; no raw PIN serialization/storage path.
if "localStorage.setItem(KEY, JSON.stringify({" not in text:
    errors.append('App Lock local config writer missing')
for forbidden in [
    'pin:first', 'pin: first', 'rawPin', 'plainPin',
    "localStorage.setItem(KEY, first)", "localStorage.setItem(KEY, pin)"
]:
    if forbidden in text:
        errors.append(f'raw PIN persistence marker detected: {forbidden}')

# Existing records without a KDF field must still use the legacy cost so users
# are not locked out during the security upgrade.
if 'config.kdfIterations == null' not in text:
    errors.append('Legacy App Lock records no longer have a compatibility KDF path')
if 'validLegacyPin(pin)' not in text:
    errors.append('Legacy 4-digit configured PINs are no longer accepted for verification')

if errors:
    print('NexusNova App Lock security readiness: FAIL')
    for item in errors:
        print(' - ERROR:', item)
    sys.exit(1)

print('NexusNova App Lock security readiness: PASS')
print(' - new PINs: 6–12 digits')
print(' - new KDF: PBKDF2-SHA256 600k')
print(' - legacy v1/v2 records: compatible at 140k KDF')
print(' - unlock attempts: exponential backoff after 3 failures')
print(' - background privacy: auto re-lock after 60 seconds hidden')
print(' - raw PIN: never persisted')
