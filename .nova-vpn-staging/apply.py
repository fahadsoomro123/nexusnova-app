from pathlib import Path

ROOT = Path('.')


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding='utf-8')
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'{label}: exact marker not found; refusing blind patch')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


def copy_template(name: str, destination: str) -> None:
    source = ROOT / '.nova-vpn-staging' / name
    target = ROOT / destination
    if not source.is_file():
        raise SystemExit(f'Missing staged source: {source}')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(source.read_text(encoding='utf-8'), encoding='utf-8')


copy_template('NovaVpnManager.kt.txt', 'NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NovaVpnManager.kt')
copy_template('NovaVpnActivity.kt.txt', 'NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NovaVpnActivity.kt')
copy_template('nova-vpn-suite.js.txt', 'fresh-rebuild/src/features/apps/nova-vpn-suite.js')

build_file = ROOT / 'NexusNovaAndroid/app/build.gradle.kts'
replace_once(
    build_file,
    '''    compileOptions {\n        sourceCompatibility = JavaVersion.VERSION_17\n        targetCompatibility = JavaVersion.VERSION_17\n    }''',
    '''    compileOptions {\n        sourceCompatibility = JavaVersion.VERSION_17\n        targetCompatibility = JavaVersion.VERSION_17\n        isCoreLibraryDesugaringEnabled = true\n    }''',
    'build.gradle compileOptions'
)
replace_once(
    build_file,
    '''dependencies {\n    implementation("androidx.core:core-ktx:1.12.0")''',
    '''dependencies {\n    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.3")\n    implementation("com.wireguard.android:tunnel:1.0.20260102")\n\n    implementation("androidx.core:core-ktx:1.12.0")''',
    'build.gradle dependencies'
)

manifest = ROOT / 'NexusNovaAndroid/app/src/main/AndroidManifest.xml'
replace_once(
    manifest,
    '''        <activity\n            android:name=".BrowserActivity"\n            android:exported="false"\n            android:label="NexusNova Browser"\n            android:configChanges="orientation|screenSize|keyboardHidden"\n            android:windowSoftInputMode="adjustResize" />\n\n        <activity\n            android:name=".CallerSetupActivity"''',
    '''        <activity\n            android:name=".BrowserActivity"\n            android:exported="false"\n            android:label="NexusNova Browser"\n            android:configChanges="orientation|screenSize|keyboardHidden"\n            android:windowSoftInputMode="adjustResize" />\n\n        <activity\n            android:name=".NovaVpnActivity"\n            android:exported="false"\n            android:label="Nova VPN"\n            android:configChanges="orientation|screenSize|keyboardHidden" />\n\n        <activity\n            android:name=".CallerSetupActivity"''',
    'AndroidManifest NovaVpnActivity'
)

main = ROOT / 'NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt'
replace_once(
    main,
    '''            ACTION_REQUEST_CALLER_ROLE -> requestCallerRole()\n\n            ACTION_OPEN_EXTERNAL -> {''',
    '''            ACTION_REQUEST_CALLER_ROLE -> requestCallerRole()\n\n            ACTION_OPEN_NOVA_VPN -> {\n                val authToken = message.optString("authToken").trim()\n                if (authToken.isBlank() || authToken.length > MAX_VPN_AUTH_TOKEN_CHARS) return\n                try {\n                    startActivity(\n                        Intent(this, NovaVpnActivity::class.java)\n                            .putExtra(NovaVpnActivity.EXTRA_AUTH_TOKEN, authToken)\n                    )\n                } catch (_: Exception) {\n                    // Keep the main app alive if the optional VPN control cannot launch.\n                }\n            }\n\n            ACTION_OPEN_EXTERNAL -> {''',
    'MainActivity VPN action'
)
replace_once(
    main,
    '''        const val ACTION_REQUEST_CALLER_ROLE = "requestCallerRole"\n        const val ACTION_OPEN_EXTERNAL = "openExternal"\n\n        const val MAX_BRIDGE_MESSAGE_CHARS = 2_048''',
    '''        const val ACTION_REQUEST_CALLER_ROLE = "requestCallerRole"\n        const val ACTION_OPEN_NOVA_VPN = "openNovaVpn"\n        const val ACTION_OPEN_EXTERNAL = "openExternal"\n\n        const val MAX_BRIDGE_MESSAGE_CHARS = 8_192\n        const val MAX_VPN_AUTH_TOKEN_CHARS = 7_000''',
    'MainActivity VPN constants'
)

registry = ROOT / 'fresh-rebuild/src/features/hub/app-registry.js'
replace_once(
    registry,
    '''  { id: 'nova-vault', name: 'Nova Vault + 10X', category: 'Mining', placement: 'mine', icon: 'vault', description: 'Server-backed vault rewards and secure 10X chance' },\n  { id: 'file-vault', name: 'File Vault', category: 'Security & System', icon: 'vault', description: 'Protected file workflow' },''',
    '''  { id: 'nova-vault', name: 'Nova Vault + 10X', category: 'Mining', placement: 'mine', icon: 'vault', description: 'Server-backed vault rewards and secure 10X chance' },\n  { id: 'nova-vpn', name: 'Nova VPN', category: 'Security & System', icon: 'security', description: 'System-wide WireGuard VPN for browsers and apps' },\n  { id: 'file-vault', name: 'File Vault', category: 'Security & System', icon: 'vault', description: 'Protected file workflow' },''',
    'Nova Hub registry'
)

app_screen = ROOT / 'fresh-rebuild/src/features/apps/app-screen.js'
replace_once(
    app_screen,
    '''import { articleRenderers } from './articles-suite.js';\nimport { newsSuiteRenderers } from './news-suite.js';''',
    '''import { articleRenderers } from './articles-suite.js';\nimport { novaVpnRenderers } from './nova-vpn-suite.js';\nimport { newsSuiteRenderers } from './news-suite.js';''',
    'app-screen import'
)
replace_once(
    app_screen,
    '''premiumQuranRenderers[id] || documentsLiveRenderers[id] || teacherAIRenderers[id] || pakistanSuiteRenderers[id] || articleRenderers[id] || newsSuiteRenderers[id]''',
    '''premiumQuranRenderers[id] || documentsLiveRenderers[id] || teacherAIRenderers[id] || pakistanSuiteRenderers[id] || articleRenderers[id] || novaVpnRenderers[id] || newsSuiteRenderers[id]''',
    'app-screen renderer'
)

ad_policy = ROOT / 'fresh-rebuild/src/core/ad-policy.js'
replace_once(
    ad_policy,
    '''  'quran', 'hadith', 'bukhari', 'bible', 'qibla', 'security', 'emergency',\n  'health', 'contacts', 'about'\n]);''',
    '''  'quran', 'hadith', 'bukhari', 'bible', 'qibla', 'security', 'emergency',\n  'health', 'contacts', 'about', 'nova-vpn'\n]);''',
    'ad-policy protected apps'
)
replace_once(
    ad_policy,
    '''  'nova-vault':'tools',\n  'file-vault':'tools',''',
    '''  'nova-vault':'tools',\n  'nova-vpn':'tools',\n  'file-vault':'tools',''',
    'ad-policy coverage alias'
)

print('Nova VPN canonical source prepared successfully.')
