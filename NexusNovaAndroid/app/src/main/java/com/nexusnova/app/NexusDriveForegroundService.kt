package com.nexusnova.app

import android.Manifest
import android.annotation.SuppressLint
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
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityRecognitionResult
import com.google.android.gms.location.DetectedActivity
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/**
 * Smart native Nova Drive tracker.
 *
 * Tracking is armed by opening Nova Drive. Trips then start/pause/resume/end
 * automatically from activity-recognition + precision GPS evidence.
 * Coordinates stay in memory only; persisted records are aggregate trip stats.
 */
class NexusDriveForegroundService : Service(), LocationListener {

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var locationManager: LocationManager

    private var armed = false
    private var active = false
    private var paused = false
    private var tripId = ""
    private var tripMode = MODE_UNKNOWN
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
    private var stationarySince = 0L
    private var lastStatus = "Ready"
    private var foregroundStarted = false

    private var activityType = DetectedActivity.UNKNOWN
    private var activityConfidence = 0
    private var activityUpdatesRegistered = false
    private var lastActivityRegistrationAttempt = 0L

    private var candidateMode = MODE_UNKNOWN
    private var candidateDistanceM = 0.0
    private var candidateMovingMs = 0L
    private var candidateStartedAt = 0L
    private var candidateConfirmations = 0

    private data class Fix(
        val lat: Double,
        val lon: Double,
        val accuracy: Double,
        val at: Long,
        val speedMps: Double
    )

    private val ticker = object : Runnable {
        override fun run() {
            if (!armed) return
            if (!activityUpdatesRegistered && System.currentTimeMillis() - lastActivityRegistrationAttempt >= 15_000L) {
                ensureActivityUpdates()
            }
            persistSnapshot()
            refreshNotification()
            handler.postDelayed(this, 1_000L)
        }
    }

