from pathlib import Path

path = Path('NexusNovaAndroid/patch_admob.py')
text = path.read_text(encoding='utf-8')

split_marker = "new_interstitial = '''"
if split_marker not in text:
    raise SystemExit('AdMob new_interstitial block not found')
head, tail = text.split(split_marker, 1)

old_bad = '            if (!miningStartGate && now - lastInterstitialShownAt < INTERSTITIAL_COOLDOWN_MS) {\\n'
old_good = '            if (now - lastInterstitialShownAt < INTERSTITIAL_COOLDOWN_MS) {\\n'
if old_bad in head:
    head = head.replace(old_bad, old_good, 1)
elif old_good not in head:
    raise SystemExit('Legacy interstitial source matcher is not compatible with current NexusAdManager')

new_good = '            if (!miningStartGate && now - lastInterstitialShownAt < INTERSTITIAL_COOLDOWN_MS) {\\n'
new_bad = '            if (now - lastInterstitialShownAt < INTERSTITIAL_COOLDOWN_MS) {\\n'
if new_good not in tail:
    if new_bad not in tail:
        raise SystemExit('New interstitial cooldown matcher not found')
    tail = tail.replace(new_bad, new_good, 1)

text = head + split_marker + tail

# Permanently verify that the generated native manager contains the mandatory
# mining-start exception to the ordinary 3-minute interstitial cooldown.
required_old = "    'mining-start',\n]"
required_new = "    'mining-start',\n    '!miningStartGate && now - lastInterstitialShownAt',\n]"
if required_new not in text:
    if required_old not in text:
        raise SystemExit('AdMob required marker list insertion point not found')
    text = text.replace(required_old, required_new, 1)

path.write_text(text, encoding='utf-8')
print('Fixed AdMob patch compatibility: current showInterstitial matcher + mining-start cooldown exception locked.')
