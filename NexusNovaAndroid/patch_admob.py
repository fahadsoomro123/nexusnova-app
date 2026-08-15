from pathlib import Path

path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
text = path.read_text()

# Keep this patch separate from patch_viewport.py. The viewport helper is an
# approved/locked UI fix and must remain independently testable.
if 'private lateinit var adManager: NexusAdManager' not in text:
    old = '    private lateinit var webView: WebView\n'
    new = old + '    private lateinit var adManager: NexusAdManager\n'
    if old not in text:
        raise SystemExit('AdMob field insertion point not found')
    text = text.replace(old, new, 1)

if 'adManager = NexusAdManager(this, webView)' not in text:
    old = '''        configureWebView()\n        installNativeMessageListener()\n\n        // The production GitHub Pages origin'''
    new = '''        configureWebView()\n        installNativeMessageListener()\n        adManager = NexusAdManager(this, webView) { view -> isTrustedAppPage(view) }\n        adManager.initialize()\n\n        // The production GitHub Pages origin'''
    if old not in text:
        raise SystemExit('AdMob initialization insertion point not found')
    text = text.replace(old, new, 1)

if 'ACTION_SHOW_REWARDED_AD -> adManager.showRewarded()' not in text:
    old = '''            ACTION_REQUEST_CALLER_ROLE -> requestCallerRole()\n\n            ACTION_OPEN_EXTERNAL -> {'''
    new = '''            ACTION_REQUEST_CALLER_ROLE -> requestCallerRole()\n\n            ACTION_SHOW_REWARDED_AD -> adManager.showRewarded()\n            ACTION_SHOW_INTERSTITIAL_AD -> adManager.showInterstitial()\n            ACTION_AD_STATUS -> adManager.publishStatus()\n\n            ACTION_OPEN_EXTERNAL -> {'''
    if old not in text:
        raise SystemExit('AdMob native-action insertion point not found')
    text = text.replace(old, new, 1)

if 'const val ACTION_SHOW_REWARDED_AD = "showRewardedAd"' not in text:
    old = '''        const val ACTION_REQUEST_CALLER_ROLE = "requestCallerRole"\n        const val ACTION_OPEN_EXTERNAL = "openExternal"\n'''
    new = '''        const val ACTION_REQUEST_CALLER_ROLE = "requestCallerRole"\n        const val ACTION_OPEN_EXTERNAL = "openExternal"\n        const val ACTION_SHOW_REWARDED_AD = "showRewardedAd"\n        const val ACTION_SHOW_INTERSTITIAL_AD = "showInterstitialAd"\n        const val ACTION_AD_STATUS = "adStatus"\n'''
    if old not in text:
        raise SystemExit('AdMob action-constant insertion point not found')
    text = text.replace(old, new, 1)

path.write_text(text)
print('AdMob bridge patch applied safely.')
