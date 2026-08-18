from pathlib import Path

path = Path('NexusNovaAndroid/app/src/main/assets/www/js/nexusnova-auth-page-v2.js')
text = path.read_text(encoding='utf-8')
old = '''async function ensureUserProfile(user) {\n  try {\n    await ensureUserProfile(user);\n'''
new = '''async function ensureUserProfile(user) {\n  try {\n    await createUserProfile(user);\n'''
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise SystemExit('Auth profile helper shape not found')

path.write_text(text, encoding='utf-8')
if 'async function ensureUserProfile(user)' not in text or 'await createUserProfile(user);' not in text:
    raise SystemExit('Auth profile helper verification failed')
print('Auth profile helper recursion removed; Firestore profile bootstrap is best-effort without self-recursion.')
