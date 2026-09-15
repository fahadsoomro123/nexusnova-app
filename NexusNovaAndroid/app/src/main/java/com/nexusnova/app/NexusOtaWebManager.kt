package com.nexusnova.app

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceResponse
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest
import java.util.concurrent.Executors

/**
 * Atomic differential web OTA layered over the signed bundled web baseline.
 *
 * An OTA can explicitly block bundled asset paths. A blocked path is consumed by
 * this interceptor and returns an intentional 404, preventing WebViewAssetLoader
 * from resurrecting an obsolete bundled asset.
 */
class NexusOtaWebManager(context: Context) {
    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val versionsRoot = File(appContext.filesDir, "nexusnova-ota-web/versions")

    init {
        runCatching {
            appContext.getSharedPreferences("nexusnova_ota_web_v1", Context.MODE_PRIVATE)
                .edit().clear().apply()
            appContext.getSharedPreferences("nexusnova_ota_web_v2_stable", Context.MODE_PRIVATE)
                .edit().clear().apply()
        }

        val storedBase = prefs.getString(KEY_BUNDLED_BASE, "")?.trim()?.lowercase().orEmpty()
        if (storedBase != BUNDLED_WEB_BASE) {
            runCatching { versionsRoot.deleteRecursively() }
            prefs.edit()
                .clear()
                .putString(KEY_BUNDLED_BASE, BUNDLED_WEB_BASE)
                .apply()
            android.util.Log.i(TAG, "Reset OTA overlay for bundled base $BUNDLED_WEB_BASE")
        }
    }

    fun intercept(uri: Uri): WebResourceResponse? {
        if (!uri.scheme.equals("https", ignoreCase = true)) return null
        if (!uri.host.equals(ASSET_HOST, ignoreCase = true)) return null
        val path = uri.path ?: return null
        if (!path.startsWith(ASSET_PATH)) return null

        val relativePath = normalizeAssetPath(path.removePrefix(ASSET_PATH)) ?: return null
        val active = activeVersion().takeIf { it.isNotBlank() } ?: return null
        val root = File(versionsRoot, active)
        val file = safeChild(root, relativePath)

        if (file?.isFile == true) {
            return try {
                WebResourceResponse(
                    mimeTypeFor(relativePath),
                    textEncodingFor(relativePath),
                    FileInputStream(file)
                )
            } catch (_: Exception) {
                null
            }
        }

        if (isBlocked(relativePath)) {
            return blockedResponse()
        }

        return null
    }

    fun checkForUpdate(onComplete: (Boolean) -> Unit) {
        EXECUTOR.execute {
            var updated = false
            var lastError: Throwable? = null
            for (attempt in 1..UPDATE_CHECK_ATTEMPTS) {
                try {
                    updated = checkForUpdateBlocking(attempt)
                    lastError = null
                    if (updated) break
                } catch (error: Throwable) {
                    lastError = error
                    android.util.Log.w(TAG, "OTA check attempt $attempt/$UPDATE_CHECK_ATTEMPTS failed", error)
                }

                if (attempt < UPDATE_CHECK_ATTEMPTS) {
                    try {
                        Thread.sleep(UPDATE_RETRY_DELAY_MS)
                    } catch (_: InterruptedException) {
                        Thread.currentThread().interrupt()
                        break
                    }
                }
            }

            if (!updated && lastError != null) {
                android.util.Log.w(TAG, "OTA update unavailable after retries", lastError)
            }
            onComplete(updated)
        }
    }

    fun rollbackToBundled(): Boolean {
        val active = activeVersion()
        if (active.isBlank()) return false
        prefs.edit()
            .remove(KEY_ACTIVE_VERSION)
            .putString(KEY_BLOCKED_VERSION, active)
            .putString(KEY_BUNDLED_BASE, BUNDLED_WEB_BASE)
            .apply()
        runCatching { File(versionsRoot, active).deleteRecursively() }
        android.util.Log.w(TAG, "Rolled back OTA version $active to bundled assets")
        return true
    }

    fun activeVersion(): String = prefs.getString(KEY_ACTIVE_VERSION, "")?.trim().orEmpty()

