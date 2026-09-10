package com.nexusnova.tracker

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED && intent?.action != Intent.ACTION_LOCKED_BOOT_COMPLETED) return
        val prefs = context.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(MainActivity.KEY_TRACKING_ENABLED, false)) return
        if (prefs.getString(MainActivity.KEY_TOKEN, "").orEmpty().length != 64) return
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return
        if (Build.VERSION.SDK_INT >= 29 && ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) return

        try {
            ContextCompat.startForegroundService(
                context,
                Intent(context, NovaVehicleTrackerService::class.java).setAction(NovaVehicleTrackerService.ACTION_START)
            )
        } catch (_: Exception) {
            // Modern Android may defer background foreground-service starts under
            // device/OEM restrictions. The next visible app launch can start it.
        }
    }
}
