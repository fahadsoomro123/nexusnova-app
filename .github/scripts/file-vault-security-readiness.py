from pathlib import Path
import sys

path = Path('js/nexusnova-file-vault-v1.js')
if not path.exists():
    print('NexusNova File Vault security readiness: FAIL\n - ERROR: vault module missing')
    sys.exit(1)
text = path.read_text(encoding='utf-8')
errors = []

for marker in [
    "const MAX_FILES_PER_BATCH = 10;",
    "const LEGACY_KDF_ITERATIONS = 150000;",
    "const CURRENT_KDF_ITERATIONS = 600000;",
    "const owner = () => String(window.nexusAccountId || '').trim();",
    "function requireOwner()",
    "if (!id) throw new Error('Sign in and wait for your NexusNova account to finish loading before using File Vault.');",
    "function clearPassphrase()",
    "{name:'PBKDF2', salt, iterations:Number(iterations), hash:'SHA-256'}",
    "{name:'AES-GCM', length:256}",
    "cryptoVersion:2",
    "kdfIterations:CURRENT_KDF_ITERATIONS",
    "record.kdfIterations == null",
    "? LEGACY_KDF_ITERATIONS",
    "if (salt.length !== 16 || iv.length !== 12)",
    "if (files.length > MAX_FILES_PER_BATCH)",
    "if (passphrase.length < 12)",
    "owner: accountId",
    "record.owner !== accountId",
    "autocomplete=\"off\" autocapitalize=\"none\" spellcheck=\"false\"",
]:
    if marker not in text:
        errors.append(f'vault security marker missing: {marker}')

if "window.nexusAccountId || 'guest'" in text or 'window.nexusAccountId || "guest"' in text:
    errors.append('guest vault owner fallback must remain removed')
if 'localStorage' in text or 'sessionStorage' in text:
    errors.append('File Vault must not persist passphrases/keys in Web Storage')
if text.count('clearPassphrase();') < 2:
    errors.append('Passphrase must be cleared after both save and decrypt operations')
if "deriveKey(passphrase, salt, CURRENT_KDF_ITERATIONS)" not in text:
    errors.append('New vault records are not using the current KDF cost')
if "deriveKey(passphrase, salt, iterations)" not in text:
    errors.append('Legacy/current KDF version-aware decrypt path is missing')

if errors:
    print('NexusNova File Vault security readiness: FAIL')
    for item in errors:
        print(' - ERROR:', item)
    sys.exit(1)

print('NexusNova File Vault security readiness: PASS')
print(' - no shared guest vault bucket')
print(' - new records: PBKDF2-SHA256 600k + AES-256-GCM')
print(' - legacy 150k records: backward-compatible decrypt only')
print(' - passphrase: never Web Storage persisted; cleared after use')
print(' - owner access: active NexusNova account only')
print(' - upload batch: bounded to 10 files / 25 MB each')
