from pathlib import Path
import subprocess

path = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
text = path.read_text()

old = """        settings.cacheMode = WebSettings.LOAD_DEFAULT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {"""
new = """        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.useWideViewPort = false
        settings.loadWithOverviewMode = false
        webView.isHorizontalScrollBarEnabled = false
        webView.setOnScrollChangeListener { view, scrollX, scrollY, _, _ ->
            if (scrollX != 0) view.scrollTo(0, scrollY)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {"""
if old not in text:
    raise SystemExit('Viewport insertion point not found')
text = text.replace(old, new, 1)

viewport_body = '''
                view?.post {
                    view.scrollTo(0, 0)
                    view.evaluateJavascript(
                        \"\"\"
                        (function(){
                          try {
                            document.documentElement.style.width='100%';
                            document.documentElement.style.maxWidth='100%';
                            document.documentElement.style.overflowX='hidden';
                            document.body.style.width='100%';
                            document.body.style.maxWidth='100%';
                            document.body.style.overflowX='hidden';
                            var splash=document.getElementById('nxSplash');
                            if(splash){splash.style.left='0';splash.style.right='0';splash.style.width='100vw';splash.style.maxWidth='100vw';}
                            var auth=document.querySelector('.auth-shell');
                            if(auth){auth.style.marginLeft='auto';auth.style.marginRight='auto';auth.style.maxWidth='calc(100vw - 24px)';}
                            window.scrollTo(0,0);
                          } catch(e) {}
                        })();
                        \"\"\".trimIndent(),
                        null
                    )
                }
'''

old_client = """        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest("""

# Newer MainActivity versions own onPageFinished for blank-screen health checks.
# Keep the locked viewport correction independent by using onPageCommitVisible in
# that case. Older versions retain the original onPageFinished implementation.
if 'override fun onPageFinished(view: WebView?, url: String?)' in text:
    callback = '''        webView.webViewClient = object : WebViewClient() {
            override fun onPageCommitVisible(view: WebView?, url: String?) {
                super.onPageCommitVisible(view, url)''' + viewport_body + '''            }

            override fun shouldInterceptRequest('''
else:
    callback = '''        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)''' + viewport_body + '''            }

            override fun shouldInterceptRequest('''

if old_client not in text:
    raise SystemExit('WebViewClient insertion point not found')
text = text.replace(old_client, callback, 1)
path.write_text(text)

# Android owns the final splash escape as well as the web CSS/JS failsafes.
# Running this here keeps every existing Android build/runtime pipeline on the
# same native v4 release contract without changing the user's established UI.
subprocess.run(['python3', 'NexusNovaAndroid/patch_native_splash_release_v4.py'], check=True)
