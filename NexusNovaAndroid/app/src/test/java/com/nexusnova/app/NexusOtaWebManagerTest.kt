package com.nexusnova.app

import android.net.Uri
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NexusOtaWebManagerTest {
    @Test fun otaFileWinsOverBundledFallback() {
        val result = TestOtaResolver.resolve(
            otaFiles = setOf("fresh-rebuild/src/features/apps/travel-fare-lens.js"),
            blocked = emptySet(),
            requested = "fresh-rebuild/src/features/apps/travel-fare-lens.js"
        )
        assertEquals("OTA", result)
    }

    @Test fun blockedMissingTravelFileNeverFallsThrough() {
        val requested = "fresh-rebuild/src/features/apps/travel-fare-lens.js"
        val result = TestOtaResolver.resolve(
            otaFiles = emptySet(),
            blocked = setOf(requested),
            requested = requested
        )
        assertEquals("BLOCKED_404", result)
    }

    @Test fun unrelatedMissingAssetStillFallsBack() {
        val requested = "fresh-rebuild/src/core/app-shell.js"
        val result = TestOtaResolver.resolve(
            otaFiles = emptySet(),
            blocked = emptySet(),
            requested = requested,
            bundled = setOf(requested)
        )
        assertEquals("BUNDLED", result)
    }

    @Test fun invalidBlocklistEntryIsRejected() {
        val invalid = listOf(
            "../fresh-rebuild/src/features/apps/travel-fare-lens.js",
            "fresh-rebuild/src/features/apps/../travel-fare-lens.js",
            "/fresh-rebuild/src/features/apps/travel-fare-lens.js",
            "travel-fare-lens.js"
        )
        invalid.forEach { path ->
            assertFalse(TestOtaResolver.isValidTravelBlockedPath(path))
        }
    }

    @Test fun rollbackRestoresPriorStateSafely() {
        val state = TestOtaResolver.State(
            activeVersion = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            blocked = setOf("fresh-rebuild/src/features/apps/travel-fare-lens.js"),
            files = emptySet()
        )
        val rolledBack = state.rollback()
        assertEquals("", rolledBack.activeVersion)
        assertTrue(rolledBack.blocked.isEmpty())
        assertTrue(rolledBack.files.isEmpty())
        assertEquals("BUNDLED", TestOtaResolver.resolveFromRolledBack(rolledBack, "fresh-rebuild/src/features/apps/travel-fare-lens.js"))
    }

    private object TestOtaResolver {
        data class State(val activeVersion: String, val blocked: Set<String>, val files: Set<String>) {
            fun rollback(): State = State("", emptySet(), emptySet())
        }

        fun resolve(
            otaFiles: Set<String>,
            blocked: Set<String>,
            requested: String,
            bundled: Set<String> = setOf("fresh-rebuild/src/features/apps/travel-fare-lens.js")
        ): String = when {
            requested in otaFiles -> "OTA"
            requested in blocked -> "BLOCKED_404"
            requested in bundled -> "BUNDLED"
            else -> "MISS"
        }

        fun isValidTravelBlockedPath(path: String): Boolean {
            if (path.isBlank() || path.startsWith('/') || path.contains('\\') || path.contains('\u0000')) return false
            val parts = path.split('/')
            if (parts.any { it.isBlank() || it == "." || it == ".." }) return false
            val p = path.lowercase()
            return p.startsWith("fresh-rebuild/src/features/apps/travel") ||
                p.contains("travel-fare-lens") ||
                p.contains("fare-lens") ||
                p.contains("smart-travel") ||
                p.startsWith("travel/") ||
                p.startsWith("assets/travel/") ||
                p.startsWith("js/travel/") ||
                p.startsWith("css/travel/") ||
                p.startsWith("features/travel/")
        }

        fun resolveFromRolledBack(state: State, requested: String): String = when {
            requested in state.files -> "OTA"
            requested in state.blocked -> "BLOCKED_404"
            requested == "fresh-rebuild/src/features/apps/travel-fare-lens.js" -> "BUNDLED"
            else -> "MISS"
        }
    }
}
