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
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
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

    private val navy = Color.rgb(2, 7, 14)
    private val panel = Color.rgb(8, 23, 42)
    private val panel2 = Color.rgb(12, 34, 59)
    private val blueBright = Color.rgb(88, 181, 255)
    private val textPrimary = Color.WHITE
    private val textMuted = Color.rgb(119, 153, 190)

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportActionBar?.hide()
        title = "NexusNova Browser"
        window.statusBarColor = Color.rgb(1, 5, 10)
        window.navigationBarColor = Color.BLACK

        desktopMode = getPreferences(MODE_PRIVATE).getBoolean(PREF_DESKTOP_MODE, false)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(navy)
        }

        root.addView(buildBrandHeader())
        root.addView(buildAddressPanel())
        root.addView(buildNavigationRow())

        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progress = 0
            progressTintList = ColorStateList.valueOf(blueBright)
            progressBackgroundTintList = ColorStateList.valueOf(Color.rgb(10, 29, 50))
        }
        root.addView(progressBar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)))

        val secureStrip = TextView(this).apply {
            text = "●  NEXUS SECURE WEBVIEW   •   HTTPS ONLY   •   IN APP"
            setTextColor(Color.rgb(111, 180, 246))
            textSize = 8.5f
            letterSpacing = 0.08f
            gravity = Gravity.CENTER
            setPadding(dp(10), dp(7), dp(10), dp(7))
            background = roundedGradient(
                intArrayOf(Color.rgb(5, 17, 32), Color.rgb(7, 24, 44)),
                0f,
                Color.TRANSPARENT,
                0
            )
        }
        root.addView(secureStrip)

        webView = WebView(this).apply {
            setBackgroundColor(Color.rgb(3, 8, 15))
            overScrollMode = View.OVER_SCROLL_NEVER
        }
        root.addView(webView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))

        setContentView(root)
        configureWebView()

        val requested = intent.getStringExtra(EXTRA_URL).orEmpty()
        webView.loadUrl(normalizeInput(requested).ifBlank { HOME_URL })
    }

    private fun buildBrandHeader(): View {
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(14), dp(13), dp(14), dp(12))
            background = roundedGradient(
                intArrayOf(Color.rgb(5, 19, 36), Color.rgb(7, 28, 51), Color.rgb(3, 12, 24)),
                0f,
                Color.TRANSPARENT,
                0
            )
            elevation = dp(6).toFloat()
        }

        val logo = TextView(this).apply {
            text = "N"
            gravity = Gravity.CENTER
            textSize = 23f
            setTextColor(Color.WHITE)
            typeface = Typeface.DEFAULT_BOLD
            background = roundedGradient(
                intArrayOf(Color.rgb(18, 91, 205), blueBright),
                dp(15).toFloat(),
                Color.rgb(105, 193, 255),
                dp(1)
            )
            elevation = dp(8).toFloat()
        }
        header.addView(logo, LinearLayout.LayoutParams(dp(48), dp(48)).apply { marginEnd = dp(11) })

        val titleStack = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val kicker = TextView(this).apply {
            text = "NEXUSNOVA // WEB GRID"
            setTextColor(Color.rgb(104, 180, 252))
            textSize = 8f
            letterSpacing = 0.12f
            typeface = Typeface.DEFAULT_BOLD
        }
        titleView = TextView(this).apply {
            text = "NexusNova Browser"
            setTextColor(textPrimary)
            textSize = 17f
            maxLines = 1
            typeface = Typeface.DEFAULT_BOLD
        }
        val subtitle = TextView(this).apply {
            text = "Private-looking in-app browsing workspace"
            setTextColor(textMuted)
            textSize = 9.5f
            maxLines = 1
        }
        titleStack.addView(kicker)
        titleStack.addView(titleView)
        titleStack.addView(subtitle)
        header.addView(titleStack, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))

        secureBadge = TextView(this).apply {
            text = "SECURE"
            setTextColor(Color.rgb(151, 215, 255))
            textSize = 8.5f
            letterSpacing = 0.08f
            gravity = Gravity.CENTER
            typeface = Typeface.DEFAULT_BOLD
            setPadding(dp(9), dp(6), dp(9), dp(6))
            background = roundedGradient(
                intArrayOf(Color.rgb(10, 47, 84), Color.rgb(5, 29, 54)),
                dp(18).toFloat(),
                Color.rgb(40, 111, 177),
                dp(1)
            )
        }
        header.addView(secureBadge, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { marginStart = dp(8) })
        return header
    }

    private fun buildAddressPanel(): View {
        val outer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(10), dp(10), dp(10), dp(5))
            setBackgroundColor(navy)
        }

        val label = TextView(this).apply {
            text = "SEARCH OR ENTER WEBSITE"
            setTextColor(Color.rgb(91, 160, 226))
            textSize = 8f
            letterSpacing = 0.12f
            typeface = Typeface.DEFAULT_BOLD
            setPadding(dp(3), 0, 0, dp(5))
        }
        outer.addView(label)

        val card = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(7), dp(7), dp(7), dp(7))
            background = roundedGradient(
                intArrayOf(Color.rgb(12, 34, 59), Color.rgb(5, 17, 31)),
                dp(18).toFloat(),
                Color.rgb(34, 83, 132),
                dp(1)
            )
            elevation = dp(4).toFloat()
        }

        val lock = TextView(this).apply {
            text = "⌁"
            gravity = Gravity.CENTER
            textSize = 18f
            setTextColor(Color.rgb(104, 185, 255))
        }
        card.addView(lock, LinearLayout.LayoutParams(dp(34), dp(46)))

        addressBar = EditText(this).apply {
            hint = "Search the web or enter a secure website"
            setSingleLine(true)
            setTextColor(textPrimary)
            setHintTextColor(Color.rgb(107, 139, 174))
            textSize = 12.5f
            setPadding(dp(8), 0, dp(8), 0)
            setSelectAllOnFocus(true)
            background = roundedGradient(
                intArrayOf(Color.rgb(3, 11, 21), Color.rgb(5, 17, 31)),
                dp(13).toFloat(),
                Color.rgb(24, 65, 108),
                dp(1)
            )
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_URI
            imeOptions = android.view.inputmethod.EditorInfo.IME_ACTION_GO
            setOnEditorActionListener { _, actionId, event ->
                val go = actionId == android.view.inputmethod.EditorInfo.IME_ACTION_GO ||
                    event?.keyCode == android.view.KeyEvent.KEYCODE_ENTER
                if (go) {
                    navigate(addressBar.text?.toString().orEmpty())
                    true
                } else false
            }
        }
        card.addView(addressBar, LinearLayout.LayoutParams(0, dp(46), 1f).apply { marginEnd = dp(7) })

        val goButton = browserButton("GO", primary = true).apply {
            textSize = 10f
            letterSpacing = 0.08f
            setOnClickListener { navigate(addressBar.text?.toString().orEmpty()) }
        }
        card.addView(goButton, LinearLayout.LayoutParams(dp(64), dp(46)))
        outer.addView(card)
        return outer
    }

    private fun buildNavigationRow(): View {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(10), dp(3), dp(10), dp(9))
            setBackgroundColor(navy)
        }

        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }

        backButton = browserButton("‹").apply {
            contentDescription = "Back"
            textSize = 24f
            setOnClickListener { if (webView.canGoBack()) webView.goBack() }
        }
        forwardButton = browserButton("›").apply {
            contentDescription = "Forward"
            textSize = 24f
            setOnClickListener { if (webView.canGoForward()) webView.goForward() }
        }
        val reload = browserButton("↻").apply {
            contentDescription = "Reload"
            textSize = 19f
            setOnClickListener { webView.reload() }
        }
        val home = browserButton("⌂").apply {
            contentDescription = "Home"
            textSize = 18f
            setOnClickListener { webView.loadUrl(HOME_URL) }
        }

        listOf(backButton, forwardButton, reload, home).forEach { button ->
            row.addView(button, LinearLayout.LayoutParams(0, dp(44), 1f).apply {
                marginStart = dp(3)
                marginEnd = dp(3)
            })
        }
        container.addView(row)

        val featureRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(7), 0, 0)
        }

        desktopButton = browserButton(if (desktopMode) "Desktop: ON" else "Desktop Site").apply {
            textSize = 10f
            contentDescription = "Toggle desktop site mode"
            setOnClickListener { toggleDesktopMode() }
        }
        val extensions = browserButton("Extensions & Apps").apply {
            textSize = 10f
            contentDescription = "Extensions and Apps Hub"
            setOnClickListener {
                try {
                    startActivity(Intent(this@BrowserActivity, MainActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                        putExtra(EXTRA_OPEN_BROWSER_EXTENSIONS, true)
                    })
                } catch (_: Exception) {
                    // Keep browsing if the main app activity cannot be brought forward.
                }
            }
        }
        featureRow.addView(desktopButton, LinearLayout.LayoutParams(0, dp(42), 1f).apply { marginEnd = dp(4) })
        featureRow.addView(extensions, LinearLayout.LayoutParams(0, dp(42), 1f).apply { marginStart = dp(4) })
        container.addView(featureRow)

        val hint = TextView(this).apply {
            text = "BACK • FORWARD • RELOAD • HOME     |     DESKTOP • EXTENSIONS"
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(77, 119, 162))
            textSize = 7.2f
            letterSpacing = 0.04f
            setPadding(0, dp(5), 0, 0)
        }
        container.addView(hint)
        return container
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
        mobileUserAgent = settings.userAgentString
        applyDesktopMode(reload = false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.safeBrowsingEnabled = true

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return true
                if (isHttps(uri)) return false
                openSupportedExternalScheme(uri)
                return true
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                if (!url.isNullOrBlank()) addressBar.setText(url)
                progressBar.visibility = View.VISIBLE
                secureBadge.text = if (desktopMode) "DESKTOP" else "LOADING"
                secureBadge.setTextColor(Color.rgb(151, 215, 255))
                syncNavigationButtons()
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (!url.isNullOrBlank()) addressBar.setText(url)
                secureBadge.text = if (desktopMode) "DESKTOP" else "SECURE"
                secureBadge.setTextColor(Color.rgb(151, 215, 255))
                syncNavigationButtons()
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                progressBar.visibility = if (newProgress >= 100) View.GONE else View.VISIBLE
            }

            override fun onReceivedTitle(view: WebView?, pageTitle: String?) {
                val clean = pageTitle?.trim().orEmpty().take(38)
                titleView.text = if (clean.isBlank()) "NexusNova Browser" else clean
            }
        }
    }

    private fun toggleDesktopMode() {
        desktopMode = !desktopMode
        getPreferences(MODE_PRIVATE).edit().putBoolean(PREF_DESKTOP_MODE, desktopMode).apply()
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
            if (this::desktopButton.isInitialized) desktopButton.text = "Desktop: ON"
            if (this::secureBadge.isInitialized) secureBadge.text = "DESKTOP"
        } else {
            settings.userAgentString = mobileUserAgent
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = false
            settings.textZoom = 100
            webView.setInitialScale(0)
            if (this::desktopButton.isInitialized) desktopButton.text = "Desktop Site"
            if (this::secureBadge.isInitialized) secureBadge.text = "SECURE"
        }

        if (reload && webView.url != null) webView.reload()
    }

    private fun syncNavigationButtons() {
        if (!this::webView.isInitialized || !this::backButton.isInitialized || !this::forwardButton.isInitialized) return
        backButton.alpha = if (webView.canGoBack()) 1f else 0.36f
        forwardButton.alpha = if (webView.canGoForward()) 1f else 0.36f
        backButton.isEnabled = webView.canGoBack()
        forwardButton.isEnabled = webView.canGoForward()
    }

    private fun navigate(raw: String) {
        val url = normalizeInput(raw)
        if (url.isNotBlank()) webView.loadUrl(url)
    }

    private fun normalizeInput(raw: String): String {
        val text = raw.trim().take(MAX_URL_CHARS)
        if (text.isBlank()) return ""
        if (text.startsWith("javascript:", true) ||
            text.startsWith("data:", true) ||
            text.startsWith("file:", true) ||
            text.startsWith("content:", true) ||
            text.startsWith("intent:", true)
        ) return ""

        if (text.contains(' ') || (!text.contains('.') && !text.startsWith("http", true))) {
            val query = URLEncoder.encode(text, StandardCharsets.UTF_8.toString())
            return "https://www.google.com/search?q=$query"
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

    private fun isHttps(uri: Uri): Boolean =
        uri.scheme.equals("https", ignoreCase = true) && !uri.host.isNullOrBlank()

    private fun openSupportedExternalScheme(uri: Uri) {
        val allowed = when (uri.scheme?.lowercase(Locale.ROOT)) {
            "tel", "sms", "smsto", "mailto", "geo" -> true
            else -> false
        }
        if (!allowed) return
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: Exception) {
            // Optional external action has no installed handler.
        }
    }

    private fun browserButton(label: String, primary: Boolean = false) = Button(this).apply {
        text = label
        isAllCaps = false
        gravity = Gravity.CENTER
        setTextColor(Color.WHITE)
        typeface = Typeface.DEFAULT_BOLD
        textSize = 14f
        minWidth = 0
        minHeight = 0
        setPadding(0, 0, 0, 0)
        stateListAnimator = null
        background = if (primary) {
            roundedGradient(
                intArrayOf(Color.rgb(13, 103, 248), blueBright),
                dp(13).toFloat(),
                Color.rgb(88, 181, 255),
                dp(1)
            )
        } else {
            roundedGradient(
                intArrayOf(panel2, panel),
                dp(13).toFloat(),
                Color.rgb(35, 82, 127),
                dp(1)
            )
        }
        elevation = dp(if (primary) 5 else 2).toFloat()
    }

    private fun roundedGradient(colors: IntArray, radius: Float, strokeColor: Int, strokeWidth: Int): GradientDrawable =
        GradientDrawable(GradientDrawable.Orientation.TL_BR, colors).apply {
            cornerRadius = radius
            if (strokeWidth > 0 && strokeColor != Color.TRANSPARENT) setStroke(strokeWidth, strokeColor)
        }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (this::webView.isInitialized && webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
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
        private const val PREF_DESKTOP_MODE = "desktop_mode"
        private const val HOME_URL = "https://www.google.com/"
        private const val MAX_URL_CHARS = 2_000
        private const val DESKTOP_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 NexusNovaBrowser/2.0"
    }
}
