package com.nexusnova.app

import android.content.Context
import android.net.VpnService
import android.os.SystemClock
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel
import com.wireguard.config.Config
import com.wireguard.crypto.KeyPair
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.net.URL
import java.nio.charset.StandardCharsets
import java.util.concurrent.CopyOnWriteArraySet
import javax.net.ssl.HttpsURLConnection

class NovaVpnManager private constructor(context: Context) {

    data class Server(
        val id: String,
        val name: String,
        val country: String,
        val city: String,
        val healthUrl: String,
        val provisionUrl: String,
        val latencyMs: Long? = null
    )

    data class Snapshot(
        val phase: String,
        val state: Tunnel.State,
        val servers: List<Server>,
        val selectedServerId: String?,
        val recommendedServerId: String?,
        val rxBytes: Long,
        val txBytes: Long,
        val message: String
    )

    private data class Lease(
        val leaseId: String,
        val serverId: String,
        val revokeUrl: String,
        val revokeToken: String
    )

    private val appContext = context.applicationContext
    private val backend = GoBackend(appContext)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val listeners = CopyOnWriteArraySet<(Snapshot) -> Unit>()
    private val lock = Any()

    @Volatile private var phase = PHASE_IDLE
    @Volatile private var state = Tunnel.State.DOWN
    @Volatile private var servers: List<Server> = emptyList()
    @Volatile private var selectedServerId: String? = null
    @Volatile private var recommendedServerId: String? = null
    @Volatile private var message = "Nova VPN is ready. Refresh production servers to continue."
    @Volatile private var currentLease: Lease? = null

    private val tunnel = object : Tunnel {
        override fun getName(): String = TUNNEL_NAME

        override fun onStateChange(newState: Tunnel.State) {
            state = newState
            phase = if (newState == Tunnel.State.UP) PHASE_CONNECTED else PHASE_IDLE
            publish()
        }
    }

    fun addListener(listener: (Snapshot) -> Unit) {
        listeners.add(listener)
        listener(snapshot())
    }

    fun removeListener(listener: (Snapshot) -> Unit) {
        listeners.remove(listener)
    }

    fun refreshCatalog() {
        if (phase == PHASE_LOADING || phase == PHASE_CONNECTING || phase == PHASE_DISCONNECTING) return
        phase = PHASE_LOADING
        message = "Checking verified Nova VPN infrastructure…"
        publish()
        scope.launch {
            try {
                val catalog = fetchCatalog()
                val measured = measureServers(catalog)
                servers = measured
                recommendedServerId = measured
                    .filter { it.latencyMs != null }
                    .minByOrNull { it.latencyMs ?: Long.MAX_VALUE }
                    ?.id
                if (selectedServerId !in measured.map { it.id }) {
                    selectedServerId = recommendedServerId ?: measured.firstOrNull()?.id
                }
                phase = if (state == Tunnel.State.UP) PHASE_CONNECTED else PHASE_IDLE
                message = if (measured.isEmpty()) {
                    "Nova VPN client is ready, but no production VPN servers are provisioned yet."
                } else {
                    val measuredCount = measured.count { it.latencyMs != null }
                    "${measured.size} production server${if (measured.size == 1) "" else "s"} loaded • $measuredCount latency checked"
                }
            } catch (error: Exception) {
                phase = if (state == Tunnel.State.UP) PHASE_CONNECTED else PHASE_ERROR
                message = safeError("Could not load Nova VPN servers", error)
            }
            publish()
        }
    }

    fun selectServer(serverId: String) {
        val normalized = serverId.trim()
        if (normalized.isBlank() || servers.none { it.id == normalized }) return
        selectedServerId = normalized
        publish()
    }

    fun selectRecommended() {
        val recommended = recommendedServerId ?: return
        selectedServerId = recommended
        publish()
    }

