from pathlib import Path
import runpy

path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
text = path.read_text()

if 'private lateinit var adConsentManager: NexusAdConsentManager' not in text:
    marker = '    private lateinit var adManager: NexusAdManager\n'
    if marker not in text:
        raise SystemExit('Ad manager field missing before privacy patch')
    text = text.replace(marker, marker + '    private lateinit var adConsentManager: NexusAdConsentManager\n', 1)

if 'adConsentManager = NexusAdConsentManager(this)' not in text:
    old = '''        adManager = NexusAdManager(this, webView) { view -> isTrustedAppPage(view) }\n        if (BuildConfig.NEXUS_ADS_TEST_MODE) {\n            // Debug/development APKs always use Google's test inventory.\n            adManager.initialize()\n        } else {\n            // Release APKs cannot initialize/request production ads until UMP\n            // has refreshed consent state and says ad requests are allowed.\n            NexusAdConsentManager(this).gather { canRequestAds ->\n                if (canRequestAds) adManager.initialize()\n            }\n        }\n'''
    new = '''        adManager = NexusAdManager(this, webView) { view -> isTrustedAppPage(view) }\n        adConsentManager = NexusAdConsentManager(this)\n        if (BuildConfig.NEXUS_ADS_TEST_MODE) {\n            // Debug/development APKs always use Google's test inventory.\n            adManager.initialize()\n        } else {\n            // Release APKs cannot initialize/request production ads until UMP\n            // has refreshed consent state and says ad requests are allowed.\n            adConsentManager.gather { canRequestAds ->\n                if (canRequestAds) adManager.initialize()\n                publishAdPrivacyStatus()\n            }\n        }\n'''
    if old not in text:
        raise SystemExit('Ad consent initialization block not found')
    text = text.replace(old, new, 1)

if 'ACTION_AD_PRIVACY_STATUS -> publishAdPrivacyStatus()' not in text:
    old = '''            ACTION_AD_STATUS -> adManager.publishStatus()\n\n            ACTION_OPEN_EXTERNAL -> {'''
    new = '''            ACTION_AD_STATUS -> {\n                adManager.publishStatus()\n                publishAdPrivacyStatus()\n            }\n            ACTION_AD_PRIVACY_STATUS -> publishAdPrivacyStatus()\n            ACTION_SHOW_AD_PRIVACY_OPTIONS -> {\n                if (BuildConfig.NEXUS_ADS_TEST_MODE || !adConsentManager.privacyOptionsRequired()) {\n                    publishAdPrivacyStatus()\n                } else {\n                    adConsentManager.showPrivacyOptions { error ->\n                        publishAdPrivacyStatus(error)\n                    }\n                }\n            }\n\n            ACTION_OPEN_EXTERNAL -> {'''
    if old not in text:
        raise SystemExit('Ad status action block not found for privacy insertion')
    text = text.replace(old, new, 1)

if 'private fun publishAdPrivacyStatus' not in text:
    marker = '    private fun permissionsFor(resources: Array<String>): List<String> = buildList {\n'
    method = '''    private fun publishAdPrivacyStatus(error: String? = null) {\n        runOnUiThread {\n            if (!::adConsentManager.isInitialized || !isTrustedAppPage(webView)) return@runOnUiThread\n            val required = !BuildConfig.NEXUS_ADS_TEST_MODE && adConsentManager.privacyOptionsRequired()\n            val detail = JSONObject()\n                .put("required", required)\n                .put("testMode", BuildConfig.NEXUS_ADS_TEST_MODE)\n                .put("error", error ?: JSONObject.NULL)\n            val script = "window.dispatchEvent(new CustomEvent('nexusnova:ad-privacy-event',{detail:${detail}}));"\n            webView.evaluateJavascript(script, null)\n        }\n    }\n\n'''
    if marker not in text:
        raise SystemExit('Privacy status method insertion point not found')
    text = text.replace(marker, method + marker, 1)

if 'const val ACTION_AD_PRIVACY_STATUS = "adPrivacyStatus"' not in text:
    marker = '''        const val ACTION_AD_STATUS = "adStatus"\n'''
    addition = marker + '''        const val ACTION_AD_PRIVACY_STATUS = "adPrivacyStatus"\n        const val ACTION_SHOW_AD_PRIVACY_OPTIONS = "showAdPrivacyOptions"\n'''
    if marker not in text:
        raise SystemExit('Ad status constant insertion point not found')
    text = text.replace(marker, addition, 1)

path.write_text(text)

required = [
    'adConsentManager = NexusAdConsentManager(this)',
    'ACTION_AD_PRIVACY_STATUS -> publishAdPrivacyStatus()',
    'ACTION_SHOW_AD_PRIVACY_OPTIONS',
    'nexusnova:ad-privacy-event',
]
missing = [item for item in required if item not in text]
if missing:
    raise SystemExit('Ad privacy patch verification failed: ' + ', '.join(missing))

# This workflow step runs immediately after the authoritative TEST timer patch,
# so it is the safe point to harden native earned/dismiss event ordering.
runpy.run_path('NexusNovaAndroid/patch_android_reward_event_order_v1.py', run_name='__main__')

print('UMP privacy options bridge + rewarded event-order hardening applied.')
