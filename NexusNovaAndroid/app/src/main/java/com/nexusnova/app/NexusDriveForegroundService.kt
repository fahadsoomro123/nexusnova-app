package com.nexusnova.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.util.UUID
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/**
 * Native foreground Nova Drive tracker.
 *
 * Privacy contract:
 * - Latitude/longitude are held only in memory as the previous GPS fix.
 * - Coordinates are never written to SharedPreferences, logs, notifications or JS.
 * - Persisted data contains only trip aggregates needed to resume/display a drive.
 */
class NexusDriveForegroundService : Service(), LocationListener {

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var locationManager: LocationManager

    private var tripId = ""
    private var active = false
    private var paused = false
    private var startedAt = 0L
    private var pausedAt = 0L
    private var pausedMs = 0L
    private var distanceM = 0.0
    private var movingMs = 0L
    private var speedKmh = 0.0
    private var topKmh = 0.0
    private var accuracyM = Double.NaN
    private var headingDeg = Double.NaN
    private var lastFix: Fix? = null
    private var lastStatus = "Ready"
    private var foregroundStarted = false

    private data class Fix(
        val lat: Double,
        val lon: Double,
        val accuracy: Double,
        val at: Long,
        val speedMps: Double
    )

    private val ticker = object : Runnable {
        override fun run() {
            if (!active) return
            persistSnapshot()
            refreshNotification()
            handler.postDelayed(this, 1_000L)
        }
    }

