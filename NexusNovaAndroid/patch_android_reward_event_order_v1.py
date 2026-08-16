from pathlib import Path

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www/js')
BOOST = ROOT / 'nexusnova-admob-nexus-pass-v1.js'
MINING = ROOT / 'rewards-security-v1.js'
MARKER = 'nx-android-reward-event-order-v1'

for path in (BOOST, MINING):
    if not path.exists():
        raise SystemExit(f'Missing prepared Android reward asset: {path}')

boost = BOOST.read_text(encoding='utf-8')
mining = MINING.read_text(encoding='utf-8')

if MARKER not in boost:
    needle = "  let pendingRewardFxKind = '';\n"
    replacement = "  let pendingRewardFxKind = '';\n  let pendingKindClearTimer = null;\n  // nx-android-reward-event-order-v1\n"
    if needle not in boost:
        raise SystemExit('Reward event-order state insertion point not found.')
    boost = boost.replace(needle, replacement, 1)

    # A new ad request owns exactly one pending reward kind.
    needle = "    pendingKind = expected;\n    if (!post('showRewardedAd',"
    replacement = "    clearTimeout(pendingKindClearTimer);\n    pendingKindClearTimer = null;\n    pendingKind = expected;\n    if (!post('showRewardedAd',"
    if needle not in boost:
        raise SystemExit('Reward request pending-kind insertion point not found.')
    boost = boost.replace(needle, replacement, 1)

    # Earned can arrive just after dismissed on some devices/WebView scheduling.
    needle = "    const kind = pendingKind;\n    pendingKind = '';\n"
    replacement = "    clearTimeout(pendingKindClearTimer);\n    pendingKindClearTimer = null;\n    const kind = pendingKind;\n    pendingKind = '';\n"
    if needle not in boost:
        raise SystemExit('Reward earned consumption insertion point not found.')
    boost = boost.replace(needle, replacement, 1)

    old = """      case 'rewarded-dismissed':
        rewardedScreenOpen = false;
        pendingKind = '';
        if (pendingRewardFxKind) {
"""
    new = """      case 'rewarded-dismissed':
        rewardedScreenOpen = false;
        // Do not erase the pending reward immediately. AdMob normally emits
        // earned before dismissed, but WebView/native delivery can reorder by a
        // few milliseconds. Keep a short grace window so the first boost is not
        // lost, while handleEarned still consumes the token exactly once.
        clearTimeout(pendingKindClearTimer);
        pendingKindClearTimer = setTimeout(() => {
          pendingKind = '';
          pendingKindClearTimer = null;
        }, 1800);
        if (pendingRewardFxKind) {
"""
    if old not in boost:
        raise SystemExit('Reward dismissed ordering block not found.')
    boost = boost.replace(old, new, 1)

    # Hard failures can safely invalidate immediately.
    old = """      case 'rewarded-failed':
        rewardedReady = false;
        pendingKind = '';
"""
    new = """      case 'rewarded-failed':
        rewardedReady = false;
        clearTimeout(pendingKindClearTimer);
        pendingKindClearTimer = null;
        pendingKind = '';
"""
    if old not in boost:
        raise SystemExit('Reward failure cleanup block not found.')
    boost = boost.replace(old, new, 1)

# Session Pulse now carries boost details; keep the large mining button label
# stable instead of flickering between MINING ACTIVE and TEST BOOST wording.
old_label = "    text.textContent = previewOffset > 0 ? 'MINING ACTIVE • TEST BOOST' : 'MINING ACTIVE';\n"
if old_label in mining:
    mining = mining.replace(old_label, "    text.textContent = 'MINING ACTIVE';\n", 1)

BOOST.write_text(boost, encoding='utf-8')
MINING.write_text(mining, encoding='utf-8')

checks = [
    (BOOST, MARKER),
    (BOOST, 'pendingKindClearTimer = setTimeout'),
    (BOOST, '}, 1800);'),
    (MINING, "text.textContent = 'MINING ACTIVE';"),
]
for path, needle in checks:
    if needle not in path.read_text(encoding='utf-8'):
        raise SystemExit(f'Android reward event-order verification failed: {path} -> {needle}')

if "MINING ACTIVE • TEST BOOST" in MINING.read_text(encoding='utf-8'):
    raise SystemExit('Mining button still contains TEST BOOST flicker label.')

print('Hardened rewarded earned/dismiss ordering and stabilized the mining button label.')
