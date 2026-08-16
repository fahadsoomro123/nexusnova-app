from pathlib import Path

server_path = Path('functions/notifications.js')
server = server_path.read_text(encoding='utf-8')

if 'const MAX_TOKENS_PER_USER = 20;' not in server:
    marker = 'const MAX_TOKENS_PER_TEST = 20;\n'
    if marker not in server:
        raise SystemExit('FCM token limit insertion point changed unexpectedly.')
    server = server.replace(marker, marker + 'const MAX_TOKENS_PER_USER = 20;\n', 1)

old_uid = '''function uidOf(req) {\n  if (!req.auth?.uid) {\n    throw new HttpsError("unauthenticated", "Please sign in first.");\n  }\n  return req.auth.uid;\n}\n'''
new_uid = old_uid + '''\nfunction verifiedUidOf(req) {\n  const uid = uidOf(req);\n  if (req.auth.token?.email_verified !== true) {\n    throw new HttpsError("failed-precondition", "Verify your email before enabling push notifications.");\n  }\n  return uid;\n}\n'''
if 'function verifiedUidOf(req)' not in server:
    if old_uid not in server:
        raise SystemExit('FCM auth helper changed unexpectedly.')
    server = server.replace(old_uid, new_uid, 1)

for export_name in ['registerPushToken', 'removePushToken', 'sendPushTest']:
    old = f'exports.{export_name} = protectedCallable(async (req) => {{\n  const uid = uidOf(req);'
    new = f'exports.{export_name} = protectedCallable(async (req) => {{\n  const uid = verifiedUidOf(req);'
    if new not in server:
        if old not in server:
            raise SystemExit(f'{export_name} auth call changed unexpectedly.')
        server = server.replace(old, new, 1)

old_register = '''  const ref = tokenRef(db, uid, token);\n  const snapshot = await ref.get();\n\n  const data = {'''
new_register = '''  const ref = tokenRef(db, uid, token);\n  const snapshot = await ref.get();\n\n  if (!snapshot.exists) {\n    const existing = await db\n      .collection("users")\n      .doc(uid)\n      .collection("pushTokens")\n      .limit(MAX_TOKENS_PER_USER)\n      .get();\n    if (existing.size >= MAX_TOKENS_PER_USER) {\n      throw new HttpsError(\n        "resource-exhausted",\n        "This account already has the maximum number of push-enabled devices."\n      );\n    }\n  }\n\n  const data = {'''
if 'maximum number of push-enabled devices' not in server:
    if old_register not in server:
        raise SystemExit('FCM registration block changed unexpectedly.')
    server = server.replace(old_register, new_register, 1)

server_path.write_text(server, encoding='utf-8')

client_path = Path('js/nexusnova-fcm-v1.js')
client = client_path.read_text(encoding='utf-8')
old_client = '''    const auth = parts.authMod.getAuth(app);\n    if (!auth.currentUser) throw new Error("Sign in before enabling push notifications.");\n\n    if (typeof window.nexusRequireAppCheck !== "function") {'''
new_client = '''    const auth = parts.authMod.getAuth(app);\n    let user = auth.currentUser;\n    if (!user) throw new Error("Sign in before enabling push notifications.");\n    await user.reload();\n    user = auth.currentUser || user;\n    await user.getIdToken(true);\n    if (!user.emailVerified) {\n      throw new Error("Verify your email before enabling push notifications.");\n    }\n\n    if (typeof window.nexusRequireAppCheck !== "function") {'''
if 'Verify your email before enabling push notifications.' not in client:
    if old_client not in client:
        raise SystemExit('FCM client auth context changed unexpectedly.')
    client = client.replace(old_client, new_client, 1)
client_path.write_text(client, encoding='utf-8')

print('Hardened FCM registration/test/remove with fresh verified Auth, App Check, and a 20-device cap.')
