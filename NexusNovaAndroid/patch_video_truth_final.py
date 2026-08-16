from pathlib import Path

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www')
INDEX = ROOT / 'index.html'
PAGE = ROOT / 'page2.html'
CORE = ROOT / 'js/page2-core.js'
BOOST = ROOT / 'js/nexusnova-admob-nexus-pass-v1.js'
VAULT = ROOT / 'js/nexusnova-nova-vault-v1.js'
MODERN = ROOT / 'js/nexusnova-android-mining-modern-v2.js'
MAIN = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')

for path in (INDEX, PAGE, CORE, BOOST, VAULT, MODERN, MAIN):
    if not path.exists():
        raise SystemExit(f'Missing video-truth patch input: {path}')

index = INDEX.read_text(encoding='utf-8')
page = PAGE.read_text(encoding='utf-8')
core = CORE.read_text(encoding='utf-8')
boost = BOOST.read_text(encoding='utf-8')
vault = VAULT.read_text(encoding='utf-8')
modern = MODERN.read_text(encoding='utf-8')
main = MAIN.read_text(encoding='utf-8')

MARKER = 'nx-video-truth-final-v1'
if MARKER in index and MARKER in core and MARKER in boost and MARKER in vault:
    print('Video-truth final patch already applied.')
    raise SystemExit(0)

# ---------------------------------------------------------------------------
# 1) AUTH: one Firebase version, explicit local persistence, native handoff.
# ---------------------------------------------------------------------------
index = index.replace('firebasejs/10.8.0/', 'firebasejs/12.1.0/')

old_auth_import = '''    getAuth,\n    createUserWithEmailAndPassword,'''
new_auth_import = '''    getAuth,\n    setPersistence,\n    browserLocalPersistence,\n    createUserWithEmailAndPassword,'''
if old_auth_import in index:
    index = index.replace(old_auth_import, new_auth_import, 1)
elif 'browserLocalPersistence' not in index:
    raise SystemExit('Index Firebase Auth import patch point not found.')

old_auth_create = '''const auth =\n    getAuth(app);\n'''
new_auth_create = '''const auth =\n    getAuth(app);\n\ntry {\n    await setPersistence(auth, browserLocalPersistence);\n} catch (error) {\n    console.warn("NexusNova Auth persistence:", error);\n}\n'''
if old_auth_create in index:
    index = index.replace(old_auth_create, new_auth_create, 1)
elif 'await setPersistence(auth, browserLocalPersistence)' not in index:
    raise SystemExit('Index Auth persistence insertion point not found.')

# The login page used to clear Android's same-device marker on the initial
# Firebase null callback. That defeats native session restore. Only explicit
# logout should clear the marker.
old_clear_listener = '''// The Android caller store is tied to the authenticated account. If Firebase\n// restores no user on the login page, clear its last active-account marker.\n// This is a safe no-op in a normal browser/PWA build.\nonAuthStateChanged(auth, user => {\n    if(user || typeof window.NexusAndroid?.postMessage !== "function") return;\n    try{\n        window.NexusAndroid.postMessage(\n            JSON.stringify({action:"clearActiveAccount"})\n        );\n    }catch(error){\n        console.warn("NexusNova Android active-account clear:",error);\n    }\n});\n\n'''
if old_clear_listener in index:
    index = index.replace(old_clear_listener, '', 1)

# Preserve the Android/native route and mark the navigation as a login handoff.
index = index.replace(
    "(location.pathname.startsWith('/nexusnova-native/') ? './page2.html?nxAndroid=1' : './page2.html')",
    "(location.pathname.startsWith('/nexusnova-native/') ? './page2.html?nxAndroid=1&fromLogin=1' : './page2.html')",
    1
)

old_login_profile = '''                await createUserProfile(\n                    result.user\n                );\n\n\n                openDashboard();\n'''
new_login_profile = '''                await createUserProfile(\n                    result.user\n                );\n\n                try {\n                    sessionStorage.setItem('nx:android-auth-handoff-at', String(Date.now()));\n                    localStorage.setItem('nx:last-auth-uid', result.user.uid);\n                    if (typeof window.NexusAndroid?.postMessage === 'function') {\n                        window.NexusAndroid.postMessage(JSON.stringify({\n                            action:'setActiveAccount',\n                            accountId:result.user.uid\n                        }));\n                    }\n                } catch (_) {}\n\n                openDashboard();\n'''
if old_login_profile in index:
    index = index.replace(old_login_profile, new_login_profile, 1)