    fun connect(serverId: String, authToken: String) {
        val normalizedId = serverId.trim()
        val token = authToken.trim()
        if (normalizedId.isBlank() || token.isBlank()) {
            phase = PHASE_ERROR
            message = "A verified NexusNova account is required before connecting."
            publish()
            return
        }
        if (token.length > MAX_AUTH_TOKEN_CHARS) {
            phase = PHASE_ERROR
            message = "Secure session token is invalid. Please reopen Nova VPN."
            publish()
            return
        }
        if (VpnService.prepare(appContext) != null) {
            phase = PHASE_ERROR
            message = "Android VPN permission is required before connecting."
            publish()
            return
        }
        if (phase == PHASE_CONNECTING || phase == PHASE_DISCONNECTING) return

        val server = servers.firstOrNull { it.id == normalizedId }
        if (server == null) {
            phase = PHASE_ERROR
            message = "Selected server is no longer available. Refresh the server list."
            publish()
            return
        }

        phase = PHASE_CONNECTING
        selectedServerId = server.id
        message = "Creating an encrypted WireGuard session with ${server.name}…"
        publish()

        scope.launch {
            try {
                val keyPair = KeyPair()
                val provision = provision(server, keyPair.publicKey.toBase64(), token)
                val config = buildConfig(keyPair.privateKey.toBase64(), provision)

                synchronized(lock) {
                    if (backend.getState(tunnel) == Tunnel.State.UP) {
                        backend.setState(tunnel, Tunnel.State.DOWN, null)
                    }
                    backend.setState(tunnel, Tunnel.State.UP, config)
                    currentLease = Lease(
                        leaseId = provision.optString("leaseId").trim(),
                        serverId = server.id,
                        revokeUrl = provision.optString("revokeUrl").trim(),
                        revokeToken = provision.optString("revokeToken").trim()
                    )
                }

                state = Tunnel.State.UP
                phase = PHASE_CONNECTED
                message = "Protected by ${server.name} • full-device WireGuard tunnel"
            } catch (error: Exception) {
                runCatching {
                    synchronized(lock) {
                        backend.setState(tunnel, Tunnel.State.DOWN, null)
                    }
                }
                currentLease = null
                state = Tunnel.State.DOWN
                phase = PHASE_ERROR
                message = safeError("Nova VPN could not connect", error)
            }
            publish()
        }
    }

    fun disconnect() {
        if (phase == PHASE_DISCONNECTING || state == Tunnel.State.DOWN) {
            if (state == Tunnel.State.DOWN) {
                phase = PHASE_IDLE
                message = "Nova VPN is disconnected."
                publish()
            }
            return
        }
        phase = PHASE_DISCONNECTING
        message = "Closing encrypted tunnel…"
        publish()

        scope.launch {
            val lease = currentLease
            try {
                synchronized(lock) {
                    backend.setState(tunnel, Tunnel.State.DOWN, null)
                    currentLease = null
                }
                state = Tunnel.State.DOWN
                phase = PHASE_IDLE
                message = "Nova VPN is disconnected."
                if (lease != null) revokeLeaseBestEffort(lease)
            } catch (error: Exception) {
                phase = PHASE_ERROR
                message = safeError("Nova VPN could not disconnect cleanly", error)
            }
            publish()
        }
    }

    fun snapshot(): Snapshot {
        var rx = 0L
        var tx = 0L
        if (state == Tunnel.State.UP) {
            runCatching {
                val stats = synchronized(lock) { backend.getStatistics(tunnel) }
                rx = stats.totalRx()
                tx = stats.totalTx()
            }
        }
        return Snapshot(
            phase = phase,
            state = state,
            servers = servers,
            selectedServerId = selectedServerId,
            recommendedServerId = recommendedServerId,
            rxBytes = rx,
            txBytes = tx,
            message = message
        )
    }

    fun publish() {
        val value = snapshot()
        listeners.forEach { listener -> runCatching { listener(value) } }
    }

