from pathlib import Path

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www/js')
BOOST = ROOT / 'nexusnova-admob-nexus-pass-v1.js'
VAULT = ROOT / 'nexusnova-nova-vault-v1.js'
CONFIG = ROOT / 'nexusnova-rewarded-ads-config-v1.js'

for path in (BOOST, VAULT, CONFIG):
    if not path.exists():
        raise SystemExit(f'Missing prepared Android asset: {path}')

boost = BOOST.read_text(encoding='utf-8')
vault = VAULT.read_text(encoding='utf-8')
config = CONFIG.read_text(encoding='utf-8')

MARKER = 'nx-test-boost-reward-fx-v1'
if MARKER in boost:
    print('Test mining boost reward FX already applied.')
    raise SystemExit(0)

# ---------------------------------------------------------------------------
# TEST-only reward overlay. No Firestore write is introduced here. Debug AdMob
# can exercise the complete UX (-2H timer preview + Vault gift + animation),
# while release/production remains on the existing server-authoritative path.
# ---------------------------------------------------------------------------
needle = "  const PANEL_ID = 'nxMiningBoostPanel';\n"
insert = """  const PANEL_ID = 'nxMiningBoostPanel';
  const TEST_REWARD_OVERLAY_KEY = 'nx:nova-test-boost-overlay:v1';
  const TEST_FX_STYLE_ID = 'nxTestBoostFxStyleV1';
  const TEST_FX_ID = 'nxTestBoostFxV1';
  // nx-test-boost-reward-fx-v1
"""
if needle not in boost:
    raise SystemExit('Boost constant insertion point not found.')
boost = boost.replace(needle, insert, 1)