elif 'nx:android-auth-handoff-at' not in index:
    raise SystemExit('Index login handoff insertion point not found.')

# ---------------------------------------------------------------------------
# 2) DASHBOARD AUTH: explicit persistence + bounded handoff grace. Never throw
#    a just-authenticated user back to Login while WebView restores persistence.
# ---------------------------------------------------------------------------
old_core_import = '''    getAuth,\n    onAuthStateChanged,\n    signOut\n'''
new_core_import = '''    getAuth,\n    setPersistence,\n    browserLocalPersistence,\n    onAuthStateChanged,\n    signOut\n'''
if old_core_import in core:
    core = core.replace(old_core_import, new_core_import, 1)
elif 'browserLocalPersistence' not in core:
    raise SystemExit('Dashboard Auth import patch point not found.')

old_core_auth = '''const auth = getAuth(app);\nconst db = getFirestore(app);\n'''
new_core_auth = '''const auth = getAuth(app);\ntry {\n    await setPersistence(auth, browserLocalPersistence);\n} catch (error) {\n    console.warn('NexusNova dashboard Auth persistence:', error);\n}\nconst db = getFirestore(app);\n\nlet nxAuthNullRedirectTimer = null;\nconst nxAndroidShell = location.pathname.startsWith('/nexusnova-native/') || new URLSearchParams(location.search).get('nxAndroid') === '1';\n'''
if old_core_auth in core:
    core = core.replace(old_core_auth, new_core_auth, 1)
elif 'nxAuthNullRedirectTimer' not in core:
    raise SystemExit('Dashboard Auth persistence state insertion point not found.')

old_listener = '''onAuthStateChanged(\n    auth,\n    async user => {\n\n        if(!user){\n            delete window.nexusAccountId;\n            window.dispatchEvent(new Event("nexusaccountcleared"));\n            window.location.replace("./index.html");\n\n            return;\n        }\n\n        currentUser = user;\n        window.nexusAccountId = user.uid;\n        window.dispatchEvent(new Event("nexusaccountready"));\n        renderEmailVerificationStatus();\n\n        await loadUserProfile();\n\n        loadMarket();\n        loadFinanceData();\n        loadNews();\n        loadChat();\n        renderEmergencyContacts();\n\n    }\n);\n'''
new_listener = '''onAuthStateChanged(\n    auth,\n    async user => {\n\n        if(!user){\n            if (nxAuthNullRedirectTimer) clearTimeout(nxAuthNullRedirectTimer);\n            const handoffAt = Number(sessionStorage.getItem('nx:android-auth-handoff-at') || 0);\n            const recentHandoff = nxAndroidShell && handoffAt > 0 && Date.now() - handoffAt < 45_000;\n            const graceMs = recentHandoff ? 12_000 : (nxAndroidShell ? 3_500 : 0);\n            const redirectIfStillSignedOut = async () => {\n                try { await auth.authStateReady?.(); } catch (_) {}\n                if (auth.currentUser) return;\n                delete window.nexusAccountId;\n                window.dispatchEvent(new Event("nexusaccountcleared"));\n                const target = nxAndroidShell ? './index.html?nxAndroid=1&authExpired=1' : './index.html';\n                window.location.replace(target);\n            };\n            if (graceMs > 0) nxAuthNullRedirectTimer = setTimeout(redirectIfStillSignedOut, graceMs);\n            else void redirectIfStillSignedOut();\n            return;\n        }\n\n        if (nxAuthNullRedirectTimer) { clearTimeout(nxAuthNullRedirectTimer); nxAuthNullRedirectTimer = null; }\n        try { sessionStorage.removeItem('nx:android-auth-handoff-at'); } catch (_) {}\n        currentUser = user;\n        window.nexusAccountId = user.uid;\n        window.dispatchEvent(new Event("nexusaccountready"));\n        renderEmailVerificationStatus();\n\n        // Home/mining gets network priority. Profile, markets, news and chat are\n        // deferred so they cannot compete with the first authoritative mining\n        // snapshot on slower phones/connections.\n        setTimeout(async () => {\n            try { await loadUserProfile(); } catch (error) { console.warn('Deferred profile load:', error); }\n            setTimeout(() => {\n                try { loadMarket(); } catch (_) {}\n                try { loadFinanceData(); } catch (_) {}\n                try { loadNews(); } catch (_) {}\n                try { loadChat(); } catch (_) {}\n                try { renderEmergencyContacts(); } catch (_) {}\n            }, 900);\n        }, 700);\n\n    }\n);\n'''
if old_listener in core:
    core = core.replace(old_listener, new_listener, 1)
