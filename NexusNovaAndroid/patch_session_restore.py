from pathlib import Path

main_path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
store_path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/PhonebookStore.kt')
page_path = Path('NexusNovaAndroid/app/src/main/assets/www/page2.html')
ux_path = Path('NexusNovaAndroid/app/src/main/assets/www/js/nexusnova-ux-simplify-v1.js')
integrity_path = Path('NexusNovaAndroid/app/src/main/assets/www/js/final-integrity-fix.js')

main = main_path.read_text()
store = store_path.read_text()
page = page_path.read_text(encoding='utf-8')

# PhonebookStore already keeps the authenticated account marker in private app
# SharedPreferences for caller-ID scoping. Expose only a boolean so Android can
# decide whether to start at the dashboard; Firebase remains the real auth gate.
if 'fun hasActiveAccount(): Boolean' not in store:
    anchor = '''    fun clearActiveAccount(accountId: String?): Boolean {\n'''
    insertion = '''    fun hasActiveAccount(): Boolean = synchronized(lock) {\n        activeAccountIdLocked() != null\n    }\n\n'''
    if anchor not in store:
        raise SystemExit('PhonebookStore session marker insertion point not found')
    store = store.replace(anchor, insertion + anchor, 1)

# On the same installed app/device, skip the login document when a previously
# authenticated account marker exists. page2-core still checks Firebase Auth;
# if the persisted Firebase session is gone/expired it immediately redirects to
# index.html, so this never bypasses authentication.
if 'PhonebookStore.hasActiveAccount()' not in main:
    legacy_old = '        webView.loadUrl(PRODUCTION_APP_URL)\n'
    legacy_new = '''        val launchUrl = if (PhonebookStore.hasActiveAccount()) {\n            PRODUCTION_DASHBOARD_URL\n        } else {\n            PRODUCTION_APP_URL\n        }\n        webView.loadUrl(launchUrl)\n'''

    recovery_old = '        loadProductionApp()\n'
    recovery_new = '''        val launchUrl = if (PhonebookStore.hasActiveAccount()) {\n            PRODUCTION_DASHBOARD_URL\n        } else {\n            PRODUCTION_APP_URL\n        }\n        loadProductionApp(launchUrl)\n'''

    if legacy_old in main:
        main = main.replace(legacy_old, legacy_new, 1)
    elif recovery_old in main:
        main = main.replace(recovery_old, recovery_new, 1)

        helper_old = '''    private fun loadProductionApp(forceFresh: Boolean = false) {\n        usingOfflineFallback = false\n        if (forceFresh) webView.clearCache(true)\n        val suffix = if (forceFresh) "?androidRecovery=${System.currentTimeMillis()}" else ""\n        webView.loadUrl(PRODUCTION_APP_URL + suffix)\n    }\n'''
        helper_new = '''    private fun loadProductionApp(startUrl: String = PRODUCTION_APP_URL, forceFresh: Boolean = false) {\n        usingOfflineFallback = false\n        if (forceFresh) webView.clearCache(true)\n        val separator = if (startUrl.contains("?")) "&" else "?"\n        val suffix = if (forceFresh) "${separator}androidRecovery=${System.currentTimeMillis()}" else ""\n        webView.loadUrl(startUrl + suffix)\n    }\n'''
        if helper_old not in main:
            raise SystemExit('MainActivity recovery helper insertion point not found')
        main = main.replace(helper_old, helper_new, 1)
    else:
        raise SystemExit('MainActivity launch URL insertion point not found')

if 'const val PRODUCTION_DASHBOARD_URL' not in main:
    old = '        const val PRODUCTION_APP_URL = "https://fahadsoomro123.github.io/nexusnova-app/"\n'
    new = old + '        const val PRODUCTION_DASHBOARD_URL = "https://fahadsoomro123.github.io/nexusnova-app/page2.html"\n'
    if old not in main:
        raise SystemExit('MainActivity production URL constant insertion point not found')
    main = main.replace(old, new, 1)

# nx-android-back-session-stability-v1
# Preserve the actual WebView/history when Android recreates the Activity. This
# keeps the current screen and avoids an unnecessary auth/balance bootstrap.
if 'nx-android-back-session-stability-v1' not in main:
    launch_block = '''        val launchUrl = if (PhonebookStore.hasActiveAccount()) {\n            PRODUCTION_DASHBOARD_URL\n        } else {\n            PRODUCTION_APP_URL\n        }\n        loadProductionApp(launchUrl)\n'''
    restored_block = '''        // nx-android-back-session-stability-v1\n        val restoredWebState = savedInstanceState?.let { state ->\n            runCatching { webView.restoreState(state) }.getOrNull()\n        } != null\n        if (!restoredWebState) {\n            val launchUrl = if (PhonebookStore.hasActiveAccount()) {\n                PRODUCTION_DASHBOARD_URL\n            } else {\n                PRODUCTION_APP_URL\n            }\n            loadProductionApp(launchUrl)\n        }\n'''
    if launch_block not in main:
        raise SystemExit('MainActivity saved-state launch insertion point not found')
    main = main.replace(launch_block, restored_block, 1)

if 'override fun onSaveInstanceState(outState: Bundle)' not in main:
    marker = '    override fun onDestroy() {\n'
    block = '''    override fun onSaveInstanceState(outState: Bundle) {\n        if (this::webView.isInitialized) {\n            runCatching { webView.saveState(outState) }\n        }\n        super.onSaveInstanceState(outState)\n    }\n\n'''
    if marker not in main:
        raise SystemExit('MainActivity onSaveInstanceState insertion point not found')
    main = main.replace(marker, block + marker, 1)

