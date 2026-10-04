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
import com.nexusnova.app.video.VideoMediaRegistry
import com.nexusnova.app.video.VideoStudioExporter
import com.nexusnova.app.video.VideoStudioJsonCodec
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var adManager: NexusAdManager? = null
    private val otaWebManager by lazy { NexusOtaWebManager(this) }

    private val videoMediaRegistry by lazy { VideoMediaRegistry(contentResolver) }
    private val videoExporter by lazy { VideoStudioExporter(this) }

    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    private var pendingWebPermissionRequest: PermissionRequest? = null
    private var pendingGeolocation: PendingGeolocation? = null
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var fileChooserAcceptTypes: Set<String> = emptySet()
    private var pendingVideoMediaBinding = false
    private var lastPickedVideoMedia: List<PickedVideoMedia> = emptyList()
    private var usingOfflineFallback = false
    private var mainFrameWatchdogToken = 0
    private var finishedWatchdogToken = -1
    private var webRecoveryAttempts = 0
    private var rendererCrashRecoveries = 0

    private data class PickedVideoMedia(
        val uri: Uri,
        val name: String,
        val size: Long,
        val mimeType: String?
    )

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

        // Render the signed baseline first. The OTA check runs asynchronously and
        // reloads only after a complete, hash-verified compatible package activates.
        loadProductionApp()
        checkForWebUpdate()
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