needle = "  function expectedKind() {\n"
helpers = r'''  function readTestRewardOverlay(anchorAt = 0) {
    try {
      const parsed = JSON.parse(localStorage.getItem(TEST_REWARD_OVERLAY_KEY) || '{}');
      if (!anchorAt || Number(parsed.anchorAt || 0) !== Number(anchorAt)) {
        return { anchorAt:Number(anchorAt)||0, extraUses:0, pendingVaults:0 };
      }
      return {
        anchorAt:Number(anchorAt)||0,
        extraUses:Math.max(0, Math.min(TOTAL_LIMIT, Math.floor(Number(parsed.extraUses) || 0))),
        pendingVaults:Math.max(0, Math.floor(Number(parsed.pendingVaults) || 0))
      };
    } catch (_) {
      return { anchorAt:Number(anchorAt)||0, extraUses:0, pendingVaults:0 };
    }
  }

  function writeTestRewardOverlay(next = {}) {
    const safe = {
      anchorAt:Number(next.anchorAt)||0,
      extraUses:Math.max(0, Math.min(TOTAL_LIMIT, Math.floor(Number(next.extraUses) || 0))),
      pendingVaults:Math.max(0, Math.floor(Number(next.pendingVaults) || 0))
    };
    try { localStorage.setItem(TEST_REWARD_OVERLAY_KEY, JSON.stringify(safe)); } catch (_) {}
    window.dispatchEvent(new CustomEvent('nexusnova:test-reward-state', { detail:{...safe} }));
    return safe;
  }

  function applyStoredTestOverlay(raw = {}) {
    if (!testMode) return raw;
    const active = raw.miningActive === true || raw.active === true;
    const anchorAt = Number(raw.miningLastUpdate ?? raw.anchorAt) || 0;
    const startedAt = Number(raw.miningStartedAt ?? raw.startedAt) || 0;
    if (!active || anchorAt <= 0 || startedAt <= 0) return raw;
    const overlay = readTestRewardOverlay(anchorAt);
    if (overlay.extraUses < 1) return raw;
    const effectiveStartedAt = startedAt - overlay.extraUses * BOOST_MS;
    return {
      ...raw,
      miningStartedAt: effectiveStartedAt,
      startedAt: effectiveStartedAt,
      miningLastUpdate: anchorAt,
      anchorAt
    };
  }

  function ensureBoostFxStyle() {
    if (el(TEST_FX_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = TEST_FX_STYLE_ID;
    style.textContent = `
      #${TEST_FX_ID}{position:fixed;inset:0;z-index:2147483000;pointer-events:none;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 48%,rgba(0,126,255,.18),rgba(1,7,18,.04) 46%,rgba(0,0,0,.12));animation:nxFxFade 2.45s ease both}
      #${TEST_FX_ID}.rain{background:radial-gradient(circle at 50% 48%,rgba(112,75,255,.23),rgba(11,4,35,.04) 48%,rgba(0,0,0,.12))}
      .nx-fx-core{position:relative;width:min(82vw,390px);min-height:330px;display:grid;place-items:center;text-align:center;transform:translateY(-3vh)}
      .nx-fx-orbit,.nx-fx-orbit::before,.nx-fx-orbit::after{position:absolute;content:"";border-radius:50%;border:1px solid rgba(96,220,255,.62);box-shadow:0 0 34px rgba(27,176,255,.28);animation:nxFxOrbit 1.35s ease-out both}.nx-fx-orbit{width:210px;height:210px}.nx-fx-orbit::before{inset:22px;animation-delay:.08s}.nx-fx-orbit::after{inset:48px;animation-delay:.16s}
      .rain .nx-fx-orbit,.rain .nx-fx-orbit::before,.rain .nx-fx-orbit::after{border-color:rgba(167,137,255,.7);box-shadow:0 0 38px rgba(113,78,255,.34)}
      .nx-fx-symbol{position:relative;z-index:3;width:105px;height:105px;border-radius:32px;display:grid;place-items:center;font-size:57px;background:linear-gradient(145deg,#078cff,#55e2ff);box-shadow:0 22px 65px rgba(0,151,255,.43),inset 0 1px rgba(255,255,255,.4);animation:nxFxSymbol .8s cubic-bezier(.18,.9,.24,1.2) both}.rain .nx-fx-symbol{background:linear-gradient(145deg,#6557ff,#9c7dff);box-shadow:0 22px 65px rgba(107,76,255,.5),inset 0 1px rgba(255,255,255,.38)}
      .nx-fx-copy{position:relative;z-index:4;margin-top:138px;text-shadow:0 4px 24px rgba(0,0,0,.55)}.nx-fx-kicker{font-size:11px;font-weight:950;letter-spacing:.22em;color:#81dfff}.rain .nx-fx-kicker{color:#c5b4ff}.nx-fx-title{margin-top:6px;font-size:27px;line-height:1.06;font-weight:950;color:#fff}.nx-fx-value{margin-top:10px;font-size:38px;font-weight:1000;letter-spacing:.02em;color:#71f2d5}.rain .nx-fx-value{color:#c7b3ff}.nx-fx-gift{margin-top:6px;font-size:13px;font-weight:900;color:#f3edff}.nx-fx-test{margin-top:8px;font-size:9px;letter-spacing:.12em;font-weight:900;color:rgba(216,231,255,.7)}
      .nx-fx-spark{position:absolute;left:50%;top:48%;width:6px;height:42px;border-radius:999px;background:linear-gradient(#fff,rgba(60,204,255,.02));transform-origin:50% 145px;animation:nxFxSpark 1.05s ease-out both}.rain .nx-fx-spark{height:70px;background:linear-gradient(#fff,rgba(154,124,255,.02));animation-name:nxFxRain}
      #mineBtn.nx-boost-hit{animation:nxMineBoostHit 1.05s ease-out!important;filter:brightness(1.12) saturate(1.18)}
      @keyframes nxFxFade{0%{opacity:0}10%,78%{opacity:1}100%{opacity:0}}@keyframes nxFxOrbit{0%{transform:scale(.28);opacity:0}55%{opacity:1}100%{transform:scale(1.7);opacity:0}}@keyframes nxFxSymbol{0%{transform:scale(.35) rotate(-12deg);opacity:0}62%{transform:scale(1.12) rotate(2deg)}100%{transform:scale(1);opacity:1}}@keyframes nxFxSpark{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--r)) translateY(-28px) scaleY(.2)}25%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--r)) translateY(-150px) scaleY(1.2)}}@keyframes nxFxRain{0%{opacity:0;transform:translate(calc(-50% + var(--x)),-190px) rotate(24deg)}20%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--x)),190px) rotate(24deg)}}@keyframes nxMineBoostHit{0%{transform:scale(1)}35%{transform:scale(1.018);box-shadow:0 0 0 2px rgba(85,245,220,.6),0 0 70px rgba(25,220,255,.48)!important}100%{transform:scale(1)}}
      @media(prefers-reduced-motion:reduce){#${TEST_FX_ID},#${TEST_FX_ID} *{animation-duration:.01ms!important;animation-iteration-count:1!important}}
    `;
    document.head.appendChild(style);
  }

  function playBoostFx(kind = 'booster', options = {}) {
    ensureBoostFxStyle();
    el(TEST_FX_ID)?.remove();
    const rain = String(kind).toLowerCase() === 'rain';
    const overlay = document.createElement('div');
    overlay.id = TEST_FX_ID;
    overlay.className = rain ? 'rain' : 'booster';
    overlay.setAttribute('aria-live', 'polite');
    const sparks = Array.from({length: rain ? 14 : 12}, (_, i) => {
      const r = Math.round((360 / 12) * i);
      const x = Math.round((i - 7) * 19);
      return `<i class="nx-fx-spark" style="--r:${r}deg;--x:${x}px;animation-delay:${(i%5)*0.035}s"></i>`;
    }).join('');
    overlay.innerHTML = `<div class="nx-fx-core">${sparks}<div class="nx-fx-orbit"></div><div class="nx-fx-symbol">${rain ? '☄' : '⚡'}</div><div class="nx-fx-copy"><div class="nx-fx-kicker">${rain ? 'NOVA RAIN' : 'NOVA BOOSTER'}</div><div class="nx-fx-title">ACTIVATED</div><div class="nx-fx-value">−2 HOURS</div><div class="nx-fx-gift">🎁 +1 NOVA VAULT</div>${options.test ? '<div class="nx-fx-test">TEST REWARD PREVIEW</div>' : ''}</div></div>`;
    document.body.appendChild(overlay);
    const miner = el('mineBtn');
    miner?.classList.add('nx-boost-hit');
    setTimeout(() => miner?.classList.remove('nx-boost-hit'), 1150);
    setTimeout(() => overlay.remove(), 2500);
  }

  function applyTestReward(kind = 'booster') {
    if (!testMode || !miningState.active || miningState.complete || miningState.malformed) return false;
    if (miningState.uses >= TOTAL_LIMIT) return false;
    const anchorAt = Number(miningState.anchorAt) || 0;
    if (anchorAt <= 0) return false;
    const overlay = readTestRewardOverlay(anchorAt);
    overlay.extraUses = Math.min(TOTAL_LIMIT, overlay.extraUses + 1);
    overlay.pendingVaults += 1;
    writeTestRewardOverlay(overlay);

    const effectiveStartedAt = Number(miningState.startedAt) - BOOST_MS;
    const uses = Math.min(TOTAL_LIMIT, miningState.uses + 1);
    miningState.startedAt = effectiveStartedAt;
    miningState.uses = uses;
    miningState.boosterUses = Math.min(BOOSTER_LIMIT, uses);
    miningState.rainUses = Math.max(0, Math.min(RAIN_LIMIT, uses - BOOSTER_LIMIT));
    miningState.reducedMs = Math.min(MAX_BOOST_MS, Math.max(0, miningState.anchorAt - effectiveStartedAt));
    miningState.complete = Date.now() - effectiveStartedAt >= DAY;
    render();
    try {
      window.nexusSecureAdoptMiningState?.({
        miningActive:true,
        miningStartedAt:effectiveStartedAt
      });
    } catch (_) {}
    playBoostFx(kind, { test:true, pendingVaults:overlay.pendingVaults });
    return true;
  }

  window.NexusNovaBoostFX = Object.freeze({ play:playBoostFx });
  window.NexusNovaTestRewards = Object.freeze({
    status: () => {
      const anchorAt = Number(miningState.anchorAt) || 0;
      return Object.freeze({...readTestRewardOverlay(anchorAt)});
    },
    consumeVault: () => {
      const anchorAt = Number(miningState.anchorAt) || 0;
      const overlay = readTestRewardOverlay(anchorAt);
      if (overlay.pendingVaults < 1) return false;
      overlay.pendingVaults -= 1;
      writeTestRewardOverlay(overlay);
      return true;
    }
  });

'''
if needle not in boost:
    raise SystemExit('Boost helper insertion point not found.')
