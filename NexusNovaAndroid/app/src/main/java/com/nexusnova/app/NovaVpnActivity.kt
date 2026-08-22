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
import kotlin.math.roundToInt

class NovaVpnActivity : AppCompatActivity() {

    private lateinit var manager: NovaVpnManager
    private var authToken = ""
    private var pendingServerId: String? = null
    private var lastServerSignature = ""

    private lateinit var statusPill: LinearLayout
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
        window.statusBarColor = COLOR_BACKGROUND
        window.navigationBarColor = COLOR_BACKGROUND
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
        val sidePad = responsiveSidePaddingDp()
        val scroll = ScrollView(this).apply {
            setBackgroundColor(COLOR_BACKGROUND)
            isFillViewport = true
            overScrollMode = View.OVER_SCROLL_NEVER
        }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(sidePad), dp(14), dp(sidePad), dp(30))
        }
        scroll.addView(
            root,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        root.addView(buildHeader())
        root.addView(space(14))
        root.addView(buildHero())
        root.addView(space(10))
        root.addView(buildStatsCard())
        root.addView(space(17))

        val serverHead = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(2), 0, dp(2), 0)
        }
        serverHead.addView(eyebrow("SECURE LOCATION"))
        serverHead.addView(space(3))
        serverHead.addView(label("Choose the fastest verified node", 16f, COLOR_TEXT, true))
        serverHead.addView(space(5))
        serverSummary = label("Checking production server catalog…", 9f, COLOR_TEXT_3, true).apply {
            letterSpacing = 0.055f
        }
        serverHead.addView(serverSummary)
        root.addView(serverHead)

        root.addView(space(10))
        val actions = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        smartButton = primaryButton("SMART PICK").apply { setOnClickListener { manager.selectRecommended() } }
        val refreshButton = secondaryButton("REFRESH").apply { setOnClickListener { manager.refreshCatalog() } }
        actions.addView(smartButton, LinearLayout.LayoutParams(0, dp(46), 1f).apply { marginEnd = dp(7) })
        actions.addView(refreshButton, LinearLayout.LayoutParams(0, dp(46), 1f))
        root.addView(actions)

        root.addView(space(10))
        serverList = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(serverList)

        root.addView(space(8))
        root.addView(buildActionPanel())
        root.addView(space(10))
        root.addView(buildPrivacyCard())

        return scroll
    }

    private fun buildHeader(): View {
        val top = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        top.addView(
            textButton("‹", compact = true).apply { setOnClickListener { finish() } },
            LinearLayout.LayoutParams(dp(44), dp(44))
        )
        top.addView(
            brandMark(46, 15, 21f),
            LinearLayout.LayoutParams(dp(46), dp(46)).apply { marginStart = dp(10) }
        )
        val titleBox = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(10), 0, 0, 0)
        }
        titleBox.addView(eyebrow("SECURITY & SYSTEM"))
        titleBox.addView(label("Nova VPN", 23f, COLOR_TEXT, true))
        titleBox.addView(label("Full-device WireGuard protection", 10f, COLOR_TEXT_3, false))
        top.addView(titleBox, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        return top
    }

    private fun buildHero(): View {
        val hero = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(18), dp(18), dp(18), dp(18))
            background = gradientPanel(
                intArrayOf(COLOR_HERO_START, COLOR_HERO_END),
                COLOR_BORDER_BLUE,
                24
            )
            elevation = dp(2).toFloat()
        }

        hero.addView(
            brandOrb(),
            LinearLayout.LayoutParams(dp(92), dp(92))
        )
        hero.addView(space(13))

        statusPill = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(dp(11), dp(6), dp(11), dp(6))
            background = rounded(COLOR_CYAN_WASH, COLOR_CYAN_BORDER, 10)
        }
        statusDot = View(this).apply { background = circle(COLOR_TEXT_3) }
        statusPill.addView(
            statusDot,
            LinearLayout.LayoutParams(dp(8), dp(8)).apply { marginEnd = dp(8) }
        )
        statusTitle = label("DISCONNECTED", 10f, COLOR_TEXT, true).apply { letterSpacing = 0.075f }
        statusPill.addView(statusTitle)
        hero.addView(statusPill)

        hero.addView(space(14))
        hero.addView(label("Private. Fast. Full-device.", 22f, COLOR_TEXT, true).apply {
            gravity = Gravity.CENTER
        })
        hero.addView(space(7))
        hero.addView(label(
            "Nova VPN protects NexusNova, browsers and other phone apps through one encrypted tunnel.",
            11f,
            COLOR_TEXT_2,
            false
        ).apply {
            gravity = Gravity.CENTER
            setLineSpacing(0f, 1.35f)
        })
        hero.addView(space(13))
        statusMessage = label("Loading secure network status…", 10f, COLOR_CYAN, false).apply {
            gravity = Gravity.CENTER
            setLineSpacing(0f, 1.3f)
        }
        hero.addView(statusMessage)

        hero.addView(space(15))
        val capabilities = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        capabilities.addView(capability("PROTOCOL", "WireGuard"), weightedParams(endMargin = 6))
        capabilities.addView(capability("ROUTING", "IPv4 + IPv6"), weightedParams(endMargin = 6))
        capabilities.addView(capability("DNS", "Tunnel DNS"), weightedParams())
        hero.addView(capabilities, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        return hero
    }

    private fun buildStatsCard(): View {
        val stats = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(10), dp(12), dp(10), dp(12))
            background = rounded(COLOR_SURFACE_STRONG, COLOR_BORDER, 18)
        }
        stats.addView(metric("PROTOCOL", "WireGuard"), weightedParams())
        rxValue = valueLabel("0 B")
        stats.addView(metricWithValue("RECEIVED", rxValue), weightedParams())
        txValue = valueLabel("0 B")
        stats.addView(metricWithValue("SENT", txValue), weightedParams())
        return stats
    }

    private fun buildActionPanel(): View {
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), dp(12), dp(12), dp(12))
            background = gradientPanel(
                intArrayOf(COLOR_ACTION_START, COLOR_ACTION_END),
                COLOR_BORDER,
                18
            )
        }
        connectButton = primaryButton("CONNECT FULL DEVICE VPN").apply { setOnClickListener { connectSelected() } }
        panel.addView(connectButton, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(54)))
        panel.addView(space(8))
        val secondaryRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        disconnectButton = secondaryButton("DISCONNECT").apply { setOnClickListener { manager.disconnect() } }
        val settingsButton = secondaryButton("VPN SETTINGS").apply {
            setOnClickListener {
                runCatching { startActivity(Intent(Settings.ACTION_VPN_SETTINGS)) }
                    .onFailure {
                        Toast.makeText(
                            this@NovaVpnActivity,
                            "VPN settings are unavailable on this device.",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
            }
        }
        secondaryRow.addView(disconnectButton, LinearLayout.LayoutParams(0, dp(46), 1f).apply { marginEnd = dp(7) })
        secondaryRow.addView(settingsButton, LinearLayout.LayoutParams(0, dp(46), 1f))
        panel.addView(secondaryRow)
        return panel
    }

    private fun buildPrivacyCard(): View {
        val privacy = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(13), dp(12), dp(13), dp(12))
            background = rounded(COLOR_SURFACE_SOFT, COLOR_BORDER, 16)
        }
        privacy.addView(eyebrow("ON-DEVICE KEY DESIGN"))
        privacy.addView(space(4))
        privacy.addView(label(
            "A fresh WireGuard client key is generated on-device for each provisioned session. NexusNova does not bundle public shared VPN private keys.",
            10f,
            COLOR_TEXT_2,
            false
        ).apply { setLineSpacing(0f, 1.4f) })
        return privacy
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
        val stateLabel = when (snapshot.phase) {
            "loading" -> "CHECKING SERVERS"
            "connecting" -> "CONNECTING"
            "connected" -> "PROTECTED"
            "disconnecting" -> "DISCONNECTING"
            "error" -> "ATTENTION"
            else -> if (snapshot.state == Tunnel.State.UP) "PROTECTED" else "DISCONNECTED"
        }
        val stateColor = when {
            snapshot.state == Tunnel.State.UP -> COLOR_GREEN
            snapshot.phase == "error" -> COLOR_RED
            snapshot.phase in setOf("loading", "connecting", "disconnecting") -> COLOR_CYAN
            else -> COLOR_TEXT_3
        }
        statusTitle.text = stateLabel
        statusTitle.setTextColor(if (snapshot.state == Tunnel.State.UP) COLOR_GREEN else COLOR_TEXT)
        statusDot.background = circle(stateColor)
        statusPill.background = rounded(
            when {
                snapshot.state == Tunnel.State.UP -> COLOR_GREEN_WASH
                snapshot.phase == "error" -> COLOR_RED_WASH
                else -> COLOR_CYAN_WASH
            },
            when {
                snapshot.state == Tunnel.State.UP -> COLOR_GREEN_BORDER
                snapshot.phase == "error" -> COLOR_RED_BORDER
                else -> COLOR_CYAN_BORDER
            },
            10
        )
        statusMessage.text = snapshot.message
        statusMessage.setTextColor(
            when {
                snapshot.state == Tunnel.State.UP -> COLOR_GREEN
                snapshot.phase == "error" -> COLOR_RED
                else -> COLOR_CYAN
            }
        )
        rxValue.text = formatBytes(snapshot.rxBytes)
        txValue.text = formatBytes(snapshot.txBytes)

        val measured = snapshot.servers.count { it.latencyMs != null }
        serverSummary.text = if (snapshot.servers.isEmpty()) {
            "PRODUCTION SERVERS • NONE AVAILABLE"
        } else {
            "${snapshot.servers.size} AVAILABLE • $measured LATENCY CHECKED"
        }

        val busy = snapshot.phase in setOf("loading", "connecting", "disconnecting")
        smartButton.isEnabled = !busy && snapshot.recommendedServerId != null
        connectButton.isEnabled = !busy && snapshot.selectedServerId != null && authToken.isNotBlank() && snapshot.state != Tunnel.State.UP
        disconnectButton.isEnabled = !busy && snapshot.state == Tunnel.State.UP
        smartButton.alpha = if (smartButton.isEnabled) 1f else 0.58f
        connectButton.alpha = if (connectButton.isEnabled) 1f else 0.58f
        disconnectButton.alpha = if (disconnectButton.isEnabled) 1f else 0.58f
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
            val empty = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(14), dp(14), dp(14), dp(14))
                background = rounded(COLOR_SURFACE_STRONG, COLOR_BORDER, 16)
                addView(label("No production server available", 13f, COLOR_TEXT, true))
                addView(space(5))
                addView(label(
                    "Nova VPN only displays servers returned by the verified production catalog.",
                    10f,
                    COLOR_TEXT_2,
                    false
                ))
            }
            serverList.addView(empty)
            return
        }

        snapshot.servers.forEach { server ->
            val selected = server.id == snapshot.selectedServerId
            val recommended = server.id == snapshot.recommendedServerId
            val item = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(13), dp(12), dp(13), dp(12))
                background = if (selected) {
                    gradientPanel(intArrayOf(COLOR_SELECTED_START, COLOR_SELECTED_END), COLOR_CYAN_BORDER_STRONG, 17)
                } else {
                    gradientPanel(intArrayOf(COLOR_SERVER_START, COLOR_SERVER_END), COLOR_BORDER, 17)
                }
                isClickable = true
                isFocusable = true
                setOnClickListener { manager.selectServer(server.id) }
            }

            val line = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
            }
            val identity = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
            identity.addView(label(server.name, 13f, COLOR_TEXT, true))
            identity.addView(space(3))
            identity.addView(label(
                listOf(server.city, server.country).filter { it.isNotBlank() }.joinToString(", "),
                9f,
                COLOR_TEXT_2,
                false
            ))
            line.addView(identity, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))

            val latencyText = server.latencyMs?.let { "$it ms" } ?: "—"
            val latencyBox = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.END
                addView(label("LATENCY", 7f, COLOR_TEXT_3, true).apply { letterSpacing = 0.1f })
                addView(space(3))
                addView(label(latencyText, 11f, if (server.latencyMs != null) COLOR_CYAN else COLOR_TEXT_3, true))
            }
            line.addView(latencyBox)
            item.addView(line)

            val flags = buildList {
                if (recommended) add("SMART PICK")
                if (selected) add("SELECTED")
            }
            if (flags.isNotEmpty()) {
                item.addView(space(8))
                item.addView(label(flags.joinToString("  •  "), 8f, if (selected) COLOR_CYAN else COLOR_TEXT_3, true).apply {
                    letterSpacing = 0.07f
                })
            }
            serverList.addView(
                item,
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { bottomMargin = dp(8) }
            )
        }
    }

    private fun brandMark(sizeDp: Int, radiusDp: Int, textSp: Float): TextView = label("N", textSp, COLOR_LOGO_TEXT, true).apply {
        gravity = Gravity.CENTER
        letterSpacing = -0.08f
        background = gradientPanel(intArrayOf(COLOR_LOGO_START, COLOR_LOGO_END), COLOR_LOGO_BORDER, radiusDp)
        elevation = dp(2).toFloat()
    }

    private fun brandOrb(): TextView = label("N", 32f, COLOR_ORB_TEXT, true).apply {
        gravity = Gravity.CENTER
        letterSpacing = -0.08f
        background = GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            intArrayOf(COLOR_ORB_START, COLOR_SURFACE_STRONG, COLOR_ACTION_END)
        ).apply {
            shape = GradientDrawable.OVAL
            setStroke(dp(1), COLOR_CYAN_BORDER_STRONG)
        }
        elevation = dp(4).toFloat()
    }

    private fun capability(title: String, value: String): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setPadding(dp(5), dp(9), dp(5), dp(9))
        background = rounded(COLOR_CAPABILITY, COLOR_BORDER_SOFT, 13)
        addView(label(title, 7f, COLOR_TEXT_3, true).apply {
            gravity = Gravity.CENTER
            letterSpacing = 0.1f
        })
        addView(space(4))
        addView(label(value, 9f, COLOR_TEXT, true).apply {
            gravity = Gravity.CENTER
            maxLines = 1
        })
    }

    private fun metric(title: String, value: String): LinearLayout = metricWithValue(title, valueLabel(value))

    private fun metricWithValue(title: String, value: TextView): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        addView(label(title, 7f, COLOR_TEXT_3, true).apply { letterSpacing = 0.09f })
        addView(space(5))
        addView(value)
    }

    private fun valueLabel(value: String): TextView = label(value, 12f, COLOR_TEXT, true).apply {
        maxLines = 1
    }

    private fun eyebrow(text: String): TextView = label(text, 9f, COLOR_CYAN, true).apply {
        letterSpacing = 0.12f
    }

    private fun label(text: String, sp: Float, color: Int, bold: Boolean): TextView = TextView(this).apply {
        this.text = text
        textSize = sp
        setTextColor(color)
        setLineSpacing(0f, 1.15f)
        if (bold) setTypeface(typeface, Typeface.BOLD)
    }

    private fun primaryButton(text: String): Button = textButton(text).apply {
        background = gradientPanel(intArrayOf(COLOR_ACTION_START, COLOR_ACTION_END), COLOR_PRIMARY_BORDER, 14)
        setTextColor(COLOR_TEXT)
    }

    private fun secondaryButton(text: String): Button = textButton(text).apply {
        background = rounded(COLOR_SURFACE_STRONG, COLOR_BORDER, 13)
        setTextColor(COLOR_TEXT)
    }

    private fun textButton(text: String, compact: Boolean = false): Button = Button(this).apply {
        this.text = text
        textSize = if (compact) 27f else 10f
        isAllCaps = false
        setTypeface(typeface, Typeface.BOLD)
        setTextColor(COLOR_TEXT)
        background = rounded(COLOR_SURFACE_STRONG, COLOR_BORDER, 14)
        stateListAnimator = null
        minWidth = 0
        minHeight = 0
        gravity = Gravity.CENTER
        if (!compact) letterSpacing = 0.07f
        setPadding(if (compact) 0 else dp(10), 0, if (compact) 0 else dp(10), 0)
    }

    private fun rounded(fill: Int, stroke: Int, radiusDp: Int): GradientDrawable = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(radiusDp).toFloat()
        setColor(fill)
        setStroke(dp(1), stroke)
    }

    private fun gradientPanel(colors: IntArray, stroke: Int, radiusDp: Int): GradientDrawable = GradientDrawable(
        GradientDrawable.Orientation.TL_BR,
        colors
    ).apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(radiusDp).toFloat()
        setStroke(dp(1), stroke)
    }

    private fun circle(fill: Int): GradientDrawable = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(fill)
    }

    private fun weightedParams(endMargin: Int = 0): LinearLayout.LayoutParams = LinearLayout.LayoutParams(
        0,
        LinearLayout.LayoutParams.WRAP_CONTENT,
        1f
    ).apply { marginEnd = dp(endMargin) }

    private fun space(heightDp: Int): View = View(this).apply {
        layoutParams = LinearLayout.LayoutParams(1, dp(heightDp))
    }

    private fun responsiveSidePaddingDp(): Int {
        val widthDp = resources.configuration.screenWidthDp.takeIf { it > 0 } ?: 360
        return (widthDp * 0.04f).coerceIn(14f, 22f).roundToInt()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).roundToInt()

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

        // Exact NexusNova web design tokens mirrored for the native VPN surface.
        private val COLOR_BACKGROUND = Color.rgb(5, 11, 20)       // --nx-bg #050b14
        private val COLOR_SURFACE_STRONG = Color.rgb(12, 26, 43)  // --nx-surface-strong #0c1a2b
        private val COLOR_TEXT = Color.rgb(245, 249, 255)          // --nx-text #f5f9ff
        private val COLOR_TEXT_2 = Color.rgb(173, 193, 215)        // --nx-text-2 #adc1d7
        private val COLOR_TEXT_3 = Color.rgb(110, 134, 159)        // --nx-text-3 #6e869f
        private val COLOR_CYAN = Color.rgb(66, 211, 255)           // --nx-cyan #42d3ff
        private val COLOR_GREEN = Color.rgb(39, 226, 164)          // --nx-green #27e2a4
        private val COLOR_RED = Color.rgb(255, 101, 119)           // --nx-red #ff6577

        private val COLOR_BORDER = Color.argb(31, 154, 204, 255)   // rgba(...,.12)
        private val COLOR_BORDER_SOFT = Color.argb(23, 154, 204, 255)
        private val COLOR_BORDER_BLUE = Color.argb(46, 86, 174, 255)
        private val COLOR_CYAN_BORDER = Color.argb(46, 66, 211, 255)
        private val COLOR_CYAN_BORDER_STRONG = Color.argb(92, 66, 211, 255)
        private val COLOR_PRIMARY_BORDER = Color.argb(97, 74, 201, 255)
        private val COLOR_GREEN_BORDER = Color.argb(82, 39, 226, 164)
        private val COLOR_RED_BORDER = Color.argb(77, 255, 101, 119)

        private val COLOR_CYAN_WASH = Color.argb(17, 66, 211, 255)
        private val COLOR_GREEN_WASH = Color.argb(18, 39, 226, 164)
        private val COLOR_RED_WASH = Color.argb(18, 255, 101, 119)
        private val COLOR_SURFACE_SOFT = Color.rgb(8, 20, 34)
        private val COLOR_CAPABILITY = Color.rgb(6, 17, 29)

        // Existing approved NexusNova premium gradient values.
        private val COLOR_HERO_START = Color.rgb(8, 21, 36)
        private val COLOR_HERO_END = Color.rgb(4, 11, 20)
        private val COLOR_ACTION_START = Color.rgb(13, 29, 46)
        private val COLOR_ACTION_END = Color.rgb(5, 14, 25)
        private val COLOR_SERVER_START = Color.rgb(8, 23, 40)
        private val COLOR_SERVER_END = Color.rgb(4, 13, 24)
        private val COLOR_SELECTED_START = Color.rgb(12, 43, 64)
        private val COLOR_SELECTED_END = Color.rgb(6, 20, 34)

        // Exact NexusNova auth-logo family.
        private val COLOR_LOGO_START = Color.rgb(10, 75, 131)
        private val COLOR_LOGO_END = Color.rgb(16, 39, 71)
        private val COLOR_LOGO_BORDER = Color.argb(89, 85, 213, 255)
        private val COLOR_LOGO_TEXT = Color.rgb(234, 255, 255)
        private val COLOR_ORB_START = Color.rgb(15, 52, 91)
        private val COLOR_ORB_TEXT = Color.rgb(139, 233, 255)
    }
}
