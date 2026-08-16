from pathlib import Path

# NexusNova Nova Vault + mining-start ad gate installer.
# This runs after Mining Boost proof-only hardening so inventory boosts are
# server-authoritative while test rewarded inventory remains value-free.


def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'{label} insertion point not found')
    return text.replace(old, new, 1)

# ---------------------------------------------------------------------------
# 1) Authoritative mining engine: one Vault per natural 24H completion and an
#    Android interstitial gate before EVERY fresh mining start.
# ---------------------------------------------------------------------------
path = Path('js/rewards-security-v1.js')
text = path.read_text(encoding='utf-8')

text = replace_once(
    text,
    "  const SYNC_RETRY_DELAYS_MS = [2_500, 7_500, 15_000];\n",
    "  const SYNC_RETRY_DELAYS_MS = [2_500, 7_500, 15_000];\n  const MINING_START_AD_PLACEMENT = 'mining-start';\n  const MINING_START_AD_FEATURE = 'mining';\n  const MINING_START_AD_TIMEOUT_MS = 50_000;\n",
    'mining start ad constants'
)
text = replace_once(
    text,
    "  let syncError = '';\n",
    "  let syncError = '';\n  let miningStartAdPending = false;\n",
    'mining start ad state'
)

old_normalize = """    return {\n      miningActive: data.miningActive === true,\n      miningStartedAt: Number(data.miningStartedAt) || 0,\n      balance: Number.isFinite(balance) ? balance : NaN,\n      totalMined: Number.isFinite(totalMined) ? totalMined : NaN\n    };\n"""
new_normalize = """    return {\n      miningActive: data.miningActive === true,\n      miningStartedAt: Number(data.miningStartedAt) || 0,\n      balance: Number.isFinite(balance) ? balance : NaN,\n      totalMined: Number.isFinite(totalMined) ? totalMined : NaN,\n      novaVaultPending: Math.max(0, Math.floor(Number(data.novaVaultPending) || 0))\n    };\n"""
text = replace_once(text, old_normalize, new_normalize, 'mining normalize vault state')

old_finish = """      const nextBalance = state.balance + MINING_REWARD;\n      const nextTotal = state.totalMined + MINING_REWARD;\n      tx.update(ref, {\n        balance: nextBalance,\n        totalMined: nextTotal,\n        miningActive: false,\n        miningStartedAt: 0,\n        miningLastUpdate: now\n      });\n      return {\n        finished:true,\n        miningActive:false,\n        miningStartedAt:0,\n        balance:nextBalance,\n        totalMined:nextTotal,\n        earned:MINING_REWARD\n      };\n"""
new_finish = """      const nextBalance = state.balance + MINING_REWARD;\n      const nextTotal = state.totalMined + MINING_REWARD;\n      const nextVaultPending = state.novaVaultPending + 1;\n      tx.update(ref, {\n        balance: nextBalance,\n        totalMined: nextTotal,\n        miningActive: false,\n        miningStartedAt: 0,\n        miningLastUpdate: now,\n        novaVaultPending: nextVaultPending\n      });\n      return {\n        finished:true,\n        miningActive:false,\n        miningStartedAt:0,\n        balance:nextBalance,\n        totalMined:nextTotal,\n        novaVaultPending:nextVaultPending,\n        earned:MINING_REWARD,\n        novaVaultEarned:1\n      };\n"""
text = replace_once(text, old_finish, new_finish, 'natural completion Nova Vault grant')

old_offline = """    if (!miningState.active) {\n      button.dataset.state = 'ready';\n      button.classList.remove('active');\n      text.textContent = 'START MINING';\n      timer.textContent = 'MINER OFFLINE';\n      setVisibleBalance(miningState.balance);\n      return;\n    }\n"""
new_offline = """    if (!miningState.active) {\n      button.dataset.state = 'ready';\n      button.classList.remove('active');\n      text.textContent = miningStartAdPending ? 'START AD IN PROGRESS' : 'START MINING';\n      timer.textContent = miningStartAdPending ? 'AD REQUIRED • MINING STARTS AFTER DISMISS' : 'MINER OFFLINE';\n      setVisibleBalance(miningState.balance);\n      return;\n    }\n"""
text = replace_once(text, old_offline, new_offline, 'mining start ad render')

