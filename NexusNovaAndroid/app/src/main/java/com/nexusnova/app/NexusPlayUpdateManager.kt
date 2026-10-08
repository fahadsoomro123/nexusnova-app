package com.nexusnova.app

import android.app.Activity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability

/**
 * Google Play is the sole native application update authority.
 *
 * This wrapper deliberately exposes no APK download/install API. Native updates
 * are requested from Google Play using the official Play In-App Update flow.
 */
class NexusPlayUpdateManager(activity: Activity) {

    private val appUpdateManager: AppUpdateManager =
        AppUpdateManagerFactory.create(activity)

    private lateinit var updateLauncher: ActivityResultLauncher<IntentSenderRequest>
    private var onFlexibleDownloaded: (() -> Unit)? = null

    private val installListener = InstallStateUpdatedListener { state ->
        if (state.installStatus() == InstallStatus.DOWNLOADED) {
            onFlexibleDownloaded?.invoke()
        }
    }

    init {
        appUpdateManager.registerListener(installListener)
    }

    fun bindLauncher(launcher: ActivityResultLauncher<IntentSenderRequest>) {
        updateLauncher = launcher
    }

    fun checkForUpdate(
        showStandardUpdate: (AppUpdateInfo) -> Unit,
        showCriticalUpdate: (AppUpdateInfo) -> Unit,
    ) {
        appUpdateManager.appUpdateInfo
            .addOnSuccessListener { info ->
                if (info.updateAvailability() ==
                    UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
                ) {
                    if (info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                        startImmediate(info)
                    }
                    return@addOnSuccessListener
                }

                if (info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE) return@addOnSuccessListener
                if (info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE) && info.updatePriority() >= 4) {
                    showCriticalUpdate(info)
                } else if (info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
                    showStandardUpdate(info)
                }
            }
            .addOnFailureListener {
                android.util.Log.w(TAG, "Google Play update check failed", it)
            }
    }

    fun resumeIncompleteUpdate() {
        appUpdateManager.appUpdateInfo
            .addOnSuccessListener { info ->
                if (info.updateAvailability() ==
                    UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS &&
                    info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)
                ) {
                    startImmediate(info)
                } else if (info.installStatus() == InstallStatus.DOWNLOADED) {
                    onFlexibleDownloaded?.invoke()
                }
            }
            .addOnFailureListener {
                android.util.Log.w(TAG, "Google Play resume/update state check failed", it)
            }
    }

    fun startStandard(info: AppUpdateInfo) {
        if (!info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) return
        val options = com.google.android.play.core.appupdate.AppUpdateOptions
            .newBuilder(AppUpdateType.FLEXIBLE)
            .build()
        start(info, options)
    }

    fun startImmediate(info: AppUpdateInfo) {
        if (!info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) return
        val options = com.google.android.play.core.appupdate.AppUpdateOptions
            .newBuilder(AppUpdateType.IMMEDIATE)
            .build()
        start(info, options)
    }

    fun setFlexibleDownloadedHandler(handler: (() -> Unit)?) {
        onFlexibleDownloaded = handler
    }

    fun completeFlexibleUpdate() {
        appUpdateManager.completeUpdate()
    }

    fun unregister() {
        appUpdateManager.unregisterListener(installListener)
        onFlexibleDownloaded = null
    }

    private fun start(
        info: AppUpdateInfo,
        options: com.google.android.play.core.appupdate.AppUpdateOptions
    ) {
        try {
            appUpdateManager.startUpdateFlowForResult(info, updateLauncher, options)
        } catch (error: Throwable) {
            android.util.Log.e(TAG, "Could not start Google Play in-app update", error)
        }
    }

    private companion object {
        const val TAG = "NexusNovaPlayUpdate"
    }
}
