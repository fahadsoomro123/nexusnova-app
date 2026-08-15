from pathlib import Path

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

old_client = """        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest("""
new_client = """        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
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
            }

            override fun shouldInterceptRequest("""
if old_client not in text:
    raise SystemExit('WebViewClient insertion point not found')
text = text.replace(old_client, new_client, 1)
path.write_text(text)
