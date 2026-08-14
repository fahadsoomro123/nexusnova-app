package com.nexusnova.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.role.RoleManager
import android.content.ContentResolver
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.OpenableColumns
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
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

    private data class PendingGeolocation(
        val origin: String,
        val callback: GeolocationPermissions.Callback
    )

    private val callerRoleLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { /* user returned from the role screen */ }

    private val callerSetupLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { /* the one-time prompt is already recorded before launch */ }

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

        webView = WebView(this)
        setContentView(webView)

        configureWebView()
        installNativeMessageListener()

        // The production GitHub Pages origin is also the registered web App
        // Check origin. Loading it here means web and Android use one tested
        // mining engine instead of maintaining two drifting copies.
        webView.loadUrl(PRODUCTION_APP_URL)
        showCallerSetupOnce()
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

                // Offline fallback is intentionally local. It keeps non-value
                // utilities available, while production mining remains bound to
                // the stable, registered App Check origin.
                usingOfflineFallback = true
                view?.loadUrl(LOCAL_APP_URL)
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

    private fun installNativeMessageListener() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return

        val listener = WebViewCompat.WebMessageListener { _, message, sourceOrigin, isMainFrame, _ ->
            if (isMainFrame && isTrustedOrigin(sourceOrigin)) {
                handleNativeMessage(message.data)
            }
        }
        WebViewCompat.addWebMessageListener(
            webView,
            NATIVE_BRIDGE_NAME,
            setOf(LOCAL_APP_ORIGIN, PRODUCTION_APP_ORIGIN),
            listener
        )
    }

    private fun handleNativeMessage(payload: String?) {
        if (payload.isNullOrBlank() || payload.length > MAX_BRIDGE_MESSAGE_CHARS) return

        val message = try {
            JSONObject(payload)
        } catch (_: Exception) {
            return
        }

        when (message.optString("action")) {
            ACTION_SAVE_CONTACT -> {
                val accountId = message.optString("accountId").trim()
                val contactId = message.optString("contactId").trim()
                val name = message.optString("name").trim()
                val phone = message.optString("phone").trim()
                val address = message.optString("address").trim()
                if (name.length !in 1..MAX_CONTACT_NAME_CHARS ||
                    address.length > MAX_CONTACT_ADDRESS_CHARS
                ) return
                PhonebookStore.save(accountId, contactId, name, phone, address)
            }

            ACTION_DELETE_CONTACT -> {
                val accountId = message.optString("accountId").trim()
                val contactId = message.optString("contactId").trim()
                PhonebookStore.delete(accountId, contactId)
            }

            ACTION_SET_ACTIVE_ACCOUNT -> {
                PhonebookStore.setActiveAccount(message.optString("accountId").trim())
            }

            ACTION_CLEAR_ACTIVE_ACCOUNT -> {
                PhonebookStore.clearActiveAccount(message.optString("accountId").trim())
            }

            ACTION_REQUEST_CALLER_ROLE -> requestCallerRole()

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

    private fun showCallerSetupOnce() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
        val preferences = getSharedPreferences(CALLER_PROMPT_PREFERENCES, MODE_PRIVATE)
        if (hasCallerRole() || preferences.getBoolean(CALLER_PROMPT_SHOWN, false)) return

        preferences.edit().putBoolean(CALLER_PROMPT_SHOWN, true).apply()
        webView.postDelayed({
            if (!isFinishing && !isDestroyed && !hasCallerRole()) {
                callerSetupLauncher.launch(Intent(this, CallerSetupActivity::class.java))
            }
        }, CALLER_PROMPT_DELAY_MS)
    }

    fun hasCallerRole(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false
        val roleManager = getSystemService(RoleManager::class.java) ?: return false
        return roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)
    }

    fun requestCallerRole() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
        val roleManager = getSystemService(RoleManager::class.java) ?: return
        if (roleManager.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) &&
            !roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)
        ) {
            callerRoleLauncher.launch(
                roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)
            )
        }
    }

    override fun onDestroy() {
        fileChooserCallback?.onReceiveValue(null)
        fileChooserCallback = null
        pendingWebPermissionRequest?.deny()
        pendingWebPermissionRequest = null
        pendingGeolocation = null
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (this::webView.isInitialized && webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
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

        const val ACTION_SAVE_CONTACT = "saveContact"
        const val ACTION_DELETE_CONTACT = "deleteContact"
        const val ACTION_SET_ACTIVE_ACCOUNT = "setActiveAccount"
        const val ACTION_CLEAR_ACTIVE_ACCOUNT = "clearActiveAccount"
        const val ACTION_REQUEST_CALLER_ROLE = "requestCallerRole"
        const val ACTION_OPEN_EXTERNAL = "openExternal"

        const val MAX_BRIDGE_MESSAGE_CHARS = 2_048
        const val MAX_CONTACT_NAME_CHARS = 100
        const val MAX_CONTACT_ADDRESS_CHARS = 300
        const val MAX_EXTERNAL_URL_CHARS = 2_000
        const val MAX_PICKED_FILES = 5
        const val MAX_PICKED_FILE_BYTES = 20L * 1024L * 1024L
        const val MAX_PICKED_TOTAL_BYTES = 20L * 1024L * 1024L

        const val CALLER_PROMPT_PREFERENCES = "caller_role_prompt"
        const val CALLER_PROMPT_SHOWN = "shown"
        const val CALLER_PROMPT_DELAY_MS = 2_500L

        val LOCATION_PERMISSIONS = arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
    }
}
