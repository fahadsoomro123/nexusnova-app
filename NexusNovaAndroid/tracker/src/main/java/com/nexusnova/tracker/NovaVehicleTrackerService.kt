package com.nexusnova.tracker

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class NovaVehicleTrackerService : Service() {
    private lateinit var fused: FusedLocationProviderClient
    private val prefs by lazy { getSharedPreferences(MainActivity.PREFS, MODE_PRIVATE) }
    private val networkExecutor = Executors.newSingleThreadExecutor()
    private val sending = AtomicBoolean(false)
    private var lastSentAt = 0L
    private var lastNotificationAt = 0L

    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val location = result.lastLocation ?: return
            val speedKmh = if (location.hasSpeed()) (location.speed * 3.6).coerceAtLeast(0.0) else 0.0
            val now = System.currentTimeMillis()
            val interval = if (speedKmh >= 2.0) MOVING_UPLOAD_MS else PARKED_UPLOAD_MS
            if (now - lastNotificationAt >= NOTIFICATION_UPDATE_MS) {
                updateNotification("${speedKmh.toInt()} km/h • secure GPS active")
                lastNotificationAt = now
            }
            if (now - lastSentAt >= interval) sendTelemetry(location, speedKmh)
        }
    }

    override fun onCreate() {
        super.onCreate()
        fused = LocationServices.getFusedLocationProviderClient(this)
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            prefs.edit().putBoolean(MainActivity.KEY_TRACKING_ENABLED, false).apply()
            stopTracking()
            return START_NOT_STICKY
        }

        val token = prefs.getString(MainActivity.KEY_TOKEN, "").orEmpty()
        val enabled = prefs.getBoolean(MainActivity.KEY_TRACKING_ENABLED, false)
        if (token.length != 64 || !enabled || !hasFineLocation()) {
            stopSelf()
            return START_NOT_STICKY
        }

        startAsForeground()
        beginLocationUpdates()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        try { fused.removeLocationUpdates(callback) } catch (_: Exception) {}
        networkExecutor.shutdownNow()
        super.onDestroy()
    }

    private fun startAsForeground() {
        val notification = buildNotification("Secure tracker armed • waiting for GPS")
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            notification,
            if (Build.VERSION.SDK_INT >= 29) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0
        )
    }

    private fun beginLocationUpdates() {
        if (!hasFineLocation()) return
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, LOCATION_INTERVAL_MS)
            .setMinUpdateIntervalMillis(5_000L)
            .setMaxUpdateDelayMillis(15_000L)
            .build()
        try {
            fused.removeLocationUpdates(callback)
            fused.requestLocationUpdates(request, callback, mainLooper)
        } catch (_: SecurityException) {
            updateNotification("Location permission missing • tracker paused")
            stopSelf()
        }
    }

    private fun sendTelemetry(location: Location, speedKmh: Double) {
        if (!sending.compareAndSet(false, true)) return
        val token = prefs.getString(MainActivity.KEY_TOKEN, "").orEmpty()
        if (token.length != 64) {
            sending.set(false)
            return
        }
        val battery = batterySnapshot()
        val payload = JSONObject()
            .put("latitude", location.latitude)
            .put("longitude", location.longitude)
            .put("accuracyM", if (location.hasAccuracy()) location.accuracy.toDouble() else 0.0)
            .put("speedKmh", speedKmh.coerceIn(0.0, 350.0))
            .put("heading", if (location.hasBearing()) location.bearing.toDouble() else 0.0)
            .put("batteryPct", battery.percent)
            .put("charging", battery.charging)
            .put("externalPower", battery.externalPower)
            .put("observedAt", location.time.takeIf { it > 0 } ?: System.currentTimeMillis())
            .toString()

        networkExecutor.execute {
            try {
                val connection = (URL(TELEMETRY_URL).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 12_000
                    readTimeout = 12_000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    setRequestProperty("Accept", "application/json")
                    setRequestProperty("Authorization", "Bearer $token")
                }
                connection.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
                val responseCode = connection.responseCode
                val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
                stream?.bufferedReader()?.use { it.readText() }
                connection.disconnect()
                when {
                    responseCode in 200..299 -> {
                        lastSentAt = System.currentTimeMillis()
                        prefs.edit().remove(KEY_PENDING_PAYLOAD).apply()
                    }
                    responseCode == 401 -> {
                        prefs.edit()
                            .putBoolean(MainActivity.KEY_TRACKING_ENABLED, false)
                            .remove(MainActivity.KEY_TOKEN)
                            .putString(KEY_PENDING_PAYLOAD, payload)
                            .apply()
                        updateNotification("Tracker access revoked • open app to pair again")
                        stopSelf()
                    }
                    else -> prefs.edit().putString(KEY_PENDING_PAYLOAD, payload).apply()
                }
            } catch (_: Exception) {
                prefs.edit().putString(KEY_PENDING_PAYLOAD, payload).apply()
            } finally {
                sending.set(false)
            }
        }
    }

    private fun batterySnapshot(): BatterySnapshot {
        val intent = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
        val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val plugged = intent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
        val percent = if (level >= 0 && scale > 0) (level * 100.0 / scale).coerceIn(0.0, 100.0) else 0.0
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
        return BatterySnapshot(percent, charging, plugged != 0)
    }

    private fun stopTracking() {
        try { fused.removeLocationUpdates(callback) } catch (_: Exception) {}
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < 26) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Nova Vehicle Premium",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Required notification for secure vehicle location tracking"
            setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(text: String): android.app.Notification {
        val openIntent = PendingIntent.getActivity(
            this,
            10,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val stopIntent = PendingIntent.getService(
            this,
            11,
            Intent(this, NovaVehicleTrackerService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("Nova Vehicle Premium")
            .setContentText(text)
            .setContentIntent(openIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .addAction(0, "Stop", stopIntent)
            .build()
    }

    private fun updateNotification(text: String) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification(text))
    }

    private fun hasFineLocation(): Boolean =
        ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    private data class BatterySnapshot(
        val percent: Double,
        val charging: Boolean,
        val externalPower: Boolean
    )

    companion object {
        const val ACTION_START = "com.nexusnova.tracker.START"
        const val ACTION_STOP = "com.nexusnova.tracker.STOP"
        private val TELEMETRY_URL = "${BuildConfig.NOVA_VEHICLE_API_BASE}/v1/tracker/telemetry"
        private const val CHANNEL_ID = "nova_vehicle_tracker"
        private const val NOTIFICATION_ID = 9107
        private const val LOCATION_INTERVAL_MS = 10_000L
        private const val MOVING_UPLOAD_MS = 10_000L
        private const val PARKED_UPLOAD_MS = 60_000L
        private const val NOTIFICATION_UPDATE_MS = 30_000L
        private const val KEY_PENDING_PAYLOAD = "pending_payload"
    }
}
