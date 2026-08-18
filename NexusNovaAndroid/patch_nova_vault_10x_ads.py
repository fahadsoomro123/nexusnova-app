from pathlib import Path

path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NexusAdManager.kt')
text = path.read_text(encoding='utf-8')

# This patch intentionally runs AFTER patch_admob.py. It only extends the
# already-established rewarded-purpose allowlist with Nova Vault 10x. No ad
# unit, frequency cap, mining behavior, sign-in flow or UI is changed here.
route_marker = '            REWARD_PURPOSE_WATCH_AD -> REWARD_PURPOSE_WATCH_AD\n'
route_line = '            REWARD_PURPOSE_VAULT_10X -> REWARD_PURPOSE_VAULT_10X\n'
if route_line not in text:
    if route_marker not in text:
        raise SystemExit('Nova Vault 10x native route anchor missing')
    text = text.replace(route_marker, route_marker + route_line, 1)

constant_marker = '        const val REWARD_PURPOSE_WATCH_AD = "task-watch-ad"\n'
constant_line = '        const val REWARD_PURPOSE_VAULT_10X = "nova-vault-10x"\n'
if constant_line not in text:
    if constant_marker not in text:
        raise SystemExit('Nova Vault 10x native constant anchor missing')
    text = text.replace(constant_marker, constant_marker + constant_line, 1)

path.write_text(text, encoding='utf-8')

verify = path.read_text(encoding='utf-8')
required = [
    'REWARD_PURPOSE_VAULT_10X -> REWARD_PURPOSE_VAULT_10X',
    'const val REWARD_PURPOSE_VAULT_10X = "nova-vault-10x"',
    'ssvIdentityReady',
    'ServerSideVerificationOptions',
    'INTERSTITIAL_ALLOWED_FEATURES',
]
missing = [item for item in required if item not in verify]
if missing:
    raise SystemExit('Nova Vault 10x native verification failed: ' + ', '.join(missing))

print('Added isolated Nova Vault 10x rewarded purpose to the existing secure native AdMob bridge.')
