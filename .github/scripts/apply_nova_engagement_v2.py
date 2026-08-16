from pathlib import Path

ROOT = Path('.')
MINING = ROOT / 'js/rewards-security-v1.js'
VAULT = ROOT / 'js/nexusnova-nova-vault-v1.js'
FUNCTIONS = ROOT / 'functions/index.js'
READINESS = ROOT / '.github/scripts/nova-vault-readiness.py'

for path in (MINING, VAULT, FUNCTIONS, READINESS):
    if not path.exists():
        raise SystemExit(f'Missing required file: {path}')

mining = MINING.read_text(encoding='utf-8')
vault = VAULT.read_text(encoding='utf-8')
functions = FUNCTIONS.read_text(encoding='utf-8')
readiness = READINESS.read_text(encoding='utf-8')

# ---------------------------------------------------------------------------
# Mining start v2: user intent starts mining first. The full-screen ad is a
# best-effort monetization attempt only; no-fill, timeout, cooldown or a missing
# native bridge can never force the user to tap START MINING again.
# ---------------------------------------------------------------------------
start = mining.find('  async function requireMiningStartAd() {')
end = mining.find('\n\n  async function startMining() {', start)
if start < 0 or end < 0:
    if 'function requestMiningStartAdBestEffort()' not in mining:
        raise SystemExit('Mining start-ad function patch point not found.')
else:
    replacement = '''  function requestMiningStartAdBestEffort() {\n    const hasBridge =\n      typeof window.NexusAndroid?.postMessage === 'function' ||\n      typeof window.nexusPostNativeAction === 'function';\n    if (!hasBridge || miningStartAdPending) return Promise.resolve(false);\n\n    miningStartAdPending = true;\n    renderMiningAuthoritative();\n    return new Promise(resolve => {\n      let settled = false;\n      let timeout = null;\n      const finish = shown => {\n        if (settled) return;\n        settled = true;\n        clearTimeout(timeout);\n        window.removeEventListener('nexusnova:native-ad-event', onAdEvent);\n        resolve(Boolean(shown));\n      };\n      const onAdEvent = event => {\n        const detail = event?.detail || {};\n        if (String(detail.provider || '') !== 'admob') return;\n        if (String(detail.placement || '') !== MINING_START_AD_PLACEMENT) return;\n        const type = String(detail.event || '');\n        if (type === 'interstitial-dismissed') {\n          finish(true);\n          return;\n        }\n        if ([\n          'interstitial-unavailable', 'interstitial-skipped',\n          'interstitial-failed', 'interstitial-load-failed'\n        ].includes(type)) finish(false);\n      };\n      window.addEventListener('nexusnova:native-ad-event', onAdEvent);\n      timeout = setTimeout(() => finish(false), MINING_START_AD_TIMEOUT_MS);\n      const posted = postNative('showInterstitialAd', {\n        placement: MINING_START_AD_PLACEMENT,\n        feature: MINING_START_AD_FEATURE,\n        reason: MINING_START_AD_PLACEMENT,\n        testOnly: false\n      });\n      if (!posted) finish(false);\n    }).finally(() => {\n      miningStartAdPending = false;\n      renderMiningAuthoritative();\n    });\n  }'''
    mining = mining[:start] + replacement + mining[end:]

old_start_gate = '''        // Every fresh mining activation is ad-gated. Natural completion and\n        // Time Warp both leave mining inactive, so the exact same gate runs\n        // before the next session. Mining starts only after ad dismissal.\n        await requireMiningStartAd();\n        const started = await startFresh(context);\n        adoptState(started);\n        return started;'''
new_start_gate = '''        // User intent is authoritative: start the secure mining session first.\n        // The Android interstitial is attempted immediately afterwards, but ad\n        // no-fill/failure/timeout never turns mining back off or requires a\n        // second tap. This keeps monetization best-effort and UX frustration low.\n        const started = await startFresh(context);\n        adoptState(started);\n        void requestMiningStartAdBestEffort();\n        return started;'''
if old_start_gate in mining:
    mining = mining.replace(old_start_gate, new_start_gate, 1)
elif 'void requestMiningStartAdBestEffort();' not in mining:
    raise SystemExit('Mining start call-site patch point not found.')