    private fun fetchCatalog(): List<Server> {
        val json = getJson(CATALOG_URL, MAX_CATALOG_BYTES)
        if (json.optInt("version") != 1) throw IllegalStateException("Unsupported server catalog version.")
        if (!json.optString("protocol").equals("wireguard", ignoreCase = true)) {
            throw IllegalStateException("Server catalog protocol mismatch.")
        }
        if (!json.optString("routing").equals("full-tunnel", ignoreCase = true)) {
            throw IllegalStateException("Server catalog is not approved for full-device routing.")
        }

        val array = json.optJSONArray("servers") ?: JSONArray()
        val result = ArrayList<Server>(array.length())
        val ids = HashSet<String>()
        for (index in 0 until array.length()) {
            val item = array.optJSONObject(index) ?: continue
            if (!item.optBoolean("enabled", true)) continue
            val id = item.optString("id").trim()
            val name = item.optString("name").trim()
            val country = item.optString("country").trim()
            val city = item.optString("city").trim()
            val healthUrl = item.optString("healthUrl").trim()
            val provisionUrl = item.optString("provisionUrl").trim()
            if (id.length !in 2..64 || !SERVER_ID_REGEX.matches(id) || !ids.add(id)) continue
            if (name.length !in 2..80 || country.length !in 2..80 || city.length !in 1..80) continue
            if (!isTrustedServiceUrl(healthUrl) || !isTrustedServiceUrl(provisionUrl)) continue
            result += Server(id, name, country, city, healthUrl, provisionUrl)
            if (result.size >= MAX_SERVERS) break
        }
        return result
    }

    private suspend fun measureServers(input: List<Server>): List<Server> = coroutineScope {
        input.map { server ->
            async(Dispatchers.IO) { server.copy(latencyMs = measureLatency(server.healthUrl)) }
        }.awaitAll().sortedWith(
            compareBy<Server> { it.latencyMs == null }
                .thenBy { it.latencyMs ?: Long.MAX_VALUE }
                .thenBy { it.name }
        )
    }

    private fun measureLatency(rawUrl: String): Long? {
        val connection = openTrustedHttps(rawUrl)
        return try {
            connection.requestMethod = "HEAD"
            connection.connectTimeout = HEALTH_CONNECT_TIMEOUT_MS
            connection.readTimeout = HEALTH_READ_TIMEOUT_MS
            connection.useCaches = false
            connection.instanceFollowRedirects = false
            val started = SystemClock.elapsedRealtimeNanos()
            val code = connection.responseCode
            val elapsed = (SystemClock.elapsedRealtimeNanos() - started) / 1_000_000L
            if (code in 200..399) elapsed.coerceAtLeast(1L) else null
        } catch (_: Exception) {
            null
        } finally {
            connection.disconnect()
        }
    }

    private fun provision(server: Server, clientPublicKey: String, authToken: String): JSONObject {
        val connection = openTrustedHttps(server.provisionUrl)
        return try {
            connection.requestMethod = "POST"
            connection.connectTimeout = PROVISION_CONNECT_TIMEOUT_MS
            connection.readTimeout = PROVISION_READ_TIMEOUT_MS
            connection.useCaches = false
            connection.doOutput = true
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.setRequestProperty("Authorization", "Bearer $authToken")

            val body = JSONObject()
                .put("serverId", server.id)
                .put("clientPublicKey", clientPublicKey)
                .put("platform", "android")
                .put("packageId", BuildConfig.APPLICATION_ID)
                .put("versionCode", BuildConfig.VERSION_CODE)
                .toString()
                .toByteArray(StandardCharsets.UTF_8)

            if (body.size > MAX_PROVISION_REQUEST_BYTES) throw IllegalStateException("Provision request is too large.")
            connection.setFixedLengthStreamingMode(body.size)
            connection.outputStream.use { it.write(body) }

            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.use { readLimited(it, MAX_PROVISION_RESPONSE_BYTES) }.orEmpty()
            if (code !in 200..299) throw IllegalStateException("Provisioning service returned HTTP $code.")
            val json = JSONObject(response)
            validateProvision(json, server)
            json
        } finally {
            connection.disconnect()
        }
    }

