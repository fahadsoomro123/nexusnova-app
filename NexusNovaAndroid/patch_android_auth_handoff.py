from pathlib import Path
import re

INDEX = Path('NexusNovaAndroid/app/src/main/assets/www/index.html')
PAGE2 = Path('NexusNovaAndroid/app/src/main/assets/www/js/page2-core.js')

index = INDEX.read_text(encoding='utf-8')
page2 = PAGE2.read_text(encoding='utf-8')


def ensure_auth_import(text: str) -> str:
    # Keep login + dashboard on the same Firebase JS generation in the APK.
    text = text.replace('https://www.gstatic.com/firebasejs/10.8.0/', 'https://www.gstatic.com/firebasejs/12.1.0/')
    pattern = re.compile(
        r'import\s*\{(?P<body>.*?)\}\s*from\s*["\']https://www\.gstatic\.com/firebasejs/12\.1\.0/firebase-auth\.js["\'];',
        re.S,
    )
    match = pattern.search(text)
    if not match:
        raise SystemExit('Firebase Auth import block not found in Android shell')
    body = match.group('body')
    missing = [name for name in ('setPersistence', 'browserLocalPersistence') if re.search(rf'\b{name}\b', body) is None]
    if not missing:
        return text
    clean = body.rstrip()
    if clean and not clean.endswith(','):
        clean += ','
    clean += '\n    ' + ',\n    '.join(missing) + '\n'
    replacement = 'import {' + clean + '} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";'
    return text[:match.start()] + replacement + text[match.end():]


index = ensure_auth_import(index)
page2 = ensure_auth_import(page2)

# ---------------------------------------------------------------------------
# Login document: explicit local persistence + deterministic handoff marker.
# ---------------------------------------------------------------------------
if 'nx-android-auth-persistence-v2' not in index:
    auth_match = re.search(r'const\s+auth\s*=\s*getAuth\(app\);', index)
    if not auth_match:
        raise SystemExit('Android login auth initialization not found')
    block = '''\n\n// nx-android-auth-persistence-v2\nconst nexusAuthPersistenceReady = setPersistence(\n    auth,\n    browserLocalPersistence\n).catch(error => {\n    console.warn("NexusNova Android auth persistence:", error);\n});\n'''
    index = index[:auth_match.end()] + block + index[auth_match.end():]

if 'nx-android-auth-handoff-v2' not in index:
    dashboard_match = re.search(r'function\s+openDashboard\s*\([^)]*\)\s*\{', index)
    if not dashboard_match:
        raise SystemExit('Android openDashboard function not found')
    block = '''\n\n    // nx-android-auth-handoff-v2\n    try {\n        sessionStorage.setItem("nexusnova_auth_handoff", String(Date.now()));\n        const user = auth.currentUser;\n        if (user && typeof window.NexusAndroid?.postMessage === "function") {\n            window.NexusAndroid.postMessage(\n                JSON.stringify({action:"setActiveAccount", accountId:user.uid})\n            );\n        }\n    } catch (error) {\n        console.warn("NexusNova Android auth handoff:", error);\n    }\n'''
    index = index[:dashboard_match.end()] + block + index[dashboard_match.end():]

# Await persistence before value-bearing sign-in/signup. Apply only when missing.
if 'await nexusAuthPersistenceReady;\n\n                const result =\n                    await signInWithEmailAndPassword' not in index:
    index, count = re.subn(
        r'(if\s*\(loginMode\)\s*\{\s*)(const\s+result\s*=\s*await\s+signInWithEmailAndPassword\s*\()',
        r'\1await nexusAuthPersistenceReady;\n\n                \2',
        index,
        count=1,
        flags=re.S,
    )
    if count != 1:
        raise SystemExit('Android email-login persistence wait insertion point not found')

# Signup path: insert immediately before the first createUserWithEmailAndPassword call.
create_pos = index.find('await createUserWithEmailAndPassword(')
if create_pos < 0:
    raise SystemExit('Android signup call not found')
window_before = index[max(0, create_pos - 220):create_pos]
if 'nexusAuthPersistenceReady' not in window_before:
    line_start = index.rfind('\n', 0, create_pos) + 1
    index = index[:line_start] + '            await nexusAuthPersistenceReady;\n\n' + index[line_start:]

