package com.nexusnova.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.ContentResolver
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.OpenableColumns
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var adManager: NexusAdManager? = null

    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    private var pendingWebPermissionRequest: PermissionRequest? = null
    private var pendingGeolocation: PendingGeolocation? = null
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var fileChooserAcceptTypes: Set<String> = emptySet()
    private var usingOfflineFallback = false
    private var mainFrameWatchdogToken = 0
    private var finishedWatchdogToken = -1
    private var webRecoveryAttempts = 0
    private var rendererCrashRecoveries = 0

    private data class PendingGeolocation(
        val origin: String,
        val callback: GeolocationPermissions.Callback
    )

    private val webPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        val request = pendingWebPermissionRequest ?: return@registerForActivityResult
        pendingWebPermissionRequest = null
        grantApprovedWebResources(request)
    }

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        val pending = pendingGeolocation ?: return@registerForActivityResult
        pendingGeolocation = null
        pending.callback.invoke(pending.origin, hasLocationPermission(), false)
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = fileChooserCallback ?: return@registerForActivityResult
        val acceptedTypes = fileChooserAcceptTypes
        fileChooserCallback = null
        fileChooserAcceptTypes = emptySet()

        val selected = try {
            val acceptedUris = ArrayList<Uri>(MAX_PICKED_FILES)
            var totalBytes = 0L
            WebChromeClient.FileChooserParams
                .parseResult(result.resultCode, result.data)
                ?.forEach { uri ->
                    if (acceptedUris.size >= MAX_PICKED_FILES) return@forEach
                    val size = validatePickedUri(uri, acceptedTypes) ?: return@forEach
                    if (size > MAX_PICKED_TOTAL_BYTES - totalBytes) return@forEach
                    totalBytes += size
                    acceptedUris.add(uri)
                }
            acceptedUris.toTypedArray().takeIf { it.isNotEmpty() }
        } catch (_: Exception) {
            null
        }

        callback.onReceiveValue(selected)
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)

        try {
            NexusNativeAppCheck.initialize(this)
        } catch (error: Throwable) {
            android.util.Log.e("NexusNovaAppCheck", "Native App Check initialization failed", error)
        }

        webView = WebView(this)
        setContentView(webView)

        configureWebView()
        try {
            installNativeMessageListener()
        } catch (error: Throwable) {
            android.util.Log.e("NexusNovaStartup", "Native bridge setup failed", error)
        }

        // Keep the launcher path equivalent to the known-working Golden build:
        // render NexusNova first, then initialize optional native monetization.
        loadProductionApp()
    }

    private fun initializeAdsSafely() {
        if (isFinishing || isDestroyed || adManager != null) return

        val manager = try {
            NexusAdManager(this, webView) { view -> isTrustedAppPage(view) }
        } catch (error: Throwable) {
            android.util.Log.e("NexusNovaStartup", "Ad manager creation failed", error)
            return
        }
        adManager = manager

        try {
            if (BuildConfig.NEXUS_ADS_TEST_MODE) {
                // Debug/development APKs always use Google's test inventory.
                manager.initialize()
            } else {
                // Release APKs cannot initialize/request production ads until UMP
                // has refreshed consent state and says ad requests are allowed.
                NexusAdConsentManager(this).gather { canRequestAds ->
                    if (canRequestAds && !isFinishing && !isDestroyed) {
                        runCatching { manager.initialize() }
                    }
                }
            }
        } catch (error: Throwable) {
            android.util.Log.e("NexusNovaStartup", "Optional ad initialization failed", error)
        }
    }

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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.safeBrowsingEnabled = true
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val uri = request?.url ?: return super.shouldInterceptRequest(view, request)
                return assetLoader.shouldInterceptRequest(uri)
                    ?: super.shouldInterceptRequest(view, request)
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                val uri = url?.let { runCatching { Uri.parse(it) }.getOrNull() } ?: return
                if (!isProductionOrigin(uri) || usingOfflineFallback) return
                armMainFrameWatchdog(view ?: return)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                val target = view ?: return
                val uri = url?.let { runCatching { Uri.parse(it) }.getOrNull() } ?: return
                if (!isProductionOrigin(uri) || usingOfflineFallback) return
                finishedWatchdogToken = mainFrameWatchdogToken
                scheduleBlankScreenCheck(target, mainFrameWatchdogToken)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val requestToHandle = request ?: return true
                val uri = requestToHandle.url
                if (isTrustedAppPage(uri)) return false

                // Remote frames never receive the origin-bound native bridge. Permit
                // normal http(s) content in the in-app browser iframe, but block
                // custom-scheme frame navigations rather than exposing another app.
                if (!requestToHandle.isForMainFrame) return !isHttpUri(uri)

                openExternalUri(uri)
                return true
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                val failed = request ?: return
                if (!failed.isForMainFrame || usingOfflineFallback) return
                if (!isProductionOrigin(failed.url)) return

                recoverProductionWebView(view, "main-frame network error")
            }

            override fun onReceivedHttpError(
                view: WebView?,
                request: WebResourceRequest?,
                errorResponse: WebResourceResponse?
            ) {
                super.onReceivedHttpError(view, request, errorResponse)
                val failed = request ?: return
                val status = errorResponse?.statusCode ?: return
                if (!failed.isForMainFrame || status < 400 || usingOfflineFallback) return
                if (!isProductionOrigin(failed.url)) return
                recoverProductionWebView(view, "HTTP $status")
            }

            override fun onRenderProcessGone(
                view: WebView?,
                detail: RenderProcessGoneDetail?
            ): Boolean {
                val didCrash = detail?.didCrash() == true
                android.util.Log.e(
                    "NexusNovaWeb",
                    "WebView renderer gone; didCrash=$didCrash"
                )
                val target = view ?: return true
                adManager = null
                clearPendingWebCallbacks()
                runCatching { target.stopLoading() }
                runCatching { (target.parent as? android.view.ViewGroup)?.removeView(target) }
                runCatching { target.removeAllViews() }
                runCatching { target.destroy() }

                if (isFinishing || isDestroyed) return true

                if (didCrash && rendererCrashRecoveries >= MAX_RENDERER_CRASH_RECOVERIES) {
                    window.decorView.post {
                        if (!isFinishing && !isDestroyed) showRendererRecoveryFailure()
                    }
                    return true
                }

                if (didCrash) rendererCrashRecoveries += 1
                val delayMs = if (didCrash) RENDERER_CRASH_RECOVERY_DELAY_MS else 0L
                window.decorView.postDelayed({
                    if (!isFinishing && !isDestroyed) rebuildWebViewAfterRendererExit()
                }, delayMs)
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                val permissionRequest = request ?: return
                if (!isTrustedOrigin(permissionRequest.origin)) {
                    permissionRequest.deny()
                    return
                }

                val requiredPermissions = permissionsFor(permissionRequest.resources)
                if (requiredPermissions.isEmpty()) {
                    permissionRequest.deny()
                    return
                }

                pendingWebPermissionRequest?.deny()
                pendingWebPermissionRequest = permissionRequest
                val missingPermissions = requiredPermissions.filterNot(::hasPermission)
                if (missingPermissions.isEmpty()) {
                    pendingWebPermissionRequest = null
                    grantApprovedWebResources(permissionRequest)
                } else {
                    webPermissionLauncher.launch(missingPermissions.toTypedArray())
                }
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest?) {
                if (pendingWebPermissionRequest === request) {
                    pendingWebPermissionRequest = null
                }
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                if (origin == null || callback == null || !isTrustedOrigin(Uri.parse(origin))) {
                    callback?.invoke(origin, false, false)
                    return
                }

                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false)
                    return
                }

                pendingGeolocation?.callback?.invoke(pendingGeolocation?.origin, false, false)
                pendingGeolocation = PendingGeolocation(origin, callback)
                locationPermissionLauncher.launch(LOCATION_PERMISSIONS)
            }

            override fun onGeolocationPermissionsHidePrompt() {
                pendingGeolocation?.let { pending ->
                    pending.callback.invoke(pending.origin, false, false)
                }
                pendingGeolocation = null
            }

            override fun onShowFileChooser(
                view: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: WebChromeClient.FileChooserParams?
            ): Boolean {
                val callback = filePathCallback ?: return false
                // Android does not expose the requesting frame's origin here. It can
                // at least prove the top-level document remains one of our two exact
                // trusted app locations before opening the picker.
                if (!isTrustedAppPage(view)) {
                    callback.onReceiveValue(null)
                    return true
                }
                val params = fileChooserParams ?: run {
                    callback.onReceiveValue(null)
                    return true
                }

                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = callback
                fileChooserAcceptTypes = params.acceptTypes
                    .map { it.trim() }
                    .filter { it.isNotEmpty() }
                    .toSet()

                return try {
                    fileChooserLauncher.launch(params.createIntent())
                    true
                } catch (_: Exception) {
                    fileChooserCallback = null
                    fileChooserAcceptTypes = emptySet()
                    callback.onReceiveValue(null)
                    true
                }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun rebuildWebViewAfterRendererExit() {
        if (isFinishing || isDestroyed) return
        webView = WebView(this)
        setContentView(webView)
        configureWebView()
        try {
            installNativeMessageListener()
        } catch (error: Throwable) {
            android.util.Log.e("NexusNovaStartup", "Native bridge recovery setup failed", error)
        }
        loadProductionApp()
    }

    private fun showRendererRecoveryFailure() {
        if (isFinishing || isDestroyed) return
        setContentView(android.widget.FrameLayout(this))
        android.app.AlertDialog.Builder(this)
            .setTitle("NexusNova needs restart")
            .setMessage("The Android WebView renderer stopped repeatedly. Restart NexusNova to continue.")
            .setNegativeButton("CLOSE") { dialog, _ ->
                dialog.dismiss()
                finishAndRemoveTask()
            }
            .setPositiveButton("RESTART") { dialog, _ ->
                dialog.dismiss()
                recreate()
            }
            .setCancelable(false)
            .show()
    }

    private fun clearPendingWebCallbacks() {
        fileChooserCallback?.onReceiveValue(null)
        fileChooserCallback = null
        fileChooserAcceptTypes = emptySet()
        pendingWebPermissionRequest?.deny()
        pendingWebPermissionRequest = null
        pendingGeolocation?.let { pending ->
            pending.callback.invoke(pending.origin, false, false)
        }
        pendingGeolocation = null
    }

    private fun loadProductionApp(forceFresh: Boolean = false) {
        usingOfflineFallback = false
        if (forceFresh) webView.clearCache(true)
        val suffix = if (forceFresh) "?androidRecovery=${System.currentTimeMillis()}" else ""
        webView.loadUrl(LOCAL_APP_URL)
    }

    private fun armMainFrameWatchdog(view: WebView) {
        val token = ++mainFrameWatchdogToken
        finishedWatchdogToken = -1
        view.postDelayed({
            if (isFinishing || isDestroyed || usingOfflineFallback) return@postDelayed
            if (token != mainFrameWatchdogToken || finishedWatchdogToken == token) return@postDelayed
            recoverProductionWebView(view, "main-frame load timeout")
        }, MAIN_FRAME_LOAD_TIMEOUT_MS)
    }

    private fun scheduleBlankScreenCheck(view: WebView, token: Int) {
        view.postDelayed({
            if (isFinishing || isDestroyed || usingOfflineFallback) return@postDelayed
            if (token != mainFrameWatchdogToken || finishedWatchdogToken != token) return@postDelayed
            view.evaluateJavascript(BLANK_SCREEN_PROBE) { result ->
                if (token != mainFrameWatchdogToken || usingOfflineFallback) return@evaluateJavascript
                if (result == "true") {
                    webRecoveryAttempts = 0
                    return@evaluateJavascript
                }
                recoverProductionWebView(view, "blank rendered page")
            }
        }, BLANK_SCREEN_GRACE_MS)
    }

    private fun recoverProductionWebView(view: WebView?, reason: String) {
        if (usingOfflineFallback || isFinishing || isDestroyed) return
        val target = view ?: webView
        if (webRecoveryAttempts < MAX_WEB_RECOVERY_ATTEMPTS) {
            webRecoveryAttempts += 1
            target.stopLoading()
            target.clearCache(true)
            target.postDelayed({
                if (!isFinishing && !isDestroyed && !usingOfflineFallback) {
                    loadProductionApp(forceFresh = true)
                }
            }, WEB_RECOVERY_RELOAD_DELAY_MS)
            return
        }

        // A technically successful but visually blank remote page is just as unusable
        // as a network failure. Fall back to the bundled shell instead of leaving the
        // user on an empty WebView. Value-bearing mining remains disabled offline.
        usingOfflineFallback = true
        mainFrameWatchdogToken += 1
        target.stopLoading()
        target.loadUrl(LOCAL_APP_URL)
        android.util.Log.w("NexusNovaWeb", "Using local fallback after $reason")
    }

    private fun installNativeMessageListener() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return

        val trustedOrigins = setOf(LOCAL_APP_ORIGIN, PRODUCTION_APP_ORIGIN)
        val listener = WebViewCompat.WebMessageListener { _, message, sourceOrigin, isMainFrame, _ ->
            if (isMainFrame && isTrustedOrigin(sourceOrigin)) {
                handleNativeMessage(message.data)
            }
        }
        WebViewCompat.addWebMessageListener(
            webView,
            NATIVE_BRIDGE_NAME,
            trustedOrigins,
            listener
        )

        // Dedicated, origin-bound bridge for the NexusNova Browser shell.
        // It is intentionally separate from the general native action bridge so
        // remote iframes can never launch privileged NexusNova activities.
        val browserListener = WebViewCompat.WebMessageListener { _, message, sourceOrigin, isMainFrame, _ ->
            if (isMainFrame && isTrustedOrigin(sourceOrigin)) {
                handleBrowserMessage(message.data)
            }
        }
        WebViewCompat.addWebMessageListener(
            webView,
            BROWSER_BRIDGE_NAME,
            trustedOrigins,
            browserListener
        )

        // App Check tokens are exposed only to the bundled/local NexusNova origin.
        // Remote pages and browser iframes cannot access this bridge.
        val appCheckListener = WebViewCompat.WebMessageListener { _, message, sourceOrigin, isMainFrame, replyProxy ->
            if (isMainFrame && isLocalOrigin(sourceOrigin)) {
                NexusNativeAppCheck.handleMessage(message.data, replyProxy)
            }
        }
        WebViewCompat.addWebMessageListener(
            webView,
            NexusNativeAppCheck.JS_BRIDGE_NAME,
            setOf(LOCAL_APP_ORIGIN),
            appCheckListener
        )
    }

    private fun handleBrowserMessage(payload: String?) {
        if (payload.isNullOrBlank() || payload.length > MAX_BRIDGE_MESSAGE_CHARS) return
        val message = try {
            JSONObject(payload)
        } catch (_: Exception) {
            return
        }
        if (message.optString("action") != BROWSER_ACTION_OPEN) return

        val url = message.optString("url").trim()
        if (url.isBlank() || url.length > MAX_EXTERNAL_URL_CHARS) return
        val uri = try {
            Uri.parse(url)
        } catch (_: Exception) {
            return
        }
        if (!uri.scheme.equals("https", ignoreCase = true) || uri.host.isNullOrBlank()) return

        try {
            startActivity(
                Intent(this, BrowserActivity::class.java)
                    .putExtra(BrowserActivity.EXTRA_URL, uri.toString())
            )
        } catch (_: Exception) {
            // If the dedicated browser activity cannot launch, keep the main app alive.
        }
    }

    private fun handleNativeMessage(payload: String?) {
        if (payload.isNullOrBlank() || payload.length > MAX_BRIDGE_MESSAGE_CHARS) return

        val message = try {
            JSONObject(payload)
        } catch (_: Exception) {
            return
        }

        when (message.optString("action")) {
            ACTION_OPEN_NOVA_VPN -> {
                val authToken = message.optString("authToken").trim()
                if (authToken.isBlank() || authToken.length > MAX_VPN_AUTH_TOKEN_CHARS) return
                try {
                    startActivity(
                        Intent(this, NovaVpnActivity::class.java)
                            .putExtra(NovaVpnActivity.EXTRA_AUTH_TOKEN, authToken)
                    )
                } catch (_: Throwable) {
                    // Keep the main app alive if the optional VPN control cannot launch.
                }
            }

            ACTION_SHOW_REWARDED_AD -> {
                initializeAdsSafely()
                adManager?.showRewarded(
                    rewardPurpose = message.optString("rewardPurpose").trim(),
                    testOnly = message.optBoolean("testOnly", false),
                    userId = message.optString("userId").trim()
                )
            }
            ACTION_SHOW_INTERSTITIAL_AD -> {
                initializeAdsSafely()
                adManager?.showInterstitial(
                    placement = message.optString("placement", message.optString("reason")).trim(),
                    feature = message.optString("feature").trim(),
                    testOnly = message.optBoolean("testOnly", false)
                )
            }
            ACTION_AD_STATUS -> {
                initializeAdsSafely()
                adManager?.publishStatus()
            }

            ACTION_OPEN_EXTERNAL -> {
                val url = message.optString("url").trim()
                if (url.length > MAX_EXTERNAL_URL_CHARS) return
                val uri = try {
                    Uri.parse(url)
                } catch (_: Exception) {
                    return
                }
                if (isHttpUri(uri)) openExternalUri(uri)
            }
        }
    }

    private fun permissionsFor(resources: Array<String>): List<String> = buildList {
        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE in resources) {
            add(Manifest.permission.CAMERA)
        }
        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE in resources) {
            add(Manifest.permission.RECORD_AUDIO)
        }
    }.distinct()

    private fun grantApprovedWebResources(request: PermissionRequest) {
        if (!isTrustedOrigin(request.origin)) {
            request.deny()
            return
        }

        val approvedResources = request.resources.filter { resource ->
            when (resource) {
                PermissionRequest.RESOURCE_VIDEO_CAPTURE -> hasPermission(Manifest.permission.CAMERA)
                PermissionRequest.RESOURCE_AUDIO_CAPTURE -> hasPermission(Manifest.permission.RECORD_AUDIO)
                else -> false
            }
        }.toTypedArray()

        if (approvedResources.isEmpty()) request.deny()
        else request.grant(approvedResources)
    }

    private fun validatePickedUri(uri: Uri, acceptedTypes: Set<String>): Long? {
        if (uri.scheme != ContentResolver.SCHEME_CONTENT) return null
        val size = pickedUriSize(uri) ?: return null
        if (size > MAX_PICKED_FILE_BYTES) return null
        if (acceptedTypes.isEmpty()) return size

        val mimeType = try {
            contentResolver.getType(uri)?.lowercase(Locale.ROOT)
        } catch (_: Exception) {
            null
        } ?: return null
        val accepted = acceptedTypes
            .asSequence()
            .flatMap { value -> value.split(',').asSequence() }
            .map { value -> value.substringBefore(';').trim().lowercase(Locale.ROOT) }
            .any { acceptedType ->
                acceptedType == "*/*" ||
                    acceptedType == mimeType ||
                    (acceptedType.endsWith("/*") &&
                        mimeType.startsWith(acceptedType.removeSuffix("*"))) ||
                    (acceptedType == ".pdf" && mimeType == "application/pdf")
            }
        return size.takeIf { accepted }
    }

    private fun pickedUriSize(uri: Uri): Long? {
        val columnSize = try {
            contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
                val index = cursor.getColumnIndex(OpenableColumns.SIZE)
                if (index >= 0 && cursor.moveToFirst() && !cursor.isNull(index)) {
                    cursor.getLong(index).takeIf { it >= 0L }
                } else {
                    null
                }
            }
        } catch (_: Exception) {
            null
        }
        if (columnSize != null) return columnSize

        return try {
            contentResolver.openAssetFileDescriptor(uri, "r")?.use { descriptor ->
                descriptor.length.takeIf { it >= 0L }
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun isTrustedAppPage(view: WebView?): Boolean {
        val url = view?.url ?: return false
        return try {
            isTrustedAppPage(Uri.parse(url))
        } catch (_: Exception) {
            false
        }
    }

    private fun hasPermission(permission: String): Boolean =
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

    private fun hasLocationPermission(): Boolean =
        hasPermission(Manifest.permission.ACCESS_FINE_LOCATION) ||
            hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION)

    private fun isHttpsDefaultPort(uri: Uri): Boolean =
        uri.scheme.equals("https", ignoreCase = true) && (uri.port == -1 || uri.port == 443)

    private fun isLocalOrigin(uri: Uri): Boolean =
        isHttpsDefaultPort(uri) && uri.host.equals(ASSET_HOST, ignoreCase = true)

    private fun isProductionOrigin(uri: Uri): Boolean =
        isHttpsDefaultPort(uri) && uri.host.equals(PRODUCTION_HOST, ignoreCase = true)

    private fun isTrustedOrigin(uri: Uri): Boolean =
        isLocalOrigin(uri) || isProductionOrigin(uri)

    private fun isTrustedAppPage(uri: Uri): Boolean = when {
        isLocalOrigin(uri) -> uri.path?.startsWith(ASSET_PATH) == true
        isProductionOrigin(uri) -> uri.path?.startsWith(PRODUCTION_PATH) == true
        else -> false
    }

    private fun isHttpUri(uri: Uri): Boolean =
        (uri.scheme.equals("https", ignoreCase = true) ||
            uri.scheme.equals("http", ignoreCase = true)) &&
            !uri.host.isNullOrBlank()

    private fun openExternalUri(uri: Uri) {
        if (!isAllowedExternalUri(uri)) return
        try {
            startActivity(
                Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)
            )
        } catch (_: Exception) {
            // There may be no application capable of handling an optional URL.
        }
    }

    private fun isAllowedExternalUri(uri: Uri): Boolean = when {
        isHttpUri(uri) -> true
        uri.scheme.equals("tel", ignoreCase = true) -> !uri.schemeSpecificPart.isNullOrBlank()
        uri.scheme.equals("sms", ignoreCase = true) -> !uri.schemeSpecificPart.isNullOrBlank()
        uri.scheme.equals("smsto", ignoreCase = true) -> !uri.schemeSpecificPart.isNullOrBlank()
        uri.scheme.equals("mailto", ignoreCase = true) -> !uri.schemeSpecificPart.isNullOrBlank()
        uri.scheme.equals("geo", ignoreCase = true) -> !uri.schemeSpecificPart.isNullOrBlank()
        else -> false
    }

    override fun onDestroy() {
        clearPendingWebCallbacks()
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (!this::webView.isInitialized) {
            showExitConfirmation()
            return
        }

        webView.evaluateJavascript(SYSTEM_BACK_SCRIPT) { raw ->
            if (isFinishing || isDestroyed) return@evaluateJavascript
            val result = raw?.trim()?.trim('"')
            if (result != "handled") showExitConfirmation()
        }
    }

    private fun showExitConfirmation() {
        if (isFinishing || isDestroyed) return
        android.app.AlertDialog.Builder(this)
            .setTitle("Exit NexusNova?")
            .setMessage("Do you want to exit NexusNova?")
            .setNegativeButton("NO") { dialog, _ -> dialog.dismiss() }
            .setPositiveButton("YES") { dialog, _ ->
                dialog.dismiss()
                finishAndRemoveTask()
            }
            .setCancelable(true)
            .show()
    }

    private companion object {
        const val ASSET_HOST = "appassets.androidplatform.net"
        const val LOCAL_APP_ORIGIN = "https://appassets.androidplatform.net"
        const val ASSET_PATH = "/assets/www/"
        const val LOCAL_APP_URL = "https://appassets.androidplatform.net/assets/www/index.html"

        const val PRODUCTION_HOST = "fahadsoomro123.github.io"
        const val PRODUCTION_APP_ORIGIN = "https://fahadsoomro123.github.io"
        const val PRODUCTION_PATH = "/nexusnova-app/"
        const val PRODUCTION_APP_URL = "https://fahadsoomro123.github.io/nexusnova-app/"

        const val NATIVE_BRIDGE_NAME = "NexusAndroid"
        const val BROWSER_BRIDGE_NAME = "NexusBrowserAndroid"
        const val BROWSER_ACTION_OPEN = "open"

        const val ACTION_OPEN_NOVA_VPN = "openNovaVpn"
        const val ACTION_OPEN_EXTERNAL = "openExternal"
        const val ACTION_SHOW_REWARDED_AD = "showRewardedAd"
        const val ACTION_SHOW_INTERSTITIAL_AD = "showInterstitialAd"
        const val ACTION_AD_STATUS = "adStatus"

        const val MAX_BRIDGE_MESSAGE_CHARS = 8_192
        const val MAX_VPN_AUTH_TOKEN_CHARS = 7_000
        const val MAX_EXTERNAL_URL_CHARS = 2_000
        const val MAX_PICKED_FILES = 5
        const val MAX_PICKED_FILE_BYTES = 20L * 1024L * 1024L
        const val MAX_PICKED_TOTAL_BYTES = 20L * 1024L * 1024L

        const val MAIN_FRAME_LOAD_TIMEOUT_MS = 12_000L
        const val BLANK_SCREEN_GRACE_MS = 3_500L
        const val WEB_RECOVERY_RELOAD_DELAY_MS = 350L
        const val MAX_WEB_RECOVERY_ATTEMPTS = 1
        const val RENDERER_CRASH_RECOVERY_DELAY_MS = 1_500L
        const val MAX_RENDERER_CRASH_RECOVERIES = 1
        const val SYSTEM_BACK_SCRIPT = """
            (function(){
              try {
                var ux = window.NexusNovaUxSimplify;
                if (ux && typeof ux.systemBack === 'function') {
                  return ux.systemBack() ? 'handled' : 'root';
                }
              } catch (_) {}
              return 'root';
            })();
        """
        const val BLANK_SCREEN_PROBE = """
            (function(){
              try {
                var b = document.body;
                if (!b) return false;
                var bs = getComputedStyle(b);
                if (bs.display === 'none' || bs.visibility === 'hidden' || Number(bs.opacity) === 0) return false;
                var selectors = ['#nxSplash','.auth-shell','#mineBtn','.bottom-nav','.bottom-dock','main','.app-container'];
                for (var i = 0; i < selectors.length; i++) {
                  var e = document.querySelector(selectors[i]);
                  if (!e) continue;
                  var r = e.getBoundingClientRect();
                  var es = getComputedStyle(e);
                  if (r.width > 20 && r.height > 20 && es.display !== 'none' && es.visibility !== 'hidden' && Number(es.opacity) > 0) return true;
                }
                var text = (b.innerText || '').replace(/\s+/g, ' ').trim();
                return text.length > 80 && document.documentElement.scrollHeight > 150;
              } catch (_) {
                return true;
              }
            })();
        """

        val LOCATION_PERMISSIONS = arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
    }
}