    private fun validateProvision(json: JSONObject, server: Server) {
        val leaseId = json.optString("leaseId").trim()
        val endpoint = json.optString("endpoint").trim()
        val serverPublicKey = json.optString("serverPublicKey").trim()
        val addresses = json.optJSONArray("clientAddresses") ?: throw IllegalStateException("VPN lease has no client addresses.")
        val dns = json.optJSONArray("dns") ?: throw IllegalStateException("VPN lease has no DNS servers.")
        val mtu = json.optInt("mtu", 0)
        val keepalive = json.optInt("persistentKeepalive", -1)

        if (leaseId.length !in 8..160) throw IllegalStateException("VPN lease ID is invalid.")
        if (endpoint.length !in 4..255) throw IllegalStateException("VPN endpoint is invalid.")
        if (serverPublicKey.length !in 40..60) throw IllegalStateException("VPN server key is invalid.")
        if (mtu !in 1280..1500) throw IllegalStateException("VPN MTU is outside the approved range.")
        if (keepalive !in 0..120) throw IllegalStateException("VPN keepalive value is invalid.")

        val addressList = jsonStringArray(addresses, 4)
        if (addressList.none { it.contains('.') } || addressList.none { it.contains(':') }) {
            throw IllegalStateException("VPN lease is not dual-stack; refusing a leak-prone full tunnel.")
        }
        if (jsonStringArray(dns, 4).isEmpty()) throw IllegalStateException("VPN DNS list is empty.")

        val returnedServerId = json.optString("serverId").trim()
        if (returnedServerId.isNotEmpty() && returnedServerId != server.id) {
            throw IllegalStateException("VPN lease server mismatch.")
        }
    }

    private fun buildConfig(privateKey: String, provision: JSONObject): Config {
        val addresses = jsonStringArray(provision.getJSONArray("clientAddresses"), 4)
        val dns = jsonStringArray(provision.getJSONArray("dns"), 4)
        val mtu = provision.getInt("mtu")
        val keepalive = provision.getInt("persistentKeepalive")
        val serverPublicKey = provision.getString("serverPublicKey").trim()
        val endpoint = provision.getString("endpoint").trim()

        val text = buildString {
            append("[Interface]\n")
            append("PrivateKey = ").append(privateKey).append('\n')
            append("Address = ").append(addresses.joinToString(", ")).append('\n')
            append("DNS = ").append(dns.joinToString(", ")).append('\n')
            append("MTU = ").append(mtu).append("\n\n")
            append("[Peer]\n")
            append("PublicKey = ").append(serverPublicKey).append('\n')
            append("Endpoint = ").append(endpoint).append('\n')
            append("AllowedIPs = 0.0.0.0/0, ::/0\n")
            append("PersistentKeepalive = ").append(keepalive).append('\n')
        }
        return Config.parse(ByteArrayInputStream(text.toByteArray(StandardCharsets.UTF_8)))
    }

    private fun revokeLeaseBestEffort(lease: Lease) {
        if (lease.revokeUrl.isBlank() || lease.revokeToken.isBlank() || !isTrustedServiceUrl(lease.revokeUrl)) return
        runCatching {
            val connection = openTrustedHttps(lease.revokeUrl)
            try {
                connection.requestMethod = "POST"
                connection.connectTimeout = REVOKE_TIMEOUT_MS
                connection.readTimeout = REVOKE_TIMEOUT_MS
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.setRequestProperty("Authorization", "Bearer ${lease.revokeToken}")
                val body = JSONObject()
                    .put("leaseId", lease.leaseId)
                    .put("serverId", lease.serverId)
                    .toString()
                    .toByteArray(StandardCharsets.UTF_8)
                connection.setFixedLengthStreamingMode(body.size)
                connection.outputStream.use { it.write(body) }
                connection.responseCode
            } finally {
                connection.disconnect()
            }
        }
    }