    private fun checkForUpdateBlocking(attempt: Int): Boolean {
        val requestNonce = "${System.currentTimeMillis()}-$attempt"
        val manifestText = downloadText(
            addQuery(MANIFEST_URL, "n", requestNonce),
            MAX_MANIFEST_BYTES
        )
        val manifest = JSONObject(manifestText)
        if (manifest.optInt("schema", 0) != MANIFEST_SCHEMA) {
            throw IOException("Unsupported OTA manifest schema")
        }

        val base = manifest.optString("base").trim().lowercase()
        if (base != BUNDLED_WEB_BASE) throw IOException("OTA base mismatch")

        val version = manifest.optString("version").trim().lowercase()
        if (!VERSION_PATTERN.matches(version)) throw IOException("Invalid OTA version")
        if (version == activeVersion()) return false
        if (version == prefs.getString(KEY_BLOCKED_VERSION, "")?.trim()) return false

        data class Entry(val path: String, val sha256: String, val size: Long)
        val entries = parseFileEntries(manifest.optJSONArray("files"))
        if (entries.isEmpty()) throw IOException("OTA file list missing")
        if (entries.none { it.path == "index.html" }) throw IOException("OTA entry point missing")

        val blockedPaths = parseBlockedPaths(manifest)
        validateNoOverlap(entries, blockedPaths)

        versionsRoot.mkdirs()
        val staging = File(versionsRoot, ".staging-$version")
        if (staging.exists()) staging.deleteRecursively()
        if (!staging.mkdirs()) throw IOException("Could not create OTA staging directory")

        try {
            var actualTotal = 0L
            entries.forEach { entry ->
                val output = safeChild(staging, entry.path) ?: throw IOException("Unsafe OTA output path")
                output.parentFile?.mkdirs()
                val versionedUrl = addQuery(FILE_BASE_URL + encodePath(entry.path), "v", version)
                val url = addQuery(versionedUrl, "n", requestNonce)
                val written = downloadFile(url, output, entry.size)
                actualTotal += written
                if (actualTotal > MAX_TOTAL_BYTES) throw IOException("OTA package exceeded size limit")
                if (written != entry.size) throw IOException("OTA size mismatch for ${entry.path}")
                if (!sha256(output).equals(entry.sha256, ignoreCase = true)) {
                    throw IOException("OTA hash mismatch for ${entry.path}")
                }
            }

            writeBlockedPaths(staging, blockedPaths)

            val destination = File(versionsRoot, version)
            if (destination.exists()) destination.deleteRecursively()
            if (!staging.renameTo(destination)) throw IOException("Could not activate OTA package")

            prefs.edit()
                .putString(KEY_ACTIVE_VERSION, version)
                .putString(KEY_BUNDLED_BASE, BUNDLED_WEB_BASE)
                .remove(KEY_BLOCKED_VERSION)
                .apply()
            cleanupOldVersions(keep = version)
            android.util.Log.i(TAG, "Activated OTA web version $version with ${blockedPaths.size} blocked paths")
            return true
        } catch (error: Throwable) {
            staging.deleteRecursively()
            throw error
        }
    }

    private data class FileEntry(val path: String, val sha256: String, val size: Long)

    private fun parseFileEntries(filesJson: JSONArray?): List<FileEntry> {
        if (filesJson == null || filesJson.length() !in 1..MAX_FILE_COUNT) {
            throw IOException("Invalid OTA file count")
        }
        val entries = ArrayList<FileEntry>(filesJson.length())
        val seen = HashSet<String>(filesJson.length())
        var declaredTotal = 0L
        for (i in 0 until filesJson.length()) {
            val item = filesJson.optJSONObject(i) ?: throw IOException("Invalid OTA file entry")
            val path = normalizeManifestPath(item.optString("path"))
            val sha = item.optString("sha256").trim().lowercase()
            val size = item.optLong("size", -1L)
            if (!SHA256_PATTERN.matches(sha)) throw IOException("Invalid OTA hash")
            if (size !in 0..MAX_SINGLE_FILE_BYTES) throw IOException("Invalid OTA file size")
            if (!seen.add(path)) throw IOException("Duplicate OTA file path")
            declaredTotal += size
            if (declaredTotal > MAX_TOTAL_BYTES) throw IOException("OTA package too large")
            entries += FileEntry(path, sha, size)
        }
        return entries
    }

