from pathlib import Path

main_path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
store_path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/PhonebookStore.kt')
index_path = Path('NexusNovaAndroid/app/src/main/assets/www/index.html')
page2_core_path = Path('NexusNovaAndroid/app/src/main/assets/www/js/page2-core.js')

main = main_path.read_text()
store = store_path.read_text()
index = index_path.read_text(encoding='utf-8')
page2_core = page2_core_path.read_text(encoding='utf-8')

# ---------------------------------------------------------------------------
# Firebase Auth handoff hardening for the packaged Android WebView shell.
# The login document historically used Firebase JS 10.8 while page2 used 12.1.
# A fresh WebView could therefore complete email sign-in, navigate to page2,
# then let page2 observe a transient signed-out state and bounce to index.html.
# Keep both documents on one SDK version, make local persistence explicit, and
# keep a short same-tab handoff marker so page2 never redirects during commit.
# ---------------------------------------------------------------------------
index = index.replace('https://www.gstatic.com/firebasejs/10.8.0/', 'https://www.gstatic.com/firebasejs/12.1.0/')

index_auth_import_old = '''import {\n    getAuth,\n    createUserWithEmailAndPassword,\n     signInWithEmailAndPassword,\n     GoogleAuthProvider,\n     signInWithPopup,\n     sendEmailVerification,\n     onAuthStateChanged\n} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";'''
index_auth_import_new = '''import {\n    getAuth,\n    setPersistence,\n    browserLocalPersistence,\n    createUserWithEmailAndPassword,\n     signInWithEmailAndPassword,\n     GoogleAuthProvider,\n     signInWithPopup,\n     sendEmailVerification,\n     onAuthStateChanged\n} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";'''
if index_auth_import_new not in index:
    if index_auth_import_old not in index:
        raise SystemExit('Android index Firebase Auth import block missing')
    index = index.replace(index_auth_import_old, index_auth_import_new, 1)

index_auth_old = '''const auth =\n    getAuth(app);\n'''
index_auth_new = '''const auth =\n    getAuth(app);\n\n// nx-android-auth-persistence-v1\nconst nexusAuthPersistenceReady = setPersistence(\n    auth,\n    browserLocalPersistence\n).catch(error => {\n    console.warn("NexusNova Android auth persistence:", error);\n});\n'''
if 'nx-android-auth-persistence-v1' not in index:
    if index_auth_old not in index:
        raise SystemExit('Android index auth initialization block missing')
    index = index.replace(index_auth_old, index_auth_new, 1)

open_dashboard_old = '''function openDashboard(successMessage = "Login successful! Opening dashboard...") {\n\n    showMessage(\n        successMessage,\n        true\n    );\n'''
open_dashboard_new = '''function openDashboard(successMessage = "Login successful! Opening dashboard...") {\n\n    // nx-android-auth-handoff-v1\n    try {\n        sessionStorage.setItem("nexusnova_auth_handoff", String(Date.now()));\n        const user = auth.currentUser;\n        if (user && typeof window.NexusAndroid?.postMessage === "function") {\n            window.NexusAndroid.postMessage(\n                JSON.stringify({action:"setActiveAccount", accountId:user.uid})\n            );\n        }\n    } catch (error) {\n        console.warn("NexusNova Android auth handoff:", error);\n    }\n\n    showMessage(\n        successMessage,\n        true\n    );\n'''
if 'nx-android-auth-handoff-v1' not in index:
    if open_dashboard_old not in index:
        raise SystemExit('Android index dashboard handoff insertion point missing')
    index = index.replace(open_dashboard_old, open_dashboard_new, 1)

login_old = '''            if (loginMode) {\n\n                const result =\n                    await signInWithEmailAndPassword('''
login_new = '''            if (loginMode) {\n\n                await nexusAuthPersistenceReady;\n\n                const result =\n                    await signInWithEmailAndPassword('''
if login_new not in index:
    if login_old not in index:
        raise SystemExit('Android email login persistence insertion point missing')
    index = index.replace(login_old, login_new, 1)

signup_old = '''            const result =\n                await createUserWithEmailAndPassword('''
signup_new = '''            await nexusAuthPersistenceReady;\n\n            const result =\n                await createUserWithEmailAndPassword('''
if signup_new not in index:
    if signup_old not in index:
        raise SystemExit('Android signup persistence insertion point missing')
    index = index.replace(signup_old, signup_new, 1)

