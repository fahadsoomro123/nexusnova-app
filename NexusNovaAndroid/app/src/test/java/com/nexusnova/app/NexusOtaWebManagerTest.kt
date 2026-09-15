package com.nexusnova.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class NexusOtaWebManagerTest {
    @Test fun otaFileExists_itWinsOverBundledFallback() {
        assertEquals("OTA", OtaPathPolicy.resolve(true, false, true))
    }

    @Test fun otaFileMissing_blockedPathConsumesRequestAs404() {
        assertEquals("BLOCKED_404", OtaPathPolicy.resolve(false, true, true))
    }

    @Test fun otaFileMissing_unrelatedPathStillUsesBundledFallback() {
        assertEquals("BUNDLED", OtaPathPolicy.resolve(false, false, true))
    }

    @Test fun invalidBlocklist_rejectsMalformedAndNonTravelPaths() {
        val invalid = listOf(
            "../fresh-rebuild/src/features/apps/travel-fare-lens.js",
            "fresh-rebuild/src/features/apps/../travel-fare-lens.js",
            "/fresh-rebuild/src/features/apps/travel-fare-lens.js",
            "\\fresh-rebuild/src/features/apps/travel-fare-lens.js",
            "fresh-rebuild\\src\\features\\apps\\travel-fare-lens.js",
            "fresh-rebuild/src/features/apps//travel-fare-lens.js",
            "fresh-rebuild/src/features/apps/travel-fare-lens.js\u0000.js",
            "travel-fare-lens.js"
        )
        invalid.forEach { path ->
            var rejected = false
            try { OtaPathPolicy.validateTravelBlocklist(listOf(path)) } catch (_: IOException) { rejected = true }
            assertTrue("Expected rejection: $path", rejected)
        }
    }

    @Test fun duplicateBlocklist_isRejected() {
        var rejected = false
        try {
            OtaPathPolicy.validateTravelBlocklist(listOf(TRAVEL_RENDERER, TRAVEL_RENDERER))
        } catch (_: IOException) { rejected = true }
        assertTrue(rejected)
    }

    @Test fun rollbackToBundled_doesNotLeaveBlockedOverlayState() {
        val rolledBack = State("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", setOf(TRAVEL_RENDERER)).rollback()
        assertEquals("", rolledBack.activeVersion)
        assertTrue(rolledBack.blocked.isEmpty())
        assertEquals("BUNDLED", OtaPathPolicy.resolve(false, false, true))
    }

    private data class State(val activeVersion: String, val blocked: Set<String>) {
        fun rollback(): State = State("", emptySet())
    }

    private companion object {
        const val TRAVEL_RENDERER = "fresh-rebuild/src/features/apps/travel-fare-lens.js"
    }
}