    private fun parseBlockedPaths(manifest: JSONObject): List<String> {
        val array = manifest.optJSONArray("blockedPaths") ?: manifest.optJSONArray("deletedFiles")
        if (array == null) return emptyList()
        if (array.length() > MAX_BLOCKED_PATH_COUNT) throw IOException("Too many blocked paths")
        val seen = HashSet<String>(array.length())
        val normalized = ArrayList<String>(array.length())
        for (i in 0 until array.length()) {
            val raw = array.optString(i, "")
            val path = normalizeManifestPath(raw)
            if (!isTravelSpecificPath(path)) throw IOException("Blocked path is not Travel-specific: $path")
            if (!seen.add(path)) throw IOException("Duplicate blocked path")
            normalized += path
        }
        normalized.sort()
        return normalized
    }

    private fun validateNoOverlap(entries: List<FileEntry>, blockedPaths: List<String>) {
        val files = entries.mapTo(HashSet()) { it.path }
        blockedPaths.forEach { path ->
            if (path in files) throw IOException("Path cannot be both OTA file and blocked: $path")
        }
    }

    private fun writeBlockedPaths(staging: File, blockedPaths: List<String>) {
        val metadata = File(staging, BLOCKLIST_FILE)
        metadata.writeText(blockedPaths.joinToString("\n", postfix = if (blockedPaths.isEmpty()) "" else "\n"), Charsets.UTF_8)
    }

    private fun blockedPathsForActive(): Set<String> {
        val active = activeVersion().takeIf { it.isNotBlank() } ?: return emptySet()
        val file = File(File(versionsRoot, active), BLOCKLIST_FILE)
        if (!file.isFile) return emptySet()
        return runCatching {
            file.readLines(Charsets.UTF_8)
                .filter { it.isNotBlank() }
                .map { normalizeRuntimePath(it) }
                .toSet()
        }.getOrDefault(emptySet())
    }

    private fun isBlocked(path: String): Boolean = path in blockedPathsForActive()

    private fun normalizeManifestPath(raw: String): String =
        normalizeAssetPath(raw.trim()) ?: throw IOException("Malformed OTA path")

    private fun normalizeRuntimePath(raw: String): String =
        normalizeAssetPath(raw.trim()) ?: throw IOException("Malformed active blocklist path")

    private fun normalizeAssetPath(raw: String): String? {
        if (raw.isBlank() || raw.startsWith('/') || raw.startsWith('\\')) return null
        if (raw.contains('\\') || raw.contains('\u0000')) return null
        val parts = raw.split('/')
        if (parts.any { it.isBlank() || it == "." || it == ".." }) return null
        return parts.joinToString("/")
    }

    private fun isSafeRelativePath(path: String): Boolean = normalizeAssetPath(path) != null

    private fun isTravelSpecificPath(path: String): Boolean {
        val p = path.lowercase()
        return p.startsWith("fresh-rebuild/src/features/apps/travel") ||
            p.startsWith("fresh-rebuild/src/features/travel") ||
            p.contains("travel-fare-lens") ||
            p.contains("fare-lens") ||
            p.contains("smart-travel") ||
            p.startsWith("travel/") ||
            p.startsWith("assets/travel/") ||
            p.startsWith("js/travel/") ||
            p.startsWith("css/travel/") ||
            p.startsWith("features/travel/")
    }

    private fun blockedResponse(): WebResourceResponse =
        WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", emptyMap(), "NexusNova OTA blocked resource".byteInputStream())

    private fun safeChild(root: File, relativePath: String): File? {
        return try {
            val canonicalRoot = root.canonicalFile
            val candidate = File(canonicalRoot, relativePath).canonicalFile
            val prefix = canonicalRoot.path + File.separator
            candidate.takeIf { it.path.startsWith(prefix) }
        } catch (_: IOException) {
            null
        }
    }

    private fun encodePath(path: String): String = path.split('/').joinToString("/") { segment ->
        URLEncoder.encode(segment, Charsets.UTF_8.name()).replace("+", "%20")
    }

