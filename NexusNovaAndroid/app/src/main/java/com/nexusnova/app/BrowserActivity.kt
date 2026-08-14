package com.nexusnova.app

import android.annotation.SuppressLint
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.Locale

class BrowserActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var addressBar: EditText
    private lateinit var progressBar: ProgressBar
    private lateinit var titleView: TextView
    private lateinit var secureBadge: TextView
    private lateinit var backButton: Button
    private lateinit var forwardButton: Button
    private lateinit var desktopButton: Button

    private var desktopMode = false
    private var mobileUserAgent = ""

    private val bg = Color.rgb(4, 8, 14)
    private val bar = Color.rgb(10, 16, 26)
    private val surface = Color.rgb(15, 25, 39)
    private val surface2 = Color.rgb(19, 33, 51)
    private val line = Color.rgb(37, 58, 82)
    private val cyan = Color.rgb(103, 205, 255)
    private val primary = Color.rgb(241, 247, 255)

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportActionBar?.hide()
        title = "NexusNova Browser"

        window.statusBarColor = Color.rgb(3, 6, 11)
        window.navigationBarColor = Color.rgb(3, 6, 11)

        desktopMode = getSharedPreferences(PREFS, MODE_PRIVATE)
            .getBoolean(PREF_DESKTOP_MODE, false)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(bg)
        }

        root.addView(buildTabStrip())
        root.addView(buildAddressBar())

        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progress = 0
            visibility = View.GONE
            progressTintList = ColorStateList.valueOf(cyan)
            progressBackgroundTintList = ColorStateList.valueOf(Color.rgb(7, 13, 22))
        }
        root.addView(
            progressBar,
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(2))
        )

        webView = WebView(this).apply {
            setBackgroundColor(Color.rgb(7, 11, 18))
            overScrollMode = View.OVER_SCROLL_NEVER
        }
        root.addView(
            webView,
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        )

        root.addView(buildBottomBar())

        setContentView(root)
        configureWebView()

        val requested = intent.getStringExtra(EXTRA_URL).orEmpty()
        if (requested.isBlank()) {
            loadStartPage()
        } else {
            val normalized = normalizeInput(requested)
            if (normalized.isBlank()) loadStartPage() else webView.loadUrl(normalized)
        }
    }

    private fun buildTabStrip(): View {
        val strip = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(10), dp(8), dp(8), dp(7))
            setBackgroundColor(bar)
        }

        val logo = TextView(this).apply {
            text = "N"
            gravity = Gravity.CENTER
            textSize = 16f
            setTextColor(Color.WHITE)
            typeface = Typeface.DEFAULT_BOLD
            background = roundedGradient(
                intArrayOf(Color.rgb(31, 98, 220), cyan),
                dp(11).toFloat(),
                Color.rgb(93, 189, 255),
                dp(1)
            )
            elevation = dp(4).toFloat()
        }
        strip.addView(logo, LinearLayout.LayoutParams(dp(34), dp(34)).apply {
            marginEnd = dp(8)
        })

        val tab = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(10), 0, dp(6), 0)
            background = roundedGradient(
                intArrayOf(Color.rgb(24, 37, 56), Color.rgb(16, 26, 40)),
                dp(11).toFloat(),
                Color.rgb(42, 65, 92),
                dp(1)
            )
        }

        val dot = TextView(this).apply {
            text = "●"
            textSize = 9f
            setTextColor(cyan)
            gravity = Gravity.CENTER
        }
        tab.addView(dot, LinearLayout.LayoutParams(dp(22), dp(36)))

        titleView = TextView(this).apply {
            text = "New Tab"
            setTextColor(primary)
            textSize = 11f
            typeface = Typeface.DEFAULT_BOLD
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
            gravity = Gravity.CENTER_VERTICAL
        }
        tab.addView(titleView, LinearLayout.LayoutParams(0, dp(36), 1f))

        val close = miniButton("×").apply {
            textSize = 16f
            contentDescription = "New tab"
            setOnClickListener { loadStartPage() }
        }
        tab.addView(close, LinearLayout.LayoutParams(dp(30), dp(30)))

        strip.addView(
            tab,
            LinearLayout.LayoutParams(0, dp(38), 1f).apply {
                marginEnd = dp(6)
            }
        )

        val newTab = miniButton("+").apply {
            textSize = 20f
            contentDescription = "New tab"
            setOnClickListener { loadStartPage() }
        }
        strip.addView(newTab, LinearLayout.LayoutParams(dp(36), dp(36)).apply {
            marginEnd = dp(4)
        })

        val menu = miniButton("⋮").apply {
            textSize = 20f
            contentDescription = "Browser menu"
            setOnClickListener { showBrowserMenu(this) }
        }
        strip.addView(menu, LinearLayout.LayoutParams(dp(36), dp(36)))

        return strip
    }

    private fun buildAddressBar(): View {
        val outer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(8), dp(7), dp(8), dp(8))
            setBackgroundColor(bar)
        }

        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }

        backButton = miniButton("‹").apply {
            textSize = 25f
            contentDescription = "Back"
            setOnClickListener { if (webView.canGoBack()) webView.goBack() }
        }
        forwardButton = miniButton("›").apply {
            textSize = 25f
            contentDescription = "Forward"
            setOnClickListener { if (webView.canGoForward()) webView.goForward() }
        }

        row.addView(backButton, LinearLayout.LayoutParams(dp(36), dp(42)).apply {
            marginEnd = dp(3)
        })
        row.addView(forwardButton, LinearLayout.LayoutParams(dp(36), dp(42)).apply {
            marginEnd = dp(5)
        })

        val omnibox = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(9), 0, dp(5), 0)
            background = roundedGradient(
                intArrayOf(Color.rgb(18, 29, 44), Color.rgb(14, 23, 36)),
                dp(22).toFloat(),
                line,
                dp(1)
            )
        }

        secureBadge = TextView(this).apply {
            text = "✓"
            gravity = Gravity.CENTER
            textSize = 12f
            setTextColor(cyan)
            typeface = Typeface.DEFAULT_BOLD
        }
        omnibox.addView(secureBadge, LinearLayout.LayoutParams(dp(25), dp(42)))

        addressBar = EditText(this).apply {
            hint = "Search or enter website"
            setSingleLine(true)
            setTextColor(primary)
            setHintTextColor(Color.rgb(105, 126, 153))
            textSize = 12f
            setPadding(0, 0, dp(6), 0)
            setSelectAllOnFocus(true)
            background = null
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_URI
            imeOptions = EditorInfo.IME_ACTION_GO
            setOnEditorActionListener { _, actionId, event ->
                val go = actionId == EditorInfo.IME_ACTION_GO ||
                    actionId == EditorInfo.IME_ACTION_SEARCH ||
                    event?.keyCode == android.view.KeyEvent.KEYCODE_ENTER
                if (go) {
                    navigate(text?.toString().orEmpty())
                    true
                } else {
                    false
                }
            }
        }
        omnibox.addView(addressBar, LinearLayout.LayoutParams(0, dp(42), 1f))

        val reload = miniButton("↻").apply {
            textSize = 18f
            contentDescription = "Reload"
            setOnClickListener {
                if (isStartPage(webView.url)) loadStartPage() else webView.reload()
            }
        }
        omnibox.addView(reload, LinearLayout.LayoutParams(dp(34), dp(34)))

        row.addView(
            omnibox,
            LinearLayout.LayoutParams(0, dp(44), 1f).apply {
                marginEnd = dp(5)
            }
        )

        val go = browserButton("GO", primaryButton = true).apply {
            textSize = 9f
            letterSpacing = 0.08f
            setOnClickListener { navigate(addressBar.text?.toString().orEmpty()) }
        }
        row.addView(go, LinearLayout.LayoutParams(dp(50), dp(42)))

        outer.addView(row)
        return outer
    }

    private fun buildBottomBar(): View {
        val bottom = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(dp(8), dp(6), dp(8), dp(7))
            setBackgroundColor(Color.rgb(8, 13, 22))
            elevation = dp(10).toFloat()
        }

        val back = bottomButton("‹", "Back") {
            if (webView.canGoBack()) webView.goBack()
        }
        val home = bottomButton("⌂", "Home") { loadStartPage() }
        val tabs = bottomButton("□", "1 Tab") {
            Toast.makeText(this, "NexusNova Browser • 1 active tab", Toast.LENGTH_SHORT).show()
        }
        desktopButton = bottomButton("▣", if (desktopMode) "Desktop On" else "Desktop") {
            toggleDesktopMode()
        }
        val menu = bottomButton("☰", "Menu") { showBrowserMenu(it) }

        listOf(back, home, tabs, desktopButton, menu).forEach { button ->
            bottom.addView(
                button,
                LinearLayout.LayoutParams(0, dp(54), 1f).apply {
                    marginStart = dp(2)
                    marginEnd = dp(2)
                }
            )
        }
        return bottom
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.allowFileAccessFromFileURLs = false
        settings.allowUniversalAccessFromFileURLs = false
        settings.mediaPlaybackRequiresUserGesture = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.setSupportMultipleWindows(false)
        settings.javaScriptCanOpenWindowsAutomatically = false
        settings.builtInZoomControls = true
        settings.displayZoomControls = false
        settings.setSupportZoom(true)
        settings.useWideViewPort = true
        mobileUserAgent = settings.userAgentString
        applyDesktopMode(reload = false)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.safeBrowsingEnabled = true
        }

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return true
                if (isAllowedWebUri(uri)) return false
                openSupportedExternalScheme(uri)
                return true
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                updateAddressFor(url)
                progressBar.visibility = View.VISIBLE
                secureBadge.text = "…"
                secureBadge.setTextColor(cyan)
                syncNavigationButtons()
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                updateAddressFor(url)
                updateSecurityBadge(url)
                syncNavigationButtons()
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                progressBar.visibility = if (newProgress >= 100) View.GONE else View.VISIBLE
            }

            override fun onReceivedTitle(view: WebView?, pageTitle: String?) {
                if (isStartPage(view?.url)) {
                    titleView.text = "New Tab"
                    return
                }
                val clean = pageTitle?.trim().orEmpty().take(46)
                titleView.text = if (clean.isBlank()) hostLabel(view?.url) else clean
            }
        }
    }

    private fun navigate(raw: String) {
        val url = normalizeInput(raw)
        if (url.isBlank()) {
            Toast.makeText(this, "Website ya search term likho.", Toast.LENGTH_SHORT).show()
            return
        }
        webView.loadUrl(url)
    }

    private fun normalizeInput(raw: String): String {
        val text = raw.trim().take(MAX_URL_CHARS)
        if (text.isBlank()) return ""

        if (text.startsWith("javascript:", true) ||
            text.startsWith("data:", true) ||
            text.startsWith("file:", true) ||
            text.startsWith("content:", true) ||
            text.startsWith("intent:", true) ||
            text.startsWith("blob:", true)
        ) return ""

        val looksLikeSearch = text.contains(' ') || (!text.contains('.') && !text.startsWith("http", true))
        if (looksLikeSearch) {
            val query = URLEncoder.encode(text, StandardCharsets.UTF_8.toString())
            return "$SEARCH_URL$query"
        }

        val candidate = if (text.startsWith("http://", true) || text.startsWith("https://", true)) text else "https://$text"
        return try {
            val uri = Uri.parse(candidate)
            if (uri.host.isNullOrBlank()) return ""
            when (uri.scheme?.lowercase(Locale.ROOT)) {
                "https" -> uri.toString()
                "http" -> uri.buildUpon().scheme("https").build().toString()
                else -> ""
            }
        } catch (_: Exception) {
            ""
        }
    }

    private fun loadStartPage() {
        titleView.text = "New Tab"
        addressBar.setText("")
        secureBadge.text = "N"
        secureBadge.setTextColor(cyan)
        webView.loadDataWithBaseURL(
            START_PAGE_URL,
            startPageHtml(),
            "text/html",
            StandardCharsets.UTF_8.name(),
            START_PAGE_URL
        )
    }

    private fun startPageHtml(): String = """
        <!doctype html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
          <meta name="color-scheme" content="dark">
          <title>NexusNova Start</title>
          <style>
            *{box-sizing:border-box}
            body{margin:0;min-height:100vh;background:radial-gradient(700px 360px at 50% -10%,rgba(49,132,255,.20),transparent 66%),#070b12;color:#eef6ff;font-family:Arial,sans-serif;padding:28px 16px 32px}
            .wrap{max-width:900px;margin:auto}.hero{text-align:center;padding:18px 0 24px}
            .logo{display:grid;place-items:center;width:78px;height:78px;margin:0 auto 16px;border-radius:27px;background:linear-gradient(145deg,#165fc9,#66caff);font-size:36px;font-weight:900;box-shadow:0 22px 50px rgba(24,118,247,.28),inset 0 1px 0 rgba(255,255,255,.32)}
            h1{font-size:34px;margin:0;letter-spacing:-1.7px}h1 span{color:#63c3ff}.sub{color:#7f93ad;font-size:12px;line-height:1.6;margin:8px 0 20px}
            form{display:flex;gap:8px;max-width:650px;margin:0 auto;background:#111a27;border:1px solid #263b55;border-radius:28px;padding:6px}input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:white;padding:0 14px;font-size:14px}button{border:0;border-radius:22px;background:linear-gradient(145deg,#2178ed,#63c8ff);color:white;font-weight:800;padding:12px 18px}
            .label{margin:28px 2px 10px;color:#8aa0bc;font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}a{display:block;text-decoration:none;color:#e6f2ff;background:linear-gradient(160deg,#111c2b,#0c141f);border:1px solid #1e3046;border-radius:17px;padding:16px 8px;text-align:center}.ic{display:grid;place-items:center;width:42px;height:42px;margin:0 auto 8px;border-radius:14px;background:linear-gradient(145deg,#17467c,#172b45);color:#87d1ff;font-weight:900;font-size:12px}strong{display:block;font-size:12px}.small{display:block;color:#667c98;font-size:9px;margin-top:3px}.info{margin-top:20px;border:1px solid #1a2c41;background:#0e1825;border-radius:16px;padding:13px;color:#7890aa;font-size:10px;line-height:1.6}@media(max-width:560px){.grid{grid-template-columns:repeat(2,1fr)}h1{font-size:29px}}
          </style>
        </head>
        <body>
          <div class="wrap"><div class="hero"><div class="logo">N</div><h1>Nexus<span>Nova</span> Browser</h1><div class="sub">Fast NexusNova start page • search, speed dial, desktop mode and real in-app browsing.</div><form action="https://www.google.com/search" method="get"><input name="q" autocomplete="off" placeholder="Search the web"><button type="submit">SEARCH</button></form></div><div class="label">Speed Dial</div><div class="grid"><a href="https://www.google.com/"><span class="ic">G</span><strong>Google</strong><span class="small">Search</span></a><a href="https://www.youtube.com/"><span class="ic">Y</span><strong>YouTube</strong><span class="small">Video</span></a><a href="https://www.wikipedia.org/"><span class="ic">W</span><strong>Wikipedia</strong><span class="small">Knowledge</span></a><a href="https://www.bbc.com/"><span class="ic">B</span><strong>BBC</strong><span class="small">News</span></a><a href="https://www.google.com/maps/"><span class="ic">M</span><strong>Maps</strong><span class="small">Places</span></a><a href="https://github.com/"><span class="ic">GH</span><strong>GitHub</strong><span class="small">Code</span></a><a href="https://chatgpt.com/"><span class="ic">AI</span><strong>ChatGPT</strong><span class="small">AI</span></a><a href="https://mail.google.com/"><span class="ic">GM</span><strong>Gmail</strong><span class="small">Mail</span></a></div><div class="info">NexusNova Browser runs websites directly in Android WebView. The web/GitHub Pages version cannot embed many sites because those sites block iframes, so the web version opens them in a real browser tab instead.</div></div>
        </body>
        </html>
    """.trimIndent()

    private fun showBrowserMenu(anchor: View) {
        val popup = PopupMenu(this, anchor)
        popup.menu.add("New tab")
        popup.menu.add(if (desktopMode) "Turn off Desktop Site" else "Desktop Site")
        popup.menu.add("Extensions & Apps")
        popup.menu.add("Open current page externally")
        popup.menu.add("Reload")
        popup.menu.add("Home")

        popup.setOnMenuItemClickListener { item ->
            when (item.title.toString()) {
                "New tab" -> loadStartPage()
                "Desktop Site", "Turn off Desktop Site" -> toggleDesktopMode()
                "Extensions & Apps" -> openExtensionsHub()
                "Open current page externally" -> openCurrentExternally()
                "Reload" -> if (isStartPage(webView.url)) loadStartPage() else webView.reload()
                "Home" -> loadStartPage()
            }
            true
        }
        popup.show()
    }

    private fun openExtensionsHub() {
        try {
            startActivity(Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                putExtra(EXTRA_OPEN_BROWSER_EXTENSIONS, true)
            })
        } catch (_: Exception) {
            Toast.makeText(this, "Extensions Hub unavailable.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun openCurrentExternally() {
        val url = webView.url.orEmpty()
        if (isStartPage(url) || !url.startsWith("https://", true)) return
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (_: Exception) {
            Toast.makeText(this, "No external browser found.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun toggleDesktopMode() {
        desktopMode = !desktopMode
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(PREF_DESKTOP_MODE, desktopMode).apply()
        applyDesktopMode(reload = true)
    }

    private fun applyDesktopMode(reload: Boolean) {
        if (!this::webView.isInitialized) return
        val settings = webView.settings
        if (mobileUserAgent.isBlank()) mobileUserAgent = settings.userAgentString

        if (desktopMode) {
            settings.userAgentString = DESKTOP_USER_AGENT
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            settings.textZoom = 100
            webView.setInitialScale(0)
            if (this::desktopButton.isInitialized) desktopButton.text = "▣\nDesktop On"
        } else {
            settings.userAgentString = mobileUserAgent
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = false
            settings.textZoom = 100
            webView.setInitialScale(0)
            if (this::desktopButton.isInitialized) desktopButton.text = "▣\nDesktop"
        }

        if (reload && webView.url != null) {
            if (isStartPage(webView.url)) loadStartPage() else webView.reload()
        }
    }

    private fun updateAddressFor(url: String?) {
        if (!this::addressBar.isInitialized) return
        if (isStartPage(url)) addressBar.setText("") else if (!url.isNullOrBlank()) addressBar.setText(url)
    }

    private fun updateSecurityBadge(url: String?) {
        if (!this::secureBadge.isInitialized) return
        if (isStartPage(url)) {
            secureBadge.text = "N"
            secureBadge.setTextColor(cyan)
            return
        }
        val secure = url?.startsWith("https://", true) == true
        secureBadge.text = if (secure) "✓" else "!"
        secureBadge.setTextColor(if (secure) Color.rgb(91, 218, 180) else Color.rgb(255, 135, 145))
    }

    private fun syncNavigationButtons() {
        if (!this::webView.isInitialized || !this::backButton.isInitialized || !this::forwardButton.isInitialized) return
        backButton.isEnabled = webView.canGoBack()
        forwardButton.isEnabled = webView.canGoForward()
        backButton.alpha = if (backButton.isEnabled) 1f else 0.32f
        forwardButton.alpha = if (forwardButton.isEnabled) 1f else 0.32f
    }

    private fun hostLabel(url: String?): String {
        if (url.isNullOrBlank()) return "NexusNova Browser"
        return try {
            Uri.parse(url).host?.removePrefix("www.")?.take(40) ?: "NexusNova Browser"
        } catch (_: Exception) {
            "NexusNova Browser"
        }
    }

    private fun isAllowedWebUri(uri: Uri): Boolean = uri.scheme.equals("https", ignoreCase = true) && !uri.host.isNullOrBlank()

    private fun isStartPage(url: String?): Boolean = !url.isNullOrBlank() && url.startsWith(START_PAGE_URL, ignoreCase = true)

    private fun openSupportedExternalScheme(uri: Uri) {
        val allowed = when (uri.scheme?.lowercase(Locale.ROOT)) {
            "tel", "sms", "smsto", "mailto", "geo" -> true
            else -> false
        }
        if (!allowed) return
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: Exception) {
            Toast.makeText(this, "No app found for this link.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun miniButton(label: String) = Button(this).apply {
        text = label
        isAllCaps = false
        gravity = Gravity.CENTER
        setTextColor(Color.rgb(180, 199, 221))
        typeface = Typeface.DEFAULT_BOLD
        minWidth = 0
        minHeight = 0
        setPadding(0, 0, 0, 0)
        stateListAnimator = null
        background = roundedGradient(intArrayOf(Color.rgb(14, 23, 36), Color.rgb(12, 20, 31)), dp(11).toFloat(), Color.TRANSPARENT, 0)
    }

    private fun browserButton(label: String, primaryButton: Boolean = false) = Button(this).apply {
        text = label
        isAllCaps = false
        gravity = Gravity.CENTER
        setTextColor(Color.WHITE)
        typeface = Typeface.DEFAULT_BOLD
        minWidth = 0
        minHeight = 0
        setPadding(0, 0, 0, 0)
        stateListAnimator = null
        background = if (primaryButton) {
            roundedGradient(intArrayOf(Color.rgb(35, 112, 232), cyan), dp(13).toFloat(), Color.rgb(94, 190, 255), dp(1))
        } else {
            roundedGradient(intArrayOf(surface2, surface), dp(13).toFloat(), line, dp(1))
        }
    }

    private fun bottomButton(icon: String, label: String, action: (View) -> Unit) = Button(this).apply {
        text = "$icon\n$label"
        isAllCaps = false
        gravity = Gravity.CENTER
        setTextColor(Color.rgb(150, 173, 200))
        typeface = Typeface.DEFAULT_BOLD
        textSize = 9f
        minWidth = 0
        minHeight = 0
        setPadding(0, dp(4), 0, dp(3))
        stateListAnimator = null
        background = roundedGradient(intArrayOf(Color.rgb(10, 17, 27), Color.rgb(8, 14, 23)), dp(12).toFloat(), Color.TRANSPARENT, 0)
        setOnClickListener { view -> action(view) }
    }

    private fun roundedGradient(colors: IntArray, radius: Float, strokeColor: Int, strokeWidth: Int): GradientDrawable =
        GradientDrawable(GradientDrawable.Orientation.TL_BR, colors).apply {
            cornerRadius = radius
            if (strokeWidth > 0 && strokeColor != Color.TRANSPARENT) setStroke(strokeWidth, strokeColor)
        }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (this::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        if (this::webView.isInitialized) {
            webView.stopLoading()
            webView.loadUrl("about:blank")
            webView.clearHistory()
            webView.removeAllViews()
            webView.destroy()
        }
        super.onDestroy()
    }

    companion object {
        const val EXTRA_URL = "nexusnova.browser.url"
        const val EXTRA_OPEN_BROWSER_EXTENSIONS = "nexusnova.browser.open_extensions"
        private const val PREFS = "nexusnova_browser"
        private const val PREF_DESKTOP_MODE = "desktop_mode"
        private const val START_PAGE_URL = "https://start.nexusnova.local/"
        private const val SEARCH_URL = "https://www.google.com/search?q="
        private const val MAX_URL_CHARS = 2_000
        private const val DESKTOP_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 NexusNovaBrowser/3.0"
    }
}