    override fun onCreate() {
        super.onCreate()
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action ?: ACTION_STATUS) {
            ACTION_START -> startTracking()
            ACTION_PAUSE -> pauseTracking()
            ACTION_RESUME -> resumeTracking()
            ACTION_STOP -> stopTracking(saveResult = true)
            ACTION_STATUS -> {
                if (active) {
                    persistSnapshot()
                    refreshNotification()
                }
            }
        }
        return if (active) START_STICKY else START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        handler.removeCallbacks(ticker)
        stopLocationUpdates()
        super.onDestroy()
    }

    private fun startTracking() {
        if (!hasLocationPermission()) {
            publishError("Location permission is required for Nova Drive.")
            stopSelf()
            return
        }

        if (!active) {
            tripId = "native-${System.currentTimeMillis()}-${UUID.randomUUID()}"
            active = true
            paused = false
            startedAt = System.currentTimeMillis()
            pausedAt = 0L
            pausedMs = 0L
            distanceM = 0.0
            movingMs = 0L
            speedKmh = 0.0
            topKmh = 0.0
            accuracyM = Double.NaN
            headingDeg = Double.NaN
            lastFix = null
            lastStatus = "Starting precision GPS…"
            clearCompletedTrip()
        }

        ensureForeground()
        startLocationUpdates()
        handler.removeCallbacks(ticker)
        handler.post(ticker)
        persistSnapshot()
    }

    private fun pauseTracking() {
        if (!active || paused) return
        paused = true
        pausedAt = System.currentTimeMillis()
        speedKmh = 0.0
        lastFix = null
        lastStatus = "Drive paused"
        persistSnapshot()
        refreshNotification()
    }

    private fun resumeTracking() {
        if (!active || !paused) return
        val now = System.currentTimeMillis()
        pausedMs += max(0L, now - pausedAt)
        pausedAt = 0L
        paused = false
        speedKmh = 0.0
        lastFix = null
        lastStatus = "Drive resumed • waiting for clean GPS fix"
        if (hasLocationPermission()) startLocationUpdates()
        persistSnapshot()
        refreshNotification()
    }

    private fun stopTracking(saveResult: Boolean) {
        if (!active) {
            stopSelf()
            return
        }

        val now = System.currentTimeMillis()
        if (paused && pausedAt > 0L) {
            pausedMs += max(0L, now - pausedAt)
            pausedAt = 0L
        }
        paused = false
        speedKmh = 0.0
        val durationMs = activeDuration(now)
        val meaningful = distanceM >= MIN_SAVED_TRIP_M && movingMs >= MIN_SAVED_MOVING_MS

        if (saveResult && meaningful) {
            val avgKmh = if (movingMs > 0L) (distanceM / 1000.0) / (movingMs / 3_600_000.0) else 0.0
            val completed = JSONObject()
                .put("nativeId", tripId)
                .put("at", startedAt)
                .put("endedAt", now)
                .put("distanceM", distanceM)
                .put("movingMs", movingMs)
                .put("durationMs", durationMs)
                .put("topKmh", topKmh)
                .put("avgKmh", finiteOrZero(avgKmh))
            prefs().edit().putString(KEY_COMPLETED, completed.toString()).apply()
            lastStatus = "Trip saved"
        } else {
            clearCompletedTrip()
            lastStatus = "No meaningful travel detected • false trip was not saved"
        }

        active = false
        lastFix = null
        stopLocationUpdates()
        handler.removeCallbacks(ticker)
        persistSnapshot()

        if (foregroundStarted) {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
            foregroundStarted = false
        }
        stopSelf()
    }

    override fun onLocationChanged(location: Location) {
        if (!active || paused) return

        val lat = location.latitude
        val lon = location.longitude
        val accuracy = location.accuracy.toDouble()
        val time = if (location.time > 0L) location.time else System.currentTimeMillis()
        if (!lat.isFinite() || !lon.isFinite() || !accuracy.isFinite()) return

        accuracyM = accuracy
        if (location.hasBearing()) headingDeg = normalizeHeading(location.bearing.toDouble())
        if (accuracy > MAX_GPS_ACCURACY_M) {
            speedKmh = 0.0
            lastStatus = "Waiting for stronger GPS • ±${accuracy.toInt()} m"
            persistSnapshot()
            refreshNotification()
            return
        }

        val sensorMps = if (location.hasSpeed()) location.speed.toDouble() else Double.NaN
        val safeSensorMps = if (sensorMps.isFinite() && sensorMps >= 0.0 && sensorMps * 3.6 <= MAX_DRIVE_KMH) sensorMps else Double.NaN
        val current = Fix(lat, lon, accuracy, time, safeSensorMps)
        val previous = lastFix

        if (previous == null) {
            lastFix = current
            speedKmh = if (safeSensorMps.isFinite() && safeSensorMps * 3.6 >= MIN_MOVING_KMH) safeSensorMps * 3.6 else 0.0
            topKmh = max(topKmh, speedKmh)
            lastStatus = "GPS locked • movement filter active"
            persistSnapshot()
            refreshNotification()
            return
        }

        val dt = time - previous.at
        if (dt < MIN_FIX_GAP_MS) return
        if (dt > MAX_FIX_GAP_MS) {
            lastFix = current
            speedKmh = 0.0
            lastStatus = "GPS gap ignored • tracking resumed safely"
            persistSnapshot()
            refreshNotification()
            return
        }

        val results = FloatArray(1)
        Location.distanceBetween(previous.lat, previous.lon, current.lat, current.lon, results)
        val rawDistance = results[0].toDouble()
        val dtSec = dt / 1000.0
        val calculatedKmh = if (dtSec > 0.0) rawDistance / dtSec * 3.6 else 0.0
        if (!rawDistance.isFinite() || calculatedKmh > MAX_DRIVE_KMH * 1.18) {
            lastFix = current
            speedKmh = 0.0
            lastStatus = "GPS jump filtered"
            persistSnapshot()
            refreshNotification()
            return
        }

        val noiseFloor = clamp(hypot(max(1.0, accuracy), max(1.0, previous.accuracy)) * 0.30, 3.5, 12.0)
        var acceptedDistance = 0.0
        if (rawDistance >= noiseFloor) {
            acceptedDistance = rawDistance
            val speedDistance = if (safeSensorMps.isFinite()) safeSensorMps * dtSec else Double.NaN
            if (speedDistance.isFinite() && speedDistance >= 1.0) {
                val ratio = rawDistance / max(1.0, speedDistance)
                if (ratio in 0.40..2.50) acceptedDistance = rawDistance * 0.78 + speedDistance * 0.22
            }
            val hardMax = (MAX_DRIVE_KMH / 3.6) * dtSec * 1.18 + 5.0
            acceptedDistance = clamp(acceptedDistance, 0.0, hardMax)
        }

        var liveKmh = if (safeSensorMps.isFinite()) safeSensorMps * 3.6 else calculatedKmh
        if (acceptedDistance == 0.0 && rawDistance < noiseFloor && (!liveKmh.isFinite() || liveKmh < 5.0)) liveKmh = 0.0
        liveKmh = clamp(if (liveKmh.isFinite()) liveKmh else 0.0, 0.0, MAX_DRIVE_KMH)

        val movingDelta = if (acceptedDistance > 0.0 && liveKmh >= MIN_MOVING_KMH) dt else 0L
        distanceM += acceptedDistance
        movingMs += max(0L, movingDelta)
        speedKmh = liveKmh
        if (accuracy <= TOP_SPEED_MAX_ACCURACY_M && liveKmh >= MIN_MOVING_KMH) topKmh = max(topKmh, liveKmh)
        lastFix = current
        lastStatus = if (acceptedDistance > 0.0) "Tracking • GPS ±${accuracy.toInt()} m" else "Stationary drift filtered • ±${accuracy.toInt()} m"
        persistSnapshot()
        refreshNotification()
    }

    @Deprecated("Deprecated in API 29; kept for pre-29 LocationListener compatibility")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit

    override fun onProviderEnabled(provider: String) = Unit

    override fun onProviderDisabled(provider: String) {
        if (!active) return
        speedKmh = 0.0
        lastStatus = "GPS provider unavailable • keep Location enabled"
        persistSnapshot()
        refreshNotification()
    }

    private fun startLocationUpdates() {
        if (!hasLocationPermission()) return
        stopLocationUpdates()
        val providers = buildList {
            if (runCatching { locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) }.getOrDefault(false)) add(LocationManager.GPS_PROVIDER)
            if (runCatching { locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) }.getOrDefault(false)) add(LocationManager.NETWORK_PROVIDER)
        }
        providers.forEach { provider ->
            runCatching {
                locationManager.requestLocationUpdates(provider, 1_000L, 0f, this, Looper.getMainLooper())
            }
        }
        if (providers.isEmpty()) lastStatus = "Location providers are disabled"
    }

    private fun stopLocationUpdates() {
        runCatching { locationManager.removeUpdates(this) }
    }

    private fun ensureForeground() {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0
        ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), type)
        foregroundStarted = true
    }

    private fun refreshNotification() {
        if (!foregroundStarted) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification())
    }

    private fun buildNotification(): android.app.Notification {
        val openApp = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val toggleAction = if (paused) ACTION_RESUME else ACTION_PAUSE
        val toggleLabel = if (paused) "Resume" else "Pause"
        val toggle = PendingIntent.getService(
            this,
            1,
            Intent(this, NexusDriveForegroundService::class.java).setAction(toggleAction),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val stop = PendingIntent.getService(
            this,
            2,
            Intent(this, NexusDriveForegroundService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val state = if (paused) "Paused" else "Tracking"
        val line = "${speedKmh.toInt()} km/h • ${formatDistance(distanceM)} • ${formatDuration(activeDuration(System.currentTimeMillis()))}"
        val detail = if (accuracyM.isFinite()) "GPS ±${accuracyM.toInt()} m • coordinates not stored" else "Precision GPS • coordinates not stored"

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("Nova Drive • $state")
            .setContentText(line)
            .setSubText(detail)
            .setContentIntent(openApp)
            .setOngoing(active)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(0, toggleLabel, toggle)
            .addAction(0, "Stop", stop)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Nova Drive tracking",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Live speed, distance and trip time while Nova Drive is active"
            setShowBadge(false)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
    }

    private fun persistSnapshot(error: String? = null) {
        val now = System.currentTimeMillis()
        val snapshot = JSONObject()
            .put("native", true)
            .put("active", active)
            .put("paused", paused)
            .put("tripId", tripId)
            .put("startedAt", startedAt)
            .put("pausedMs", pausedMs + if (paused && pausedAt > 0L) max(0L, now - pausedAt) else 0L)
            .put("distanceM", finiteOrZero(distanceM))
            .put("movingMs", movingMs)
            .put("durationMs", activeDuration(now))
            .put("speedKmh", finiteOrZero(speedKmh))
            .put("topKmh", finiteOrZero(topKmh))
            .put("accuracy", if (accuracyM.isFinite()) accuracyM else JSONObject.NULL)
            .put("heading", if (headingDeg.isFinite()) headingDeg else JSONObject.NULL)
            .put("status", error ?: lastStatus)
            .put("updatedAt", now)

        val completed = prefs().getString(KEY_COMPLETED, null)
        if (!completed.isNullOrBlank()) {
            runCatching { snapshot.put("completedTrip", JSONObject(completed)) }
        }
        if (!error.isNullOrBlank()) snapshot.put("error", error)
        prefs().edit().putString(KEY_SNAPSHOT, snapshot.toString()).apply()
    }

    private fun publishError(message: String) {
        active = false
        lastStatus = message
        persistSnapshot(message)
    }

    private fun clearCompletedTrip() {
        prefs().edit().remove(KEY_COMPLETED).apply()
    }

    private fun prefs() = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun activeDuration(now: Long): Long {
        if (startedAt <= 0L) return 0L
        val currentPause = if (paused && pausedAt > 0L) max(0L, now - pausedAt) else 0L
        return max(0L, now - startedAt - pausedMs - currentPause)
    }

    private fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    private fun finiteOrZero(value: Double): Double = if (value.isFinite()) value else 0.0
    private fun clamp(value: Double, minValue: Double, maxValue: Double) = max(minValue, min(maxValue, value))
    private fun normalizeHeading(value: Double): Double = ((value % 360.0) + 360.0) % 360.0

    private fun formatDistance(meters: Double): String {
        val km = max(0.0, meters) / 1000.0
        return if (km < 10.0) String.format(java.util.Locale.US, "%.2f km", km) else String.format(java.util.Locale.US, "%.1f km", km)
    }

    private fun formatDuration(ms: Long): String {
        val total = max(0L, ms / 1000L)
        val h = total / 3600L
        val m = (total % 3600L) / 60L
        val s = total % 60L
        return if (h > 0L) String.format(java.util.Locale.US, "%02d:%02d:%02d", h, m, s) else String.format(java.util.Locale.US, "%02d:%02d", m, s)
    }

    companion object {
        const val ACTION_START = "com.nexusnova.app.drive.START"
        const val ACTION_PAUSE = "com.nexusnova.app.drive.PAUSE"
        const val ACTION_RESUME = "com.nexusnova.app.drive.RESUME"
        const val ACTION_STOP = "com.nexusnova.app.drive.STOP"
        const val ACTION_STATUS = "com.nexusnova.app.drive.STATUS"

        private const val PREFS_NAME = "nexusnova_native_drive_v1"
        private const val KEY_SNAPSHOT = "snapshot"
        private const val KEY_COMPLETED = "completed_trip"
        private const val CHANNEL_ID = "nova_drive_tracking"
        private const val NOTIFICATION_ID = 260826
        private const val MAX_DRIVE_KMH = 240.0
        private const val MAX_GPS_ACCURACY_M = 40.0
        private const val TOP_SPEED_MAX_ACCURACY_M = 20.0
        private const val MAX_FIX_GAP_MS = 25_000L
        private const val MIN_FIX_GAP_MS = 350L
        private const val MIN_MOVING_KMH = 2.5
        private const val MIN_SAVED_TRIP_M = 15.0
        private const val MIN_SAVED_MOVING_MS = 3_000L

        fun start(context: Context) {
            ContextCompat.startForegroundService(
                context,
                Intent(context, NexusDriveForegroundService::class.java).setAction(ACTION_START)
            )
        }

        fun command(context: Context, action: String) {
            val intent = Intent(context, NexusDriveForegroundService::class.java).setAction(action)
            runCatching { context.startService(intent) }
        }

        fun readSnapshot(context: Context): JSONObject {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val raw = prefs.getString(KEY_SNAPSHOT, null)
            if (!raw.isNullOrBlank()) {
                runCatching { return JSONObject(raw) }
            }
            return JSONObject()
                .put("native", true)
                .put("active", false)
                .put("paused", false)
                .put("distanceM", 0)
                .put("movingMs", 0)
                .put("durationMs", 0)
                .put("speedKmh", 0)
                .put("topKmh", 0)
                .put("status", "Ready")
        }
    }
}