    private fun getJson(rawUrl: String, limit: Int): JSONObject {
        val connection = openTrustedHttps(rawUrl)
        return try {
            connection.requestMethod = "GET"
            connection.connectTimeout = CATALOG_CONNECT_TIMEOUT_MS
            connection.readTimeout = CATALOG_READ_TIMEOUT_MS
            connection.useCaches = false
            connection.setRequestProperty("Accept", "application/json")
            val code = connection.responseCode
            if (code !in 200..299) throw IllegalStateException("Server catalog returned HTTP $code.")
            JSONObject(connection.inputStream.use { readLimited(it, limit) })
        } finally {
            connection.disconnect()
        }
    }

    private fun openTrustedHttps(rawUrl: String): HttpsURLConnection {
        if (!isTrustedServiceUrl(rawUrl)) throw IllegalStateException("Untrusted Nova VPN service URL.")
        return URL(rawUrl).openConnection() as HttpsURLConnection
    }

    private fun isTrustedServiceUrl(rawUrl: String): Boolean {
        return try {
            val url = URL(rawUrl)
            val host = url.host.lowercase()
            url.protocol.equals("https", ignoreCase = true) &&
                url.port in listOf(-1, 443) &&
                (host == TRUSTED_SERVICE_HOST || host.endsWith(".$TRUSTED_SERVICE_HOST"))
        } catch (_: Exception) {
            false
        }
    }

    private fun readLimited(input: java.io.InputStream, limit: Int): String {
        val buffer = ByteArray(4096)
        val output = java.io.ByteArrayOutputStream()
        var total = 0
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            total += read
            if (total > limit) throw IllegalStateException("Nova VPN response exceeded its safety limit.")
            output.write(buffer, 0, read)
        }
        return output.toString(StandardCharsets.UTF_8.name())
    }

    private fun jsonStringArray(array: JSONArray, maxItems: Int): List<String> {
        val values = ArrayList<String>()
        for (index in 0 until minOf(array.length(), maxItems)) {
            val value = array.optString(index).trim()
            if (value.isNotBlank() && value.length <= 128) values += value
        }
        return values.distinct()
    }

    private fun safeError(prefix: String, error: Exception): String {
        val detail = error.message?.trim()?.take(160).orEmpty()
        return if (detail.isBlank()) "$prefix." else "$prefix: $detail"
    }

    companion object {
        private const val CATALOG_URL = "https://nexusnovatools.com/vpn/servers.json"
        private const val TRUSTED_SERVICE_HOST = "nexusnovatools.com"
        private const val TUNNEL_NAME = "NovaVPN"
        private const val PHASE_IDLE = "idle"
        private const val PHASE_LOADING = "loading"
        private const val PHASE_CONNECTING = "connecting"
        private const val PHASE_CONNECTED = "connected"
        private const val PHASE_DISCONNECTING = "disconnecting"
        private const val PHASE_ERROR = "error"

        private const val MAX_SERVERS = 24
        private const val MAX_AUTH_TOKEN_CHARS = 7000
        private const val MAX_CATALOG_BYTES = 96 * 1024
        private const val MAX_PROVISION_REQUEST_BYTES = 12 * 1024
        private const val MAX_PROVISION_RESPONSE_BYTES = 64 * 1024
        private const val CATALOG_CONNECT_TIMEOUT_MS = 5000
        private const val CATALOG_READ_TIMEOUT_MS = 5000
        private const val HEALTH_CONNECT_TIMEOUT_MS = 2500
        private const val HEALTH_READ_TIMEOUT_MS = 2500
        private const val PROVISION_CONNECT_TIMEOUT_MS = 7000
        private const val PROVISION_READ_TIMEOUT_MS = 12000
        private const val REVOKE_TIMEOUT_MS = 4000
        private val SERVER_ID_REGEX = Regex("[a-z0-9][a-z0-9-]{1,63}")

        @Volatile private var instance: NovaVpnManager? = null

        fun getInstance(context: Context): NovaVpnManager =
            instance ?: synchronized(this) {
                instance ?: NovaVpnManager(context).also { instance = it }
            }
    }
}