show_marker = """  async function showMessage({ title, text, icon='security', buttonText='Got it', eyebrow='MINING STATUS' }) {\n    try {\n      const ui = await getUI();\n      await ui.alert({ title, text, icon, buttonText, eyebrow });\n    } catch (_) {\n      console.warn(`${title}: ${text}`);\n    }\n  }\n\n"""
ad_helpers = show_marker + """  function postNative(action, payload = {}) {\n    try {\n      if (typeof window.nexusPostNativeAction === 'function') {\n        return window.nexusPostNativeAction(action, payload);\n      }\n      if (typeof window.NexusAndroid?.postMessage !== 'function') return false;\n      window.NexusAndroid.postMessage(JSON.stringify({ action, ...payload }));\n      return true;\n    } catch (_) {\n      return false;\n    }\n  }\n\n  async function requireMiningStartAd() {\n    if (typeof window.NexusAndroid?.postMessage !== 'function' && typeof window.nexusPostNativeAction !== 'function') {\n      throw new Error('NexusNova Android app is required because every new mining session must show the start ad first.');\n    }\n    if (miningStartAdPending) throw new Error('Mining start ad is already in progress.');\n\n    miningStartAdPending = true;\n    renderMiningAuthoritative();\n    try {\n      return await new Promise((resolve, reject) => {\n        let settled = false;\n        let timeout = null;\n        const finish = (ok, error) => {\n          if (settled) return;\n          settled = true;\n          clearTimeout(timeout);\n          window.removeEventListener('nexusnova:native-ad-event', onAdEvent);\n          if (ok) resolve(true);\n          else reject(error instanceof Error ? error : new Error(String(error || 'Mining start ad could not be shown.')));\n        };\n        const onAdEvent = event => {\n          const detail = event?.detail || {};\n          if (String(detail.provider || '') !== 'admob') return;\n          if (String(detail.placement || '') !== MINING_START_AD_PLACEMENT) return;\n          const type = String(detail.event || '');\n          if (type === 'interstitial-dismissed') {\n            finish(true);\n            return;\n          }\n          if ([\n            'interstitial-unavailable', 'interstitial-skipped',\n            'interstitial-failed', 'interstitial-load-failed'\n          ].includes(type)) {\n            const reason = String(detail.reason || detail.message || 'ad-not-ready');\n            finish(false, new Error(`Mining start ad is not ready (${reason}). Try again shortly.`));\n          }\n        };\n        window.addEventListener('nexusnova:native-ad-event', onAdEvent);\n        timeout = setTimeout(() => finish(false, new Error('Mining start ad timed out. Try again.')), MINING_START_AD_TIMEOUT_MS);\n        const posted = postNative('showInterstitialAd', {\n          placement: MINING_START_AD_PLACEMENT,\n          feature: MINING_START_AD_FEATURE,\n          reason: MINING_START_AD_PLACEMENT,\n          testOnly: false\n        });\n        if (!posted) finish(false, new Error('Mining start ad bridge is unavailable.'));\n      });\n    } finally {\n      miningStartAdPending = false;\n      renderMiningAuthoritative();\n    }\n  }\n\n"""
text = replace_once(text, show_marker, ad_helpers, 'mining start ad helper')

old_start = """        if (state.miningActive) {\n          adoptState(state);\n          return state;\n        }\n\n        const started = await startFresh(context);\n"""
new_start = """        if (state.miningActive) {\n          adoptState(state);\n          return state;\n        }\n\n        // Every fresh mining activation is ad-gated. Natural completion and\n        // Time Warp both leave mining inactive, so the exact same gate runs\n        // before the next session. Mining starts only after ad dismissal.\n        await requireMiningStartAd();\n        const started = await startFresh(context);\n"""
text = replace_once(text, old_start, new_start, 'ad before fresh mining start')

old_exports = """  window.nexusSecureStartMining = startMining;\n  window.nexusSecureFinishMining = finishMining;\n  window.nexusSecureRenderMining = () => renderMiningAuthoritative();\n  window.nexusSecureSyncMining = async () => {\n    if (miningState.known) return { ...miningState };\n    return retrySecureSync({ userInitiated:false });\n  };\n  window.nexusMiningEngineVersion = 'single-owner-v4-sync-watchdog';\n"""
new_exports = """  window.nexusSecureStartMining = startMining;\n  window.nexusSecureFinishMining = finishMining;\n  window.nexusSecureRenderMining = () => renderMiningAuthoritative();\n  window.nexusSecureAdoptMiningState = state => {\n    if (state && typeof state === 'object') adoptState(state);\n    return { ...miningState };\n  };\n  window.nexusSecureMiningState = () => ({ ...miningState, startAdPending:miningStartAdPending });\n  window.nexusSecureSyncMining = async ({ force = false } = {}) => {\n    if (!force && miningState.known) return { ...miningState };\n    return retrySecureSync({ userInitiated:false });\n  };\n  window.nexusMiningEngineVersion = 'single-owner-v5-start-ad-nova-vault';\n"""
text = replace_once(text, old_exports, new_exports, 'mining public sync/vault bridge')
path.write_text(text, encoding='utf-8')