elif 'recentHandoff' not in core:
    raise SystemExit('Dashboard Auth listener patch point not found.')

# Explicit logout owns native marker clearing.
old_logout = '''            delete window.nexusAccountId;\n\n            await signOut(\n                auth\n            );\n\n            window.location.replace(\n                "./index.html"\n            );\n'''
new_logout = '''            const oldAccountId = window.nexusAccountId || currentUser?.uid || '';\n            delete window.nexusAccountId;\n            try {\n                if (typeof window.NexusAndroid?.postMessage === 'function') {\n                    window.NexusAndroid.postMessage(JSON.stringify({action:'clearActiveAccount', accountId:oldAccountId}));\n                }\n                localStorage.removeItem('nx:last-auth-uid');\n            } catch (_) {}\n\n            await signOut(\n                auth\n            );\n\n            window.location.replace(\n                nxAndroidShell ? "./index.html?nxAndroid=1" : "./index.html"\n            );\n'''
if old_logout in core:
    core = core.replace(old_logout, new_logout, 1)

# ---------------------------------------------------------------------------
# 3) NATIVE STARTUP: returning users start directly at dashboard. The login
#    handoff never needs a second dashboard splash.
# ---------------------------------------------------------------------------
old_launch = '''        loadProductionApp()\n        showCallerSetupOnce()\n'''
new_launch = '''        loadProductionApp(startUrl = if (PhonebookStore.hasActiveAccount()) PRODUCTION_DASHBOARD_URL else PRODUCTION_APP_URL)\n        showCallerSetupOnce()\n'''
if old_launch in main:
    main = main.replace(old_launch, new_launch, 1)

# If patch_session_restore already converted the initial launch, keep it.
if 'PhonebookStore.hasActiveAccount()' not in main:
    raise SystemExit('Native returning-user dashboard launch marker missing.')

# No second branded splash after an explicit successful login.
page = page.replace(
    'var minMs = 850;',
    "var minMs = new URLSearchParams(location.search).get('fromLogin') === '1' ? 80 : 650;",
    1
)
page = page.replace(
    'setTimeout(hide, 1350);',
    "setTimeout(hide, new URLSearchParams(location.search).get('fromLogin') === '1' ? 180 : 1000);",
    1
)
page = page.replace(
    'setTimeout(releaseSplash, 2400);',
    "setTimeout(releaseSplash, new URLSearchParams(location.search).get('fromLogin') === '1' ? 140 : 1200);",
    1
)

# ---------------------------------------------------------------------------
# 4) REWARDED AD: never silently do nothing. If a rewarded screen closes and
#    no earned callback arrives within the reorder grace window, show an inline
#    note and leave the boost unused/retryable.
# ---------------------------------------------------------------------------
if 'let transientBoostNote' not in boost:
    anchor = "  let pendingRewardFxKind = '';\n"
    if anchor not in boost:
        raise SystemExit('Boost transient note insertion point not found.')
    boost = boost.replace(anchor, anchor + "  let transientBoostNote = '';\n  let transientBoostNoteUntil = 0;\n", 1)

old_timeout = '''        pendingKindClearTimer = setTimeout(() => {\n          pendingKind = '';\n          pendingKindClearTimer = null;\n        }, 1800);\n'''
new_timeout = '''        pendingKindClearTimer = setTimeout(() => {\n          if (pendingKind) {\n            pendingKind = '';\n            transientBoostNote = 'Ad closed before reward • no boost used';\n            transientBoostNoteUntil = Date.now() + 4_000;\n            render();\n          }\n          pendingKindClearTimer = null;\n        }, 1800);\n'''
if old_timeout in boost:
    boost = boost.replace(old_timeout, new_timeout, 1)
elif 'Ad closed before reward • no boost used' not in boost:
    raise SystemExit('Rewarded dismissal feedback patch point not found.')

