from pathlib import Path

# Legacy compatibility validator. The focused family-auth patch now creates the
# safe helper directly, so this file must never rewrite Auth afterwards.
path = Path('NexusNovaAndroid/app/src/main/assets/www/js/nexusnova-auth-page-v2.js')
text = path.read_text(encoding='utf-8')

recursive = '''async function ensureUserProfile(user) {\n  try {\n    await ensureUserProfile(user);\n'''
safe = '''async function ensureUserProfile(user) {\n  try {\n    await createUserProfile(user);\n'''

if recursive in text:
    raise SystemExit('Auth profile helper recursion returned')
if safe not in text:
    raise SystemExit('Safe Auth profile helper shape not found')
if 'nx-family-auth-persistence-v2' not in text:
    raise SystemExit('Focused family Auth persistence v2 marker missing')

print('Family Auth recursion compatibility PASS: safe helper already present; no mutation required.')