mining = mining.replace(
    "single-owner-v5-start-ad-nova-vault",
    "single-owner-v6-start-first-ad-best-effort-nova-vault"
)
mining = mining.replace(
    "text.textContent = miningStartAdPending ? 'START AD IN PROGRESS' : 'START MINING';\n      timer.textContent = miningStartAdPending ? 'AD REQUIRED • MINING STARTS AFTER DISMISS' : 'MINER OFFLINE';",
    "text.textContent = 'START MINING';\n      timer.textContent = 'MINER OFFLINE';"
)

# ---------------------------------------------------------------------------
# Booster/Rain gift: the gift Vault is created in the exact same server-side
# transaction that consumes the inventory and applies -2H, so retries cannot
# duplicate it and clients cannot mint it directly.
# ---------------------------------------------------------------------------
old_updates = '''    const cooldownUntil=now+NOVA_COOLDOWN;\n    const updates={miningStartedAt:nextStartedAt,novaFeatureCooldownUntil:cooldownUntil};\n    if(kind==="booster") updates.novaBoosterInventory=inventory.booster-1;\n    else updates.novaRainInventory=inventory.rain-1;'''
new_updates = '''    const cooldownUntil=now+NOVA_COOLDOWN;\n    const nextVaultPending=inventory.pendingVaults+1;\n    const updates={\n      miningStartedAt:nextStartedAt,\n      novaFeatureCooldownUntil:cooldownUntil,\n      novaVaultPending:nextVaultPending\n    };\n    if(kind==="booster") updates.novaBoosterInventory=inventory.booster-1;\n    else updates.novaRainInventory=inventory.rain-1;'''
if old_updates in functions:
    functions = functions.replace(old_updates, new_updates, 1)
elif 'const nextVaultPending=inventory.pendingVaults+1;' not in functions:
    raise SystemExit('Nova boost gift update patch point not found.')

old_return = '''      uses:uses+1,\n      cooldownUntil,\n      inventory:{\n        booster:kind==="booster"?inventory.booster-1:inventory.booster,\n        rain:kind==="rain"?inventory.rain-1:inventory.rain,\n        timeWarp:inventory.timeWarp,\n        pendingVaults:inventory.pendingVaults\n      }'''
new_return = '''      uses:uses+1,\n      cooldownUntil,\n      novaVaultPending:nextVaultPending,\n      novaVaultGifted:1,\n      inventory:{\n        booster:kind==="booster"?inventory.booster-1:inventory.booster,\n        rain:kind==="rain"?inventory.rain-1:inventory.rain,\n        timeWarp:inventory.timeWarp,\n        pendingVaults:nextVaultPending\n      }'''
if old_return in functions:
    functions = functions.replace(old_return, new_return, 1)
elif 'novaVaultGifted:1' not in functions:
    raise SystemExit('Nova boost gift return patch point not found.')

# ---------------------------------------------------------------------------
# Client UX: immediately adopt server-returned inventory and tell the user that
# a successful Booster/Rain use gifted a Vault. Firestore onSnapshot remains the
# long-term source of truth.
# ---------------------------------------------------------------------------
old_run_action = '''      if (Number.isFinite(Number(result.balance))) window.nexusApplySecureAccountState?.(result);\n      if (Number.isFinite(Number(result.cooldownUntil))) state.cooldownUntil = Number(result.cooldownUntil);\n      await syncMining(result);'''
new_run_action = '''      if (Number.isFinite(Number(result.balance))) window.nexusApplySecureAccountState?.(result);\n      if (Number.isFinite(Number(result.cooldownUntil))) state.cooldownUntil = Number(result.cooldownUntil);\n      const returnedInventory = result?.inventory;\n      if (returnedInventory && typeof returnedInventory === 'object') {\n        state.booster = cleanInt(returnedInventory.booster);\n        state.rain = cleanInt(returnedInventory.rain);\n        state.timeWarp = cleanInt(returnedInventory.timeWarp);\n        state.pending = cleanInt(returnedInventory.pendingVaults);\n      } else if (Number.isFinite(Number(result.novaVaultPending))) {\n        state.pending = cleanInt(result.novaVaultPending);\n      }\n      await syncMining(result);'''
if old_run_action in vault:
    vault = vault.replace(old_run_action, new_run_action, 1)