boost = boost.replace(needle, helpers + needle, 1)

# Re-apply persisted TEST offset whenever Firestore refreshes the base session.
needle = "  function adoptMiningState(raw = {}) {\n"
replacement = "  function adoptMiningState(raw = {}) {\n    raw = applyStoredTestOverlay(raw);\n"
if needle not in boost:
    raise SystemExit('adoptMiningState patch point not found.')
boost = boost.replace(needle, replacement, 1)

# Keep the authoritative visible timer aligned with the TEST overlay after a
# base Firestore snapshot refresh.
needle = "    miningState.malformed = malformed;\n    render();\n"
replacement = """    miningState.malformed = malformed;
    render();
    if (testMode && active && !malformed) {
      const testOverlay = readTestRewardOverlay(anchorAt);
      if (testOverlay.extraUses > 0) {
        setTimeout(() => {
          try { window.nexusSecureAdoptMiningState?.({ miningActive:true, miningStartedAt:startedAt }); } catch (_) {}
        }, 0);
      }
    }
"""
if needle not in boost:
    raise SystemExit('adoptMiningState tail patch point not found.')
boost = boost.replace(needle, replacement, 1)

# Replace old no-value TEST completion popup with reward application + FX.
old = """    if (detail.testMode === true || testMode || !SERVER_VERIFIED_BOOST_ENABLED) {
      await premiumMessage(
        'TEST Ad Completed',
        `${kindLabel(kind)} ad flow is working. TEST ads never reduce mining time or change NVX.`,
        'spark'
      );
      return;
    }

    await premiumMessage(
      'Mining Boost Not Live Yet',
      'Server-verified mining boost fulfillment is not enabled. No mining value was changed.',
      'security'
    );
"""
new = """    if (detail.testMode === true || testMode) {
      if (!applyTestReward(kind)) {
        await premiumMessage('Boost Not Applied', 'The TEST reward could not be attached to the current mining session.', 'security');
      }
      return;
    }

    await premiumMessage(
      'Mining Boost Not Live Yet',
      'Server-verified mining boost fulfillment is not enabled. No mining value was changed.',
      'security'
    );
"""
if old not in boost:
    raise SystemExit('TEST earned branch patch point not found.')
