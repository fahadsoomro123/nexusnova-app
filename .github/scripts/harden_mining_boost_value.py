from pathlib import Path

# 1) Firestore: remove the client-authorized two-hour timestamp mutation while
# keeping normal mining start/finish/rollover/repair unchanged.
rules_path = Path('firestore.rules')
rules = rules_path.read_text(encoding='utf-8')
start_marker = '    function validMiningBoost() {\n'
end_marker = '    function validMiningFinish() {\n'
if start_marker in rules:
    start = rules.index(start_marker)
    end = rules.index(end_marker, start)
    rules = rules[:start] + rules[end:]
rules = rules.replace('          || validMiningBoost()\n', '', 1)
if 'validMiningBoost()' in rules:
    raise SystemExit('Legacy validMiningBoost rule reference still exists after hardening.')
rules_path.write_text(rules, encoding='utf-8')

# 2) Web bridge: test inventory can prove the UX but can never mutate mining
# timestamps. Production stays off until a server-verified fulfillment exists.
boost_path = Path('js/nexusnova-admob-nexus-pass-v1.js')
boost = boost_path.read_text(encoding='utf-8')
boost = boost.replace(
    '/* NexusNova AdMob Mining Boost bridge v1\n   Compatibility filename retained so existing loaders do not break.\n\n   Reward flow (TEST MODE until production hardening is complete):\n   rewarded ad -> one 2-hour mining-time reduction -> Firestore rules cap the\n   session to six reductions / 12 hours total. No rewarded ad directly mints NVX.\n*/',
    '/* NexusNova AdMob Mining Boost bridge v1.2\n   Compatibility filename retained so existing loaders do not break.\n\n   Security contract:\n   - Debug/test ads prove the UX only and never change mining timestamps/value.\n   - Production mining boosts stay disabled until a server-verified ad proof exists.\n   - Normal 24-hour mining start/finish remains owned by the existing mining engine.\n*/',
    1
)
const_marker = '  const MAX_BOOST_MS = TOTAL_LIMIT * BOOST_MS;\n'
if 'SERVER_VERIFIED_BOOST_ENABLED' not in boost:
    if const_marker not in boost:
        raise SystemExit('Mining Boost constant insertion point not found.')
    boost = boost.replace(
        const_marker,
        const_marker + '  const SERVER_VERIFIED_BOOST_ENABLED = false;\n',
        1
    )

apply_start = "  async function applyBoost(kind = '') {\n"
show_start = "  async function showRewarded(kind = '') {\n"
if apply_start in boost:
    start = boost.index(apply_start)
    end = boost.index(show_start, start)
    blocked_apply = """  async function applyBoost() {\n    throw new Error(\n      'Mining Boost value changes are disabled until server-verified ad proof is deployed.'\n    );\n  }\n\n"""
    boost = boost[:start] + blocked_apply + boost[end:]

old_post = "post('showRewardedAd', { rewardPurpose:'mining-boost', boostKind:expected })"
new_post = "post('showRewardedAd', { rewardPurpose:'mining-boost', boostKind:expected, testOnly:true })"
if old_post in boost:
    boost = boost.replace(old_post, new_post, 1)
if new_post not in boost:
    raise SystemExit('Mining Boost request is not explicitly testOnly.')

# Block release/live inventory before the bridge request even reaches native.
android_gate = """    if (!hasNative()) {\n      await premiumMessage('Android App Required', 'Rewarded mining boosts run through the native NexusNova Android app. No fake boost was issued.', 'security');\n      return { shown:false, native:false };\n    }\n\n    pendingKind = expected;\n"""
android_gate_new = """    if (!hasNative()) {\n      await premiumMessage('Android App Required', 'Rewarded mining boost testing runs through the native NexusNova Android app. No mining time was changed.', 'security');\n      return { shown:false, native:false };\n    }\n    if (!testMode && !SERVER_VERIFIED_BOOST_ENABLED) {\n      await premiumMessage(\n        'Mining Boost Not Live Yet',\n        'Live mining-time rewards need server-verified ad proof. Normal mining continues unchanged.',\n        'security'\n      );\n      return { shown:false, reason:'server-proof-required' };\n    }\n\n    pendingKind = expected;\n"""
if android_gate_new not in boost:
    if android_gate not in boost:
        raise SystemExit('Mining Boost Android gate insertion point not found.')
    boost = boost.replace(android_gate, android_gate_new, 1)

# Replace earned handling with a proof-only test path. No callable in this module
# writes Firestore value or timestamps after this migration.
handle_start = '  async function handleEarned(detail) {\n'
handle_end = '  function handleNativeEvent(event) {\n'
if handle_start in boost:
    start = boost.index(handle_start)
    end = boost.index(handle_end, start)
    hardened_handle = """  async function handleEarned(detail) {\n    const purpose = String(detail.rewardPurpose || '');\n    if (purpose !== 'mining-boost' || Number(detail.boostHours || 0) !== 2) {\n      pendingKind = '';\n      await premiumMessage(\n        'App Update Required',\n        'This Android build uses an older mining-boost contract. No mining time was changed.',\n        'security'\n      );\n      return;\n    }\n\n    const kind = pendingKind || expectedKind();\n    pendingKind = '';\n    if (!kind) {\n      await premiumMessage('Boost Not Applied', 'No eligible active mining boost was pending. No mining value was changed.', 'security');\n      return;\n    }\n\n    if (detail.testMode === true || testMode || !SERVER_VERIFIED_BOOST_ENABLED) {\n      await premiumMessage(\n        'TEST Ad Completed',\n        `${kindLabel(kind)} ad flow is working. TEST ads never reduce mining time or change NVX.`,\n        'spark'\n      );\n      return;\n    }\n\n    await premiumMessage(\n      'Mining Boost Not Live Yet',\n      'Server-verified mining boost fulfillment is not enabled. No mining value was changed.',\n      'security'\n    );\n  }\n\n"""
    boost = boost[:start] + hardened_handle + boost[end:]

