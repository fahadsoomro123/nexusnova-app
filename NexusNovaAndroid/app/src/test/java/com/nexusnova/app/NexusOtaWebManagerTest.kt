package com.nexusnova.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class NexusOtaWebManagerTest {
    @Test fun otaFileExists_itWinsOverBundledFallback() {
        assertEquals("OTA", OtaPathPolicy.resolve(otaFileExists = true, blocked = false, bundledFileExists = true))
    }

    @Test fun otaFileMissing_blockedPathConsumesRequestAs404() {
        assertEquals("BLOCKED_404", OtaPathPolicy.resolve(otaFileExists = false, blocked = true, bundledFileExists = true))
    }

    @Test fun otaFileMissing_unrelatedPathStillUsesBundledFallback() {
        assertEquals("BUNDLED", OtaPathPolicy.resolve(otaFileExists = false, blocked = false, bundledFileExists = true))
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
            try {
                OtaPathPolicy.validateTravelBlocklist(listOf(path))
                throw AssertionError("Expected rejection: $path")
            } catch (_: IOException) {
                // expected
            }
        }
    }

    @Test fun duplicateBlocklist_isRejected() {
        var rejected = false
        try {
            OtaPathPolicy.validateTravelBlocklist(listOf(TRAVEL_RENDERER, TRAVEL_RENDERER))
        } catch (_: IOException) {
            rejected = true
        }
        assertTrue(rejected)
    }

    private companion object {
        const val TRAVEL_RENDERER = "fresh-rebuild/src/features/apps/travel-fare-lens.js"
    }
}