# ---------------------------------------------------------------------------
# 2) Firestore: direct clients may grant exactly ONE pending Vault only as part
#    of a valid natural 24H finish/rollover. Inventory/reward fields stay server
#    owned. Direct Mining Boost timestamp mutation must already be gone.
# ---------------------------------------------------------------------------
path = Path('firestore.rules')
rules = path.read_text(encoding='utf-8')
if 'validMiningBoost()' in rules:
    raise SystemExit('Mining Boost client rule must be removed before Nova Vault install')

old_finish_rule = """    function validMiningFinish() {\n      return request.resource.data.diff(resource.data).affectedKeys()\n          .hasOnly(['balance', 'totalMined', 'miningActive', 'miningStartedAt', 'miningLastUpdate'])\n        && resource.data.miningActive == true\n        && resource.data.miningStartedAt is int\n        && resource.data.miningStartedAt > 0\n        && request.time.toMillis() - resource.data.miningStartedAt >= 86400000\n        && resource.data.balance is number\n        && resource.data.totalMined is number\n        && request.resource.data.balance == resource.data.balance + 24\n        && request.resource.data.totalMined == resource.data.totalMined + 24\n        && request.resource.data.miningActive == false\n        && request.resource.data.miningStartedAt == 0\n        && freshMiningMillis(request.resource.data.miningLastUpdate);\n    }\n"""
new_finish_rule = """    function validMiningFinish() {\n      return request.resource.data.diff(resource.data).affectedKeys()\n          .hasOnly(['balance', 'totalMined', 'miningActive', 'miningStartedAt', 'miningLastUpdate', 'novaVaultPending'])\n        && resource.data.miningActive == true\n        && resource.data.miningStartedAt is int\n        && resource.data.miningStartedAt > 0\n        && request.time.toMillis() - resource.data.miningStartedAt >= 86400000\n        && resource.data.balance is number\n        && resource.data.totalMined is number\n        && request.resource.data.balance == resource.data.balance + 24\n        && request.resource.data.totalMined == resource.data.totalMined + 24\n        && request.resource.data.novaVaultPending == resource.data.get('novaVaultPending', 0) + 1\n        && request.resource.data.miningActive == false\n        && request.resource.data.miningStartedAt == 0\n        && freshMiningMillis(request.resource.data.miningLastUpdate);\n    }\n"""
rules = replace_once(rules, old_finish_rule, new_finish_rule, 'Firestore natural Vault grant')

old_rollover = """    function validMiningRollover() {\n      return request.resource.data.diff(resource.data).affectedKeys()\n          .hasOnly(['balance', 'totalMined', 'miningActive', 'miningStartedAt', 'miningLastUpdate'])\n        && resource.data.miningActive == true\n        && resource.data.miningStartedAt is int\n        && resource.data.miningStartedAt > 0\n        && request.time.toMillis() - resource.data.miningStartedAt >= 86400000\n        && resource.data.balance is number\n        && resource.data.totalMined is number\n        && request.resource.data.balance == resource.data.balance + 24\n        && request.resource.data.totalMined == resource.data.totalMined + 24\n        && request.resource.data.miningActive == true\n        && freshMiningMillis(request.resource.data.miningStartedAt)\n        && request.resource.data.miningLastUpdate == request.resource.data.miningStartedAt;\n    }\n"""
new_rollover = """    function validMiningRollover() {\n      return request.resource.data.diff(resource.data).affectedKeys()\n          .hasOnly(['balance', 'totalMined', 'miningActive', 'miningStartedAt', 'miningLastUpdate', 'novaVaultPending'])\n        && resource.data.miningActive == true\n        && resource.data.miningStartedAt is int\n        && resource.data.miningStartedAt > 0\n        && request.time.toMillis() - resource.data.miningStartedAt >= 86400000\n        && resource.data.balance is number\n        && resource.data.totalMined is number\n        && request.resource.data.balance == resource.data.balance + 24\n        && request.resource.data.totalMined == resource.data.totalMined + 24\n        && request.resource.data.novaVaultPending == resource.data.get('novaVaultPending', 0) + 1\n        && request.resource.data.miningActive == true\n        && freshMiningMillis(request.resource.data.miningStartedAt)\n        && request.resource.data.miningLastUpdate == request.resource.data.miningStartedAt;\n    }\n"""
rules = replace_once(rules, old_rollover, new_rollover, 'Firestore rollover Vault grant')
path.write_text(rules, encoding='utf-8')

