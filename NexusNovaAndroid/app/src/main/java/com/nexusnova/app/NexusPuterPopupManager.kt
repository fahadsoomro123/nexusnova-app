package com.nexusnova.app

import android.app.Dialog
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Message
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

/**
 * Isolated child WebView used only for a user-initiated Puter authentication popup.
 * The child never receives NexusNova's native WebMessage bridges. Its first real
 * HTTPS navigation must be Puter-owned; later HTTPS redirects are allowed so the
 * Puter page can use an external identity provider when the user chooses one.
 */
object NexusPuterPopupManager {
    fun open(
        activity: AppCompatActivity,
        resultMsg: Message?,
        isUserGesture: Boolean
    ): Boolean {
        if (!isUserGesture || resultMsg == null || activity.isFinishing || activity.isDestroyed) {
            return false
        }
        val transport = resultMsg.obj as? WebView.WebViewTransport ?: return false
        val popup = WebView(activity)
        val settings = popup.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.allowFileAccessFromFileURLs = false
        settings.allowUniversalAccessFromFileURLs = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.setSupportMultipleWindows(false)
        settings.javaScriptCanOpenWindowsAutomatically = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.safeBrowsingEnabled = true
        }

        val dialog = Dialog(activity, android.R.style.Theme_DeviceDefault_Light_NoActionBar)
        val container = android.widget.FrameLayout(activity)
        container.addView(
            popup,
            android.widget.FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
        dialog.setContentView(container)
        dialog.window?.setLayout(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )

        var puterEstablished = false
        popup.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return true
                if (uri.scheme.equals("about", ignoreCase = true)) return false
                if (!uri.scheme.equals("https", ignoreCase = true) || uri.host.isNullOrBlank()) return true

                if (!puterEstablished) {
                    if (!isPuterHost(uri)) {
                        runCatching {
                            activity.startActivity(
                                Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)
                            )
                        }
                        dialog.dismiss()
                        return true
                    }
                    puterEstablished = true
                }
                return false
            }
        }
        popup.webChromeClient = object : WebChromeClient() {
            override fun onCloseWindow(window: WebView?) {
                dialog.dismiss()
            }
        }

        dialog.setOnDismissListener {
            runCatching { popup.stopLoading() }
            runCatching { popup.removeAllViews() }
            runCatching { popup.destroy() }
        }
        transport.webView = popup
        return try {
            resultMsg.sendToTarget()
            dialog.show()
            true
        } catch (_: Throwable) {
            runCatching { popup.destroy() }
            false
        }
    }

    private fun isPuterHost(uri: Uri): Boolean {
        if (!uri.scheme.equals("https", ignoreCase = true) || (uri.port != -1 && uri.port != 443)) return false
        val host = uri.host?.lowercase() ?: return false
        return host == "puter.com" || host.endsWith(".puter.com")
    }
}
