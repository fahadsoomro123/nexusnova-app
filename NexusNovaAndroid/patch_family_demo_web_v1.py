from pathlib import Path

# NexusNova family/auth persistence patch v2.
# Focused owner only: Firebase Auth persistence + native account handoff.
# Startup presentation, Settings, Nova Hub and APK versioning have dedicated
# owners and MUST NOT be mutated here.

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www')
AUTH = ROOT / 'js/nexusnova-auth-page-v2.js'
CORE = ROOT / 'js/nexusnova-page2-core-launch-v2.js'

for path in (AUTH, CORE):
    if not path.exists():
        raise SystemExit(f'Missing family-auth input: {path}')

# Login/auth persistence and native active-account handoff.
auth = AUTH.read_text(encoding='utf-8')

if 'nx-family-auth-persistence-v2' not in auth:
    anchor = "const db = fsMod.getFirestore(app);\n"
    block = anchor + '''\n// nx-family-auth-persistence-v2\nconst authPersistenceReady = authMod.setPersistence(\n  auth,\n  authMod.browserLocalPersistence\n).catch(error => {\n  console.warn('NexusNova auth persistence:', error);\n});\n'''
    if anchor not in auth:
        raise SystemExit('Auth persistence anchor missing')
    auth = auth.replace(anchor, block, 1)

if 'function markNativeActiveAccount' not in auth:
    anchor = "const nativeShell = typeof window.NexusAndroid?.postMessage === 'function';\n"
    block = anchor + '''\nfunction markNativeActiveAccount(user) {\n  if (!nativeShell || !user?.uid) return;\n  try {\n    window.NexusAndroid.postMessage(JSON.stringify({\n      action: 'setActiveAccount',\n      accountId: String(user.uid)\n    }));\n  } catch (error) {\n    console.warn('NexusNova native account handoff:', error);\n  }\n}\n\nasync function ensureUserProfile(user) {\n  try {\n    await createUserProfile(user);\n    return true;\n  } catch (error) {\n    console.warn('NexusNova profile bootstrap deferred:', error);\n    return false;\n  }\n}\n'''
    if anchor not in auth:
        raise SystemExit('Native auth handoff anchor missing')
    auth = auth.replace(anchor, block, 1)

redirect_old = "  document.documentElement.classList.add('nx-auth-redirecting');\n  window.location.replace('./page2.html');"
redirect_new = "  document.documentElement.classList.add('nx-auth-redirecting');\n  markNativeActiveAccount(auth.currentUser);\n  window.location.replace('./page2.html');"
if redirect_old in auth:
    auth = auth.replace(redirect_old, redirect_new, 1)
elif 'markNativeActiveAccount(auth.currentUser);' not in auth:
    raise SystemExit('Native active-account redirect anchor missing')

login_old = '''      user = result.user;\n      await createUserProfile(user);\n      setMessage('Login successful. Opening NexusNova…', true);'''
login_new = '''      user = result.user;\n      await ensureUserProfile(user);\n      setMessage('Login successful. Opening NexusNova…', true);'''
if login_old in auth:
    auth = auth.replace(login_old, login_new, 1)

signup_old = '''      user = result.user;\n      await createUserProfile(user);\n      try {'''
signup_new = '''      user = result.user;\n      await ensureUserProfile(user);\n      try {'''
if signup_old in auth:
    auth = auth.replace(signup_old, signup_new, 1)

if '    await createUserProfile(result.user);\n' in auth:
    auth = auth.replace('    await createUserProfile(result.user);\n', '    await ensureUserProfile(result.user);\n', 1)

if 'await authPersistenceReady;\n    let user;' not in auth:
    old = '''  try {\n    let user;\n'''
    new = '''  try {\n    await authPersistenceReady;\n    let user;\n'''
    if old not in auth:
        raise SystemExit('Email auth persistence wait anchor missing')
    auth = auth.replace(old, new, 1)

if '// nx-family-auth-restore-wait-v2' not in auth:
    old = '''// Restore Firebase persistence before exposing the form. If the account is\n// already signed in, skip the login screen instead of flashing it and bouncing.\ntry {\n'''
    new = '''// Restore Firebase persistence before exposing the form. If the account is\n// already signed in, skip the login screen instead of flashing it and bouncing.\n// nx-family-auth-restore-wait-v2\ntry {\n  await authPersistenceReady;\n'''
    if old not in auth:
        old = '''// Restore Firebase persistence before exposing the form. If the account is\n// already signed in, skip the login screen instead of flashing it and bouncing.\n// nx-family-auth-restore-wait-v1\ntry {\n  await authPersistenceReady;\n'''
        if old not in auth:
            raise SystemExit('Auth restore persistence anchor missing')
        new = old.replace('nx-family-auth-restore-wait-v1', 'nx-family-auth-restore-wait-v2')
    auth = auth.replace(old, new, 1)

recursive = '''async function ensureUserProfile(user) {\n  try {\n    await ensureUserProfile(user);\n'''
if recursive in auth:
    raise SystemExit('Family auth patch generated recursive ensureUserProfile')
if '''async function ensureUserProfile(user) {\n  try {\n    await createUserProfile(user);\n''' not in auth:
    raise SystemExit('Safe ensureUserProfile implementation missing')

AUTH.write_text(auth, encoding='utf-8')

# Dashboard Firebase persistence settles before page2-core interprets null Auth.
core = CORE.read_text(encoding='utf-8')
if 'nx-family-dashboard-persistence-v2' not in core:
    anchor = "      const auth = authMod.getAuth(app);\n"
    block = anchor + '''      // nx-family-dashboard-persistence-v2\n      try {\n        await authMod.setPersistence(auth, authMod.browserLocalPersistence);\n      } catch (error) {\n        console.warn('NexusNova dashboard auth persistence:', error);\n      }\n'''
    if anchor not in core:
        raise SystemExit('Dashboard persistence anchor missing')
    core = core.replace(anchor, block, 1)
CORE.write_text(core, encoding='utf-8')

checks = {
    AUTH: [
        'nx-family-auth-persistence-v2',
        'markNativeActiveAccount',
        'async function ensureUserProfile(user)',
        'await createUserProfile(user);',
        'await ensureUserProfile(user);',
    ],
    CORE: ['nx-family-dashboard-persistence-v2', 'browserLocalPersistence'],
}
for path, tokens in checks.items():
    data = path.read_text(encoding='utf-8')
    missing = [token for token in tokens if token not in data]
    if missing:
        raise SystemExit(f'Family auth verification failed for {path}: {missing}')

print('Family auth persistence v2 applied: focused auth/session handoff only; startup, Settings, Nova Hub and versioning untouched.')
