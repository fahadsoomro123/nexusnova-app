package com.nexusnova.app

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Xml
import androidx.webkit.JavaScriptReplyProxy
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.recaptcha.RecaptchaAppCheckProviderFactory
import org.json.JSONArray
import org.json.JSONObject
import org.xmlpull.v1.XmlPullParser
import java.io.ByteArrayOutputStream
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.Executors

/**
 * Native Firebase App Check owner for the Android WebView shell.
 *
 * The same origin-bound message channel also carries the News screen's fixed,
 * read-only live-feed request. Keeping that request native avoids Android WebView
 * fetch/JSONP failures while still restricting the bridge to the bundled app origin.
 */
object NexusNativeAppCheck {
    const val JS_BRIDGE_NAME = "NexusAppCheckAndroid"
    private const val ACTION_GET_TOKEN = "getAppCheckToken"
    private const val ACTION_FETCH_NEWS = "fetchNews"
    private const val RECAPTCHA_ANDROID_SITE_KEY = "6Lcso5UtAAAAAHqiBuZ7Y0OjwFEVlNfjjnWZXLvi"
    private const val MAX_REQUEST_ID_CHARS = 120
    private const val MAX_NEWS_QUERY_CHARS = 120
    private const val MAX_NEWS_RESPONSE_BYTES = 2 * 1024 * 1024
    private const val NEWS_CONNECT_TIMEOUT_MS = 10_000
    private const val NEWS_READ_TIMEOUT_MS = 15_000

