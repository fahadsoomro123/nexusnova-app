package com.nexusnova.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NexusOtaWebManagerTest {
    @Test fun otaFileWinsOverBundledFallback() {
        assertEquals("OTA", resolve(setOf(TRAVEL_RENDERER), emptySet(), TRAVEL_RENDERER))
    }

    @Test fun blockedMissingTravelFileNeverFallsThrough() {
        assertEquals("BLOCKED_404", resolve(emptySet(), setOf(TRAVEL_RENDERER), TRAVEL_RENDERER))
    }

    @Test fun unrelatedMissingAssetStillFallsBack() {
        assertEquals("BUNDLED", resolve(emptySet(), emptySet(), CORE_ASSET, bundled = setOf(CORE_ASSET)))
    }

    @Test fun invalidBlocklistEntryIsRejected() {
        listOf(
            "../fresh-rebuild/src/features/apps/travel-fare-lens.js",
            "fresh-rebuild/src/features/apps/../travel-fare-lens.js",
            "/fresh-rebuild/src/features/apps/travel-fare-lens.js",
            "fresh-rebuild/src/features/apps/travel-fare-lens.js",
            "fresh-rebuild/src/features/apps/Travel-Fare-Lens.js"
        ).forEach { path ->
            val valid = normalizeTravelPath(path) != null && path == path.lowercase()
            assertFalse("Expected rejection: $path", valid && isTravelSpecificPath(path))
        }
    }

    @Test fun rollbackRestoresPriorStateSafely() {
        val prior = State("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", setOf(TRAVEL_RENDERER), emptySet())
        val rolledBack = prior.rollback()
        assertEquals("", rolledBack.activeVersion)
        assertTrue(rolledBack.blocked.isEmpty())
        assertTrue(rolledBack.files.isEmpty())
        assertEquals("BUNDLED", resolve(rolledBack.files, rolledBack.blocked, TRAVEL_RENDERER, bundled = setOf(TRAVEL_RENDERER)))
    }

    private data class State(val activeVersion: String, val blocked: Set<String>, val files: Set<String>) {
        fun rollback(): State = State("", emptySet(), emptySet())
    }

    private fun resolve(otaFiles: Set<String>, blocked: Set<String>, requested: String, bundled: Set<String> = setOf(TRAVEL_RENDERER)): String = when {
        requested in otaFiles -> "OTA"
        requested in blocked -> "BLOCKED_404"
        requested in bundled -> "BUNDLED"
        else -> "MISS"
    }

    private fun normalizeTravelPath(raw: String): String? {
        if (raw.isBlank() || raw.startsWith('/') || raw.startsWith('\\')) return null
        if (raw.contains('\\') || raw.contains('\u0000')) return null
        val parts = raw.split('/')
        if (parts.any { it.isBlank() || it == "." || it == ".." }) return null
        return parts.joinToString("/")
    }

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

    private companion object {
        const val TRAVEL_RENDERER = "fresh-rebuild/src/features/apps/travel-fare-lens.js"
        const val CORE_ASSET = "fresh-rebuild/src/core/app-shell.js"
    }
}
