from pathlib import Path

path = Path('firestore.rules')
text = path.read_text(encoding='utf-8')

replacements = {
    "allow create: if signedIn() && validChatMessage();":
        "allow create: if signedIn() && request.auth.token.email_verified == true && validChatMessage();",
    "allow create: if signedIn() && validListingCreate();":
        "allow create: if signedIn() && request.auth.token.email_verified == true && validListingCreate();",
    "allow update: if signedIn() && validListingUpdate();":
        "allow update: if signedIn() && request.auth.token.email_verified == true && validListingUpdate();",
    "allow delete: if signedIn() && request.auth.uid == resource.data.sellerUid;":
        "allow delete: if signedIn() && request.auth.token.email_verified == true && request.auth.uid == resource.data.sellerUid;",
    "allow create: if signedIn() && validOrderCreate();":
        "allow create: if signedIn() && request.auth.token.email_verified == true && validOrderCreate();",
    "allow update: if signedIn() && validOrderUpdate();":
        "allow update: if signedIn() && request.auth.token.email_verified == true && validOrderUpdate();",
}

changed = 0
for old, new in replacements.items():
    if new in text:
        continue
    if old not in text:
        raise SystemExit(f'Unexpected firestore.rules shape; missing: {old}')
    text = text.replace(old, new, 1)
    changed += 1

if changed:
    path.write_text(text, encoding='utf-8')
    print(f'Hardened {changed} chat/marketplace write rules to verified-email users.')
else:
    print('Verified-email chat/marketplace write hardening is already applied.')
