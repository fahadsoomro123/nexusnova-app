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

old_boost = '''    adoptMiningState(result);\n    try { await window.nexusSecureSyncMining?.(); } catch (_) {}\n    return result;\n'''
new_boost = '''    adoptMiningState(result);\n    try {\n      if (typeof window.nexusSecureAdoptMiningState === 'function') {\n        window.nexusSecureAdoptMiningState(result);\n      } else {\n        await window.nexusSecureSyncMining?.({ force:true });\n      }\n    } catch (_) {}\n    return result;\n'''
if new_boost not in boost:
    if old_boost not in boost:
        raise SystemExit('Mining boost post-transaction sync insertion point not found.')
    boost = boost.replace(old_boost, new_boost, 1)

REWARDS.write_text(rewards, encoding='utf-8')
BOOST.write_text(boost, encoding='utf-8')

checks = [
    (REWARDS, bridge_marker),
    (REWARDS, 'window.nexusSecureAdoptMiningState = state =>'),
    (REWARDS, 'window.nexusSecureSyncMining = async ({ force = false } = {}) =>'),
    (BOOST, 'window.nexusSecureAdoptMiningState(result);'),
    (BOOST, 'window.nexusSecureSyncMining?.({ force:true });'),
]
for path, needle in checks:
    if needle not in path.read_text(encoding='utf-8'):
        raise SystemExit(f'Mining boost sync verification failed: {needle}')

print('Applied authoritative mining boost -> countdown synchronization bridge.')
