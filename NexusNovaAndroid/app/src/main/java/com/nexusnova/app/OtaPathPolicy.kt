package com.nexusnova.app

import java.io.IOException

internal object OtaPathPolicy {
    fun normalize(raw: String): String? {
        val path = raw.trim()
        if (path.isBlank() || path.startsWith('/') || path.startsWith('\\')) return null
        if (path.contains('\\') || path.contains('\u0000')) return null
        val parts = path.split('/')
        if (parts.any { it.isBlank() || it == "." || it == ".." }) return null
        return parts.joinToString("/")
    }

    fun isTravelSpecific(path: String): Boolean {
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

    fun validateTravelBlocklist(rawPaths: List<String>): List<String> {
        val seen = HashSet<String>(rawPaths.size)
        val normalized = ArrayList<String>(rawPaths.size)
        rawPaths.forEach { raw ->
            val path = normalize(raw) ?: throw IOException("Malformed blocked path")
            if (!isTravelSpecific(path)) throw IOException("Blocked path is not Travel-specific: $path")
            if (!seen.add(path)) throw IOException("Duplicate blocked path")
            normalized += path
        }
        normalized.sort()
        return normalized
    }

    fun resolve(otaFileExists: Boolean, blocked: Boolean, bundledFileExists: Boolean): String = when {
        otaFileExists -> "OTA"
        blocked -> "BLOCKED_404"
        bundledFileExists -> "BUNDLED"
        else -> "MISS"
    }
}
