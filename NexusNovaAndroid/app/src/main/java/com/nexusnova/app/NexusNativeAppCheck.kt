package com.nexusnova.app

import android.content.Context
import androidx.webkit.JavaScriptReplyProxy
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.recaptcha.RecaptchaAppCheckProviderFactory
import org.json.JSONObject

/**
 * Native Firebase App Check owner for the Android WebView shell.
 *
 * Keep this startup/sign-in path deliberately lightweight. Live News work is
 * delegated to NexusNativeNews and is initialized only when the News screen is
 * actually opened.
 */
object NexusNativeAppCheck {
    const val JS_BRIDGE_NAME = "NexusAppCheckAndroid"
    private const val ACTION_GET_TOKEN = "getAppCheckToken"
    private const val RECAPTCHA_ANDROID_SITE_KEY = "6Lcso5UtAAAAAHqiBuZ7Y0OjwFEVlNfjjnWZXLvi"

    @Volatile
    private var initialized = false

    @Synchronized
    fun initialize(context: Context) {
        if (initialized) return
        val firebaseApp = FirebaseApp.initializeApp(context.applicationContext)
            ?: throw IllegalStateException("Firebase Android configuration is unavailable")
        FirebaseAppCheck.getInstance(firebaseApp).installAppCheckProviderFactory(
            RecaptchaAppCheckProviderFactory.getInstance(RECAPTCHA_ANDROID_SITE_KEY)
        )
        initialized = true
    }

    fun handleMessage(payload: String?, replyProxy: JavaScriptReplyProxy) {
        val request = try {
            JSONObject(payload.orEmpty())
        } catch (_: Exception) {
            replyError(replyProxy, "", "Invalid native request")
            return
        }

        when (request.optString("action")) {
            ACTION_GET_TOKEN -> handleAppCheckToken(request, replyProxy)
            NexusNativeNews.ACTION_FETCH_NEWS -> NexusNativeNews.handleRequest(request, replyProxy)
        }
    }

    private fun handleAppCheckToken(request: JSONObject, replyProxy: JavaScriptReplyProxy) {
        val requestId = request.optString("requestId").trim()
        if (requestId.isBlank() || requestId.length > 120) {
            replyError(replyProxy, requestId, "Invalid App Check request id")
            return
        }
        if (!initialized) {
            replyError(replyProxy, requestId, "Native App Check is not initialized")
            return
        }

        val forceRefresh = request.optBoolean("forceRefresh", true)
        FirebaseAppCheck.getInstance()
            .getAppCheckToken(forceRefresh)
            .addOnSuccessListener { result ->
                val token = result.token.trim()
                if (token.isBlank()) {
                    replyError(replyProxy, requestId, "Native App Check returned an empty token")
                    return@addOnSuccessListener
                }
                val response = JSONObject()
                    .put("requestId", requestId)
                    .put("ok", true)
                    .put("token", token)
                    .put("expireTimeMillis", result.expireTimeMillis)
                runCatching { replyProxy.postMessage(response.toString()) }
            }
            .addOnFailureListener { error ->
                val message = error.message?.trim().takeUnless { it.isNullOrBlank() }
                    ?: "Native App Check verification failed"
                replyError(replyProxy, requestId, message)
            }
    }

    private fun replyError(replyProxy: JavaScriptReplyProxy, requestId: String, message: String) {
        val response = JSONObject()
            .put("requestId", requestId)
            .put("ok", false)
            .put("error", message.take(500))
        runCatching { replyProxy.postMessage(response.toString()) }
    }
}
