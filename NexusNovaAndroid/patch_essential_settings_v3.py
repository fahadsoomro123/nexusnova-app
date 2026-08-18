from pathlib import Path
import hashlib
import shutil

ROOT = Path('.')
SOURCE = ROOT / 'js/nexusnova-account-deletion-settings-v1.js'
TARGET = ROOT / 'NexusNovaAndroid/app/src/main/assets/www/js/nexusnova-account-deletion-settings-v1.js'
SIGNIN = ROOT / 'NexusNovaAndroid/app/src/main/assets/www/index.html'


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


if not SOURCE.exists():
    raise SystemExit('Essential Settings source is missing')
if not TARGET.parent.exists():
    raise SystemExit('Android web shell must be prepared before Settings restore')
if not SIGNIN.exists():
    raise SystemExit('Prepared Android sign-in asset is missing')

source_text = SOURCE.read_text(encoding='utf-8')
required = [
    'NexusNova Essential Settings v3',
    'nxAccountDeletionSettingsRow',
    'nxPrivacyPolicySettingsRow',
    'account-deletion.html',
    'privacy-policy.html',
    'nxSettingsVersion',
]
missing = [token for token in required if token not in source_text]
if missing:
    raise SystemExit('Essential Settings v3 source contract missing: ' + ', '.join(missing))

before_signin = sha256(SIGNIN)
shutil.copy2(SOURCE, TARGET)
if sha256(SIGNIN) != before_signin:
    raise SystemExit('Sign-in asset changed while restoring Settings')

staged = TARGET.read_text(encoding='utf-8')
missing = [token for token in required if token not in staged]
if missing:
    raise SystemExit('Staged Essential Settings v3 verification failed: ' + ', '.join(missing))

print('Restored approved compact Settings v3 into Android shell; sign-in asset remained unchanged.')