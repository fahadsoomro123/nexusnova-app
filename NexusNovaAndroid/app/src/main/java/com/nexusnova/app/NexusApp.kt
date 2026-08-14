package com.nexusnova.app

import android.app.Activity
import android.app.Application
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.core.view.WindowCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.util.Collections
import java.util.WeakHashMap

class NexusApp : Application() {

    private val browserBridgeInstalled = Collections.newSetFromMap(WeakHashMap<WebView, Boolean>())

    override fun onCreate() {
        super.onCreate()
        PhonebookStore.init(this)
        registerActivityLifecycleCallbacks(object : ActivityLifecycleCallbacks {
            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
                if (activity is MainActivity) {
                    activity.window.decorView.post {
                        // MainActivity creates an edge-to-edge WebView. Restore normal
                        // system-window fitting after creation so NexusNova's fixed dock,
                        // login and splash stay clear of Android navigation buttons.
                        WindowCompat.setDecorFitsSystemWindows(activity.window, true)
                        installBrowserBridge(activity)
                    }
                }
            }

            override fun onActivityStarted(activity: Activity) = Unit
            override fun onActivityResumed(activity: Activity) = Unit
            override fun onActivityPaused(activity: Activity) = Unit
            override fun onActivityStopped(activity: Activity) = Unit
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
            override fun onActivityDestroyed(activity: Activity) = Unit
        })
    }

    private fun installBrowserBridge(activity: MainActivity) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        val root = activity.findViewById<View>(android.R.id.content) ?: return
        val webView = findWebView(root) ?: return
        if (!browserBridgeInstalled.add(webView)) return

        try {
            WebViewCompat.addWebMessageListener(
                webView,
                BROWSER_BRIDGE_NAME,
                setOf(PRODUCTION_ORIGIN, LOCAL_ORIGIN)
            ) { _, message, sourceOrigin, isMainFrame, _ ->
                if (!isMainFrame || !isTrustedOrigin(sourceOrigin)) return@addWebMessageListener
                val payload = message.data ?: return@addWebMessageListener
                if (payload.length > MAX_MESSAGE_CHARS) return@addWebMessageListener

                val json = try {
                    JSONObject(payload)
                } catch (_: Exception) {
                    return@addWebMessageListener
                }
                if (json.optString("action") != ACTION_OPEN) return@addWebMessageListener

                val rawUrl = json.optString("url").trim()
                if (rawUrl.length !in 1..MAX_URL_CHARS) return@addWebMessageListener
                val uri = try {
                    Uri.parse(rawUrl)
                } catch (_: Exception) {
                    return@addWebMessageListener
                }
                if (!isSafeHttps(uri)) return@addWebMessageListener

                activity.startActivity(
                    Intent(activity, BrowserActivity::class.java)
                        .putExtra(BrowserActivity.EXTRA_URL, uri.toString())
                )
            }
        } catch (_: IllegalArgumentException) {
            // Bridge name was already installed for this WebView.
        }
    }

    private fun findWebView(view: View): WebView? {
        if (view is WebView) return view
        if (view !is ViewGroup) return null
        for (index in 0 until view.childCount) {
            findWebView(view.getChildAt(index))?.let { return it }
        }
        return null
    }

    private fun isTrustedOrigin(uri: Uri): Boolean {
        if (!uri.scheme.equals("https", ignoreCase = true)) return false
        val defaultPort = uri.port == -1 || uri.port == 443
        if (!defaultPort) return false
        return uri.host.equals("fahadsoomro123.github.io", ignoreCase = true) ||
            uri.host.equals("appassets.androidplatform.net", ignoreCase = true)
    }

    private fun isSafeHttps(uri: Uri): Boolean =
        uri.scheme.equals("https", ignoreCase = true) &&
            !uri.host.isNullOrBlank() &&
            (uri.port == -1 || uri.port == 443)

    private companion object {
        const val BROWSER_BRIDGE_NAME = "NexusBrowserAndroid"
        const val ACTION_OPEN = "open"
        const val PRODUCTION_ORIGIN = "https://fahadsoomro123.github.io"
        const val LOCAL_ORIGIN = "https://appassets.androidplatform.net"
        const val MAX_MESSAGE_CHARS = 2_048
        const val MAX_URL_CHARS = 2_000
    }
}
