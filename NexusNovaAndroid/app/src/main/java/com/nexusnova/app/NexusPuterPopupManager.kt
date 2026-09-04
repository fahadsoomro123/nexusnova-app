package com.nexusnova.app

import android.annotation.SuppressLint
import android.content.res.ColorStateList
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Message
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
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

/**
 * Secure Puter authentication window styled as NexusNova's Nova Browser.
 *
 * This must remain the WebView supplied through WebViewTransport so Puter's
 * window.opener/sign-in promise keeps working. The auth WebView is isolated:
 * it never receives NexusNova native bridges, file access, content access, or
 * mixed-content permission. After Puter has established the session, HTTPS
 * identity-provider redirects stay inside this same in-app browser window.
 */
object NexusPuterPopupManager {

    @SuppressLint("SetJavaScriptEnabled")
    fun open(
        activity: AppCompatActivity,
        resultMsg: Message?,
        isUserGesture: Boolean
    ): Boolean {
        if (!isUserGesture || resultMsg == null || activity.isFinishing || activity.isDestroyed) {
            return false
        }
        val transport = resultMsg.obj as? WebView.WebViewTransport ?: return false

        val bg = Color.rgb(4, 8, 14)
        val bar = Color.rgb(10, 16, 26)
        val surface = Color.rgb(18, 29, 44)
        val line = Color.rgb(37, 58, 82)
        val cyan = Color.rgb(103, 205, 255)
        val primary = Color.rgb(241, 247, 255)
        val muted = Color.rgb(145, 162, 184)

        val popup = WebView(activity).apply {
            setBackgroundColor(Color.rgb(7, 11, 18))
            overScrollMode = View.OVER_SCROLL_NEVER
        }
        configureSecureSettings(popup)
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(popup, true)

        val dialog = android.app.Dialog(activity, android.R.style.Theme_DeviceDefault_NoActionBar)
        dialog.setCancelable(true)
        dialog.setCanceledOnTouchOutside(false)

        val root = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(bg)
        }