# signInWithPopup cannot complete inside the current Android WebView because the
# Firebase auth handler lives on nexusnova-6ade2.firebaseapp.com and the native
# shell intentionally externalizes untrusted top-level origins. Do not throw the
# user into Chrome and then show the old misleading "StackBlitz" error. Email
# auth remains fully functional; browser/PWA Google auth is left unchanged.
google_click_old = '''googleLoginBtn.addEventListener(\n    "click",\n    async () => {\n\n        googleLoginBtn.disabled =\n            true;'''
google_click_new = '''googleLoginBtn.addEventListener(\n    "click",\n    async () => {\n\n        if (window.__nexusAndroidShell === true) {\n            showMessage(\n                "Google sign-in is not enabled inside this Android TEST shell yet. Use email login for this build."\n            );\n            return;\n        }\n\n        googleLoginBtn.disabled =\n            true;'''
if 'Google sign-in is not enabled inside this Android TEST shell yet' not in index:
    if google_click_old not in index:
        raise SystemExit('Android Google auth guard insertion point missing')
    index = index.replace(google_click_old, google_click_new, 1)

index = index.replace(
    '"This StackBlitz domain is not authorized in Firebase.";',
    '"This domain is not authorized for Google sign-in in Firebase: " + location.hostname;',
    1,
)

page2_auth_import_old = '''import {\n    getAuth,\n    onAuthStateChanged,\n    signOut\n} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";'''
page2_auth_import_new = '''import {\n    getAuth,\n    setPersistence,\n    browserLocalPersistence,\n    onAuthStateChanged,\n    signOut\n} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";'''
if page2_auth_import_new not in page2_core:
    if page2_auth_import_old not in page2_core:
        raise SystemExit('Android page2 Firebase Auth import block missing')
    page2_core = page2_core.replace(page2_auth_import_old, page2_auth_import_new, 1)

page2_auth_old = '''const auth = getAuth(app);\nconst db = getFirestore(app);\n'''
page2_auth_new = '''const auth = getAuth(app);\n\n// nx-android-page2-auth-persistence-v1\ntry {\n    await setPersistence(auth, browserLocalPersistence);\n} catch (error) {\n    console.warn("NexusNova page2 auth persistence:", error);\n}\n\nconst db = getFirestore(app);\n'''
if 'nx-android-page2-auth-persistence-v1' not in page2_core:
    if page2_auth_old not in page2_core:
        raise SystemExit('Android page2 auth initialization block missing')
    page2_core = page2_core.replace(page2_auth_old, page2_auth_new, 1)

signed_out_old = '''        if(!user){\n            delete window.nexusAccountId;\n            window.dispatchEvent(new Event("nexusaccountcleared"));\n            window.location.replace("./index.html");\n\n            return;\n        }\n\n        currentUser = user;'''
signed_out_new = '''        // nx-android-auth-handoff-grace-v1\n        if(!user && window.__nexusAndroidShell === true){\n            let handoffAt = 0;\n            try {\n                handoffAt = Number(sessionStorage.getItem("nexusnova_auth_handoff") || 0);\n            } catch (_) {}\n\n            if(handoffAt > 0 && Date.now() - handoffAt < 12000){\n                try {\n                    if(typeof auth.authStateReady === "function") await auth.authStateReady();\n                    if(!auth.currentUser){\n                        await new Promise(resolve => setTimeout(resolve, 1800));\n                    }\n                    user = auth.currentUser;\n                } catch (error) {\n                    console.warn("NexusNova Android auth handoff wait:", error);\n                }\n            }\n        }\n\n        if(!user){\n            try { sessionStorage.removeItem("nexusnova_auth_handoff"); } catch (_) {}\n            delete window.nexusAccountId;\n            window.dispatchEvent(new Event("nexusaccountcleared"));\n            window.location.replace("./index.html");\n\n            return;\n        }\n\n        try { sessionStorage.removeItem("nexusnova_auth_handoff"); } catch (_) {}\n        currentUser = user;'''
if 'nx-android-auth-handoff-grace-v1' not in page2_core:
    if signed_out_old not in page2_core:
        raise SystemExit('Android page2 signed-out redirect block missing')
    page2_core = page2_core.replace(signed_out_old, signed_out_new, 1)

index_path.write_text(index, encoding='utf-8')
page2_core_path.write_text(page2_core, encoding='utf-8')

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

store_path.write_text(store)
main_path.write_text(main)

required_auth_markers = [
    'firebasejs/12.1.0/firebase-auth.js',
    'nx-android-auth-persistence-v1',
    'nx-android-auth-handoff-v1',
    'Google sign-in is not enabled inside this Android TEST shell yet',
]
missing_index = [marker for marker in required_auth_markers if marker not in index]
required_page2_markers = [
    'nx-android-page2-auth-persistence-v1',
    'nx-android-auth-handoff-grace-v1',
]
missing_page2 = [marker for marker in required_page2_markers if marker not in page2_core]
if missing_index or missing_page2:
    raise SystemExit('Android auth-session hardening incomplete: ' + ', '.join(missing_index + missing_page2))

print('Same-device Firebase session restore and Android auth handoff hardening applied safely.')
