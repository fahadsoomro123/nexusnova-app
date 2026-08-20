from pathlib import Path

path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NexusAdManager.kt')
text = path.read_text(encoding='utf-8')

signature = 'fun showInterstitial(placement: String? = null, feature: String? = null, testOnly: Boolean = false)'
if signature not in text:
    raise SystemExit('Fresh ad coverage patch requires patched interstitial bridge')

old_gate = '''            val now = System.currentTimeMillis()\n            if (!miningStartGate && now - lastInterstitialShownAt < INTERSTITIAL_COOLDOWN_MS) {\n'''
new_gate = '''            val now = System.currentTimeMillis()\n            val interstitialCooldownMs = if (BuildConfig.NEXUS_ADS_TEST_MODE) {\n                TEST_INTERSTITIAL_COOLDOWN_MS\n            } else {\n                INTERSTITIAL_COOLDOWN_MS\n            }\n            if (!miningStartGate && now - lastInterstitialShownAt < interstitialCooldownMs) {\n'''

if old_gate in text:
    text = text.replace(old_gate, new_gate, 1)
elif 'TEST_INTERSTITIAL_COOLDOWN_MS' not in text:
    raise SystemExit('Interstitial cooldown gate insertion point not found')

const_marker = '        const val INTERSTITIAL_COOLDOWN_MS = 3L * 60L * 1000L\n'
if 'const val TEST_INTERSTITIAL_COOLDOWN_MS = 5_000L' not in text:
    if const_marker not in text:
        raise SystemExit('Interstitial cooldown constant insertion point not found')
    text = text.replace(
        const_marker,
        const_marker + '        const val TEST_INTERSTITIAL_COOLDOWN_MS = 5_000L\n',
        1,
    )

path.write_text(text, encoding='utf-8')

required = [
    signature,
    'TEST_INTERSTITIAL_COOLDOWN_MS',
    'if (BuildConfig.NEXUS_ADS_TEST_MODE)',
    'now - lastInterstitialShownAt < interstitialCooldownMs',
]
missing = [token for token in required if token not in text]
if missing:
    raise SystemExit('Fresh ad coverage patch incomplete: ' + ', '.join(missing))

print('Fresh TEST ad coverage cooldown patch applied')