# Give the render status an early transient-note branch.
old_status_anchor = '''    if (status) {\n      if (!miningState.known) {\n'''
new_status_anchor = '''    if (status) {\n      if (transientBoostNoteUntil > Date.now() && transientBoostNote) {\n        status.innerHTML = `<strong>${transientBoostNote}</strong> • watch the rewarded ad until the reward is granted`;\n      } else if (!miningState.known) {\n'''
if old_status_anchor in boost:
    boost = boost.replace(old_status_anchor, new_status_anchor, 1)
elif 'transientBoostNoteUntil > Date.now()' not in boost:
    raise SystemExit('Boost status transient-note patch point not found.')

# Expose safe TEST stored-boost use for rewards revealed by a TEST Nova Vault.
old_api_tail = '''    cooldownRemainingMs: () => testCooldownRemainingMs(),\n    consumeVault: () => {'''
new_api_tail = '''    cooldownRemainingMs: () => testCooldownRemainingMs(),\n    useStoredBoost: kind => {\n      const requested = String(kind || '').toLowerCase() === 'rain' ? 'rain' : 'booster';\n      if (requested !== expectedKind()) return false;\n      const ok = applyTestReward(requested);\n      if (!ok) return false;\n      const fxKind = pendingRewardFxKind || requested;\n      pendingRewardFxKind = '';\n      playBoostFx(fxKind, { test:true });\n      return true;\n    },\n    beginCooldown: () => startTestCooldown(),\n    consumeVault: () => {'''
if old_api_tail in boost:
    boost = boost.replace(old_api_tail, new_api_tail, 1)
elif 'useStoredBoost: kind =>' not in boost:
    raise SystemExit('TEST stored boost API insertion point not found.')

# ---------------------------------------------------------------------------
# 5) TEST NOVA VAULT: a reveal must become usable TEST inventory. Production
#    inventory and NVX remain server-authoritative and untouched.
# ---------------------------------------------------------------------------
if 'TEST_INVENTORY_KEY' not in vault:
    anchor = "  const TEST_REWARD_STATE_EVENT = 'nexusnova:test-reward-state';\n"
    if anchor not in vault:
        raise SystemExit('Vault TEST inventory constant insertion point not found.')
    vault = vault.replace(anchor, anchor + "  const TEST_INVENTORY_KEY = 'nx:nova-test-vault-inventory:v1';\n", 1)

    helper_anchor = "  const cleanInt = value => Math.max(0, Math.floor(Number(value) || 0));\n"
    helpers = '''  const testAnchor = () => {\n    try { return Number(window.NexusNovaTestRewards?.status?.().anchorAt) || 0; } catch (_) { return 0; }\n  };\n  function readTestInventory() {\n    const anchorAt = testAnchor();\n    try {\n      const raw = JSON.parse(localStorage.getItem(TEST_INVENTORY_KEY) || '{}');\n      if (!anchorAt || Number(raw.anchorAt || 0) !== anchorAt) return {anchorAt, booster:0, rain:0, timeWarp:0, nvx:0};\n      return {\n        anchorAt,\n        booster:cleanInt(raw.booster),\n        rain:cleanInt(raw.rain),\n        timeWarp:cleanInt(raw.timeWarp),\n        nvx:Math.max(0, Number(raw.nvx) || 0)\n      };\n    } catch (_) { return {anchorAt, booster:0, rain:0, timeWarp:0, nvx:0}; }\n  }\n  function writeTestInventory(next) {\n    const safe = {\n      anchorAt:testAnchor(),\n      booster:cleanInt(next.booster),\n      rain:cleanInt(next.rain),\n      timeWarp:cleanInt(next.timeWarp),\n      nvx:Math.max(0, Number(next.nvx) || 0)\n    };\n    try { localStorage.setItem(TEST_INVENTORY_KEY, JSON.stringify(safe)); } catch (_) {}\n    window.dispatchEvent(new CustomEvent('nexusnova:test-vault-inventory', {detail:{...safe}}));\n    return safe;\n  }\n  function storeTestVaultReward(preview = {}) {\n    const inv = readTestInventory();\n    const type = String(preview.type || '').toLowerCase();\n    if (type === 'booster') inv.booster += 1;\n    else if (type === 'rain') inv.rain += 1;\n    else if (type === 'time-warp' || type === 'timewarp') inv.timeWarp += 1;\n    else if (type === 'nvx') inv.nvx += Math.max(0, Number(preview.amount) || 0);\n    return writeTestInventory(inv);\n  }\n'''
    if helper_anchor not in vault:
        raise SystemExit('Vault TEST inventory helper insertion point not found.')
    vault = vault.replace(helper_anchor, helper_anchor + helpers, 1)