# In the current Android WebView, Firebase popup auth leaves the trusted app
# origin and is intentionally externalized by MainActivity. Prevent the broken
# browser round-trip instead of showing the old misleading StackBlitz message.
if 'nx-android-google-webview-guard-v2' not in index:
    google_match = re.search(
        r'googleLoginBtn\.addEventListener\s*\(\s*["\']click["\']\s*,\s*async\s*\(\)\s*=>\s*\{',
        index,
        re.S,
    )
    if not google_match:
        raise SystemExit('Android Google login handler not found')
    block = '''\n\n        // nx-android-google-webview-guard-v2\n        if (window.__nexusAndroidShell === true) {\n            showMessage(\n                "Google sign-in is not enabled inside this Android TEST shell yet. Use email login for this build."\n            );\n            return;\n        }\n'''
    index = index[:google_match.end()] + block + index[google_match.end():]

index = index.replace(
    '"This StackBlitz domain is not authorized in Firebase.";',
    '"This domain is not authorized for Google sign-in in Firebase: " + location.hostname;',
)

# ---------------------------------------------------------------------------
# Dashboard document: make persistence explicit and give the just-completed
# login a short restoration window before the legacy signed-out redirect fires.
# ---------------------------------------------------------------------------
if 'nx-android-page2-auth-persistence-v2' not in page2:
    auth_match = re.search(r'const\s+auth\s*=\s*getAuth\(app\);', page2)
    if not auth_match:
        raise SystemExit('Android dashboard auth initialization not found')
    block = '''\n\n// nx-android-page2-auth-persistence-v2\nconst nexusPage2AuthPersistenceReady = setPersistence(\n    auth,\n    browserLocalPersistence\n).catch(error => {\n    console.warn("NexusNova page2 auth persistence:", error);\n});\nawait nexusPage2AuthPersistenceReady;\n'''
    page2 = page2[:auth_match.end()] + block + page2[auth_match.end():]

if 'nx-android-auth-handoff-grace-v2' not in page2:
    auth_section = page2.find('/* =========================================================\n   AUTH\n========================================================= */')
    if auth_section < 0:
        raise SystemExit('Android dashboard AUTH section not found')
    callback = re.search(
        r'onAuthStateChanged\s*\(\s*auth\s*,\s*async\s+user\s*=>\s*\{',
        page2[auth_section:],
        re.S,
    )
    if not callback:
        raise SystemExit('Android dashboard auth-state callback not found')
    insert_at = auth_section + callback.end()
    block = '''\n\n        // nx-android-auth-handoff-grace-v2\n        if(!user && window.__nexusAndroidShell === true){\n            let handoffAt = 0;\n            try {\n                handoffAt = Number(sessionStorage.getItem("nexusnova_auth_handoff") || 0);\n            } catch (_) {}\n\n            if(handoffAt > 0 && Date.now() - handoffAt < 15000){\n                try {\n                    await nexusPage2AuthPersistenceReady;\n                    if(typeof auth.authStateReady === "function") {\n                        await auth.authStateReady();\n                    }\n                    user = auth.currentUser;\n                    if(!user){\n                        await new Promise(resolve => setTimeout(resolve, 1800));\n                        user = auth.currentUser;\n                    }\n                } catch (error) {\n                    console.warn("NexusNova Android auth handoff wait:", error);\n                }\n            }\n        }\n'''
    page2 = page2[:insert_at] + block + page2[insert_at:]

# Clear the transient handoff marker once a real user has survived the auth gate.
if 'nx-android-auth-handoff-clear-v2' not in page2:
    auth_section = page2.find('/* =========================================================\n   AUTH\n========================================================= */')
    current_user_pos = page2.find('currentUser = user;', auth_section)
    if current_user_pos < 0:
        raise SystemExit('Android dashboard currentUser assignment not found')
    line_start = page2.rfind('\n', 0, current_user_pos) + 1
    clear_block = '''        // nx-android-auth-handoff-clear-v2\n        try { sessionStorage.removeItem("nexusnova_auth_handoff"); } catch (_) {}\n'''
    page2 = page2[:line_start] + clear_block + page2[line_start:]

INDEX.write_text(index, encoding='utf-8')
PAGE2.write_text(page2, encoding='utf-8')

required_index = [
    'firebasejs/12.1.0/firebase-auth.js',
    'nx-android-auth-persistence-v2',
    'nx-android-auth-handoff-v2',
    'nx-android-google-webview-guard-v2',
]
required_page2 = [
    'nx-android-page2-auth-persistence-v2',
    'nx-android-auth-handoff-grace-v2',
    'nx-android-auth-handoff-clear-v2',
]
missing = [x for x in required_index if x not in index] + [x for x in required_page2 if x not in page2]
if missing:
    raise SystemExit('Android auth handoff final verification failed: ' + ', '.join(missing))

print('Final Android Firebase auth handoff hardening applied after UI/performance patches.')
