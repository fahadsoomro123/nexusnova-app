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
    old = '        webView.loadUrl(PRODUCTION_APP_URL)\n'
    new = '''        val launchUrl = if (PhonebookStore.hasActiveAccount()) {\n            PRODUCTION_DASHBOARD_URL\n        } else {\n            PRODUCTION_APP_URL\n        }\n        webView.loadUrl(launchUrl)\n'''
    if old not in main:
        raise SystemExit('MainActivity launch URL insertion point not found')
    main = main.replace(old, new, 1)

if 'const val PRODUCTION_DASHBOARD_URL' not in main:
    old = '        const val PRODUCTION_APP_URL = "https://fahadsoomro123.github.io/nexusnova-app/"\n'
    new = old + '        const val PRODUCTION_DASHBOARD_URL = "https://fahadsoomro123.github.io/nexusnova-app/page2.html"\n'
    if old not in main:
        raise SystemExit('MainActivity production URL constant insertion point not found')
    main = main.replace(old, new, 1)

store_path.write_text(store)
main_path.write_text(main)
print('Same-device Firebase session restore patch applied safely.')
