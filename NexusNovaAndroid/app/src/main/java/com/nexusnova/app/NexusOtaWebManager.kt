package com.nexusnova.app

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceResponse
import java.io.File

/**
 * Stable bundled-web mode.
 *
 * The previous OTA channel could replace only part of the web module graph,
 * which allowed stale remote files to override the signed APK and break every
 * Nova Hub tool. Stable builds intentionally use only the web assets bundled
 * and verified inside the signed APK. Old OTA state is cleared once this
 * manager is created so a reinstall/update cannot reactivate a stale package.
 */
class NexusOtaWebManager(context: Context) {
    private val appContext = context.applicationContext

    init {
        // Remove both the legacy preference state and any downloaded web trees.
        // This directory is owned exclusively by the old NexusNova OTA layer.
        runCatching {
            appContext.getSharedPreferences("nexusnova_ota_web_v1", Context.MODE_PRIVATE)
                .edit().clear().apply()
            appContext.getSharedPreferences("nexusnova_ota_web_v2_stable", Context.MODE_PRIVATE)
                .edit().clear().apply()
            File(appContext.filesDir, "nexusnova-ota-web").deleteRecursively()
        }
    }

    /** Never override signed APK assets in stable mode. */
    fun intercept(uri: Uri): WebResourceResponse? = null

    /** OTA is deliberately disabled until a complete atomic updater is shipped. */
    fun checkForUpdate(onComplete: (Boolean) -> Unit) {
        onComplete(false)
    }

    fun rollbackToBundled(): Boolean = false

    fun activeVersion(): String = ""
}