# The Android navigation-bar Back action now belongs to the contextual web UX.
# Inner screens go back inside NexusNova; root screens ask for explicit YES/NO
# confirmation instead of immediately backgrounding or destroying the app.
legacy_back = '''    @Deprecated("Deprecated in Java")\n    override fun onBackPressed() {\n        if (this::webView.isInitialized && webView.canGoBack()) webView.goBack()\n        else super.onBackPressed()\n    }\n'''
background_back = '''    @Deprecated("Deprecated in Java")\n    override fun onBackPressed() {\n        if (this::webView.isInitialized && webView.canGoBack()) {\n            webView.goBack()\n        } else {\n            moveTaskToBack(true)\n        }\n    }\n'''
confirmed_back = '''    @Deprecated("Deprecated in Java")\n    override fun onBackPressed() {\n        if (!this::webView.isInitialized) {\n            showExitConfirmation()\n            return\n        }\n\n        webView.evaluateJavascript(SYSTEM_BACK_SCRIPT) { raw ->\n            if (isFinishing || isDestroyed) return@evaluateJavascript\n            val result = raw?.trim()?.trim('"')\n            if (result != "handled") showExitConfirmation()\n        }\n    }\n\n    private fun showExitConfirmation() {\n        if (isFinishing || isDestroyed) return\n        android.app.AlertDialog.Builder(this)\n            .setTitle("Exit NexusNova?")\n            .setMessage("Do you want to exit NexusNova?")\n            .setNegativeButton("NO") { dialog, _ -> dialog.dismiss() }\n            .setPositiveButton("YES") { dialog, _ ->\n                dialog.dismiss()\n                finishAndRemoveTask()\n            }\n            .setCancelable(true)\n            .show()\n    }\n'''
if 'private fun showExitConfirmation()' not in main:
    if background_back in main:
        main = main.replace(background_back, confirmed_back, 1)
    elif legacy_back in main:
        main = main.replace(legacy_back, confirmed_back, 1)
    else:
        raise SystemExit('MainActivity exit-confirmation insertion point not found')

if 'const val SYSTEM_BACK_SCRIPT' not in main:
    marker = '        const val BLANK_SCREEN_PROBE = """\n'
    script = '''        const val SYSTEM_BACK_SCRIPT = """\n            (function(){\n              try {\n                var ux = window.NexusNovaUxSimplify;\n                if (ux && typeof ux.systemBack === 'function') {\n                  return ux.systemBack() ? 'handled' : 'root';\n                }\n              } catch (_) {}\n              return 'root';\n            })();\n        """\n'''
    if marker not in main:
        raise SystemExit('MainActivity system-back script insertion point not found')
    main = main.replace(marker, script + marker, 1)

# nx-android-balance-priority-v1
# Firebase app/auth/firestore are the only remote modules required before the
# first secure balance snapshot. Start those connections from <head> so they are
# already in flight while the bundled UI is parsing instead of starting later.
if 'nx-android-balance-priority-v1' not in page:
    head = '<head>\n'
    preload = '''<head>\n<!-- nx-android-balance-priority-v1 -->\n<link rel="preconnect" href="https://www.gstatic.com" crossorigin>\n<link rel="modulepreload" href="https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js" crossorigin>\n<link rel="modulepreload" href="https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js" crossorigin>\n<link rel="modulepreload" href="https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js" crossorigin>\n'''
    if head not in page:
        raise SystemExit('Android dashboard head insertion point not found')
    page = page.replace(head, preload, 1)

store_path.write_text(store)
main_path.write_text(main)
page_path.write_text(page, encoding='utf-8')

required_main = [
    'nx-android-back-session-stability-v1',
    'webView.restoreState(state)',
    'webView.saveState(outState)',
    'showExitConfirmation()',
    'Do you want to exit NexusNova?',
    'SYSTEM_BACK_SCRIPT',
    'finishAndRemoveTask()',
]
missing = [item for item in required_main if item not in main]
if missing:
    raise SystemExit('Android session/back UX verification failed: ' + ', '.join(missing))
if 'nx-android-balance-priority-v1' not in page or 'firebase-firestore.js' not in page:
    raise SystemExit('Android secure balance preload verification failed')

if not ux_path.exists():
    raise SystemExit('Android UX simplify module missing from bundled shell')
ux = ux_path.read_text(encoding='utf-8')
for token in ['id="nxUxBack"', '← PREVIOUS', 'NEXT PAGE →', 'systemBack:handleSystemBack']:
    if token not in ux:
        raise SystemExit('Android recent UX command missing: ' + token)

if not integrity_path.exists():
    raise SystemExit('Android integrity loader missing from bundled shell')
integrity = integrity_path.read_text(encoding='utf-8')
for token in [
    'nexusnova-ux-simplify-v1.js',
    'nexusnova-existing-app-ad-hotfix-v2.js',
    'nexusnova-ad-placements-v1.js',
    'nexusnova-watch-ad-reward-v1.js',
]:
    if token not in integrity:
        raise SystemExit('Android recent loader missing: ' + token)

print('Same-device session, explicit exit confirmation, bottom Back/book navigation, recent ad loaders, and secure-balance bootstrap verified.')