# Make UI language truthful in debug/test mode.
boost = boost.replace(
    'Rewarded ad = real session time -2 hours',
    'TEST rewarded ad • no mining-time change',
    1
)
boost = boost.replace(
    "button.title = 'Optional rewarded ad. Completion applies one 2-hour reduction to the current mining session; no advertiser click or install is required.';",
    "button.title = 'TEST rewarded ad flow. No mining time or NVX changes until server-verified fulfillment is deployed.';",
    1
)
boost = boost.replace(
    "else label = `WATCH AD — ${kindLabel(kind).toUpperCase()} (-2H)`;",
    "else label = testMode ? `TEST AD — ${kindLabel(kind).toUpperCase()} (NO TIME CHANGE)` : 'MINING BOOST NOT LIVE';",
    1
)
boost = boost.replace(
    ": rewardedReady ? 'WATCH AD • -2H' : 'PREPARING AD…';",
    ": rewardedReady ? 'TEST AD • NO TIME CHANGE' : 'PREPARING TEST AD…';",
    2
)
boost = boost.replace(
    "? `${kindLabel(kind)} ready • -2h real mining time${testMode ? ' • TEST MODE' : ''}`",
    "? `${kindLabel(kind)} ready • TEST MODE • no mining-time change`",
    1
)

# Static safety invariants.
for forbidden in ['runTransaction(context.db', 'tx.update(ref, { miningStartedAt:']:
    if forbidden in boost:
        raise SystemExit(f'Direct Mining Boost value writer remains: {forbidden}')
for required in [
    'const SERVER_VERIFIED_BOOST_ENABLED = false;',
    "boostKind:expected, testOnly:true",
    'TEST ads never reduce mining time or change NVX.',
    'Mining Boost value changes are disabled until server-verified ad proof is deployed.'
]:
    if required not in boost:
        raise SystemExit(f'Mining Boost hardening marker missing: {required}')
boost_path.write_text(boost, encoding='utf-8')

# 3) Public config: do not advertise an active value reward while proof is absent.
config_path = Path('js/nexusnova-rewarded-ads-config-v1.js')
config = config_path.read_text(encoding='utf-8')
config = config.replace("rewardLabel: '2h mining time reduction',", "rewardLabel: 'TEST mining boost flow — no time change',", 1)
if 'serverVerifiedValueEnabled' not in config:
    config = config.replace(
        "    maxBoostHoursPerSession: 12\n",
        "    maxBoostHoursPerSession: 12,\n    serverVerifiedValueEnabled: false\n",
        1
    )
config_path.write_text(config, encoding='utf-8')

# 4) Android sync patch: there is no successful client boost transaction to adopt.
sync_patch_path = Path('NexusNovaAndroid/patch_mining_boost_sync.py')
sync_patch = sync_patch_path.read_text(encoding='utf-8')
old_sync_start = "old_boost = '''    adoptMiningState(result);\\n"
if old_sync_start in sync_patch:
    start = sync_patch.index(old_sync_start)
    end = sync_patch.index("REWARDS.write_text", start)
    replacement = """# Mining Boost value changes are disabled until server-verified fulfillment.\n# The prepared boost bridge must remain test-only and contain no direct Firestore\n# timestamp writer; there is therefore no post-transaction state to adopt.\nif 'SERVER_VERIFIED_BOOST_ENABLED = false' not in boost:\n    raise SystemExit('Prepared Mining Boost bridge lost its server-proof safety switch.')\nif 'runTransaction(context.db' in boost or 'tx.update(ref, { miningStartedAt:' in boost:\n    raise SystemExit('Prepared Mining Boost bridge still contains a direct value writer.')\n\n"""
    sync_patch = sync_patch[:start] + replacement + sync_patch[end:]

# Remove old BOOST-specific verification entries if still present.
sync_patch = sync_patch.replace("    (BOOST, 'window.nexusSecureAdoptMiningState(result);'),\n", '', 1)
sync_patch = sync_patch.replace("    (BOOST, 'window.nexusSecureSyncMining?.({ force:true });'),\n", '', 1)
if "(BOOST, 'SERVER_VERIFIED_BOOST_ENABLED = false')" not in sync_patch:
    sync_patch = sync_patch.replace(
        "    (REWARDS, 'window.nexusSecureSyncMining = async ({ force = false } = {}) =>'),\n",
        "    (REWARDS, 'window.nexusSecureSyncMining = async ({ force = false } = {}) =>'),\n    (BOOST, 'SERVER_VERIFIED_BOOST_ENABLED = false'),\n",
        1
    )
sync_patch_path.write_text(sync_patch, encoding='utf-8')

print('Hardened Mining Boost: direct client value/timestamp mutation removed; TEST UX remains; normal mining untouched.')
