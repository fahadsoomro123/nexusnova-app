from pathlib import Path

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www/js')
REWARDS = ROOT / 'rewards-security-v1.js'
BOOST = ROOT / 'nexusnova-admob-nexus-pass-v1.js'

if not REWARDS.exists() or not BOOST.exists():
    raise SystemExit('Mining boost sync patch requires prepared Android web assets.')

rewards = REWARDS.read_text(encoding='utf-8')
boost = BOOST.read_text(encoding='utf-8')

bridge_marker = 'android-mining-boost-sync-v1'
adopt_marker = '  window.nexusSecureAdoptMiningState = state => {'
force_sync_marker = '  window.nexusSecureSyncMining = async ({ force = false } = {}) => {'

# The current Nova Vault mining engine already exposes the authoritative state
# adoption + force-sync hooks. Older shells did not, so keep a legacy migration
# fallback while making this patch idempotent for the current v5 engine.
if bridge_marker not in rewards:
    if adopt_marker in rewards and force_sync_marker in rewards:
        rewards = rewards.replace(
            adopt_marker,
            '  // android-mining-boost-sync-v1\n'
            '  // Authoritative server/Vault timing can be adopted immediately so\n'
            '  // the visible countdown cannot lag a confirmed state transition.\n'
            + adopt_marker,
            1
        )
    else:
        old = '''  window.nexusSecureStartMining = startMining;\n  window.nexusSecureFinishMining = finishMining;\n  window.nexusSecureRenderMining = () => renderMiningAuthoritative();\n  window.nexusSecureSyncMining = async () => {\n    if (miningState.known) return { ...miningState };\n    return retrySecureSync({ userInitiated:false });\n  };\n'''
        new = '''  window.nexusSecureStartMining = startMining;\n  window.nexusSecureFinishMining = finishMining;\n  window.nexusSecureRenderMining = () => renderMiningAuthoritative();\n\n  // android-mining-boost-sync-v1\n  // A confirmed authoritative state can be adopted immediately so the mining\n  // countdown and projected balance do not wait for a delayed snapshot.\n  window.nexusSecureAdoptMiningState = state => {\n    if (!state || typeof state !== 'object') return { ...miningState };\n    const next = {\n      miningActive: Object.prototype.hasOwnProperty.call(state, 'miningActive')\n        ? state.miningActive === true\n        : miningState.active,\n      miningStartedAt: Object.prototype.hasOwnProperty.call(state, 'miningStartedAt')\n        ? Number(state.miningStartedAt) || 0\n        : miningState.startedAt,\n      balance: Number.isFinite(Number(state.balance))\n        ? Number(state.balance)\n        : miningState.balance,\n      totalMined: Number.isFinite(Number(state.totalMined))\n        ? Number(state.totalMined)\n        : miningState.totalMined\n    };\n    adoptState(next);\n    return { ...miningState };\n  };\n\n  window.nexusSecureSyncMining = async ({ force = false } = {}) => {\n    if (!force && miningState.known) return { ...miningState };\n    return retrySecureSync({ userInitiated:false });\n  };\n'''
        if old not in rewards:
            raise SystemExit('Secure mining sync insertion point not found for legacy or current engine.')
        rewards = rewards.replace(old, new, 1)

# Rewarded-ad Mining Boost remains value-free. Real -2h changes now come only
# from the server-authoritative Nova Vault inventory path, never from this web
# bridge writing Firestore timestamps itself.
if 'SERVER_VERIFIED_BOOST_ENABLED = false' not in boost:
    raise SystemExit('Prepared Mining Boost bridge lost its server-proof safety switch.')
if 'runTransaction(context.db' in boost or 'tx.update(ref, { miningStartedAt:' in boost:
    raise SystemExit('Prepared Mining Boost bridge still contains a direct value writer.')
if 'window.NexusNovaVault.useBoost' not in boost:
    raise SystemExit('Prepared Mining Boost bridge lost its Nova Vault server-authoritative path.')

REWARDS.write_text(rewards, encoding='utf-8')
BOOST.write_text(boost, encoding='utf-8')

checks = [
    (REWARDS, bridge_marker),
    (REWARDS, 'window.nexusSecureAdoptMiningState = state =>'),
    (REWARDS, 'window.nexusSecureSyncMining = async ({ force = false } = {}) =>'),
    (BOOST, 'SERVER_VERIFIED_BOOST_ENABLED = false'),
    (BOOST, 'window.NexusNovaVault.useBoost'),
]
for path, needle in checks:
    if needle not in path.read_text(encoding='utf-8'):
        raise SystemExit(f'Mining boost sync verification failed: {needle}')

print('Verified authoritative Nova Vault/mining countdown synchronization bridge.')