elif 'const returnedInventory = result?.inventory;' not in vault:
    raise SystemExit('Nova client inventory adoption patch point not found.')

vault = vault.replace(
    '1 free Vault after every natural 24H mining completion',
    '1 Vault after natural 24H completion • +1 gift after every Booster/Rain use'
)
vault = vault.replace(
    'Complete a natural 24-hour mining session to earn your next free Nova Vault.',
    'Complete a natural 24-hour mining session or use a stored Booster/Rain to earn your next Nova Vault.'
)
vault = vault.replace(
    'Vault odds: NVX 60% • Booster 18% • Nova Rain 17% • 24H Time Warp 5% • NVX reward is 1–10. Time Warp never creates another Vault.',
    'Vault odds: NVX 60% • Booster 18% • Nova Rain 17% • 24H Time Warp 5% • NVX reward is 1–10. Every successful Booster/Rain use gifts +1 Vault; Time Warp never creates another Vault.'
)
vault = vault.replace(
    '`Mining time reduced by 2 hours. Total reduction this session: ${Number(result.reducedHours || 0)} hours. Next Nova action unlocks in 15 seconds.`',
    '`Mining time reduced by 2 hours and +1 Nova Vault gift added. Total reduction this session: ${Number(result.reducedHours || 0)} hours. Next Nova action unlocks in 15 seconds.`'
)

# ---------------------------------------------------------------------------
# Readiness contract follows the new UX and protects against accidental return
# to hard ad-gating or removal of the atomic gift.
# ---------------------------------------------------------------------------
readiness = readiness.replace("    'await requireMiningStartAd();',", "    'function requestMiningStartAdBestEffort()',\n    'void requestMiningStartAdBestEffort();',")
readiness = readiness.replace(
    '    "single-owner-v5-start-ad-nova-vault"',
    '    "single-owner-v6-start-first-ad-best-effort-nova-vault"'
)
readiness = readiness.replace(
    "    'novaVaultPending=optionalProfileInt(d,\"novaVaultPending\",0)+1'",
    "    'novaVaultPending=optionalProfileInt(d,\"novaVaultPending\",0)+1',\n    'const nextVaultPending=inventory.pendingVaults+1;',\n    'novaVaultGifted:1'"
)
readiness = readiness.replace(
    "print(' - every fresh Android mining start waits for mining-start ad dismissal')",
    "start_first=mining.find('const started = await startFresh(context);')\nad_after=mining.find('void requestMiningStartAdBestEffort();')\nif start_first < 0 or ad_after < 0 or start_first > ad_after:\n    print('NexusNova Nova Vault readiness: FAIL')\n    print(' - ERROR: mining must start before the best-effort ad request')\n    sys.exit(1)\n\nprint(' - every fresh mining tap starts immediately; Android ad is best-effort and never blocks mining')\nprint(' - every successful Booster/Rain use atomically gifts +1 Nova Vault')"
)

MINING.write_text(mining, encoding='utf-8')
VAULT.write_text(vault, encoding='utf-8')
FUNCTIONS.write_text(functions, encoding='utf-8')
READINESS.write_text(readiness, encoding='utf-8')

# Final patcher assertions.
checks = {
    MINING: [
        'function requestMiningStartAdBestEffort()',
        'const started = await startFresh(context);',
        'void requestMiningStartAdBestEffort();',
        'single-owner-v6-start-first-ad-best-effort-nova-vault',
    ],
    FUNCTIONS: [
        'const nextVaultPending=inventory.pendingVaults+1;',
        'novaVaultPending:nextVaultPending',
        'novaVaultGifted:1',
    ],
    VAULT: [
        'const returnedInventory = result?.inventory;',
        '+1 Nova Vault gift added',
        'Every successful Booster/Rain use gifts +1 Vault',
    ],
}
for path, needles in checks.items():
    text = path.read_text(encoding='utf-8')
    for needle in needles:
        if needle not in text:
            raise SystemExit(f'Engagement v2 verification failed in {path}: {needle}')

if 'await requireMiningStartAd();' in MINING.read_text(encoding='utf-8'):
    raise SystemExit('Blocking mining-start ad gate is still present.')

print('Applied NexusNova engagement v2: start-first best-effort ads + Booster/Rain Vault gifts.')
