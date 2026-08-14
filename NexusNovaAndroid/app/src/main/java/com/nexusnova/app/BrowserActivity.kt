package com.nexusnova.app

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Gravity
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
import androidx.core.view.setPadding
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.Locale

class BrowserActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var addressBar: EditText
    private lateinit var progressBar: ProgressBar
    private lateinit var titleView: TextView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        title = "NexusNova Browser"

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(4, 12, 24))
        }

        val brandBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(12))
            setBackgroundColor(Color.rgb(8, 24, 43))
        }
        titleView = TextView(this).apply {
            text = "NexusNova Browser"
            setTextColor(Color.WHITE)
            textSize = 18f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        val secureBadge = TextView(this).apply {
            text = "  IN APP  "
            setTextColor(Color.rgb(134, 239, 172))
            textSize = 10f
            gravity = Gravity.CENTER
        }
        brandBar.addView(titleView, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        brandBar.addView(secureBadge, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        root.addView(brandBar)

        val addressRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(8))
        }
        addressBar = EditText(this).apply {
            hint = "Search or enter website"
            setSingleLine(true)
            setTextColor(Color.WHITE)
            setHintTextColor(Color.rgb(130, 148, 166))
            setBackgroundColor(Color.rgb(10, 28, 49))
            setPadding(dp(12))
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
        val goButton = browserButton("Go").apply {
            setOnClickListener { navigate(addressBar.text?.toString().orEmpty()) }
        }
        addressRow.addView(addressBar, LinearLayout.LayoutParams(0, dp(46), 1f).apply { marginEnd = dp(7) })
        addressRow.addView(goButton, LinearLayout.LayoutParams(dp(64), dp(46)))
        root.addView(addressRow)

        val navRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(dp(8), 0, dp(8), dp(8))
        }
        val back = browserButton("←").apply {
            contentDescription = "Back"
            setOnClickListener { if (webView.canGoBack()) webView.goBack() }
        }
        val forward = browserButton("→").apply {
            contentDescription = "Forward"
            setOnClickListener { if (webView.canGoForward()) webView.goForward() }
        }
        val reload = browserButton("↻").apply {
            contentDescription = "Reload"
            setOnClickListener { webView.reload() }
        }
        val home = browserButton("⌂").apply {
            contentDescription = "Home"
            setOnClickListener { webView.loadUrl(HOME_URL) }
        }
        listOf(back, forward, reload, home).forEach { button ->
            navRow.addView(button, LinearLayout.LayoutParams(0, dp(42), 1f).apply {
                marginStart = dp(3)
                marginEnd = dp(3)
            })
        }
        root.addView(navRow)

        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progress = 0
        }
        root.addView(progressBar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)))

        webView = WebView(this)
        root.addView(webView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)

        configureWebView()
        val requested = intent.getStringExtra(EXTRA_URL).orEmpty()
        webView.loadUrl(normalizeInput(requested).ifBlank { HOME_URL })
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
        settings.userAgentString = settings.userAgentString + " NexusNovaBrowser/1.0"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.safeBrowsingEnabled = true
        }

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
                progressBar.visibility = android.view.View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (!url.isNullOrBlank()) addressBar.setText(url)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                progressBar.visibility = if (newProgress >= 100) android.view.View.GONE else android.view.View.VISIBLE
            }

            override fun onReceivedTitle(view: WebView?, pageTitle: String?) {
                val clean = pageTitle?.trim().orEmpty().take(48)
                titleView.text = if (clean.isBlank()) "NexusNova Browser" else "NexusNova Browser • $clean"
            }
        }
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
            val scheme = uri.scheme?.lowercase(Locale.ROOT)
            when (scheme) {
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

    private fun browserButton(label: String) = Button(this).apply {
        text = label
        isAllCaps = false
        setTextColor(Color.WHITE)
        setBackgroundColor(Color.rgb(14, 44, 73))
        textSize = 14f
        setPadding(0)
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
        private const val HOME_URL = "https://www.google.com/"
        private const val MAX_URL_CHARS = 2_000
    }
}
