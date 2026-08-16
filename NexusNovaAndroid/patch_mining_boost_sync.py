from pathlib import Path

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www/js')
REWARDS = ROOT / 'rewards-security-v1.js'
BOOST = ROOT / 'nexusnova-admob-nexus-pass-v1.js'

if not REWARDS.exists() or not BOOST.exists():
    raise SystemExit('Mining boost sync patch requires prepared Android web assets.')

rewards = REWARDS.read_text(encoding='utf-8')
boost = BOOST.read_text(encoding='utf-8')

bridge_marker = 'android-mining-boost-sync-v1'

# Expose one narrow timing-adoption hook from the authoritative mining engine.
# The boost transaction result is already a successful Firestore transaction;
# applying its timing fields immediately prevents the visible timer/balance from
# staying one rewarded boost behind while an onSnapshot delivery is delayed.
if bridge_marker not in rewards:
    old = '''  window.nexusSecureStartMining = startMining;\n  window.nexusSecureFinishMining = finishMining;\n  window.nexusSecureRenderMining = () => renderMiningAuthoritative();\n  window.nexusSecureSyncMining = async () => {\n    if (miningState.known) return { ...miningState };\n    return retrySecureSync({ userInitiated:false });\n  };\n'''
    new = '''  window.nexusSecureStartMining = startMining;\n  window.nexusSecureFinishMining = finishMining;\n  window.nexusSecureRenderMining = () => renderMiningAuthoritative();\n\n  // android-mining-boost-sync-v1\n  // A successful boost transaction already contains authoritative timing.\n  // Adopt it immediately so the mining countdown and projected balance cannot\n  // remain one Firestore snapshot behind the Booster/Rain counters.\n  window.nexusSecureAdoptMiningState = state => {\n    if (!state || typeof state !== 'object') return { ...miningState };\n    const next = {\n      miningActive: Object.prototype.hasOwnProperty.call(state, 'miningActive')\n        ? state.miningActive === true\n        : miningState.active,\n      miningStartedAt: Object.prototype.hasOwnProperty.call(state, 'miningStartedAt')\n        ? Number(state.miningStartedAt) || 0\n        : miningState.startedAt,\n      balance: Number.isFinite(Number(state.balance))\n        ? Number(state.balance)\n        : miningState.balance,\n      totalMined: Number.isFinite(Number(state.totalMined))\n        ? Number(state.totalMined)\n        : miningState.totalMined\n    };\n    adoptState(next);\n    return { ...miningState };\n  };\n\n  window.nexusSecureSyncMining = async ({ force = false } = {}) => {\n    if (!force && miningState.known) return { ...miningState };\n    return retrySecureSync({ userInitiated:false });\n  };\n'''
    if old not in rewards:
        raise SystemExit('Secure mining sync insertion point not found.')
    rewards = rewards.replace(old, new, 1)

# Mining Boost value changes are disabled until server-verified fulfillment.
# The prepared boost bridge must remain test-only and contain no direct Firestore
# timestamp writer; there is therefore no post-transaction state to adopt.
if 'SERVER_VERIFIED_BOOST_ENABLED = false' not in boost:
    raise SystemExit('Prepared Mining Boost bridge lost its server-proof safety switch.')
if 'runTransaction(context.db' in boost or 'tx.update(ref, { miningStartedAt:' in boost:
    raise SystemExit('Prepared Mining Boost bridge still contains a direct value writer.')

REWARDS.write_text(rewards, encoding='utf-8')
BOOST.write_text(boost, encoding='utf-8')

checks = [
    (REWARDS, bridge_marker),
    (REWARDS, 'window.nexusSecureAdoptMiningState = state =>'),
    (REWARDS, 'window.nexusSecureSyncMining = async ({ force = false } = {}) =>'),
    (BOOST, 'SERVER_VERIFIED_BOOST_ENABLED = false'),
]
for path, needle in checks:
    if needle not in path.read_text(encoding='utf-8'):
        raise SystemExit(f'Mining boost sync verification failed: {needle}')

print('Applied authoritative mining boost -> countdown synchronization bridge.')