    private val mainHandler = Handler(Looper.getMainLooper())
    private val newsExecutor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "NexusNovaNativeNews").apply { isDaemon = true }
    }

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
            ACTION_FETCH_NEWS -> handleNews(request, replyProxy)
        }
    }

    private fun handleAppCheckToken(request: JSONObject, replyProxy: JavaScriptReplyProxy) {
        val requestId = request.optString("requestId").trim()
        if (!validRequestId(requestId)) {
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
                replyJson(replyProxy, response)
            }
            .addOnFailureListener { error ->
                val message = error.message?.trim().takeUnless { it.isNullOrBlank() }
                    ?: "Native App Check verification failed"
                replyError(replyProxy, requestId, message)
            }
    }

    private fun handleNews(request: JSONObject, replyProxy: JavaScriptReplyProxy) {
        val requestId = request.optString("requestId").trim()
        if (!validRequestId(requestId)) {
            replyError(replyProxy, requestId, "Invalid News request id")
            return
        }
        val query = request.optString("query", "Pakistan").trim().ifBlank { "Pakistan" }
        if (query.length > MAX_NEWS_QUERY_CHARS) {
            replyError(replyProxy, requestId, "News query is too long")
            return
        }

        newsExecutor.execute {
            try {
                val articles = try {
                    fetchGoogleNews(query)
                } catch (_: Throwable) {
                    fetchGdeltNews(query)
                }
                if (articles.length() == 0) throw IllegalStateException("No current live headlines were returned")
                val response = JSONObject()
                    .put("requestId", requestId)
                    .put("ok", true)
                    .put("articles", articles)
                replyJson(replyProxy, response)
            } catch (error: Throwable) {
                val message = error.message?.trim().takeUnless { it.isNullOrBlank() }
                    ?: "Live news service is unavailable"
                replyError(replyProxy, requestId, message)
            }
        }
    }

    private fun fetchGoogleNews(query: String): JSONArray {
        val encoded = URLEncoder.encode(query, Charsets.UTF_8.name())
        val url = "https://news.google.com/rss/search?q=$encoded&hl=en-PK&gl=PK&ceid=PK:en"
        val connection = openNewsConnection(url, "application/rss+xml, application/xml, text/xml")
        try {
            val parser = Xml.newPullParser()
            parser.setInput(InputStreamReader(connection.inputStream, Charsets.UTF_8))
            val rows = JSONArray()
            var inItem = false
            var title = ""
            var link = ""
            var published = ""
            var source = ""
            var sourceHome = ""
            var event = parser.eventType

            while (event != XmlPullParser.END_DOCUMENT && rows.length() < 40) {
                if (event == XmlPullParser.START_TAG) {
                    when (parser.name) {
                        "item" -> {
                            inItem = true
                            title = ""
                            link = ""
                            published = ""
                            source = ""
                            sourceHome = ""
                        }
                        "title" -> if (inItem) title = parser.nextText().trim()
                        "link" -> if (inItem) link = parser.nextText().trim()
                        "pubDate" -> if (inItem) published = parser.nextText().trim()
                        "source" -> if (inItem) {
                            sourceHome = parser.getAttributeValue(null, "url")?.trim().orEmpty()
                            source = parser.nextText().trim()
                        }
                    }
                } else if (event == XmlPullParser.END_TAG && parser.name == "item" && inItem) {
                    inItem = false
                    if (title.isNotBlank() && isHttpUrl(link)) {
                        rows.put(
                            JSONObject()
                                .put("title", title.take(280))
                                .put("url", link)
                                .put("domain", source.ifBlank { hostOf(sourceHome).ifBlank { "Publisher" } })
                                .put("publisherUrl", sourceHome.takeIf(::isHttpUrl).orEmpty())
                                .put("seen", published)
                                .put("country", "")
                                .put("image", "")
                        )
                    }
                }
                event = parser.next()
            }
            return rows
        } finally {
            connection.disconnect()
        }
    }

    private fun fetchGdeltNews(query: String): JSONArray {
        val encoded = URLEncoder.encode(query, Charsets.UTF_8.name())
        val url = "https://api.gdeltproject.org/api/v2/doc/doc?query=$encoded&mode=ArtList&format=json&maxrecords=40&sort=DateDesc&timespan=48h"
        val connection = openNewsConnection(url, "application/json")
        try {
            val body = readLimited(connection, MAX_NEWS_RESPONSE_BYTES)
            val source = JSONObject(body).optJSONArray("articles") ?: JSONArray()
            val rows = JSONArray()
            for (i in 0 until source.length()) {
                val item = source.optJSONObject(i) ?: continue
                val title = item.optString("title").trim()
                val link = item.optString("url").trim()
                if (title.isBlank() || !isHttpUrl(link)) continue
                rows.put(
                    JSONObject()
                        .put("title", title.take(280))
                        .put("url", link)
                        .put("domain", item.optString("domain").trim().ifBlank { hostOf(link).ifBlank { "Publisher" } })
                        .put("publisherUrl", "")
                        .put("seen", item.optString("seendate", item.optString("date")).trim())
                        .put("country", item.optString("sourcecountry").trim())
                        .put("image", item.optString("socialimage", item.optString("image")).trim().takeIf(::isHttpUrl).orEmpty())
                )
                if (rows.length() >= 40) break
            }
            return rows
        } finally {
            connection.disconnect()
        }
    }

    private fun openNewsConnection(url: String, accept: String): HttpURLConnection {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = NEWS_CONNECT_TIMEOUT_MS
        connection.readTimeout = NEWS_READ_TIMEOUT_MS
        connection.instanceFollowRedirects = true
        connection.useCaches = false
        connection.setRequestProperty("Accept", accept)
        connection.setRequestProperty("Cache-Control", "no-cache")
        connection.setRequestProperty("User-Agent", "NexusNova-Android-News/1.0")
        connection.connect()
        if (connection.responseCode !in 200..299) {
            val code = connection.responseCode
            connection.disconnect()
            throw IllegalStateException("Live news HTTP $code")
        }
        return connection
    }

    private fun readLimited(connection: HttpURLConnection, maxBytes: Int): String {
        val output = ByteArrayOutputStream()
        connection.inputStream.use { input ->
            val buffer = ByteArray(16 * 1024)
            var total = 0
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                total += read
                if (total > maxBytes) throw IllegalStateException("Live news response is too large")
                output.write(buffer, 0, read)
            }
        }
        return output.toByteArray().toString(Charsets.UTF_8)
    }

    private fun validRequestId(value: String): Boolean =
        value.isNotBlank() && value.length <= MAX_REQUEST_ID_CHARS

    private fun isHttpUrl(value: String): Boolean = try {
        val url = URL(value)
        (url.protocol.equals("https", true) || url.protocol.equals("http", true)) && url.host.isNotBlank()
    } catch (_: Exception) {
        false
    }

    private fun hostOf(value: String): String = try {
        URL(value).host.removePrefix("www.")
    } catch (_: Exception) {
        ""
    }

    private fun replyJson(replyProxy: JavaScriptReplyProxy, response: JSONObject) {
        val send = { runCatching { replyProxy.postMessage(response.toString()) } }
        if (Looper.myLooper() == Looper.getMainLooper()) send() else mainHandler.post(send)
    }

    private fun replyError(replyProxy: JavaScriptReplyProxy, requestId: String, message: String) {
        val response = JSONObject()
            .put("requestId", requestId)
            .put("ok", false)
            .put("error", message.take(500))
        replyJson(replyProxy, response)
    }
}
