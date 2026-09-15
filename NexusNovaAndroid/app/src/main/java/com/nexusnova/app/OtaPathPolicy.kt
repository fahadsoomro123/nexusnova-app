package com.nexusnova.app

/** Pure path policy shared by OTA manifest validation and runtime interception. */
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
}
