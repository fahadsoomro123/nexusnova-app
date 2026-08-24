from pathlib import Path
import re
import subprocess
import sys

ROOT = Path('.')
SELF = '.github/scripts/repo-secret-readiness.py'
errors = []
notes = []


def tracked_files():
    raw = subprocess.check_output(['git', 'ls-files', '-z'])
    return [Path(item.decode('utf-8')) for item in raw.split(b'\0') if item]


files = tracked_files()

# Signing/private credential material must never be committed. Public client
# configuration such as Firebase web apiKey/google-services.json is not treated
# as a secret by this guard.
blocked_suffixes = {
    '.jks', '.keystore', '.p12', '.pfx', '.pem', '.key'
}
blocked_names = {
    '.env', 'credentials.json', 'service-account.json', 'service_account.json'
}

for path in files:
    name = path.name.lower()
    suffix = path.suffix.lower()
    if suffix in blocked_suffixes:
        errors.append(f'blocked private/signing file is tracked: {path.as_posix()}')
    if name in blocked_names:
        errors.append(f'blocked credential file is tracked: {path.as_posix()}')
    if ('service-account' in name or 'service_account' in name) and suffix == '.json':
        errors.append(f'possible service-account credential file is tracked: {path.as_posix()}')
    if name.startswith('.env.') and name != '.env.example':
        errors.append(f'blocked environment file is tracked: {path.as_posix()}')

# High-confidence credential signatures only. This intentionally avoids generic
# words such as "password" or public Firebase client keys to reduce false alarms.
patterns = [
    ('private-key-header', re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')),
    ('github-classic-token', re.compile(r'\bghp_[A-Za-z0-9]{30,}\b')),
    ('github-fine-grained-token', re.compile(r'\bgithub_pat_[A-Za-z0-9_]{30,}\b')),
    ('openai-project-key', re.compile(r'\bsk-proj-[A-Za-z0-9_-]{20,}\b')),
    ('stripe-live-secret', re.compile(r'\bsk_live_[A-Za-z0-9]{20,}\b')),
    ('aws-access-key', re.compile(r'\bAKIA[0-9A-Z]{16}\b')),
    ('service-account-private-key', re.compile(r'"private_key"\s*:\s*"-----BEGIN PRIVATE KEY')),
]

for path in files:
    rel = path.as_posix()
    if rel == SELF or not path.is_file():
        continue
    try:
        if path.stat().st_size > 2_000_000:
            notes.append(f'skipped large tracked file: {rel}')
            continue
        data = path.read_bytes()
        if b'\x00' in data:
            continue
        text = data.decode('utf-8')
    except (UnicodeDecodeError, OSError):
        continue

    for label, pattern in patterns:
        if pattern.search(text):
            errors.append(f'{label} signature detected in tracked file: {rel}')

if errors:
    print('NexusNova repository secret readiness: FAIL')
    for item in errors:
        print(' - ERROR:', item)
    sys.exit(1)

print('NexusNova repository secret readiness: PASS')
print(f' - tracked files checked: {len(files)}')
print(' - private signing/credential extensions: absent')
print(' - high-confidence private token/key signatures: absent')
print(' - Firebase client configuration is intentionally not classified as a private secret')
for item in notes[:10]:
    print(' - NOTE:', item)