boost = boost.replace(old, new, 1)

# Update visible TEST copy so it no longer contradicts the new debug behavior.
replacements = {
    'TEST rewarded ad • no mining-time change': 'TEST rewarded ad • -2H +1 Vault preview',
    '`TEST AD — ${kindLabel(kind).toUpperCase()} (NO TIME CHANGE)`': '`TEST AD — ${kindLabel(kind).toUpperCase()} (-2H + VAULT)`',
    "button.title = 'TEST rewarded ad flow. No mining time or NVX changes until server-verified fulfillment is deployed.';": "button.title = 'Debug TEST ads preview a local -2H mining boost and +1 Vault. Production value remains server-verified.';",
    "rewardedReady ? 'TEST AD • NO TIME CHANGE' : 'PREPARING TEST AD…'": "rewardedReady ? 'TEST AD • -2H +1 VAULT' : 'PREPARING TEST AD…'",
    "`${kindLabel(kind)} ready • TEST MODE • no mining-time change`": "`${kindLabel(kind)} ready • TEST MODE • -2H +1 Vault preview`",
    "'Rewarded mining boost testing runs through the native NexusNova Android app. No mining time was changed.'": "'Rewarded mining boost testing runs through the native NexusNova Android app.'"
}
for before, after in replacements.items():
    boost = boost.replace(before, after)

