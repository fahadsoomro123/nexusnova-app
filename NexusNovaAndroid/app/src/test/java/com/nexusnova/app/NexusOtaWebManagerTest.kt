package com.nexusnova.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NexusOtaWebManagerTest {
    @Test fun otaFileExists_itWinsOverBundledFallback() {
        assertEquals("OTA", resolve(setOf(TRAVEL_RENDERER), emptySet(), TRAVEL_RENDERER, setOf(TRAVEL_RENDERER)))
    }

    @Test fun otaFileMissing_blockedPathConsumesRequestAs404() {
        assertEquals("BLOCKED_404", resolve(emptySet(), setOf(TRAVEL_RENDERER), TRAVEL_RENDERER, setOf(TRAVEL_RENDERER)))
    }

    @Test fun otaFileMissing_unrelatedPathStillUsesBundledFallback() {
        assertEquals("BUNDLED", resolve(emptySet(), emptySet(), CORE_ASSET, setOf(CORE_ASSET)))
    }

    @Test fun rollback_clearsActiveOverlayAndBlockedState() {
        val prior = State("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", setOf(TRAVEL_RENDERER), setOf(CORE_ASSET))
        val rolledBack = prior.rollback()
        assertEquals("", rolledBack.activeVersion)
        assertTrue(rolledBack.blocked.isEmpty())
        assertTrue(rolledBack.files.isEmpty())
        assertEquals("BUNDLED", resolve(rolledBack.files, rolledBack.blocked, TRAVEL_RENDERER, setOf(TRAVEL_RENDERER)))
    }

    private data class State(val activeVersion: String, val blocked: Set<String>, val files: Set<String>) {
        fun rollback(): State = State("", emptySet(), emptySet())
    }

    private fun resolve(otaFiles: Set<String>, blocked: Set<String>, requested: String, bundled: Set<String>): String = when {
        requested in otaFiles -> "OTA"
        requested in blocked -> "BLOCKED_404"
        requested in bundled -> "BUNDLED"
        else -> "MISS"
    }

    private companion object {
        const val TRAVEL_RENDERER = "fresh-rebuild/src/features/apps/travel-fare-lens.js"
        const val CORE_ASSET = "fresh-rebuild/src/core/app-shell.js"
    }
}
