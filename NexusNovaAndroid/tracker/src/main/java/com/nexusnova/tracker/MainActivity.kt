package com.nexusnova.tracker

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.InputFilter
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Space
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {
    private val prefs by lazy { getSharedPreferences(PREFS, MODE_PRIVATE) }
    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var statusText: TextView
    private lateinit var pairCode: EditText
    private lateinit var pairButton: Button
    private lateinit var startButton: Button
    private lateinit var stopButton: Button
    private lateinit var alwaysButton: Button
    private lateinit var vehicleText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(2, 10, 20)
        window.navigationBarColor = Color.rgb(2, 10, 20)
        setContentView(buildUi())
        refreshUi()
        requestForegroundPermissionsIfNeeded()
    }

    override fun onResume() {
        super.onResume()
        refreshUi()
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun buildUi(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(18), dp(22), dp(18), dp(18))
            setBackgroundColor(Color.rgb(2, 10, 20))
        }

        root.addView(TextView(this).apply {
            text = "NEXUSNOVA PRIVATE TELEMETRY"
            setTextColor(Color.rgb(83, 220, 255))
            textSize = 10f
            letterSpacing = .16f
        }, matchWrap())

        root.addView(TextView(this).apply {
            text = "Nova Vehicle Premium"
            setTextColor(Color.WHITE)
            textSize = 28f
            setPadding(0, dp(5), 0, 0)
        }, matchWrap())

        root.addView(TextView(this).apply {
            text = "Companion Tracker"
            setTextColor(Color.rgb(150, 166, 190))
            textSize = 13f
            setPadding(0, dp(3), 0, dp(18))
        }, matchWrap())

        vehicleText = TextView(this).apply {
            textSize = 15f
            setTextColor(Color.rgb(220, 244, 255))
            setPadding(dp(14), dp(13), dp(14), dp(13))
            background = panelDrawable(Color.rgb(8, 31, 51), Color.rgb(35, 95, 128))
        }
        root.addView(vehicleText, matchWrap())

        statusText = TextView(this).apply {
            textSize = 12f
            setTextColor(Color.rgb(151, 182, 203))
            setPadding(dp(14), dp(12), dp(14), dp(12))
            background = panelDrawable(Color.rgb(5, 22, 38), Color.rgb(28, 68, 95))
        }
        root.addView(statusText, matchWrap(top = 9))

        root.addView(TextView(this).apply {
            text = "ONE-TIME PAIRING CODE"
            setTextColor(Color.rgb(113, 205, 241))
            textSize = 10f
            letterSpacing = .11f
            setPadding(0, dp(19), 0, dp(6))
        }, matchWrap())

        pairCode = EditText(this).apply {
            hint = "12-character code"
            setHintTextColor(Color.rgb(89, 111, 130))
            setTextColor(Color.WHITE)
            textSize = 20f
            gravity = Gravity.CENTER
            isSingleLine = true
            filters = arrayOf(InputFilter.LengthFilter(16))
            background = panelDrawable(Color.rgb(6, 25, 42), Color.rgb(67, 168, 215))
            setPadding(dp(12), dp(12), dp(12), dp(12))
        }
        root.addView(pairCode, matchWrap())

        pairButton = actionButton("PAIR THIS TRACKER", false).also { button ->
            button.setOnClickListener { claimPairing() }
        }
        root.addView(pairButton, matchWrap(top = 9))

        root.addView(Space(this), LinearLayout.LayoutParams(1, dp(10)))

        startButton = actionButton("START SECURE TRACKING", true).also { button ->
            button.setOnClickListener { startTracking() }
        }
        root.addView(startButton, matchWrap(top = 4))

        stopButton = actionButton("STOP TRACKING", false).also { button ->
            button.setOnClickListener { stopTracking() }
        }
        root.addView(stopButton, matchWrap(top = 8))

        alwaysButton = actionButton("ALLOW ALWAYS LOCATION", false).also { button ->
            button.setOnClickListener { requestAlwaysLocation() }
        }
        root.addView(alwaysButton, matchWrap(top = 8))

        root.addView(TextView(this).apply {
            text = "Keep this phone powered in the vehicle. Android will show the required foreground-service notification while tracking is active."
            setTextColor(Color.rgb(100, 126, 145))
            textSize = 10f
            gravity = Gravity.CENTER
            setPadding(dp(8), dp(18), dp(8), 0)
        }, matchWrap())

        return root
    }

    private fun claimPairing() {
        val code = pairCode.text?.toString().orEmpty().uppercase().replace("-", "").replace(" ", "")
        if (code.length != 12) {
            status("Enter the 12-character code shown in Nova Drive.", error = true)
            return
        }
        pairButton.isEnabled = false
        status("Securely claiming one-time pairing…")
        executor.execute {
            try {
                val connection = (URL(CLAIM_URL).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 15_000
                    readTimeout = 15_000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    setRequestProperty("Accept", "application/json")
                }
                val request = JSONObject()
                    .put("pairingCode", code)
                    .put("deviceLabel", "NexusNova Tracker ${Build.MODEL}")
                    .toString()
                connection.outputStream.use { it.write(request.toByteArray(Charsets.UTF_8)) }
                val responseCode = connection.responseCode
                val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                connection.disconnect()
                val json = JSONObject(body.ifBlank { "{}" })
                if (responseCode !in 200..299 || json.optBoolean("ok") != true) {
                    throw IllegalStateException("Pairing code is invalid, expired, or already used.")
                }
                val token = json.optString("token")
                val vehicleId = json.optString("vehicleId")
                val vehicleName = json.optString("vehicleName", "Vehicle")
                if (token.length != 64 || vehicleId.isBlank()) throw IllegalStateException("Pairing response was incomplete.")
                prefs.edit()
                    .putString(KEY_TOKEN, token)
                    .putString(KEY_VEHICLE_ID, vehicleId)
                    .putString(KEY_VEHICLE_NAME, vehicleName)
                    .apply()
                runOnUiThread {
                    pairCode.setText("")
                    status("Paired securely. Grant location, then tracking can stay active with the screen locked.")
                    refreshUi()
                    requestForegroundPermissionsIfNeeded()
                }
            } catch (error: Exception) {
                runOnUiThread { status(error.message ?: "Pairing failed.", error = true) }
            } finally {
                runOnUiThread { pairButton.isEnabled = true }
            }
        }
    }

    private fun startTracking() {
        val token = prefs.getString(KEY_TOKEN, "").orEmpty()
        if (token.length != 64) {
            status("Pair this tracker from Nova Drive first.", error = true)
            return
        }
        if (!hasFineLocation()) {
            requestForegroundPermissionsIfNeeded()
            status("Precise location permission is required before tracking starts.", error = true)
            return
        }
        prefs.edit().putBoolean(KEY_TRACKING_ENABLED, true).apply()
        val intent = Intent(this, NovaVehicleTrackerService::class.java).setAction(NovaVehicleTrackerService.ACTION_START)
        ContextCompat.startForegroundService(this, intent)
        status("Tracking active. You can lock the screen now.")
        refreshUi()
    }

    private fun stopTracking() {
        prefs.edit().putBoolean(KEY_TRACKING_ENABLED, false).apply()
        startService(Intent(this, NovaVehicleTrackerService::class.java).setAction(NovaVehicleTrackerService.ACTION_STOP))
        status("Tracking stopped on this device.")
        refreshUi()
    }

    private fun requestForegroundPermissionsIfNeeded() {
        val missing = mutableListOf<String>()
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            missing += Manifest.permission.ACCESS_FINE_LOCATION
            missing += Manifest.permission.ACCESS_COARSE_LOCATION
        }
        if (Build.VERSION.SDK_INT >= 33 && ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            missing += Manifest.permission.POST_NOTIFICATIONS
        }
        if (missing.isNotEmpty()) ActivityCompat.requestPermissions(this, missing.distinct().toTypedArray(), REQ_FOREGROUND)
    }

    private fun requestAlwaysLocation() {
        if (Build.VERSION.SDK_INT < 29) {
            status("Always-location permission is already covered on this Android version.")
            return
        }
        if (!hasFineLocation()) {
            requestForegroundPermissionsIfNeeded()
            status("Grant precise location first, then enable Always location.")
            return
        }
        if (Build.VERSION.SDK_INT == 29) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION), REQ_BACKGROUND)
        } else {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName"))
            startActivity(intent)
            status("In Permissions → Location, choose Allow all the time for reboot recovery.")
        }
    }

    private fun refreshUi() {
        if (!::vehicleText.isInitialized) return
        val token = prefs.getString(KEY_TOKEN, "").orEmpty()
        val name = prefs.getString(KEY_VEHICLE_NAME, "Vehicle").orEmpty().ifBlank { "Vehicle" }
        val tracking = prefs.getBoolean(KEY_TRACKING_ENABLED, false)
        val paired = token.length == 64
        vehicleText.text = if (paired) "✓ $name • secure device paired" else "No vehicle paired yet"
        startButton.isEnabled = paired && !tracking
        stopButton.isEnabled = paired && tracking
        pairButton.text = if (paired) "PAIR / REPLACE VEHICLE" else "PAIR THIS TRACKER"
        alwaysButton.visibility = if (Build.VERSION.SDK_INT >= 29) View.VISIBLE else View.GONE
        if (tracking) status("Tracker enabled • foreground GPS will continue after screen lock.")
    }

    private fun hasFineLocation(): Boolean =
        ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    private fun status(message: String, error: Boolean = false) {
        if (!::statusText.isInitialized) return
        statusText.text = message
        statusText.setTextColor(if (error) Color.rgb(255, 164, 174) else Color.rgb(151, 205, 222))
    }

    private fun actionButton(label: String, primary: Boolean): Button = Button(this).apply {
        text = label
        isAllCaps = false
        textSize = 12f
        setTextColor(if (primary) Color.rgb(4, 20, 32) else Color.rgb(218, 244, 255))
        background = if (primary) {
            panelDrawable(Color.rgb(67, 213, 255), Color.rgb(92, 116, 255), dp(14).toFloat())
        } else {
            panelDrawable(Color.rgb(9, 39, 62), Color.rgb(49, 99, 132), dp(14).toFloat())
        }
        minHeight = dp(48)
    }

    private fun panelDrawable(fill: Int, stroke: Int, radius: Float = dp(16).toFloat()): GradientDrawable =
        GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = radius
            setColor(fill)
            setStroke(dp(1), stroke)
        }

    private fun matchWrap(top: Int = 0): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(top)
        }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    companion object {
        const val PREFS = "nova_vehicle_tracker_v1"
        const val KEY_TOKEN = "device_token"
        const val KEY_VEHICLE_ID = "vehicle_id"
        const val KEY_VEHICLE_NAME = "vehicle_name"
        const val KEY_TRACKING_ENABLED = "tracking_enabled"
        private const val CLAIM_URL = "https://us-central1-nexusnova-6ade2.cloudfunctions.net/claimNovaVehiclePairing"
        private const val REQ_FOREGROUND = 301
        private const val REQ_BACKGROUND = 302
    }
}