# ---------------------------------------------------------------------------
# 3) Secure backend: cryptographic Vault draw + stored Booster/Rain/Time Warp,
#    all sharing one 15s server-enforced cooldown.
# ---------------------------------------------------------------------------
path = Path('functions/index.js')
fn = path.read_text(encoding='utf-8')
fn = replace_once(
    fn,
    'const {getFirestore,FieldValue}=require("firebase-admin/firestore");\n',
    'const {getFirestore,FieldValue}=require("firebase-admin/firestore");\nconst {randomInt}=require("node:crypto");\n',
    'crypto random import'
)
fn = replace_once(
    fn,
    'const DAY=86400000, RATE=1, DAILY=5;\n',
    'const DAY=86400000, HOUR=3600000, RATE=1, DAILY=5;\nconst NOVA_COOLDOWN=15*1000;\nconst NOVA_BOOST_MS=2*HOUR;\nconst NOVA_BOOSTER_LIMIT=2;\nconst NOVA_RAIN_LIMIT=4;\nconst NOVA_TOTAL_BOOST_LIMIT=NOVA_BOOSTER_LIMIT+NOVA_RAIN_LIMIT;\nconst NOVA_MAX_BOOST_MS=NOVA_TOTAL_BOOST_LIMIT*NOVA_BOOST_MS;\n',
    'Nova backend constants'
)

helper_marker = """function profileBoolean(data,field){\n  const value=data?.[field];\n  if(typeof value!==\"boolean\") invalidProfile(field);\n  return value;\n}\n"""
helpers = helper_marker + """function optionalProfileInt(data,field,defaultValue=0){\n  const value=data?.[field];\n  if(value===undefined||value===null) return defaultValue;\n  if(typeof value!==\"number\"||!Number.isSafeInteger(value)||value<0){\n    invalidProfile(field);\n  }\n  return value;\n}\nfunction requireNovaCooldown(data,now){\n  const until=optionalProfileInt(data,\"novaFeatureCooldownUntil\",0);\n  if(now<until){\n    throw new HttpsError(\"resource-exhausted\",`Nova cooldown active. Try again in ${Math.ceil((until-now)/1000)} seconds.`);\n  }\n}\nfunction novaInventorySnapshot(data){\n  return {\n    booster:optionalProfileInt(data,\"novaBoosterInventory\",0),\n    rain:optionalProfileInt(data,\"novaRainInventory\",0),\n    timeWarp:optionalProfileInt(data,\"novaTimeWarpInventory\",0),\n    pendingVaults:optionalProfileInt(data,\"novaVaultPending\",0)\n  };\n}\n"""
fn = replace_once(fn, helper_marker, helpers, 'Nova helper functions')

old_server_finish = '    tx.update(r,{balance,totalMined,miningActive:false,miningStartedAt:0,miningLastUpdate:now});\n    return {finished:true,balance,earned,totalMined,miningActive:false};\n'
new_server_finish = '    const novaVaultPending=optionalProfileInt(d,"novaVaultPending",0)+1;\n    tx.update(r,{balance,totalMined,miningActive:false,miningStartedAt:0,miningLastUpdate:now,novaVaultPending});\n    return {finished:true,balance,earned,totalMined,miningActive:false,novaVaultPending,novaVaultEarned:1};\n'
fn = replace_once(fn, old_server_finish, new_server_finish, 'server natural Vault grant')

