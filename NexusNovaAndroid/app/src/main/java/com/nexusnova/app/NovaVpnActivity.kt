package com.nexusnova.app

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.VpnService
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.wireguard.android.backend.Tunnel
import java.util.Locale

class NovaVpnActivity : AppCompatActivity() {

    private lateinit var manager: NovaVpnManager
    private var authToken = ""
    private var pendingServerId: String? = null
    private var lastServerSignature = ""

    private lateinit var statusDot: View
    private lateinit var statusTitle: TextView
    private lateinit var statusMessage: TextView
    private lateinit var serverSummary: TextView
    private lateinit var rxValue: TextView
    private lateinit var txValue: TextView
    private lateinit var connectButton: Button
    private lateinit var disconnectButton: Button
    private lateinit var smartButton: Button
    private lateinit var serverList: LinearLayout

    private val handler = Handler(Looper.getMainLooper())
    private val managerListener: (NovaVpnManager.Snapshot) -> Unit = { snapshot ->
        runOnUiThread { render(snapshot) }
    }
    private val statsTicker = object : Runnable {
        override fun run() {
            if (!isFinishing && !isDestroyed) {
                manager.publish()
                handler.postDelayed(this, STATS_REFRESH_MS)
            }
        }
    }

    private val vpnPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val serverId = pendingServerId
        pendingServerId = null
        if (result.resultCode == RESULT_OK && !serverId.isNullOrBlank()) {
            manager.connect(serverId, authToken)
        } else {
            Toast.makeText(this, "VPN permission was not granted.", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        authToken = intent.getStringExtra(EXTRA_AUTH_TOKEN).orEmpty().trim().take(MAX_AUTH_TOKEN_CHARS)
        manager = NovaVpnManager.getInstance(applicationContext)
        setContentView(buildContent())
        manager.addListener(managerListener)
        manager.refreshCatalog()
        handler.post(statsTicker)
    }

    override fun onDestroy() {
        handler.removeCallbacks(statsTicker)
        if (this::manager.isInitialized) manager.removeListener(managerListener)
        pendingServerId = null
        authToken = ""
        super.onDestroy()
    }

    private fun buildContent(): View {
        val scroll = ScrollView(this).apply {
            setBackgroundColor(COLOR_BACKGROUND)
            isFillViewport = true
        }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(18), dp(18), dp(30))
        }
        scroll.addView(root, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

        val top = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        top.addView(textButton("‹", compact = true).apply { setOnClickListener { finish() } }, LinearLayout.LayoutParams(dp(48), dp(48)))
        val titleBox = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), 0, 0, 0)
        }
        titleBox.addView(label("NOVA VPN", 24f, COLOR_TEXT, true))
        titleBox.addView(label("SYSTEM-WIDE WIREGUARD", 11f, COLOR_MUTED, true))
        top.addView(titleBox, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        root.addView(top)

        root.addView(space(14))
        val hero = card().apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(20), dp(20), dp(20))
        }
        val stateRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        statusDot = View(this).apply { background = circle(COLOR_MUTED) }
        stateRow.addView(statusDot, LinearLayout.LayoutParams(dp(11), dp(11)).apply { marginEnd = dp(10) })
        statusTitle = label("DISCONNECTED", 13f, COLOR_TEXT, true)
        stateRow.addView(statusTitle)
        hero.addView(stateRow)
        hero.addView(space(14))
        hero.addView(label("Encrypted protection for the whole phone", 21f, COLOR_TEXT, true))
        hero.addView(space(8))
        hero.addView(label("When connected, Nova VPN routes Chrome, Firefox and other phone apps through the encrypted tunnel — not only NexusNova.", 14f, COLOR_MUTED, false))
        hero.addView(space(16))
        statusMessage = label("Loading secure network status…", 13f, COLOR_CYAN, false)
        hero.addView(statusMessage)
        root.addView(hero)

        root.addView(space(14))
        val stats = card().apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(16), dp(15), dp(16), dp(15))
        }
        stats.addView(metric("PROTOCOL", "WireGuard"), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        rxValue = valueLabel("0 B")
        stats.addView(metricWithValue("RECEIVED", rxValue), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        txValue = valueLabel("0 B")
        stats.addView(metricWithValue("SENT", txValue), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        root.addView(stats)

        root.addView(space(14))
        serverSummary = label("Checking production server catalog…", 13f, COLOR_MUTED, false)
        root.addView(serverSummary)
        root.addView(space(10))

        val actions = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        smartButton = primaryButton("SMART PICK").apply { setOnClickListener { manager.selectRecommended() } }
        val refreshButton = secondaryButton("REFRESH").apply { setOnClickListener { manager.refreshCatalog() } }
        actions.addView(smartButton, LinearLayout.LayoutParams(0, dp(48), 1f).apply { marginEnd = dp(8) })
        actions.addView(refreshButton, LinearLayout.LayoutParams(0, dp(48), 1f))
        root.addView(actions)

        root.addView(space(12))
        serverList = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(serverList)

        root.addView(space(16))
        connectButton = primaryButton("CONNECT").apply { setOnClickListener { connectSelected() } }
        root.addView(connectButton, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(54)))
        root.addView(space(9))
        disconnectButton = secondaryButton("DISCONNECT").apply { setOnClickListener { manager.disconnect() } }
        root.addView(disconnectButton, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)))
        root.addView(space(9))
        root.addView(secondaryButton("ANDROID VPN SETTINGS / KILL SWITCH").apply {
            setOnClickListener {
                runCatching { startActivity(Intent(Settings.ACTION_VPN_SETTINGS)) }
                    .onFailure { Toast.makeText(this@NovaVpnActivity, "VPN settings are unavailable on this device.", Toast.LENGTH_SHORT).show() }
            }
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)))

        root.addView(space(14))
        root.addView(label("Privacy design: Nova VPN does not ship public/shared private keys. A fresh WireGuard client key is generated on-device for each provisioned session. Production servers must be owned or explicitly controlled by NexusNova.", 12f, COLOR_MUTED, false))

        return scroll
    }

    private fun connectSelected() {
        val snapshot = manager.snapshot()
        val serverId = snapshot.selectedServerId
        if (serverId.isNullOrBlank()) {
            Toast.makeText(this, "No production VPN server is available yet.", Toast.LENGTH_SHORT).show()
            return
        }
        if (authToken.isBlank()) {
            Toast.makeText(this, "Reopen Nova VPN from a verified NexusNova account.", Toast.LENGTH_LONG).show()
            return
        }
        val permissionIntent = VpnService.prepare(this)
        if (permissionIntent != null) {
            pendingServerId = serverId
            vpnPermissionLauncher.launch(permissionIntent)
        } else {
            manager.connect(serverId, authToken)
        }
    }

    private fun render(snapshot: NovaVpnManager.Snapshot) {
        statusTitle.text = when (snapshot.phase) {
            "loading" -> "CHECKING SERVERS"
            "connecting" -> "CONNECTING"
            "connected" -> "PROTECTED"
            "disconnecting" -> "DISCONNECTING"
            "error" -> "ATTENTION"
            else -> if (snapshot.state == Tunnel.State.UP) "PROTECTED" else "DISCONNECTED"
        }
        statusDot.background = circle(
            when {
                snapshot.state == Tunnel.State.UP -> COLOR_GREEN
                snapshot.phase == "error" -> COLOR_RED
                snapshot.phase in setOf("loading", "connecting", "disconnecting") -> COLOR_CYAN
                else -> COLOR_MUTED
            }
        )
        statusMessage.text = snapshot.message
        rxValue.text = formatBytes(snapshot.rxBytes)
        txValue.text = formatBytes(snapshot.txBytes)

        val measured = snapshot.servers.count { it.latencyMs != null }
        serverSummary.text = if (snapshot.servers.isEmpty()) {
            "PRODUCTION SERVERS • NONE PROVISIONED"
        } else {
            "PRODUCTION SERVERS • ${snapshot.servers.size} AVAILABLE • $measured LATENCY CHECKED"
        }

        val busy = snapshot.phase in setOf("loading", "connecting", "disconnecting")
        smartButton.isEnabled = !busy && snapshot.recommendedServerId != null
        connectButton.isEnabled = !busy && snapshot.selectedServerId != null && authToken.isNotBlank() && snapshot.state != Tunnel.State.UP
        disconnectButton.isEnabled = !busy && snapshot.state == Tunnel.State.UP
        connectButton.text = if (snapshot.phase == "connecting") "CONNECTING…" else "CONNECT FULL DEVICE VPN"
        disconnectButton.text = if (snapshot.phase == "disconnecting") "DISCONNECTING…" else "DISCONNECT"

        val signature = buildString {
            append(snapshot.selectedServerId).append('|').append(snapshot.recommendedServerId)
            snapshot.servers.forEach { append('|').append(it.id).append(':').append(it.latencyMs ?: -1) }
        }
        if (signature != lastServerSignature) {
            lastServerSignature = signature
            renderServers(snapshot)
        }
    }

    private fun renderServers(snapshot: NovaVpnManager.Snapshot) {
        serverList.removeAllViews()
        if (snapshot.servers.isEmpty()) {
            val empty = card().apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(16), dp(16), dp(16), dp(16))
                addView(label("No fake servers shown", 15f, COLOR_TEXT, true))
                addView(space(6))
                addView(label("The Nova VPN client is installed, but the production catalog is intentionally empty until real WireGuard infrastructure is provisioned.", 13f, COLOR_MUTED, false))
            }
            serverList.addView(empty)
            return
        }

        snapshot.servers.forEach { server ->
            val selected = server.id == snapshot.selectedServerId
            val recommended = server.id == snapshot.recommendedServerId
            val item = card(selected).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(16), dp(15), dp(16), dp(15))
                isClickable = true
                isFocusable = true
                setOnClickListener { manager.selectServer(server.id) }
            }
            val line = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
            }
            line.addView(label(server.name, 16f, COLOR_TEXT, true), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            val latency = server.latencyMs?.let { "$it ms" } ?: "not measured"
            line.addView(label(latency, 12f, if (server.latencyMs != null) COLOR_CYAN else COLOR_MUTED, true))
            item.addView(line)
            item.addView(space(5))
            val badges = buildList {
                add(listOf(server.city, server.country).filter { it.isNotBlank() }.joinToString(", "))
                if (recommended) add("SMART PICK")
                if (selected) add("SELECTED")
            }.filter { it.isNotBlank() }.joinToString("  •  ")
            item.addView(label(badges, 12f, if (selected) COLOR_CYAN else COLOR_MUTED, false))
            serverList.addView(item, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(9) })
        }
    }

    private fun card(selected: Boolean = false): LinearLayout = LinearLayout(this).apply {
        background = rounded(if (selected) COLOR_PANEL_SELECTED else COLOR_PANEL, if (selected) COLOR_CYAN else COLOR_BORDER)
        elevation = dp(1).toFloat()
    }

    private fun metric(title: String, value: String): LinearLayout = metricWithValue(title, valueLabel(value))

    private fun metricWithValue(title: String, value: TextView): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        addView(label(title, 10f, COLOR_MUTED, true))
        addView(space(5))
        addView(value)
    }

    private fun valueLabel(value: String): TextView = label(value, 14f, COLOR_TEXT, true)

    private fun label(text: String, sp: Float, color: Int, bold: Boolean): TextView = TextView(this).apply {
        this.text = text
        textSize = sp
        setTextColor(color)
        setLineSpacing(0f, 1.15f)
        if (bold) setTypeface(typeface, Typeface.BOLD)
    }

    private fun primaryButton(text: String): Button = textButton(text).apply {
        background = rounded(COLOR_CYAN_DARK, COLOR_CYAN)
        setTextColor(Color.WHITE)
    }

    private fun secondaryButton(text: String): Button = textButton(text).apply {
        background = rounded(COLOR_PANEL, COLOR_BORDER)
        setTextColor(COLOR_TEXT)
    }

    private fun textButton(text: String, compact: Boolean = false): Button = Button(this).apply {
        this.text = text
        textSize = if (compact) 24f else 12f
        isAllCaps = false
        setTypeface(typeface, Typeface.BOLD)
        setTextColor(COLOR_TEXT)
        background = rounded(COLOR_PANEL, COLOR_BORDER)
        stateListAnimator = null
        minWidth = 0
        minHeight = 0
        setPadding(if (compact) 0 else dp(12), 0, if (compact) 0 else dp(12), 0)
    }

    private fun rounded(fill: Int, stroke: Int): GradientDrawable = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(15).toFloat()
        setColor(fill)
        setStroke(dp(1), stroke)
    }

    private fun circle(fill: Int): GradientDrawable = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(fill)
    }

    private fun space(heightDp: Int): View = View(this).apply {
        layoutParams = LinearLayout.LayoutParams(1, dp(heightDp))
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun formatBytes(bytes: Long): String {
        val value = bytes.coerceAtLeast(0L).toDouble()
        val units = arrayOf("B", "KB", "MB", "GB", "TB")
        var amount = value
        var index = 0
        while (amount >= 1024.0 && index < units.lastIndex) {
            amount /= 1024.0
            index++
        }
        return if (index == 0) "${amount.toLong()} ${units[index]}" else String.format(Locale.US, "%.1f %s", amount, units[index])
    }

    companion object {
        const val EXTRA_AUTH_TOKEN = "nova_vpn_auth_token"
        private const val MAX_AUTH_TOKEN_CHARS = 7000
        private const val STATS_REFRESH_MS = 1200L

        private val COLOR_BACKGROUND = Color.rgb(2, 6, 12)
        private val COLOR_PANEL = Color.rgb(8, 17, 28)
        private val COLOR_PANEL_SELECTED = Color.rgb(7, 29, 38)
        private val COLOR_BORDER = Color.rgb(31, 51, 68)
        private val COLOR_TEXT = Color.rgb(238, 247, 255)
        private val COLOR_MUTED = Color.rgb(135, 158, 177)
        private val COLOR_CYAN = Color.rgb(0, 224, 255)
        private val COLOR_CYAN_DARK = Color.rgb(0, 92, 112)
        private val COLOR_GREEN = Color.rgb(54, 232, 151)
        private val COLOR_RED = Color.rgb(255, 94, 114)
    }
}
