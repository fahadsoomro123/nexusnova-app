package com.nexusnova.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OtaPathPolicyTest {
    @Test fun normalizeRejectsTraversalAndMalformedPaths() {
        listOf(
            "../fresh-rebuild/src/features/apps/travel-fare-lens.js",
            "fresh-rebuild/src/features/apps/../travel-fare-lens.js",
            "/fresh-rebuild/src/features/apps/travel-fare-lens.js",
            "\\fresh-rebuild/src/features/apps/travel-fare-lens.js",
            "fresh-rebuild\\src\\features\\apps\\travel-fare-lens.js",
            "fresh-rebuild/src/features/apps//travel-fare-lens.js",
            "fresh-rebuild/src/features/apps/travel-fare-lens.js\u0000.js"
        ).forEach { assertEquals(null, OtaPathPolicy.normalize(it)) }
    }

    @Test fun normalizeIsStableForValidTravelPaths() {
        val path = "fresh-rebuild/src/features/apps/travel-fare-lens.js"
        assertEquals(path, OtaPathPolicy.normalize(path))
        assertTrue(OtaPathPolicy.isTravelSpecific(path))
    }

    @Test fun unrelatedPathIsNotTravelSpecific() {
        assertFalse(OtaPathPolicy.isTravelSpecific("fresh-rebuild/src/core/app-shell.js"))
        assertFalse(OtaPathPolicy.isTravelSpecific("fresh-rebuild/src/features/apps/calendar.js"))
    }
}