claim_marker = 'exports.claimDailyReward=protectedCallable(async req=>{\n'
if 'exports.openNovaVault=' not in fn:
    nova_exports = r'''exports.openNovaVault=protectedCallable(async req=>{
  const uid=verifiedUidOf(req), now=Date.now();
  // Draw once per request with Node crypto so Firestore transaction retries do
  // not let a caller reroll. Odds: NVX 60%, Booster 18%, Rain 17%, Warp 5%.
  const roll=randomInt(10000);
  const nvxAmount=randomInt(1,11);
  const rewardType=roll<6000?"nvx":roll<7800?"booster":roll<9500?"rain":"time-warp";
  return db.runTransaction(async tx=>{
    const r=ref(uid), s=await tx.get(r);
    if(!s.exists) throw new HttpsError("not-found","User profile not found.");
    const d=s.data()||{};
    requireNovaCooldown(d,now);
    const inventory=novaInventorySnapshot(d);
    if(inventory.pendingVaults<1){
      throw new HttpsError("failed-precondition","No Nova Vault is ready. Complete a natural 24-hour mining session first.");
    }
    const cooldownUntil=now+NOVA_COOLDOWN;
    const updates={
      novaVaultPending:inventory.pendingVaults-1,
      novaFeatureCooldownUntil:cooldownUntil,
      novaLastVaultReward:rewardType,
      novaLastVaultAmount:rewardType==="nvx"?nvxAmount:1,
      novaLastVaultOpenedAt:now
    };
    let balance=profileNumber(d,"balance");
    let booster=inventory.booster, rain=inventory.rain, timeWarp=inventory.timeWarp;
    if(rewardType==="nvx"){
      balance+=nvxAmount;
      updates.balance=balance;
    }else if(rewardType==="booster"){
      booster+=1;
      updates.novaBoosterInventory=booster;
    }else if(rewardType==="rain"){
      rain+=1;
      updates.novaRainInventory=rain;
    }else{
      timeWarp+=1;
      updates.novaTimeWarpInventory=timeWarp;
    }
    tx.update(r,updates);
    return {
      opened:true,
      reward:{type:rewardType,amount:rewardType==="nvx"?nvxAmount:1},
      balance,
      cooldownUntil,
      novaVaultPending:inventory.pendingVaults-1,
      inventory:{booster,rain,timeWarp,pendingVaults:inventory.pendingVaults-1}
    };
  });
});

exports.useNovaBoost=protectedCallable(async req=>{
  const uid=verifiedUidOf(req), now=Date.now();
  const kind=String(req.data?.kind||"").toLowerCase();
  if(kind!=="booster"&&kind!=="rain") throw new HttpsError("invalid-argument","Unknown Nova boost type.");
  return db.runTransaction(async tx=>{
    const r=ref(uid), s=await tx.get(r);
    if(!s.exists) throw new HttpsError("not-found","User profile not found.");
    const d=s.data()||{};
    requireNovaCooldown(d,now);
    if(profileBoolean(d,"miningActive")!==true) throw new HttpsError("failed-precondition","Start mining before using a Nova boost.");
    const startedAt=optionalProfileInt(d,"miningStartedAt",0);
    const anchorAt=optionalProfileInt(d,"miningLastUpdate",0);
    if(startedAt<=0||anchorAt<=0||startedAt>anchorAt) invalidProfile("mining session");
    if(now-startedAt>=DAY) throw new HttpsError("failed-precondition","Mining session is already complete. Claim it first.");
    const reducedMs=anchorAt-startedAt;
    if(reducedMs<0||reducedMs>NOVA_MAX_BOOST_MS||reducedMs%NOVA_BOOST_MS!==0) invalidProfile("mining boost state");
    const uses=reducedMs/NOVA_BOOST_MS;
    const expected=uses<NOVA_BOOSTER_LIMIT?"booster":"rain";
    if(uses>=NOVA_TOTAL_BOOST_LIMIT) throw new HttpsError("failed-precondition","Maximum 12-hour reduction is already used for this session.");
    if(kind!==expected){
      throw new HttpsError("failed-precondition",expected==="booster"?"Use the two Nova Booster slots first.":"Nova Booster is complete. Use Nova Rain now.");
    }
    const inventory=novaInventorySnapshot(d);
    const available=kind==="booster"?inventory.booster:inventory.rain;
    if(available<1) throw new HttpsError("failed-precondition",`No stored Nova ${kind==="booster"?"Booster":"Rain"} is available.`);
    const nextStartedAt=startedAt-NOVA_BOOST_MS;
    if(anchorAt-nextStartedAt>NOVA_MAX_BOOST_MS) throw new HttpsError("failed-precondition","Maximum 12-hour reduction reached.");
    const cooldownUntil=now+NOVA_COOLDOWN;
    const updates={miningStartedAt:nextStartedAt,novaFeatureCooldownUntil:cooldownUntil};
    if(kind==="booster") updates.novaBoosterInventory=inventory.booster-1;
    else updates.novaRainInventory=inventory.rain-1;
    tx.update(r,updates);
    return {
      applied:true,
      appliedKind:kind,
      miningActive:true,
      miningStartedAt:nextStartedAt,
      miningLastUpdate:anchorAt,
      reducedHours:(uses+1)*2,
      uses:uses+1,
      cooldownUntil,
      inventory:{
        booster:kind==="booster"?inventory.booster-1:inventory.booster,
        rain:kind==="rain"?inventory.rain-1:inventory.rain,
        timeWarp:inventory.timeWarp,
        pendingVaults:inventory.pendingVaults
      }
    };
  });
});

exports.useNovaTimeWarp=protectedCallable(async req=>{
  const uid=verifiedUidOf(req), now=Date.now();
  return db.runTransaction(async tx=>{
    const r=ref(uid), s=await tx.get(r);
    if(!s.exists) throw new HttpsError("not-found","User profile not found.");
    const d=s.data()||{};
    requireNovaCooldown(d,now);
    if(profileBoolean(d,"miningActive")!==true) throw new HttpsError("failed-precondition","Start mining before using a 24H Time Warp.");
    const startedAt=optionalProfileInt(d,"miningStartedAt",0);
    if(startedAt<=0) invalidProfile("mining session");
    if(now-startedAt>=DAY) throw new HttpsError("failed-precondition","Mining session is already complete. Claim it normally instead.");
    const inventory=novaInventorySnapshot(d);
    if(inventory.timeWarp<1) throw new HttpsError("failed-precondition","No 24H Time Warp is stored in your Nova Vault.");
    const earned=DAY/HOUR*RATE;
    const balance=profileNumber(d,"balance")+earned;
    const totalMined=profileNumber(d,"totalMined")+earned;
    const cooldownUntil=now+NOVA_COOLDOWN;
    // Deliberately NO novaVaultPending increment here: Time Warp completion
    // cannot create another Vault, preventing an infinite Vault/Warp loop.
    tx.update(r,{
      balance,totalMined,
      miningActive:false,
      miningStartedAt:0,
      miningLastUpdate:now,
      novaTimeWarpInventory:inventory.timeWarp-1,
      novaFeatureCooldownUntil:cooldownUntil
    });
    return {
      completed:true,
      earned,
      balance,totalMined,
      miningActive:false,
      miningStartedAt:0,
      novaVaultEarned:0,
      cooldownUntil,
      inventory:{
        booster:inventory.booster,
        rain:inventory.rain,
        timeWarp:inventory.timeWarp-1,
        pendingVaults:inventory.pendingVaults
      }
    };
  });
});

'''
    if claim_marker not in fn:
        raise SystemExit('Nova callable insertion point not found')
    fn = fn.replace(claim_marker, nova_exports + claim_marker, 1)