# ---------------------------------------------------------------------------
# Nova Vault panel understands the local TEST gift counter. Real pending Vaults,
# inventory, rewards, cooldowns and all production value remain server-owned.
# ---------------------------------------------------------------------------
needle = "  const FIREBASE_VERSION = '12.1.0';\n"
replacement = "  const FIREBASE_VERSION = '12.1.0';\n  const TEST_REWARD_STATE_EVENT = 'nexusnova:test-reward-state';\n"
if needle not in vault:
    raise SystemExit('Vault constant patch point not found.')
vault = vault.replace(needle, replacement, 1)

needle = "  const cleanInt = value => Math.max(0, Math.floor(Number(value) || 0));\n"
helpers = r'''  const cleanInt = value => Math.max(0, Math.floor(Number(value) || 0));
  const testPendingVaults = () => {
    try { return cleanInt(window.NexusNovaTestRewards?.status?.().pendingVaults); } catch (_) { return 0; }
  };
  const totalPendingVaults = () => cleanInt(state.pending) + testPendingVaults();
'''
if needle not in vault:
    raise SystemExit('Vault helper patch point not found.')
vault = vault.replace(needle, helpers, 1)

# Pending count and buttons/status use combined real + TEST pending count.
vault = vault.replace(
    "if ($('nxVaultPending')) $('nxVaultPending').textContent = `${state.pending} VAULT${state.pending === 1 ? '' : 'S'}`;",
    "const pendingTotal = totalPendingVaults();\n    const testPending = testPendingVaults();\n    if ($('nxVaultPending')) $('nxVaultPending').textContent = `${pendingTotal} VAULT${pendingTotal === 1 ? '' : 'S'}`;"
)
vault = vault.replace('open.disabled = locked || state.pending < 1;', 'open.disabled = locked || pendingTotal < 1;')
vault = vault.replace("state.pending > 0 ? 'OPEN NOVA VAULT' : 'NO VAULT READY'", "pendingTotal > 0 ? (state.pending > 0 ? 'OPEN NOVA VAULT' : 'OPEN TEST NOVA VAULT') : 'NO VAULT READY'")
vault = vault.replace(
    "else if (state.pending > 0) statusNode.innerHTML = `<strong>${state.pending} free Vault${state.pending === 1 ? '' : 's'} ready</strong> • no ad or payment required to open`;",
    "else if (pendingTotal > 0) statusNode.innerHTML = state.pending > 0 ? `<strong>${pendingTotal} Vault${pendingTotal === 1 ? '' : 's'} ready</strong> • no ad or payment required to open` : `<strong>${testPending} TEST Vault${testPending === 1 ? '' : 's'} ready</strong> • debug reward preview`;"
)