# Render combined production + TEST inventory and make TEST rewards visibly real.
vault = vault.replace(
    "    if ($('nxVaultBooster')) $('nxVaultBooster').textContent = String(state.booster);\n    if ($('nxVaultRain')) $('nxVaultRain').textContent = String(state.rain);\n    if ($('nxVaultWarp')) $('nxVaultWarp').textContent = String(state.timeWarp);\n",
    "    const testInv = readTestInventory();\n    const boosterTotal = cleanInt(state.booster) + cleanInt(testInv.booster);\n    const rainTotal = cleanInt(state.rain) + cleanInt(testInv.rain);\n    const warpTotal = cleanInt(state.timeWarp) + cleanInt(testInv.timeWarp);\n    if ($('nxVaultBooster')) $('nxVaultBooster').textContent = String(boosterTotal);\n    if ($('nxVaultRain')) $('nxVaultRain').textContent = String(rainTotal);\n    if ($('nxVaultWarp')) $('nxVaultWarp').textContent = String(warpTotal);\n",
    1
)
vault = vault.replace('booster.disabled = locked || state.booster < 1 || !active || complete;', 'booster.disabled = locked || boosterTotal < 1 || !active || complete;', 1)
vault = vault.replace("state.booster > 0 ? 'USE BOOSTER • -2H'", "boosterTotal > 0 ? (state.booster > 0 ? 'USE BOOSTER • -2H' : 'USE TEST BOOSTER • -2H')", 1)
vault = vault.replace('rain.disabled = locked || state.rain < 1 || !active || complete;', 'rain.disabled = locked || rainTotal < 1 || !active || complete;', 1)
vault = vault.replace("state.rain > 0 ? 'USE NOVA RAIN • -2H'", "rainTotal > 0 ? (state.rain > 0 ? 'USE NOVA RAIN • -2H' : 'USE TEST NOVA RAIN • -2H')", 1)
vault = vault.replace('warp.disabled = locked || state.timeWarp < 1 || !active || complete;', 'warp.disabled = locked || warpTotal < 1 || !active || complete;', 1)
vault = vault.replace("state.timeWarp > 0 ? 'USE 24H TIME WARP'", "warpTotal > 0 ? (state.timeWarp > 0 ? 'USE 24H TIME WARP' : 'PREVIEW TEST TIME WARP')", 1)

old_preview = '''        const preview = window.NexusNovaVaultReveal?.testReward?.() || { type:'reward', amount:0, test:true };\n        if (typeof window.NexusNovaVaultReveal?.play === 'function') {\n          await window.NexusNovaVaultReveal.play({ ...preview, test:true });\n'''
new_preview = '''        const preview = window.NexusNovaVaultReveal?.testReward?.() || { type:'reward', amount:0, test:true };\n        storeTestVaultReward(preview);\n        render();\n        if (typeof window.NexusNovaVaultReveal?.play === 'function') {\n          await window.NexusNovaVaultReveal.play({ ...preview, test:true });\n'''
if old_preview in vault:
    vault = vault.replace(old_preview, new_preview, 1)
elif 'storeTestVaultReward(preview);' not in vault:
    raise SystemExit('Vault TEST reward storage patch point not found.')

# TEST stored Booster/Rain can be consumed locally without touching Firestore.
old_useboost = '''  async function useBoost(kind) {\n    const requested = String(kind || '').toLowerCase() === 'rain' ? 'rain' : 'booster';\n    const result = await runAction(requested, () => secureCallable('useNovaBoost', { kind:requested }));\n'''
new_useboost = '''  async function useBoost(kind) {\n    const requested = String(kind || '').toLowerCase() === 'rain' ? 'rain' : 'booster';\n    const testInv = readTestInventory();\n    if (cleanInt(state[requested]) < 1 && cleanInt(testInv[requested]) > 0) {\n      if (cooldownRemainingMs() > 0) return null;\n      const ok = window.NexusNovaTestRewards?.useStoredBoost?.(requested) === true;\n      if (!ok) {\n        await showMessage('TEST Boost Not Applied', 'The current secure session cannot accept this TEST boost yet.', 'security');\n        return null;\n      }\n      testInv[requested] = Math.max(0, cleanInt(testInv[requested]) - 1);\n      writeTestInventory(testInv);\n      render();\n      return {testOnly:true, kind:requested};\n    }\n    const result = await runAction(requested, () => secureCallable('useNovaBoost', { kind:requested }));\n'''
if old_useboost in vault:
    vault = vault.replace(old_useboost, new_useboost, 1)