path.write_text(fn, encoding='utf-8')

# ---------------------------------------------------------------------------
# 4) Existing Booster/Rain panel: stored Vault inventory is the only real -2H
#    value path. Test rewarded ads prove UI only and cannot consume inventory.
# ---------------------------------------------------------------------------
path = Path('js/nexusnova-admob-nexus-pass-v1.js')
boost = path.read_text(encoding='utf-8')

blocked_apply = """  async function applyBoost() {\n    throw new Error(\n      'Mining Boost value changes are disabled until server-verified ad proof is deployed.'\n    );\n  }\n\n"""
secure_apply = """  async function applyBoost(kind = '') {\n    if (typeof window.NexusNovaVault?.useBoost !== 'function') {\n      throw new Error('Nova Vault secure boost service is still loading.');\n    }\n    return window.NexusNovaVault.useBoost(kind);\n  }\n\n  function vaultInventory(kind) {\n    const snapshot = window.NexusNovaVault?.inventory?.() || {};\n    return Math.max(0, Number(kind === 'rain' ? snapshot.rain : snapshot.booster) || 0);\n  }\n\n  function novaCooldownMs() {\n    return Math.max(0, Number(window.NexusNovaVault?.cooldownRemainingMs?.()) || 0);\n  }\n\n  async function activateBoost(kind = '') {\n    const requested = String(kind || expectedKind() || '').toLowerCase();\n    if (vaultInventory(requested) > 0) return applyBoost(requested);\n    return showRewarded(requested);\n  }\n\n"""
boost = replace_once(boost, blocked_apply, secure_apply, 'Vault inventory boost bridge')
boost = boost.replace("el('nxBoosterBtn')?.addEventListener('click', () => showRewarded('booster'));", "el('nxBoosterBtn')?.addEventListener('click', () => activateBoost('booster'));", 1)
boost = boost.replace("el('nxRainBtn')?.addEventListener('click', () => showRewarded('rain'));", "el('nxRainBtn')?.addEventListener('click', () => activateBoost('rain'));", 1)

