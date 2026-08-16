from pathlib import Path

main_path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
store_path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/PhonebookStore.kt')

main = main_path.read_text()
store = store_path.read_text()

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

# At WebView root, Android Back should background NexusNova rather than destroy
# the Activity. Reopening then resumes the same authenticated WebView instantly.
old_back = '''    @Deprecated("Deprecated in Java")\n    override fun onBackPressed() {\n        if (this::webView.isInitialized && webView.canGoBack()) webView.goBack()\n        else super.onBackPressed()\n    }\n'''
new_back = '''    @Deprecated("Deprecated in Java")\n    override fun onBackPressed() {\n        if (this::webView.isInitialized && webView.canGoBack()) {\n            webView.goBack()\n        } else {\n            moveTaskToBack(true)\n        }\n    }\n'''
if new_back not in main:
    if old_back not in main:
        raise SystemExit('MainActivity Back handling insertion point not found')
    main = main.replace(old_back, new_back, 1)

store_path.write_text(store)
main_path.write_text(main)

required = [
    'nx-android-back-session-stability-v1',
    'webView.restoreState(state)',
    'webView.saveState(outState)',
    'moveTaskToBack(true)',
]
missing = [item for item in required if item not in main]
if missing:
    raise SystemExit('Android session stability verification failed: ' + ', '.join(missing))

print('Same-device Firebase session restore + Back/activity state preservation applied safely.')