elif 'useStoredBoost?.(requested)' not in vault:
    raise SystemExit('Vault TEST stored boost consumption patch point not found.')

# TEST Time Warp remains a clearly-labelled preview because debug code must not
# fake a production Firestore completion. It is still stored/consumable.
old_warp = '''  async function useTimeWarp() {\n    const result = await runAction('time-warp', () => secureCallable('useNovaTimeWarp'));\n'''
new_warp = '''  async function useTimeWarp() {\n    const testInv = readTestInventory();\n    if (cleanInt(state.timeWarp) < 1 && cleanInt(testInv.timeWarp) > 0) {\n      if (cooldownRemainingMs() > 0) return null;\n      testInv.timeWarp = Math.max(0, cleanInt(testInv.timeWarp) - 1);\n      writeTestInventory(testInv);\n      try { window.NexusNovaTestRewards?.beginCooldown?.(); } catch (_) {}\n      render();\n      if (typeof window.NexusNovaVaultReveal?.play === 'function') {\n        await window.NexusNovaVaultReveal.play({type:'time-warp', amount:1, test:true});\n      }\n      return {testOnly:true, type:'time-warp'};\n    }\n    const result = await runAction('time-warp', () => secureCallable('useNovaTimeWarp'));\n'''
if old_warp in vault:
    vault = vault.replace(old_warp, new_warp, 1)
elif "return {testOnly:true, type:'time-warp'}" not in vault:
    raise SystemExit('Vault TEST Time Warp preview patch point not found.')

# Keep TEST inventory UI live after reward/state events.
listener_anchor = "  window.addEventListener(TEST_REWARD_STATE_EVENT, render);\n"
if listener_anchor in vault and "nexusnova:test-vault-inventory" not in vault:
    vault = vault.replace(listener_anchor, listener_anchor + "  window.addEventListener('nexusnova:test-vault-inventory', render);\n", 1)

# ---------------------------------------------------------------------------
# 6) MINING UI v4: visually obvious but lighter. Integrate useful session info
#    into the reactor card and shrink the separate pulse panel.
# ---------------------------------------------------------------------------
modern = modern.replace('NexusNova Android Mining Modern v3', 'NexusNova Android Mining Modern v4', 1)
modern = modern.replace("window.nexusAndroidMiningModernVersion = 'mining-modern-v3-visible';", "window.nexusAndroidMiningModernVersion = 'mining-modern-v4-video-truth';", 1)

css_anchor = "      #mineBtn{position:relative!important;overflow:hidden!important}"
css_new = "      #mineBtn{position:relative!important;overflow:hidden!important;min-height:132px!important;border-radius:24px!important} .nx-modern-reactor-kicker{position:absolute;left:26px;top:16px;z-index:4;font-size:8px;font-weight:950;letter-spacing:.18em;color:#82e8d1;pointer-events:none}.nx-modern-session-pct{position:absolute;right:16px;bottom:17px;z-index:4;font-size:11px;font-weight:950;color:#dffcf5;letter-spacing:.04em;pointer-events:none}.nx-modern-boost-badge{position:absolute;left:26px;bottom:17px;z-index:4;padding:3px 7px;border-radius:999px;background:rgba(22,195,175,.13);border:1px solid rgba(92,239,214,.2);font-size:7px;font-weight:900;color:#81f1d7;pointer-events:none}"
if css_anchor in modern:
    modern = modern.replace(css_anchor, css_new + css_anchor, 1)

