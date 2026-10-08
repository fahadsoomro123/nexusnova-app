package com.nexusnova.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageInstaller
import android.app.PendingIntent
import android.content.ContentResolver
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.PackageInfo
import android.content.pm.Signature
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
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.WindowCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.Future

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var adManager: NexusAdManager? = null
    private val otaWebManager by lazy { NexusOtaWebManager(this) }
    private val otaInstallExecutor by lazy {
        Executors.newSingleThreadExecutor { runnable ->
            Thread(runnable, "NexusNovaOtaInstall").apply { isDaemon = true }
        }
    }
    @Volatile private var otaDownloadConnection: HttpURLConnection? = null
    @Volatile private var otaInstallFuture: Future<*>? = null
    @Volatile private var otaInstallSessionId: Int = -1
    @Volatile private var otaInstallCommitted = false
    private var nativeOtaUpdateDialog: androidx.appcompat.app.AlertDialog? = null
    private var nativeOtaPromptMessage: JSONObject? = null
    private var nativeOtaProgressText: android.widget.TextView? = null
    private var nativeOtaProgressBar: android.widget.ProgressBar? = null
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
        // Render the signed baseline while the native startup OTA check runs independently.
        loadProductionApp()
        startWebOtaCheck()
    }

    private fun startWebOtaCheck() {
        if (isFinishing || isDestroyed) return

        otaWebManager.peekForUpdate { update ->
            if (update == null) return@peekForUpdate
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                showNativeWebOtaUpdatePrompt(update)
            }
        }
    }

    private fun showNativeWebOtaUpdatePrompt(update: NexusOtaWebManager.PendingUpdate): Boolean {
        if (isFinishing || isDestroyed) return false
        if (otaInstallFuture?.isDone == false) return true
        if (nativeOtaUpdateDialog?.isShowing == true) return true

        val density = resources.displayMetrics.density
        val content = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding((24 * density).toInt(), 0, (24 * density).toInt(), 0)
        }
        val progressText = android.widget.TextView(this).apply {
            text = "Version ${update.version.take(7)} is ready. Download 0%"
            setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 17f)
        }
        val progressBar = android.widget.ProgressBar(
            this,
            null,
            android.R.attr.progressBarStyleHorizontal
        ).apply {
            max = 100
            progress = 0
            isIndeterminate = false
        }
        content.addView(
            progressText,
            android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )
        content.addView(
            progressBar,
            android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                (6 * density).toInt()
            ).apply { topMargin = (14 * density).toInt() }
        )

        val dialog = MaterialAlertDialogBuilder(this)
            .setIcon(R.drawable.ic_launcher)
            .setTitle("Web update available")
            .setView(content)
            .setNegativeButton("Not now", null)
            .setPositiveButton("Update", null)
            .create()

        nativeOtaPromptMessage = JSONObject()
            .put("kind", "web")
            .put("webVersion", update.version)
        nativeOtaUpdateDialog = dialog
        nativeOtaProgressText = progressText
        nativeOtaProgressBar = progressBar
        dialog.setOnDismissListener {
            if (nativeOtaUpdateDialog === dialog) nativeOtaUpdateDialog = null
            if (nativeOtaProgressText === progressText) nativeOtaProgressText = null
            if (nativeOtaProgressBar === progressBar) nativeOtaProgressBar = null
            nativeOtaPromptMessage = null
        }
        dialog.show()

        dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_POSITIVE).setOnClickListener {
            val version = nativeOtaPromptMessage?.optString("webVersion").orEmpty()
            if (version.isBlank()) return@setOnClickListener
            val started = startNativeWebOtaInstall(version)
            if (started) {
                dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_POSITIVE)?.isEnabled = false
                dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_NEGATIVE)?.isEnabled = false
            }
        }
        return true
    }

    private fun startNativeWebOtaInstall(expectedVersion: String): Boolean {
        if (expectedVersion.isBlank()) return false
        publishOtaInstallEvent("download-start")
        otaWebManager.applyUpdate(
            expectedVersion = expectedVersion,
            onProgress = { percent ->
                publishOtaInstallEvent("download-progress", progress = percent)
            },
            onComplete = { updated, error ->
                if (updated) {
                    publishOtaInstallEvent("install-staged")
                    runOnUiThread {
                        if (isFinishing || isDestroyed) return@runOnUiThread
                        android.util.Log.i("NexusNovaOTA", "Verified web OTA activated; refreshing local app overlay")
                        publishOtaInstallEvent("success")
                        loadProductionApp(forceFresh = true)
                    }
                } else {
                    publishOtaInstallEvent("failure", error ?: "The web update could not be activated safely.")
                }
            }
        )
        return true
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
        // Puter website authentication opens a user-initiated popup. Multiple
        // windows are enabled only so the guarded onCreateWindow handler below
        // can place that popup in an isolated WebView with no NexusNova bridge.
        settings.setSupportMultipleWindows(true)
        settings.javaScriptCanOpenWindowsAutomatically = true
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
                return otaWebManager.intercept(uri)
                    ?: assetLoader.shouldInterceptRequest(uri)
                    ?: super.shouldInterceptRequest(view, request)
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                val uri = url?.let { runCatching { Uri.parse(it) }.getOrNull() } ?: return
                if (!isTrustedAppPage(uri) || usingOfflineFallback) return
                armMainFrameWatchdog(view ?: return)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                val target = view ?: return
                val uri = url?.let { runCatching { Uri.parse(it) }.getOrNull() } ?: return
                if (!isTrustedAppPage(uri)) return
                if (isLocalOrigin(uri)) {
                    val nativeInfo = JSONObject()
                        .put("buildCommit", BuildConfig.NEXUS_BUILD_COMMIT)
                        .put("versionCode", BuildConfig.VERSION_CODE)
                        .put("versionName", BuildConfig.VERSION_NAME)
                    target.evaluateJavascript("window.NexusNovaNativeInfo = " + nativeInfo + ";", null)
                    android.util.Log.i(
                        "NexusNovaDiagnostic",
                        "runtimeBuildCommit=${BuildConfig.NEXUS_BUILD_COMMIT}; versionCode=${BuildConfig.VERSION_CODE}; versionName=${BuildConfig.VERSION_NAME}"
                    )
                }
                if (usingOfflineFallback) return
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
                if (!isTrustedAppPage(failed.url)) return

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
                if (!isTrustedAppPage(failed.url)) return
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
                    otaWebManager.rollbackToBundled()
                    window.decorView.post {
                        if (!isFinishing && !isDestroyed) showRendererRecoveryFailure()
                    }
                    return true
                }

                if (didCrash) {
                    otaWebManager.rollbackToBundled()
                    rendererCrashRecoveries += 1
                }
                val delayMs = if (didCrash) RENDERER_CRASH_RECOVERY_DELAY_MS else 0L
                window.decorView.postDelayed({
                    if (!isFinishing && !isDestroyed) rebuildWebViewAfterRendererExit()
                }, delayMs)
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: android.os.Message?
            ): Boolean {
                if (view !== webView || !isTrustedAppPage(view)) return false
                return NexusPuterPopupManager.open(
                    this@MainActivity,
                    resultMsg,
                    isUserGesture
                )
            }

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
        val suffix = if (forceFresh) {
            "?appBundle=$WEB_BUNDLE_VERSION&androidRecovery=${System.currentTimeMillis()}"
        } else {
            "?appBundle=$WEB_BUNDLE_VERSION"
        }
        webView.loadUrl(LOCAL_APP_URL + suffix)
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

        // Never strand the app on a broken OTA. Block that exact version and
        // immediately return to the signed bundled web baseline.
        val rolledBackOta = otaWebManager.rollbackToBundled()
        usingOfflineFallback = true
        mainFrameWatchdogToken += 1
        target.stopLoading()
        target.clearCache(true)
        target.loadUrl(LOCAL_APP_URL + "?otaRollback=${System.currentTimeMillis()}")
        android.util.Log.w(
            "NexusNovaWeb",
            "Using bundled fallback after $reason; otaRollback=$rolledBackOta"
        )
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
            ACTION_OTA_SHOW_PROMPT, ACTION_OTA_INSTALL, ACTION_OTA_CANCEL -> {
                android.util.Log.i("NexusNovaOTA", "Legacy full-APK OTA action ignored; web OTA only.")
            }

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


            ACTION_NATIVE_DRIVE_START -> {
                if (!hasLocationPermission()) {
                    publishNativeDriveSnapshot("Location permission is required for Nova Drive.")
                    return
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                    ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                ) {
                    runCatching { requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), NATIVE_DRIVE_NOTIFICATION_REQUEST_CODE) }
                }
                runCatching { NexusDriveForegroundService.start(this) }
                    .onFailure { publishNativeDriveSnapshot("Could not start background Drive tracking: ${it.message ?: "system restriction"}") }
                webView.postDelayed({ publishNativeDriveSnapshot() }, 180L)
            }

            ACTION_NATIVE_DRIVE_PAUSE -> {
                NexusDriveForegroundService.command(this, NexusDriveForegroundService.ACTION_PAUSE)
                webView.postDelayed({ publishNativeDriveSnapshot() }, 120L)
            }

            ACTION_NATIVE_DRIVE_RESUME -> {
                NexusDriveForegroundService.command(this, NexusDriveForegroundService.ACTION_RESUME)
                webView.postDelayed({ publishNativeDriveSnapshot() }, 120L)
            }

            ACTION_NATIVE_DRIVE_STOP -> {
                NexusDriveForegroundService.command(this, NexusDriveForegroundService.ACTION_STOP)
                webView.postDelayed({ publishNativeDriveSnapshot() }, 280L)
            }

            ACTION_NATIVE_DRIVE_STATUS -> publishNativeDriveSnapshot()

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

    private fun showNativeOtaUpdatePrompt(message: JSONObject): Boolean {
        if (isFinishing || isDestroyed) return false
        if (otaInstallFuture?.isDone == false) return true
        if (nativeOtaUpdateDialog?.isShowing == true) return true

        val rawUrl = message.optString("apkUrl").trim()
        val expectedVersionCode = message.optLong("expectedVersionCode", 0L)
        val expectedSha256 = message.optString("expectedSha256").trim().lowercase(Locale.ROOT)
        val versionName = message.optString("versionName").trim()
        val uri = runCatching { Uri.parse(rawUrl) }.getOrNull()

        if (uri == null || !isAllowedOtaDownloadUri(uri) ||
            !Regex("^[0-9a-f]{64}$").matches(expectedSha256) ||
            expectedVersionCode <= 0L
        ) {
            android.util.Log.w("NexusNovaOTA", "Rejected invalid native update prompt metadata")
            return false
        }

        val promptMessage = JSONObject(message.toString())
        val versionLabel = versionName.takeIf { it.isNotBlank() } ?: "latest release"
        val density = resources.displayMetrics.density
        val content = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding((24 * density).toInt(), 0, (24 * density).toInt(), 0)
        }
        val progressText = android.widget.TextView(this).apply {
            text = "Version $versionLabel is ready. Download 0%"
            setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 17f)
        }
        val progressBar = android.widget.ProgressBar(
            this,
            null,
            android.R.attr.progressBarStyleHorizontal
        ).apply {
            max = 100
            progress = 0
            isIndeterminate = false
        }
        content.addView(
            progressText,
            android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )
        content.addView(
            progressBar,
            android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                (6 * density).toInt()
            ).apply {
                topMargin = (14 * density).toInt()
            }
        )

        val dialog = MaterialAlertDialogBuilder(this)
            .setIcon(R.drawable.ic_launcher)
            .setTitle("NexusNova update available")
            .setView(content)
            .setNegativeButton("Not now", null)
            .setPositiveButton("Update", null)
            .create()

        nativeOtaPromptMessage = promptMessage
        nativeOtaUpdateDialog = dialog
        nativeOtaProgressText = progressText
        nativeOtaProgressBar = progressBar
        dialog.setOnDismissListener {
            if (nativeOtaUpdateDialog === dialog) nativeOtaUpdateDialog = null
            if (nativeOtaProgressText === progressText) nativeOtaProgressText = null
            if (nativeOtaProgressBar === progressBar) nativeOtaProgressBar = null
            nativeOtaPromptMessage = null
        }
        dialog.show()

        dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_POSITIVE).setOnClickListener {
            val request = nativeOtaPromptMessage ?: return@setOnClickListener
            val started = startNativeOtaInstall(request)
            if (started) {
                dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_POSITIVE)?.isEnabled = false
                dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_NEGATIVE)?.isEnabled = false
                dialog.setMessage("Preparing the secure NexusNova update…")
            }
        }
        return true
    }

    private fun startNativeOtaInstall(message: JSONObject): Boolean {
        if (otaInstallFuture?.isDone == false) {
            publishOtaInstallEvent("failure", "An update is already downloading.")
            return true
        }

        val rawUrl = message.optString("apkUrl").trim()
        val expectedVersionCode = message.optLong("expectedVersionCode", 0L)
        val expectedSha256 = message.optString("expectedSha256").trim().lowercase(Locale.ROOT)
        val uri = runCatching { Uri.parse(rawUrl) }.getOrNull()
        if (uri == null || !isAllowedOtaDownloadUri(uri) ||
            !Regex("^[0-9a-f]{64}$").matches(expectedSha256) ||
            expectedVersionCode <= 0L
        ) {
            publishOtaInstallEvent("failure", "The update source is not an approved NexusNova release asset.")
            return false
        }

        otaInstallCommitted = false
        publishOtaInstallEvent("download-start")

        otaInstallFuture = otaInstallExecutor.submit {
            try {
                val apkFile = downloadOtaApk(uri, expectedSha256)
                publishOtaInstallEvent("download-complete")
                verifyOtaApk(apkFile, expectedVersionCode, expectedSha256)
                publishOtaInstallEvent("install-staged")
                installOtaApk(apkFile)
            } catch (error: Throwable) {
                if (Thread.currentThread().isInterrupted) {
                    publishOtaInstallEvent("cancelled")
                } else {
                    android.util.Log.e("NexusNovaOTA", "Native OTA installation failed", error)
                    publishOtaInstallEvent(
                        "failure",
                        error.message ?: "The signed update could not be installed."
                    )
                }
            } finally {
                otaDownloadConnection?.disconnect()
                otaDownloadConnection = null
                otaInstallFuture = null
                if (!otaInstallCommitted) cleanupOtaCache()
            }
        }
        return true
    }

    private fun cancelNativeOtaInstall() {
        if (otaInstallCommitted) return
        otaDownloadConnection?.disconnect()
        otaDownloadConnection = null
        otaInstallFuture?.cancel(true)
        otaInstallFuture = null
        if (otaInstallSessionId >= 0) {
            runCatching { packageManager.packageInstaller.abandonSession(otaInstallSessionId) }
            otaInstallSessionId = -1
        }
        cleanupOtaCache()
        publishOtaInstallEvent("cancelled")
    }

    private fun downloadOtaApk(uri: Uri, expectedSha256: String): File {
        val root = File(cacheDir, OTA_CACHE_DIR)
        if (!root.exists() && !root.mkdirs()) throw java.io.IOException("Could not create OTA cache")
        val temp = File(root, OTA_APK_NAME + ".part")
        val target = File(root, OTA_APK_NAME)
        temp.delete()
        target.delete()

        val connection = (URL(uri.toString()).openConnection() as HttpURLConnection).apply {
            connectTimeout = OTA_CONNECT_TIMEOUT_MS
            readTimeout = OTA_READ_TIMEOUT_MS
            instanceFollowRedirects = true
            useCaches = false
            defaultUseCaches = false
            setRequestProperty("User-Agent", "NexusNova-Android-OTA/1")
            setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0")
        }
        otaDownloadConnection = connection
        try {
            connection.connect()
            if (connection.responseCode !in 200..299) {
                throw java.io.IOException("OTA download HTTP ${connection.responseCode}")
            }
            val declaredLength = connection.contentLengthLong
            if (declaredLength > OTA_MAX_APK_BYTES) throw java.io.IOException("OTA APK is too large")

            var total = 0L
            var lastReported = -1
            connection.inputStream.buffered().use { input ->
                temp.outputStream().buffered().use { output ->
                    val buffer = ByteArray(32 * 1024)
                    while (true) {
                        if (Thread.currentThread().isInterrupted) throw InterruptedException("OTA download cancelled")
                        val read = input.read(buffer)
                        if (read < 0) break
                        total += read
                        if (total > OTA_MAX_APK_BYTES) throw java.io.IOException("OTA APK exceeded size limit")
                        output.write(buffer, 0, read)
                        if (declaredLength > 0L) {
                            val percent = ((total * 100L) / declaredLength).toInt().coerceIn(0, 100)
                            if (percent != lastReported) {
                                lastReported = percent
                                publishOtaInstallEvent("download-progress", progress = percent)
                            }
                        }
                    }
                    output.flush()
                }
            }
            if (declaredLength >= 0L && total != declaredLength) {
                throw java.io.IOException("OTA byte-count mismatch")
            }
        } finally {
            connection.disconnect()
            otaDownloadConnection = null
        }

        if (!temp.renameTo(target)) throw java.io.IOException("Could not finalize OTA cache file")
        if (sha256File(target) != expectedSha256) {
            throw SecurityException("OTA SHA-256 mismatch")
        }
        return target
    }

    private fun verifyOtaApk(
        apkFile: File,
        expectedVersionCode: Long,
        expectedSha256: String
    ) {
        if (!apkFile.isFile || apkFile.length() <= 0L) throw java.io.IOException("OTA APK cache is empty")

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageManager.GET_SIGNING_CERTIFICATES
        } else {
            @Suppress("DEPRECATION")
            PackageManager.GET_SIGNATURES
        }
        val archive = packageManager.getPackageArchiveInfo(apkFile.absolutePath, flags)
            ?: throw java.io.IOException("Downloaded OTA is not a readable APK")
        if (archive.packageName != packageName) {
            throw SecurityException("OTA package mismatch: ${archive.packageName}")
        }

        val targetVersionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            archive.longVersionCode
        } else {
            @Suppress("DEPRECATION")
            archive.versionCode.toLong()
        }
        val currentInfo = packageManager.getPackageInfo(packageName, flags)
        val currentVersionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            currentInfo.longVersionCode
        } else {
            @Suppress("DEPRECATION")
            currentInfo.versionCode.toLong()
        }
        if (targetVersionCode <= currentVersionCode) {
            throw SecurityException("OTA version ${targetVersionCode} is not newer than installed ${currentVersionCode}")
        }
        if (expectedVersionCode <= 0L || targetVersionCode != expectedVersionCode) {
            throw SecurityException("OTA versionCode does not match the published update metadata")
        }
        if (sha256File(apkFile) != expectedSha256) {
            throw SecurityException("OTA SHA-256 mismatch")
        }

        val currentSigner = signingCertificateDigests(currentInfo)
        val targetSigner = signingCertificateDigests(archive)
        if (currentSigner.isEmpty() || targetSigner.isEmpty() || currentSigner.intersect(targetSigner).isEmpty()) {
            throw SecurityException("OTA production signing certificate mismatch")
        }
    }

    private fun signingCertificateDigests(info: PackageInfo): Set<String> {
        val signatures: Array<Signature> = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val signingInfo = info.signingInfo ?: return emptySet()
            if (signingInfo.hasMultipleSigners()) signingInfo.apkContentsSigners
            else signingInfo.signingCertificateHistory
        } else {
            @Suppress("DEPRECATION")
            info.signatures ?: emptyArray()
        }
        return signatures.map { signature -> sha256Hex(signature.toByteArray()) }.toSet()
    }

    private fun sha256Hex(value: ByteArray): String {
        return MessageDigest.getInstance("SHA-256")
            .digest(value)
            .joinToString("") { byte -> "%02x".format(byte) }
    }

    private fun sha256File(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered().use { input ->
            val buffer = ByteArray(32 * 1024)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { byte -> "%02x".format(byte) }
    }

    private fun installOtaApk(apkFile: File) {
        try {
            val apkUri = FileProvider.getUriForFile(
                this,
                packageName + ".fileprovider",
                apkFile
            )
            val installIntent = Intent(Intent.ACTION_INSTALL_PACKAGE).apply {
                data = apkUri
                type = APK_MIME_TYPE
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                putExtra(Intent.EXTRA_INSTALLER_PACKAGE_NAME, packageName)
            }
            val fallbackIntent = Intent(Intent.ACTION_VIEW).apply {
                data = apkUri
                type = APK_MIME_TYPE
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val intentToLaunch = when {
                installIntent.resolveActivity(packageManager) != null -> installIntent
                fallbackIntent.resolveActivity(packageManager) != null -> fallbackIntent
                else -> throw java.io.IOException("No Android package installer is available.")
            }
            startActivity(intentToLaunch)
            // Keep the verified APK alive while the system installer reads it.
            otaInstallCommitted = true
        } catch (error: Throwable) {
            publishOtaInstallEvent(
                "failure",
                error.message ?: "Android package installer could not open the verified update."
            )
            throw error
        }
    }

    private fun createOtaStatusIntentSender(sessionId: Int): android.content.IntentSender {
        val callbackIntent = Intent(this, MainActivity::class.java)
            .setAction(ACTION_OTA_INSTALL_STATUS)
            .putExtra(EXTRA_OTA_SESSION_ID, sessionId)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pending = PendingIntent.getActivity(
            this,
            sessionId,
            callbackIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return pending.intentSender
    }

    private fun handleOtaInstallStatus(intent: Intent): Boolean {
        if (intent.action != ACTION_OTA_INSTALL_STATUS) return false
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        when (status) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                val installerIntent = extractInstallIntent(intent)
                if (installerIntent == null) {
                    publishOtaInstallEvent("failure", "Android did not return an installer confirmation intent.")
                    return true
                }
                publishOtaInstallEvent("install-prompt")
                runCatching { startActivity(installerIntent) }
                    .onFailure { publishOtaInstallEvent("failure", it.message ?: "Could not open Android installer.") }
            }
            PackageInstaller.STATUS_SUCCESS -> {
                publishOtaInstallEvent("success")
                otaInstallSessionId = -1
                cleanupOtaCache()
            }
            else -> {
                publishOtaInstallEvent(
                    "failure",
                    intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
                        ?: "Android rejected the update package."
                )
                otaInstallSessionId = -1
                cleanupOtaCache()
            }
        }
        return true
    }

    @Suppress("DEPRECATION")
    private fun extractInstallIntent(intent: Intent): Intent? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
        } else {
            intent.getParcelableExtra(Intent.EXTRA_INTENT)
        }
    }

    private fun updateNativeOtaDialog(
        event: String,
        message: String? = null,
        progress: Int? = null
    ) {
        runOnUiThread {
            val dialog = nativeOtaUpdateDialog ?: return@runOnUiThread
            if (!dialog.isShowing) return@runOnUiThread

            when (event) {
                "download-start" -> {
                    nativeOtaProgressText?.text = "Downloading update… 0%"
                    nativeOtaProgressBar?.progress = 0
                }
                "download-progress" -> {
                    val percent = progress?.coerceIn(0, 100) ?: 0
                    nativeOtaProgressText?.text = "Downloading update… $percent%"
                    nativeOtaProgressBar?.progress = percent
                }
                "download-complete" -> {
                    nativeOtaProgressText?.text = "Download complete. Verifying the signed update…"
                    nativeOtaProgressBar?.progress = 100
                }
                "install-staged" -> {
                    nativeOtaProgressText?.text = "Update verified. Opening Android installer…"
                    nativeOtaProgressBar?.progress = 100
                }
                "install-prompt" -> {
                    dialog.dismiss()
                    nativeOtaUpdateDialog = null
                }
                "success" -> {
                    dialog.dismiss()
                    nativeOtaUpdateDialog = null
                }
                "cancelled" -> {
                    dialog.dismiss()
                    nativeOtaUpdateDialog = null
                }
                "failure" -> {
                    nativeOtaProgressText?.text = message ?: "The update could not be installed safely."
                    dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_POSITIVE)?.apply {
                        isEnabled = true
                        text = "Update"
                    }
                    dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_NEGATIVE)?.isEnabled = true
                }
            }
        }
    }

    private fun publishOtaInstallEvent(
        event: String,
        message: String? = null,
        progress: Int? = null
    ) {
        updateNativeOtaDialog(event, message, progress)
        if (!::webView.isInitialized || isFinishing || isDestroyed) return
        val payload = JSONObject().put("event", event)
        if (!message.isNullOrBlank()) payload.put("message", message)
        if (progress != null) payload.put("percent", progress)
        val script = "window.dispatchEvent(new CustomEvent('nexusnova:ota-install',{detail:$payload}));"
        webView.post {
            if (!isFinishing && !isDestroyed && ::webView.isInitialized) {
                runCatching { webView.evaluateJavascript(script, null) }
            }
        }
    }

    private fun cleanupOtaCache() {
        runCatching { File(cacheDir, OTA_CACHE_DIR).deleteRecursively() }
    }

    private fun isAllowedOtaDownloadUri(uri: Uri): Boolean {
        val expectedPrefix = "/${OTA_GITHUB_REPOSITORY}/apk-builds/ota-bootstrap-safe/"
        return uri.scheme.equals("https", ignoreCase = true) &&
            uri.host.equals("raw.githubusercontent.com", ignoreCase = true) &&
            uri.encodedPath?.startsWith(expectedPrefix, ignoreCase = false) == true &&
            uri.encodedPath?.endsWith(".apk", ignoreCase = true) == true
    }

    private fun publishNativeDriveSnapshot(error: String? = null) {
        if (!::webView.isInitialized || isFinishing || isDestroyed) return
        val snapshot = NexusDriveForegroundService.readSnapshot(this)
        if (!error.isNullOrBlank()) {
            snapshot.put("error", error)
            snapshot.put("status", error)
        }
        val script = "window.dispatchEvent(new CustomEvent('nexusnova:native-drive',{detail:${snapshot}}));"
        webView.post {
            if (!isFinishing && !isDestroyed && ::webView.isInitialized) {
                runCatching { webView.evaluateJavascript(script, null) }
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

        // Some Android media providers do not expose SIZE or MIME consistently.
        // A valid content URI should not be rejected solely because provider
        // metadata is incomplete. Enforce hard limits only when size is known.
        val size = pickedUriSize(uri)
        if (size != null && size > MAX_PICKED_FILE_BYTES) return null
        if (acceptedTypes.isEmpty()) return size ?: 0L

        val mimeType = try {
            contentResolver.getType(uri)?.lowercase(Locale.ROOT)
        } catch (_: Exception) {
            null
        }

        val displayName = pickedUriDisplayName(uri)
        val extension = displayName
            ?.substringAfterLast('.', "")
            ?.lowercase(Locale.ROOT)
            ?.takeIf { it.isNotBlank() }

        val accepted = acceptedTypes
            .asSequence()
            .flatMap { value -> value.split(',').asSequence() }
            .map { value -> value.substringBefore(';').trim().lowercase(Locale.ROOT) }
            .any { acceptedType ->
                acceptedType == "*/*" ||
                    (mimeType != null && (
                        acceptedType == mimeType ||
                            (acceptedType.endsWith("/*") &&
                                mimeType.startsWith(acceptedType.removeSuffix("*")))
                    )) ||
                    acceptedType == extension?.let { ".$it" } ||
                    (acceptedType == ".pdf" && mimeType == "application/pdf")
            }

        return (if (accepted) size ?: 0L else null)
    }

    private fun pickedUriDisplayName(uri: Uri): String? {
        try {
            contentResolver.query(
                uri,
                arrayOf(OpenableColumns.DISPLAY_NAME),
                null,
                null,
                null
            )?.use { cursor ->
                val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (index >= 0 && cursor.moveToFirst() && !cursor.isNull(index)) {
                    cursor.getString(index)?.takeIf { it.isNotBlank() }?.let { return it }
                }
            }
        } catch (_: Exception) {
            // Fall through to URI path for providers without a display-name column.
        }

        return uri.lastPathSegment
            ?.substringAfterLast('/')
            ?.takeIf { it.isNotBlank() }
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

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        if (intent != null) {
            handleOtaInstallStatus(intent)
            setIntent(intent)
        }
    }

    override fun onDestroy() {
        nativeOtaUpdateDialog?.dismiss()
        nativeOtaUpdateDialog = null
        nativeOtaPromptMessage = null
        if (!otaInstallCommitted) cancelNativeOtaInstall()
        else {
            otaDownloadConnection?.disconnect()
            otaDownloadConnection = null
        }
        otaInstallExecutor.shutdownNow()
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
        const val WEB_BUNDLE_VERSION = "nv16"

        const val PRODUCTION_HOST = "fahadsoomro123.github.io"
        const val PRODUCTION_APP_ORIGIN = "https://fahadsoomro123.github.io"
        const val PRODUCTION_PATH = "/nexusnova-app/"
        const val PRODUCTION_APP_URL = "https://fahadsoomro123.github.io/nexusnova-app/"

        const val NATIVE_BRIDGE_NAME = "NexusAndroid"
        const val BROWSER_BRIDGE_NAME = "NexusBrowserAndroid"
        const val BROWSER_ACTION_OPEN = "open"

        const val ACTION_OTA_SHOW_PROMPT = "showUpdatePrompt"
        const val ACTION_OTA_INSTALL = "installUpdate"
        const val ACTION_OTA_CANCEL = "cancelUpdate"
        const val ACTION_OTA_INSTALL_STATUS = "com.nexusnova.app.OTA_INSTALL_STATUS"
        const val EXTRA_OTA_SESSION_ID = "otaSessionId"
        const val OTA_GITHUB_REPOSITORY = "fahadsoomro123/nexusnova-app"
        const val OTA_CACHE_DIR = "nexusnova-ota"
        const val OTA_APK_NAME = "nexusnova-update.apk"
        const val APK_MIME_TYPE = "application/vnd.android.package-archive"
        const val OTA_MAX_APK_BYTES = 200L * 1024L * 1024L
        const val OTA_CONNECT_TIMEOUT_MS = 15_000
        const val OTA_READ_TIMEOUT_MS = 30_000
        const val ACTION_OPEN_NOVA_VPN = "openNovaVpn"
        const val ACTION_OPEN_EXTERNAL = "openExternal"
        const val ACTION_SHOW_REWARDED_AD = "showRewardedAd"
        const val ACTION_SHOW_INTERSTITIAL_AD = "showInterstitialAd"
        const val ACTION_AD_STATUS = "adStatus"
        const val ACTION_NATIVE_DRIVE_START = "nativeDriveStart"
        const val ACTION_NATIVE_DRIVE_PAUSE = "nativeDrivePause"
        const val ACTION_NATIVE_DRIVE_RESUME = "nativeDriveResume"
        const val ACTION_NATIVE_DRIVE_STOP = "nativeDriveStop"
        const val ACTION_NATIVE_DRIVE_STATUS = "nativeDriveStatus"
        const val NATIVE_DRIVE_NOTIFICATION_REQUEST_CODE = 2608

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