    private fun addQuery(url: String, key: String, value: String): String =
        Uri.parse(url).buildUpon().appendQueryParameter(key, value).build().toString()

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered().use { input ->
            val buffer = ByteArray(16 * 1024)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun downloadText(url: String, maxBytes: Long): String {
        val connection = open(url)
        try {
            val length = connection.contentLengthLong
            if (length > maxBytes) throw IOException("Response too large")
            return connection.inputStream.use { input ->
                val buffer = ByteArray(8 * 1024)
                val output = java.io.ByteArrayOutputStream()
                var total = 0L
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    total += read
                    if (total > maxBytes) throw IOException("Response too large")
                    output.write(buffer, 0, read)
                }
                output.toByteArray().toString(Charsets.UTF_8)
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun downloadFile(url: String, output: File, expectedSize: Long): Long {
        val connection = open(url)
        try {
            val length = connection.contentLengthLong
            if (length > MAX_SINGLE_FILE_BYTES) throw IOException("OTA file too large")
            if (length >= 0L && length != expectedSize) throw IOException("OTA declared size mismatch")
            var total = 0L
            connection.inputStream.use { input ->
                output.outputStream().buffered().use { out ->
                    val buffer = ByteArray(16 * 1024)
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        total += read
                        if (total > MAX_SINGLE_FILE_BYTES || total > expectedSize) throw IOException("OTA file exceeded size limit")
                        out.write(buffer, 0, read)
                    }
                }
            }
            return total
        } finally {
            connection.disconnect()
        }
    }

    private fun open(url: String): HttpURLConnection {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = CONNECT_TIMEOUT_MS
        connection.readTimeout = READ_TIMEOUT_MS
        connection.instanceFollowRedirects = true
        connection.useCaches = false
        connection.defaultUseCaches = false
        connection.setRequestProperty("User-Agent", "NexusNova-Android-OTA/6")
        connection.setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0")
        connection.setRequestProperty("Pragma", "no-cache")
        connection.connect()
        if (connection.responseCode !in 200..299) {
            val code = connection.responseCode
            connection.disconnect()
            throw IOException("OTA HTTP $code")
        }
        return connection
    }

    private fun mimeTypeFor(path: String): String = when (path.substringAfterLast('.', "").lowercase()) {
        "html", "htm" -> "text/html"
        "js", "mjs" -> "text/javascript"
        "css" -> "text/css"
        "json" -> "application/json"
        "svg" -> "image/svg+xml"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        "webp" -> "image/webp"
        "gif" -> "image/gif"
        "ico" -> "image/x-icon"
        "woff" -> "font/woff"
        "woff2" -> "font/woff2"
        "ttf" -> "font/ttf"
        "pdf" -> "application/pdf"
        "txt" -> "text/plain"
        else -> "application/octet-stream"
    }

    private fun textEncodingFor(path: String): String? = when (path.substringAfterLast('.', "").lowercase()) {
        "html", "htm", "js", "mjs", "css", "json", "svg", "txt" -> "UTF-8"
        else -> null
    }

    private fun cleanupOldVersions(keep: String) {
        versionsRoot.listFiles()?.forEach { file ->
            if (file.name != keep && !file.name.startsWith(".staging-")) runCatching { file.deleteRecursively() }
        }
    }

    private companion object {
        const val TAG = "NexusNovaOTA"
        const val PREFS_NAME = "nexusnova_ota_web_v3_atomic"
        const val KEY_ACTIVE_VERSION = "active_version"
        const val KEY_BLOCKED_VERSION = "blocked_version"
        const val KEY_BUNDLED_BASE = "bundled_base"
        const val MANIFEST_SCHEMA = 3
        const val ASSET_HOST = "appassets.androidplatform.net"
        const val ASSET_PATH = "/assets/www/"
        const val BUNDLED_WEB_BASE = "28ad58de566e42621dad6198aa01be885ccc9769"
        const val MANIFEST_URL = "https://raw.githubusercontent.com/fahadsoomro123/nexusnova-website/nexusnova-ota-public/ota/manifest.json"
        const val FILE_BASE_URL = "https://raw.githubusercontent.com/fahadsoomro123/nexusnova-website/nexusnova-ota-public/ota/files/"
        const val BLOCKLIST_FILE = ".blocked-paths"
        const val MAX_BLOCKED_PATH_COUNT = 512
        const val CONNECT_TIMEOUT_MS = 8_000
        const val READ_TIMEOUT_MS = 12_000
        const val UPDATE_CHECK_ATTEMPTS = 4
        const val UPDATE_RETRY_DELAY_MS = 1_500L
        const val MAX_MANIFEST_BYTES = 1L * 1024L * 1024L
        const val MAX_SINGLE_FILE_BYTES = 20L * 1024L * 1024L
        const val MAX_TOTAL_BYTES = 60L * 1024L * 1024L
        const val MAX_FILE_COUNT = 2_000
        val VERSION_PATTERN = Regex("^[0-9a-f]{40}$")
        val SHA256_PATTERN = Regex("^[0-9a-f]{64}$")
        val EXECUTOR = Executors.newSingleThreadExecutor { runnable ->
            Thread(runnable, "NexusNovaOtaWeb").apply { isDaemon = true }
        }
    }
}
