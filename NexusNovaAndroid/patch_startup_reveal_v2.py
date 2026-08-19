from pathlib import Path

# Legacy compatibility validator.
# Startup v2 used to rewrite the now-removed secondary full-screen shield and
# bump APK versions. The current single-owner startup architecture makes those
# mutations obsolete. Keep this file callable by older workflows, but never let
# it mutate launcher/UI/version state again.

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www')
LAUNCHER = ROOT / 'js/page2.js'
AUTH = ROOT / 'js/nexusnova-auth-page-v2.js'
REWARDS = ROOT / 'js/rewards-security-v1.js'

for path in (LAUNCHER, AUTH, REWARDS):
    if not path.exists():
        raise SystemExit(f'Missing startup-v2 compatibility input: {path}')

launcher = LAUNCHER.read_text(encoding='utf-8')
auth = AUTH.read_text(encoding='utf-8')
rewards = REWARDS.read_text(encoding='utf-8')

if 'nx-single-startup-owner-v4' not in launcher:
    raise SystemExit('Startup v2 compatibility: single startup owner v4 missing')
if 'nxSecureStartupShieldV3' in launcher:
    raise SystemExit('Startup v2 compatibility: deprecated secondary shield returned')
if 'await createUserProfile(user);' not in auth:
    raise SystemExit('Startup v2 compatibility: auth profile recursion fix missing')
if 'await ensureUserProfile(user);' in auth:
    raise SystemExit('Startup v2 compatibility: recursive auth profile helper returned')

# Secure mining must still own an explicit unknown-state renderer. Do not modify
# it here; this validator only guards the existing implementation.
if 'CHECKING SECURE SESSION' not in rewards and 'SESSION SYNC DELAYED' not in rewards:
    raise SystemExit('Startup v2 compatibility: secure mining sync renderer missing')

print('Startup v2 legacy compatibility PASS: no mutations; single startup owner retained.')