render_start = """    const kind = expectedKind();\n    const adReady = hasNative() && rewardedReady;\n    if (boosterBtn) {\n"""
render_end = """    let text = 'Checking secure mining session…';\n"""
if render_start in boost:
    start = boost.index(render_start)
    end = boost.index(render_end, start)
    new_render = """    const kind = expectedKind();\n    const adReady = hasNative() && rewardedReady;\n    const boosterInventory = vaultInventory('booster');\n    const rainInventory = vaultInventory('rain');\n    const cooldownMs = novaCooldownMs();\n    const cooldownSeconds = Math.ceil(cooldownMs / 1000);\n    if (boosterBtn) {\n      const stored = boosterInventory > 0;\n      boosterBtn.disabled = kind !== 'booster' || miningState.malformed || (stored ? cooldownMs > 0 : !adReady);\n      boosterBtn.textContent = miningState.boosterUses >= BOOSTER_LIMIT\n        ? 'BOOSTER COMPLETE'\n        : stored\n          ? cooldownMs > 0 ? `BOOSTER READY IN ${cooldownSeconds}s` : `USE VAULT BOOSTER • -2H (${boosterInventory})`\n          : !hasNative() ? 'NO VAULT BOOSTER'\n          : rewardedReady ? 'TEST AD • NO TIME CHANGE' : 'PREPARING TEST AD…';\n    }\n    if (rainBtn) {\n      const stored = rainInventory > 0;\n      rainBtn.disabled = kind !== 'rain' || miningState.malformed || (stored ? cooldownMs > 0 : !adReady);\n      rainBtn.textContent = miningState.rainUses >= RAIN_LIMIT\n        ? 'RAIN COMPLETE'\n        : miningState.boosterUses < BOOSTER_LIMIT ? 'UNLOCK AFTER BOOSTER'\n        : stored\n          ? cooldownMs > 0 ? `RAIN READY IN ${cooldownSeconds}s` : `USE VAULT RAIN • -2H (${rainInventory})`\n          : !hasNative() ? 'NO VAULT RAIN'\n          : rewardedReady ? 'TEST AD • NO TIME CHANGE' : 'PREPARING TEST AD…';\n    }\n\n"""
    boost = boost[:start] + new_render + boost[end:]
else:
    if 'USE VAULT BOOSTER' not in boost:
        raise SystemExit('Boost render insertion point not found')

# Unrelated rewarded purposes must never be consumed by the Mining Boost module.
old_purpose = """    if (purpose !== 'mining-boost' || Number(detail.boostHours || 0) !== 2) {\n      pendingKind = '';\n      await premiumMessage(\n        'App Update Required',\n        'This Android build uses an older mining-boost contract. No mining time was changed.',\n        'security'\n      );\n      return;\n    }\n"""
new_purpose = """    if (purpose !== 'mining-boost') return;\n    if (Number(detail.boostHours || 0) !== 2) {\n      pendingKind = '';\n      await premiumMessage(\n        'App Update Required',\n        'This Android build uses an older mining-boost contract. No mining time was changed.',\n        'security'\n      );\n      return;\n    }\n"""
boost = replace_once(boost, old_purpose, new_purpose, 'reward purpose isolation')
if "window.addEventListener('nexusnova:nova-vault-state', render);" not in boost:
    boost = boost.replace(
        "  window.addEventListener('nexusnova:native-ad-event', handleNativeEvent);\n",
        "  window.addEventListener('nexusnova:native-ad-event', handleNativeEvent);\n  window.addEventListener('nexusnova:nova-vault-state', render);\n",
        1
    )
path.write_text(boost, encoding='utf-8')

# ---------------------------------------------------------------------------
# 5) Critical loader + offline shell.
# ---------------------------------------------------------------------------
path = Path('js/final-integrity-fix.js')
loader = path.read_text(encoding='utf-8')
marker = "  loadCritical({flag:'__nxGrowthCenterV1',marker:'data-nx-growth-center',src:'./js/nexusnova-growth-center-v1.js?v=1',error:'NexusNova Growth Center failed to load.'});\n"
addition = marker + "  loadCritical({flag:'__nxNovaVaultV1',marker:'data-nx-nova-vault',src:'./js/nexusnova-nova-vault-v1.js?v=1',error:'NexusNova Nova Vault failed to load.'});\n"
loader = replace_once(loader, marker, addition, 'Nova Vault critical loader')
path.write_text(loader, encoding='utf-8')