# TEST Vault can be consumed locally for UX testing; it never mints inventory/NVX.
needle = "  async function openVault() {\n    const result = await runAction('vault', () => secureCallable('openNovaVault'));\n"
replacement = """  async function openVault() {
    if (state.pending < 1 && testPendingVaults() > 0) {
      if (window.NexusNovaTestRewards?.consumeVault?.()) {
        render();
        await showMessage('TEST Nova Vault Opened', 'Debug Vault flow confirmed. No production NVX or inventory was minted from this TEST Vault.', 'spark');
        return { testOnly:true };
      }
    }
    const result = await runAction('vault', () => secureCallable('openNovaVault'));
"""
if needle not in vault:
    raise SystemExit('Vault open patch point not found.')
vault = vault.replace(needle, replacement, 1)

# Successful real stored Booster/Rain uses get the same cinematic FX instead of
# the old blocking OK popup.
old = """    await showMessage(
      requested === 'rain' ? 'Nova Rain Applied' : 'Nova Booster Applied',
      `Mining time reduced by 2 hours and +1 Nova Vault gift added. Total reduction this session: ${Number(result.reducedHours || 0)} hours. Next Nova action unlocks in 15 seconds.`,
      'spark'
    );
    return result;
"""
new = """    if (typeof window.NexusNovaBoostFX?.play === 'function') {
      window.NexusNovaBoostFX.play(requested, {
        test:false,
        totalReducedHours:Number(result.reducedHours || 0),
        pendingVaults:Number(result.novaVaultPending || 0)
      });
    } else {
      await showMessage(
        requested === 'rain' ? 'Nova Rain Applied' : 'Nova Booster Applied',
        `Mining time reduced by 2 hours and +1 Nova Vault gift added.`,
        'spark'
      );
    }
    return result;
"""
if old not in vault:
    raise SystemExit('Vault boost success popup patch point not found.')
vault = vault.replace(old, new, 1)

# Keep panel live when TEST Vault state changes.
needle = "  function boot() {\n"
replacement = "  window.addEventListener(TEST_REWARD_STATE_EVENT, () => render());\n\n  function boot() {\n"
if needle not in vault:
    raise SystemExit('Vault event hook patch point not found.')
vault = vault.replace(needle, replacement, 1)

# Public config accurately describes debug behavior without claiming production value.
config = config.replace(
    "rewardLabel: 'TEST mining boost flow — no time change'",
    "rewardLabel: 'TEST mining boost preview — -2H +1 Vault locally'"
)

BOOST.write_text(boost, encoding='utf-8')
VAULT.write_text(vault, encoding='utf-8')
CONFIG.write_text(config, encoding='utf-8')

checks = {
    BOOST: [
        MARKER,
        'function applyTestReward',
        'TEST AD • -2H +1 VAULT',
        'window.NexusNovaBoostFX',
        'window.NexusNovaTestRewards',
        '−2 HOURS',
        '+1 NOVA VAULT',
    ],
    VAULT: [
        'OPEN TEST NOVA VAULT',
        'TEST Nova Vault Opened',
        'window.NexusNovaBoostFX.play',
        'TEST_REWARD_STATE_EVENT',
    ],
    CONFIG: [
        'TEST mining boost preview — -2H +1 Vault locally',
        'serverVerifiedValueEnabled: false',
    ]
}
for path, markers in checks.items():
    text = path.read_text(encoding='utf-8')
    for marker in markers:
        if marker not in text:
            raise SystemExit(f'TEST reward FX verification failed: {path} -> {marker}')

# Security invariants: no client Firestore write path may be introduced and the
# production ad-proof switch stays off.
final_boost = BOOST.read_text(encoding='utf-8')
for forbidden in ['runTransaction(context.db', 'tx.update(ref, { miningStartedAt:']:
    if forbidden in final_boost:
        raise SystemExit(f'Unsafe TEST reward patch introduced Firestore writer: {forbidden}')
if 'const SERVER_VERIFIED_BOOST_ENABLED = false;' not in final_boost:
    raise SystemExit('Production server-proof safety switch changed unexpectedly.')

print('Applied TEST mining reward preview: -2H timer overlay, +1 TEST Vault and cinematic Booster/Rain FX; production value path unchanged.')