        val top = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(activity, 10), dp(activity, 8), dp(activity, 8), dp(activity, 8))
            setBackgroundColor(bar)
        }

        val logo = TextView(activity).apply {
            text = "N"
            gravity = Gravity.CENTER
            textSize = 15f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(31, 98, 220))
        }
        top.addView(logo, LinearLayout.LayoutParams(dp(activity, 34), dp(activity, 34)).apply {
            marginEnd = dp(activity, 9)
        })

        val titleWrap = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val title = TextView(activity).apply {
            text = "Nova Browser · Secure Login"
            setTextColor(primary)
            textSize = 12f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            maxLines = 1
        }
        val hostLabel = TextView(activity).apply {
            text = "Waiting for Puter…"
            setTextColor(muted)
            textSize = 9f
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
        }
        titleWrap.addView(title)
        titleWrap.addView(hostLabel)
        top.addView(titleWrap, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))

        val back = smallButton(activity, "‹", surface, line, primary).apply {
            textSize = 24f
            contentDescription = "Back"
        }
        val close = smallButton(activity, "×", surface, line, primary).apply {
            textSize = 20f
            contentDescription = "Close secure login"
        }
        top.addView(back, LinearLayout.LayoutParams(dp(activity, 38), dp(activity, 38)).apply {
            marginEnd = dp(activity, 5)
        })
        top.addView(close, LinearLayout.LayoutParams(dp(activity, 38), dp(activity, 38)))
        root.addView(top)

        val addressRow = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(activity, 10), dp(activity, 6), dp(activity, 10), dp(activity, 7))
            setBackgroundColor(bar)
        }
        val secure = TextView(activity).apply {
            text = "✓ HTTPS"
            setTextColor(cyan)
            textSize = 9f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER_VERTICAL
        }
        val address = TextView(activity).apply {
            text = "puter.com"
            setTextColor(primary)
            textSize = 10f
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.MIDDLE
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(activity, 8), 0, 0, 0)
        }
        addressRow.addView(secure, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(activity, 32)))
        addressRow.addView(address, LinearLayout.LayoutParams(0, dp(activity, 32), 1f))
        root.addView(addressRow)

        val progress = ProgressBar(activity, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progress = 0
            visibility = View.GONE
            progressTintList = ColorStateList.valueOf(cyan)
            progressBackgroundTintList = ColorStateList.valueOf(Color.rgb(7, 13, 22))
        }
        root.addView(progress, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(activity, 2)))

        val webContainer = FrameLayout(activity).apply { setBackgroundColor(bg) }
        webContainer.addView(
            popup,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
        root.addView(webContainer, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        dialog.setContentView(root)

        var puterEstablished = false

        fun updateChrome(url: String?) {
            val uri = url?.let { runCatching { Uri.parse(it) }.getOrNull() }
            val host = uri?.host?.takeIf { it.isNotBlank() }
            hostLabel.text = when {
                host == null -> "Secure Puter authentication"
                isPuterHost(uri) -> "Puter account authentication"
                puterEstablished -> "Secure sign-in · $host"
                else -> "Secure authentication"
            }
            address.text = host ?: "puter.com"
            secure.text = if (uri?.scheme.equals("https", true)) "✓ HTTPS" else "SECURE"
            secure.setTextColor(if (uri?.scheme.equals("https", true)) cyan else muted)
            back.isEnabled = popup.canGoBack()
            back.alpha = if (back.isEnabled) 1f else .45f
        }

        popup.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return true
                if (uri.scheme.equals("about", ignoreCase = true)) return false
                if (!uri.scheme.equals("https", ignoreCase = true) || uri.host.isNullOrBlank()) {
                    Toast.makeText(activity, "Secure login only supports HTTPS pages.", Toast.LENGTH_SHORT).show()
                    return true
                }

                if (!puterEstablished) {
                    if (!isPuterHost(uri)) {
                        Toast.makeText(activity, "Waiting for the secure Puter login page.", Toast.LENGTH_SHORT).show()
                        return true
                    }
                    puterEstablished = true
                }

                // Once Puter owns the popup, keep any HTTPS identity-provider
                // redirects inside this same isolated Nova Browser auth window.
                return false
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                progress.visibility = View.VISIBLE
                updateChrome(url)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                updateChrome(url)
            }
        }

        popup.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progress.progress = newProgress
                progress.visibility = if (newProgress >= 100) View.GONE else View.VISIBLE
            }

            override fun onReceivedTitle(view: WebView?, pageTitle: String?) {
                val clean = pageTitle?.trim().orEmpty().take(54)
                title.text = if (clean.isBlank()) "Nova Browser · Secure Login" else "Nova Browser · $clean"
            }

            override fun onCloseWindow(window: WebView?) {
                dialog.dismiss()
            }
        }

        back.setOnClickListener {
            if (popup.canGoBack()) popup.goBack()
        }
        close.setOnClickListener { dialog.dismiss() }

        dialog.setOnDismissListener {
            runCatching { popup.stopLoading() }
            runCatching { popup.removeAllViews() }
            runCatching { popup.destroy() }
        }

        transport.webView = popup
        return try {
            dialog.show()
            dialog.window?.apply {
                setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                statusBarColor = Color.rgb(3, 6, 11)
                navigationBarColor = Color.rgb(3, 6, 11)
            }
            resultMsg.sendToTarget()
            true
        } catch (_: Throwable) {
            runCatching { dialog.dismiss() }
            runCatching { popup.destroy() }
            false
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureSecureSettings(view: WebView) {
        val settings = view.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.allowFileAccessFromFileURLs = false
        settings.allowUniversalAccessFromFileURLs = false
        settings.mediaPlaybackRequiresUserGesture = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.setSupportMultipleWindows(false)
        settings.javaScriptCanOpenWindowsAutomatically = false
        settings.builtInZoomControls = true
        settings.displayZoomControls = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.safeBrowsingEnabled = true
        }
    }

    private fun smallButton(
        activity: AppCompatActivity,
        label: String,
        fill: Int,
        stroke: Int,
        text: Int
    ): Button = Button(activity).apply {
        this.text = label
        setTextColor(text)
        textSize = 14f
        minWidth = 0
        minimumWidth = 0
        minHeight = 0
        minimumHeight = 0
        setPadding(0, 0, 0, 0)
        background = android.graphics.drawable.GradientDrawable().apply {
            shape = android.graphics.drawable.GradientDrawable.RECTANGLE
            cornerRadius = dp(activity, 11).toFloat()
            setColor(fill)
            setStroke(dp(activity, 1), stroke)
        }
    }

    private fun dp(activity: AppCompatActivity, value: Int): Int =
        (value * activity.resources.displayMetrics.density).toInt()

    private fun isPuterHost(uri: Uri): Boolean {
        if (!uri.scheme.equals("https", ignoreCase = true) || (uri.port != -1 && uri.port != 443)) return false
        val host = uri.host?.lowercase() ?: return false
        return host == "puter.com" || host.endsWith(".puter.com")
    }
}