path = Path('sw.js')
sw = path.read_text(encoding='utf-8')
sw = sw.replace('const CACHE = "nexusnova-shell-v17-security-origin-lock";', 'const CACHE = "nexusnova-shell-v18-nova-vault";', 1)
asset_marker = '  "./js/nexusnova-rewards-spark-v1.js",\n'
asset_addition = asset_marker + '  "./js/nexusnova-nova-vault-v1.js",\n'
sw = replace_once(sw, asset_marker, asset_addition, 'Nova Vault offline cache')
path.write_text(sw, encoding='utf-8')

# ---------------------------------------------------------------------------
# 6) Native interstitial: mining-start is an explicit mandatory gate, so it is
#    allowed even though Home/Mining is otherwise excluded from monetization
#    interstitials. It bypasses only the normal 3-minute placement cooldown;
#    it never bypasses rewarded-ad/fullscreen conflict or missing-ad checks.
# ---------------------------------------------------------------------------
path = Path('NexusNovaAndroid/patch_admob.py')
ad = path.read_text(encoding='utf-8')
context_marker = '''            val context = mapOf(\\n                "placement" to safePlacement,\\n                "feature" to safeFeature,\\n                "testOnly" to testOnly\\n            )\\n\\n            if (safeFeature.isNotBlank() && safeFeature !in INTERSTITIAL_ALLOWED_FEATURES) {\\n'''
context_new = '''            val context = mapOf(\\n                "placement" to safePlacement,\\n                "feature" to safeFeature,\\n                "testOnly" to testOnly\\n            )\\n            val miningStartGate = safePlacement == "mining-start"\\n\\n            if (!miningStartGate && safeFeature.isNotBlank() && safeFeature !in INTERSTITIAL_ALLOWED_FEATURES) {\\n'''
ad = replace_once(ad, context_marker, context_new, 'native mining-start allow gate')
ad = replace_once(
    ad,
    '            if (now - lastInterstitialShownAt < INTERSTITIAL_COOLDOWN_MS) {\\n',
    '            if (!miningStartGate && now - lastInterstitialShownAt < INTERSTITIAL_COOLDOWN_MS) {\\n',
    'native mining-start cooldown exception'
)
if "'mining-start'," not in ad and '"mining-start"' not in ad.split('required_markers = [',1)[1]:
    ad = ad.replace("    'INTERSTITIAL_RETRY_BASE_MS',\n", "    'INTERSTITIAL_RETRY_BASE_MS',\n    'mining-start',\n", 1)
path.write_text(ad, encoding='utf-8')

# ---------------------------------------------------------------------------
# 7) Android build verification: ensure the exact new web/native contract is in
#    the generated APK shell before Gradle compile.
# ---------------------------------------------------------------------------
path = Path('.github/workflows/nexusnova-android-build.yml')
android = path.read_text(encoding='utf-8')
verify_marker = "          grep -q 'nxAndroidNativeShellBootstrap' NexusNovaAndroid/app/src/main/assets/www/page2.html\n"
verify_add = verify_marker + "          grep -q 'MINING_START_AD_PLACEMENT' NexusNovaAndroid/app/src/main/assets/www/js/rewards-security-v1.js\n          grep -q 'nexusnova-nova-vault-v1.js' NexusNovaAndroid/app/src/main/assets/www/js/final-integrity-fix.js\n          grep -q 'serverVerifiedValueEnabled: false' NexusNovaAndroid/app/src/main/assets/www/js/nexusnova-rewarded-ads-config-v1.js\n          grep -q 'miningStartGate' NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NexusAdManager.kt\n"
android = replace_once(android, verify_marker, verify_add, 'Android Nova Vault/start-ad verification')
syntax_marker = "          node --check NexusNovaAndroid/app/src/main/assets/www/js/nexusnova-daily-secure-claim-v1.js\n"
syntax_add = syntax_marker + "          node --check NexusNovaAndroid/app/src/main/assets/www/js/nexusnova-nova-vault-v1.js\n"
android = replace_once(android, syntax_marker, syntax_add, 'Android Nova Vault syntax check')
path.write_text(android, encoding='utf-8')

print('Installed NexusNova Nova Vault, 15s shared cooldown, secure inventory boosts, Time Warp and mandatory ad-before-mining-start gate.')