mine_anchor = '''    if (!$(MINE_RAIL_ID)) {\n      const rail = document.createElement('span');\n      rail.id = MINE_RAIL_ID;\n      rail.innerHTML = '<i id="nxModernMineRailFill"></i>';\n      button.appendChild(rail);\n    }\n'''
mine_new = mine_anchor + '''    if (!$('nxModernReactorKicker')) {\n      const kicker=document.createElement('span'); kicker.id='nxModernReactorKicker'; kicker.className='nx-modern-reactor-kicker'; kicker.textContent='NOVA REACTOR • SECURE'; button.appendChild(kicker);\n    }\n    if (!$('nxModernSessionPct')) {\n      const pct=document.createElement('span'); pct.id='nxModernSessionPct'; pct.className='nx-modern-session-pct'; pct.textContent='SYNC'; button.appendChild(pct);\n    }\n    if (!$('nxModernBoostBadge')) {\n      const badge=document.createElement('span'); badge.id='nxModernBoostBadge'; badge.className='nx-modern-boost-badge'; badge.style.display='none'; button.appendChild(badge);\n    }\n'''
if mine_anchor in modern and 'nxModernReactorKicker' not in modern:
    modern = modern.replace(mine_anchor, mine_new, 1)

# Make Session Pulse compact; the reactor card now carries the obvious modern UI.
modern = modern.replace("min-height:58px", "min-height:42px", 1)
modern = modern.replace("padding:11px 12px", "padding:8px 10px", 1)

render_anchor = "    if ($('nxMpSyncText')) $('nxMpSyncText').textContent=boostHours>0?'TEST PREVIEW • SECURE CLOCK KEPT':'FIRESTORE VERIFIED';\n"
render_new = render_anchor + "    if ($('nxModernSessionPct')) $('nxModernSessionPct').textContent=`${percent.toFixed(0)}%`;\n    const badge=$('nxModernBoostBadge'); if(badge){badge.style.display=boostHours>0?'':'none';badge.textContent=boostHours>0?`BOOST −${boostHours}H`:'';}\n"
if render_anchor in modern and 'nxModernSessionPct' in modern:
    modern = modern.replace(render_anchor, render_new, 1)

# ---------------------------------------------------------------------------
# Durable markers + writes + sanity checks.
# ---------------------------------------------------------------------------
index = index.replace('<!-- nx-android-startup-smooth-v1 -->', '<!-- nx-android-startup-smooth-v1 -->\n<!-- nx-video-truth-final-v1 -->', 1) if MARKER not in index else index
if MARKER not in core:
    core = '/* nx-video-truth-final-v1 */\n' + core
if MARKER not in boost:
    boost = '/* nx-video-truth-final-v1 */\n' + boost
if MARKER not in vault:
    vault = '/* nx-video-truth-final-v1 */\n' + vault

INDEX.write_text(index, encoding='utf-8')
PAGE.write_text(page, encoding='utf-8')
CORE.write_text(core, encoding='utf-8')
BOOST.write_text(boost, encoding='utf-8')
VAULT.write_text(vault, encoding='utf-8')
MODERN.write_text(modern, encoding='utf-8')
MAIN.write_text(main, encoding='utf-8')

checks = [
    (INDEX, MARKER),
    (INDEX, 'browserLocalPersistence'),
    (INDEX, 'nx:android-auth-handoff-at'),
    (INDEX, 'setActiveAccount'),
    (INDEX, 'fromLogin=1'),
    (CORE, MARKER),
    (CORE, 'recentHandoff'),
    (CORE, 'await setPersistence(auth, browserLocalPersistence)'),
    (CORE, 'Deferred profile load'),
    (BOOST, MARKER),
    (BOOST, 'Ad closed before reward • no boost used'),
    (BOOST, 'useStoredBoost: kind =>'),
    (VAULT, MARKER),
    (VAULT, 'TEST_INVENTORY_KEY'),
    (VAULT, 'storeTestVaultReward(preview);'),
    (VAULT, 'useStoredBoost?.(requested)'),
    (MODERN, 'mining-modern-v4-video-truth'),
    (MODERN, 'NOVA REACTOR • SECURE'),
]
for path, needle in checks:
    if needle not in path.read_text(encoding='utf-8'):
        raise SystemExit(f'Video-truth verification failed: {path} -> {needle}')

# The login page must no longer clear native session state on its first null auth callback.
if 'If Firebase\n// restores no user on the login page, clear its last active-account marker' in INDEX.read_text(encoding='utf-8'):
    raise SystemExit('Login page still clears the native active-account marker.')

print('Applied video-truth fixes: stable auth handoff/session restore, fast single splash, deferred startup load, explicit ad miss feedback, usable TEST Vault inventory, and obvious lightweight Mining v4 UI.')
