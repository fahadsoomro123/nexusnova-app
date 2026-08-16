from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')

old_length = '''        if (password.length < 6) {\n\n            showMessage(\n                "Password must contain at least 6 characters."\n            );\n\n            return;\n        }'''
new_length = '''        // Preserve compatibility with existing accounts while requiring a\n        // stronger password for every newly created NexusNova account.\n        if (!loginMode && password.length < 10) {\n\n            showMessage(\n                "New passwords must contain at least 10 characters."\n            );\n\n            return;\n        }'''

if new_length not in text:
    if old_length not in text:
        raise SystemExit('Signup password validation block changed unexpectedly; refusing edit.')
    text = text.replace(old_length, new_length, 1)

old_exists = '''                errorText =\n                    "This email is already registered. Please use Login.";'''
new_exists = '''                // Avoid turning signup errors into a precise account lookup.\n                errorText =\n                    "Unable to create this account. Try Login if you may already have an account.";'''
if new_exists not in text:
    if old_exists not in text:
        raise SystemExit('Email-already-in-use message changed unexpectedly; refusing edit.')
    text = text.replace(old_exists, new_exists, 1)

old_weak = '''                errorText =\n                    "Password must contain at least 6 characters.";'''
new_weak = '''                errorText =\n                    "New passwords must contain at least 10 characters.";'''
if new_weak not in text:
    if old_weak not in text:
        raise SystemExit('Weak-password message changed unexpectedly; refusing edit.')
    text = text.replace(old_weak, new_weak, 1)

path.write_text(text, encoding='utf-8')
print('Hardened signup password minimum without blocking existing account logins; reduced account-enumeration detail.')