    override fun onCreate() {
        super.onCreate()
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        createNotificationChannel()
        restoreSnapshot()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action ?: ACTION_STATUS) {
            ACTION_START -> armTracking()
            ACTION_PAUSE -> legacyPause()
            ACTION_RESUME -> legacyResume()
            ACTION_STOP -> disarmTracking(saveCurrent = true)
            ACTION_ACTIVITY_UPDATE -> intent?.let(::handleActivityUpdate)
            ACTION_STATUS -> {
                if (armed) {
                    ensureForeground()
                    startLocationUpdates()
                    ensureActivityUpdates()
                    handler.removeCallbacks(ticker)
                    handler.post(ticker)
                }
            }
        }
        return if (armed) START_STICKY else START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        if (armed) persistSnapshot()
        handler.removeCallbacks(ticker)
        stopLocationUpdates()
        removeActivityUpdates()
        super.onDestroy()
    }

    private fun restoreSnapshot() {
        val raw = prefs().getString(KEY_SNAPSHOT, null)
        if (raw.isNullOrBlank()) return
        val snapshot = runCatching { JSONObject(raw) }.getOrNull() ?: return
        armed = snapshot.optBoolean("armed", false)
        active = snapshot.optBoolean("active", false)
        paused = snapshot.optBoolean("paused", false)
        tripId = snapshot.optString("tripId", "")
        tripMode = normalizeMode(snapshot.optString("tripMode", MODE_UNKNOWN))
        startedAt = snapshot.optLong("startedAt", 0L)
        pausedMs = max(0L, snapshot.optLong("pausedMs", 0L))
        distanceM = snapshot.optDouble("distanceM", 0.0).safeNonNegative()
        movingMs = max(0L, snapshot.optLong("movingMs", 0L))
        topKmh = snapshot.optDouble("topKmh", 0.0).safeNonNegative()
        speedKmh = 0.0
        lastFix = null
        stationarySince = 0L

        if (active) {
            val now = System.currentTimeMillis()
            val updatedAt = snapshot.optLong("updatedAt", startedAt)
            val gap = max(0L, now - updatedAt)
            if (gap > RESTORE_AUTO_PAUSE_GAP_MS) {
                paused = true
                pausedAt = now
                pausedMs += gap
                lastStatus = "Trip restored • auto-paused after restart"
            } else {
                pausedAt = if (paused) now else 0L
                lastStatus = "Trip restored • checking movement"
            }
        } else if (armed) {
            lastStatus = "Smart tracking armed • waiting for vehicle movement"
        }
    }

    private fun armTracking() {
        if (!hasLocationPermission()) {
            publishError("Location permission is required for Nova Drive.")
            stopSelf()
            return
        }
        armed = true
        lastStatus = if (active) "Trip active • smart tracking restored" else "Smart tracking armed • walking is ignored"
        ensureForeground()
        startLocationUpdates()
        ensureActivityUpdates()
        requestActivityPermissionIfNeeded()
        handler.removeCallbacks(ticker)
        handler.post(ticker)
        persistSnapshot()
    }

    private fun disarmTracking(saveCurrent: Boolean) {
        val now = System.currentTimeMillis()
        if (active && saveCurrent) finishCurrentTrip(now, "Tracking switched off")
        armed = false
        active = false
        paused = false
        speedKmh = 0.0
        lastFix = null
        resetCandidate()
        stationarySince = 0L
        lastStatus = "Smart tracking off"
        handler.removeCallbacks(ticker)
        stopLocationUpdates()
        removeActivityUpdates()
        persistSnapshot()
        if (foregroundStarted) {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
            foregroundStarted = false
        }
        stopSelf()
    }

    private fun legacyPause() {
        if (!active || paused) return
        paused = true
        pausedAt = System.currentTimeMillis()
        speedKmh = 0.0
        lastStatus = "Trip paused"
        persistSnapshot()
    }

    private fun legacyResume() {
        if (!active || !paused) return
        val now = System.currentTimeMillis()
        pausedMs += max(0L, now - pausedAt)
        pausedAt = 0L
        paused = false
        stationarySince = 0L
        lastFix = null
        lastStatus = "Trip resumed • checking clean GPS movement"
        persistSnapshot()
    }

    override fun onLocationChanged(location: Location) {
        if (!armed) return

        val lat = location.latitude
        val lon = location.longitude
        val accuracy = location.accuracy.toDouble()
        val time = if (location.time > 0L) location.time else System.currentTimeMillis()
        if (!lat.isFinite() || !lon.isFinite() || !accuracy.isFinite()) return

        accuracyM = accuracy
        if (location.hasBearing()) headingDeg = normalizeHeading(location.bearing.toDouble())

        val sensorMps = if (location.hasSpeed()) location.speed.toDouble() else Double.NaN
        val safeSensorMps = if (sensorMps.isFinite() && sensorMps >= 0.0 && sensorMps * 3.6 <= MAX_DRIVE_KMH) sensorMps else Double.NaN
        val current = Fix(lat, lon, accuracy, time, safeSensorMps)
        val previous = lastFix

        if (accuracy > MAX_GPS_ACCURACY_M) {
            speedKmh = 0.0
            lastStatus = "Waiting for stronger GPS • ±${accuracy.toInt()} m"
            lastFix = current
            persistSnapshot()
            refreshNotification()
            return
        }

        if (previous == null) {
            lastFix = current
            speedKmh = if (safeSensorMps.isFinite()) safeSensorMps * 3.6 else 0.0
            lastStatus = if (active) "Trip active • GPS locked" else "Armed • checking movement pattern"
            persistSnapshot()
            refreshNotification()
            return
        }

        val dt = time - previous.at
        if (dt < MIN_FIX_GAP_MS) return
        if (dt > MAX_FIX_GAP_MS) {
            lastFix = current
            speedKmh = 0.0
            resetCandidate()
            lastStatus = "GPS gap ignored • smart tracking continues"
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
        speedKmh = liveKmh

        val footActivity = isFootActivity()
        if (!active) {
            evaluateTripStart(time, acceptedDistance, dt, liveKmh, footActivity)
            lastFix = current
            persistSnapshot()
            refreshNotification()
            return
        }

        evaluateActiveTrip(time, acceptedDistance, dt, liveKmh, footActivity)
        if (active && accuracy <= TOP_SPEED_MAX_ACCURACY_M && liveKmh >= MIN_MOVING_KMH) {
            topKmh = max(topKmh, liveKmh)
        }
        lastFix = current
        persistSnapshot()
        refreshNotification()
    }

    private fun evaluateTripStart(now: Long, acceptedDistance: Double, dt: Long, liveKmh: Double, footActivity: Boolean) {
        if (footActivity) {
            resetCandidate()
            speedKmh = 0.0
            lastStatus = when (activityType) {
                DetectedActivity.RUNNING -> "Running detected • not a Drive trip"
                else -> "Walking detected • not a Drive trip"
            }
            return
        }

        val mode = candidateModeFor(liveKmh)
        val threshold = if (mode == MODE_BICYCLE) BICYCLE_START_KMH else MOTOR_START_KMH
        val qualifies = mode != MODE_UNKNOWN && acceptedDistance > 0.0 && liveKmh >= threshold
        if (!qualifies) {
            if (liveKmh < 3.0 || acceptedDistance <= 0.0) resetCandidate()
            lastStatus = if (!hasActivityRecognitionPermission()) {
                "Armed • allow Motion permission for bicycle + walking detection"
            } else {
                "Armed • waiting for vehicle or bicycle movement"
            }
            return
        }

        if (candidateMode != mode) {
            resetCandidate()
            candidateMode = mode
            candidateStartedAt = max(1L, now - dt)
        }
        if (candidateStartedAt <= 0L) candidateStartedAt = max(1L, now - dt)
        candidateConfirmations += 1
        candidateDistanceM += acceptedDistance
        candidateMovingMs += max(0L, dt)

        val ready = when (mode) {
            MODE_BICYCLE -> candidateConfirmations >= 3 && candidateDistanceM >= 12.0 && candidateMovingMs >= 4_000L
            MODE_MOTOR -> candidateConfirmations >= 2 && candidateDistanceM >= 18.0 && candidateMovingMs >= 3_000L
            else -> false
        }
        if (ready) {
            startTrip(mode, now, liveKmh)
        } else {
            lastStatus = if (mode == MODE_BICYCLE) "Bicycle movement detected • confirming trip" else "Vehicle movement detected • confirming trip"
        }
    }

    private fun startTrip(mode: String, now: Long, liveKmh: Double) {
        tripId = "native-${System.currentTimeMillis()}-${UUID.randomUUID()}"
        tripMode = mode
        active = true
        paused = false
        startedAt = if (candidateStartedAt > 0L) candidateStartedAt else now
        pausedAt = 0L
        pausedMs = 0L
        distanceM = max(0.0, candidateDistanceM)
        movingMs = max(0L, candidateMovingMs)
        topKmh = max(0.0, liveKmh)
        stationarySince = 0L
        lastStatus = if (mode == MODE_BICYCLE) "Bicycle trip started automatically" else "Vehicle trip started automatically"
        resetCandidate()
    }

    private fun evaluateActiveTrip(now: Long, acceptedDistance: Double, dt: Long, liveKmh: Double, footActivity: Boolean) {
        if (footActivity) {
            speedKmh = 0.0
            markStationary(now)
            val stoppedFor = max(0L, now - stationarySince)
            if (stoppedFor >= HUMAN_EXIT_END_MS) {
                finishCurrentTrip(now, "Trip ended • walking detected")
            } else {
                lastStatus = "Walking detected after trip • checking trip end"
            }
            return
        }

        val meaningfulMove = acceptedDistance > 0.0 && liveKmh >= MIN_MOVING_KMH
        if (meaningfulMove) {
            if (paused) {
                pausedMs += max(0L, now - pausedAt)
                pausedAt = 0L
                paused = false
            }
            stationarySince = 0L
            distanceM += acceptedDistance
            // Moving time is added whenever clean distance is accepted. This keeps
            // average speed mathematically consistent with the saved distance.
            movingMs += max(0L, dt)
            lastStatus = if (tripMode == MODE_BICYCLE) "Bicycle trip • tracking" else "Vehicle trip • tracking"
            return
        }

        markStationary(now)
        val stoppedFor = max(0L, now - stationarySince)
        if (!paused && stoppedFor >= AUTO_PAUSE_AFTER_MS) {
            paused = true
            pausedAt = stationarySince
            speedKmh = 0.0
            lastStatus = "Auto-paused • waiting for movement"
        }
        if (stoppedFor >= AUTO_END_AFTER_MS) {
            finishCurrentTrip(now, "Trip auto-saved • destination reached")
        } else if (!paused) {
            lastStatus = "Short stop detected • trip remains active"
        }
    }

    private fun markStationary(now: Long) {
        if (stationarySince <= 0L) stationarySince = now
    }

    private fun finishCurrentTrip(now: Long, reason: String) {
        if (!active) return
        if (paused && pausedAt > 0L) {
            pausedMs += max(0L, now - pausedAt)
            pausedAt = 0L
        }
        paused = false
        speedKmh = 0.0

        val meaningfulDistance = if (tripMode == MODE_BICYCLE) MIN_SAVED_BICYCLE_M else MIN_SAVED_MOTOR_M
        val meaningfulTime = if (tripMode == MODE_BICYCLE) MIN_SAVED_BICYCLE_MS else MIN_SAVED_MOTOR_MS
        val meaningful = distanceM >= meaningfulDistance && movingMs >= meaningfulTime

        if (meaningful) {
            val avgKmh = if (movingMs > 0L) (distanceM / 1000.0) / (movingMs / 3_600_000.0) else 0.0
            val completed = JSONObject()
                .put("nativeId", tripId)
                .put("at", startedAt)
                .put("endedAt", now)
                .put("distanceM", finiteOrZero(distanceM))
                .put("movingMs", movingMs)
                .put("durationMs", movingMs)
                .put("elapsedMs", max(0L, now - startedAt))
                .put("topKmh", finiteOrZero(topKmh))
                .put("avgKmh", finiteOrZero(avgKmh))
                .put("mode", tripMode)
            enqueueCompletedTrip(completed)
            lastStatus = "$reason • armed for next trip"
        } else {
            lastStatus = "False/too-short movement ignored • armed for next trip"
        }

        active = false
        tripId = ""
        tripMode = MODE_UNKNOWN
        startedAt = 0L
        pausedMs = 0L
        distanceM = 0.0
        movingMs = 0L
        topKmh = 0.0
        stationarySince = 0L
        resetCandidate()
    }

    private fun candidateModeFor(liveKmh: Double): String {
        if (activityType == DetectedActivity.ON_BICYCLE && activityConfidence >= 35) return MODE_BICYCLE
        if (activityType == DetectedActivity.IN_VEHICLE && activityConfidence >= 35) return MODE_MOTOR

        // Fail-safe fallback: never infer a bicycle from GPS speed alone. Fast
        // running can overlap with bicycle speed, so bicycle auto-start requires
        // Activity Recognition evidence. With motion permission unavailable, only
        // unmistakably fast motor movement may start via GPS as a last resort.
        if (!hasActivityRecognitionPermission()) {
            return if (liveKmh >= GPS_FAILSAFE_MOTOR_KMH) MODE_MOTOR else MODE_UNKNOWN
        }

        // While Activity Recognition is warming up, retain only the same very-high
        // speed motor fallback. Walking/running stays out of Nova Drive history.
        return if (activityConfidence <= 0 && liveKmh >= GPS_FAILSAFE_MOTOR_KMH) MODE_MOTOR else MODE_UNKNOWN
    }

    private fun isFootActivity(): Boolean =
        activityConfidence >= 45 && (activityType == DetectedActivity.WALKING || activityType == DetectedActivity.RUNNING || activityType == DetectedActivity.ON_FOOT)

    private fun resetCandidate() {
        candidateMode = MODE_UNKNOWN
        candidateDistanceM = 0.0
        candidateMovingMs = 0L
        candidateStartedAt = 0L
        candidateConfirmations = 0
    }

    private fun handleActivityUpdate(intent: Intent) {
        val result = runCatching { ActivityRecognitionResult.extractResult(intent) }.getOrNull() ?: return
        val detected = result.mostProbableActivity ?: return
        activityType = detected.type
        activityConfidence = detected.confidence.coerceIn(0, 100)
        if (!active && isFootActivity()) resetCandidate()
        persistSnapshot()
        refreshNotification()
    }

    @SuppressLint("MissingPermission")
    private fun ensureActivityUpdates() {
        lastActivityRegistrationAttempt = System.currentTimeMillis()
        if (!armed || activityUpdatesRegistered || !hasActivityRecognitionPermission()) return
        runCatching {
            ActivityRecognition.getClient(this)
                .requestActivityUpdates(ACTIVITY_UPDATE_INTERVAL_MS, activityPendingIntent())
                .addOnSuccessListener { activityUpdatesRegistered = true }
                .addOnFailureListener { activityUpdatesRegistered = false }
        }
    }

    private fun removeActivityUpdates() {
        if (!activityUpdatesRegistered) return
        runCatching {
            ActivityRecognition.getClient(this).removeActivityUpdates(activityPendingIntent())
        }
        activityUpdatesRegistered = false
    }

    private fun activityPendingIntent(): PendingIntent {
        val mutable = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
        return PendingIntent.getService(
            this,
            ACTIVITY_REQUEST_CODE,
            Intent(this, NexusDriveForegroundService::class.java).setAction(ACTION_ACTIVITY_UPDATE),
            PendingIntent.FLAG_UPDATE_CURRENT or mutable
        )
    }

    private fun requestActivityPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || hasActivityRecognitionPermission()) return
        runCatching {
            startActivity(
                Intent(this, NexusDrivePermissionActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)
            )
        }
    }

    @Deprecated("Deprecated in API 29; kept for pre-29 LocationListener compatibility")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit

    override fun onProviderEnabled(provider: String) = Unit

    override fun onProviderDisabled(provider: String) {
        if (!armed) return
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
                locationManager.requestLocationUpdates(provider, 1_500L, 1f, this, Looper.getMainLooper())
            }
        }
        if (providers.isEmpty()) lastStatus = "Location providers are disabled"
    }

    private fun stopLocationUpdates() {
        runCatching { locationManager.removeUpdates(this) }
    }

    private fun ensureForeground() {
        if (foregroundStarted) return
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0
        ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), type)
        foregroundStarted = true
    }

    private fun refreshNotification() {
        if (!foregroundStarted) return
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIFICATION_ID, buildNotification())
    }

    private fun buildNotification(): android.app.Notification {
        val openApp = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val stopTracking = PendingIntent.getService(
            this,
            3,
            Intent(this, NexusDriveForegroundService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val state = when {
            active && paused -> "Auto-paused"
            active && tripMode == MODE_BICYCLE -> "Bicycle trip"
            active -> "Vehicle trip"
            armed -> "Armed"
            else -> "Off"
        }
        val line = if (active) {
            "${speedKmh.toInt()} km/h • ${formatDistance(distanceM)} • ${formatDuration(movingMs)}"
        } else {
            "Waiting for vehicle or bicycle movement"
        }
        val detail = "${activityLabel()}${if (activityConfidence > 0) " ${activityConfidence}%" else ""} • GPS ${if (accuracyM.isFinite()) "±${accuracyM.toInt()} m" else "ready"}"

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("Nova Drive • $state")
            .setContentText(line)
            .setSubText(detail)
            .setContentIntent(openApp)
            .setOngoing(armed)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(0, "Stop tracking", stopTracking)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Nova Drive smart tracking",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Automatic vehicle and bicycle trip detection"
            setShowBadge(false)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
    }

    private fun persistSnapshot(error: String? = null) {
        val now = System.currentTimeMillis()
        val avgKmh = if (movingMs > 0L) (distanceM / 1000.0) / (movingMs / 3_600_000.0) else 0.0
        val snapshot = JSONObject()
            .put("native", true)
            .put("armed", armed)
            .put("active", active)
            .put("paused", paused)
            .put("tripId", tripId)
            .put("tripMode", tripMode)
            .put("startedAt", startedAt)
            .put("pausedMs", pausedMs + if (paused && pausedAt > 0L) max(0L, now - pausedAt) else 0L)
            .put("distanceM", finiteOrZero(distanceM))
            .put("movingMs", movingMs)
            .put("durationMs", movingMs)
            .put("speedKmh", finiteOrZero(speedKmh))
            .put("topKmh", finiteOrZero(topKmh))
            .put("avgKmh", finiteOrZero(avgKmh))
            .put("accuracy", if (accuracyM.isFinite()) accuracyM else JSONObject.NULL)
            .put("heading", if (headingDeg.isFinite()) headingDeg else JSONObject.NULL)
            .put("activity", activityLabel())
            .put("activityConfidence", activityConfidence)
            .put("status", error ?: lastStatus)
            .put("updatedAt", now)
            .put("completedTrips", completedQueue())
        if (!error.isNullOrBlank()) snapshot.put("error", error)
        prefs().edit().putString(KEY_SNAPSHOT, snapshot.toString()).apply()
    }

    private fun publishError(message: String) {
        armed = false
        active = false
        lastStatus = message
        persistSnapshot(message)
    }

    private fun enqueueCompletedTrip(completed: JSONObject) {
        val queue = completedQueue()
        queue.put(completed)
        val trimmed = JSONArray()
        val start = max(0, queue.length() - MAX_COMPLETED_QUEUE)
        for (index in start until queue.length()) trimmed.put(queue.optJSONObject(index))
        prefs().edit().putString(KEY_COMPLETED_QUEUE, trimmed.toString()).apply()
    }

    private fun completedQueue(): JSONArray {
        val raw = prefs().getString(KEY_COMPLETED_QUEUE, null)
        return if (raw.isNullOrBlank()) JSONArray() else runCatching { JSONArray(raw) }.getOrDefault(JSONArray())
    }

    private fun prefs() = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    private fun hasActivityRecognitionPermission(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED

    private fun activityLabel(): String = when (activityType) {
        DetectedActivity.IN_VEHICLE -> "IN VEHICLE"
        DetectedActivity.ON_BICYCLE -> "BICYCLE"
        DetectedActivity.WALKING -> "WALKING"
        DetectedActivity.RUNNING -> "RUNNING"
        DetectedActivity.ON_FOOT -> "ON FOOT"
        DetectedActivity.STILL -> "STILL"
        DetectedActivity.TILTING -> "TILTING"
        else -> "SMART GPS"
    }

    private fun normalizeMode(value: String): String = when (value.lowercase()) {
        MODE_MOTOR -> MODE_MOTOR
        MODE_BICYCLE -> MODE_BICYCLE
        else -> MODE_UNKNOWN
    }

    private fun Double.safeNonNegative(): Double = if (isFinite() && this >= 0.0) this else 0.0
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
        private const val ACTION_ACTIVITY_UPDATE = "com.nexusnova.app.drive.ACTIVITY_UPDATE"

        private const val PREFS_NAME = "nexusnova_native_drive_v1"
        private const val KEY_SNAPSHOT = "snapshot"
        private const val KEY_COMPLETED_QUEUE = "completed_trip_queue"
        private const val CHANNEL_ID = "nova_drive_tracking"
        private const val NOTIFICATION_ID = 260826
        private const val ACTIVITY_REQUEST_CODE = 260827
        private const val MAX_COMPLETED_QUEUE = 20

        private const val MODE_UNKNOWN = "unknown"
        private const val MODE_MOTOR = "motor"
        private const val MODE_BICYCLE = "bicycle"

        private const val MAX_DRIVE_KMH = 240.0
        private const val MAX_GPS_ACCURACY_M = 45.0
        private const val TOP_SPEED_MAX_ACCURACY_M = 20.0
        private const val MAX_FIX_GAP_MS = 30_000L
        private const val MIN_FIX_GAP_MS = 350L
        private const val MIN_MOVING_KMH = 2.5
        private const val MOTOR_START_KMH = 5.0
        private const val BICYCLE_START_KMH = 4.0
        private const val GPS_FAILSAFE_MOTOR_KMH = 32.0

        private const val AUTO_PAUSE_AFTER_MS = 20_000L
        private const val AUTO_END_AFTER_MS = 4L * 60L * 1000L
        private const val HUMAN_EXIT_END_MS = 45_000L
        private const val RESTORE_AUTO_PAUSE_GAP_MS = 2L * 60L * 1000L
        private const val ACTIVITY_UPDATE_INTERVAL_MS = 5_000L

        private const val MIN_SAVED_MOTOR_M = 20.0
        private const val MIN_SAVED_MOTOR_MS = 3_000L
        private const val MIN_SAVED_BICYCLE_M = 12.0
        private const val MIN_SAVED_BICYCLE_MS = 4_000L

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
                .put("armed", false)
                .put("active", false)
                .put("paused", false)
                .put("distanceM", 0)
                .put("movingMs", 0)
                .put("durationMs", 0)
                .put("speedKmh", 0)
                .put("topKmh", 0)
                .put("avgKmh", 0)
                .put("activity", "SMART GPS")
                .put("activityConfidence", 0)
                .put("tripMode", MODE_UNKNOWN)
                .put("completedTrips", JSONArray())
                .put("status", "Ready")
        }
    }
}