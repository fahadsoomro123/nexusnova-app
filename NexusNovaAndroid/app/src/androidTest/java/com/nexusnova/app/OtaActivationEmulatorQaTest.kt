package com.nexusnova.app

import android.content.Intent
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import java.util.regex.Pattern
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class OtaActivationEmulatorQaTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val device = UiDevice.getInstance(instrumentation)
    private val context = instrumentation.targetContext

    @Test
    fun latestOtaReachesAndroidAndActivates() {
        device.executeShellCommand("logcat -c")
        context.startActivity(
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        )

        val expected = "5240b0ac87cc764b9865cbcfd3259a79b3ed9bb9"
        val deadline = System.currentTimeMillis() + 60_000L
        var activated = false
        var evidence = ""

        while (System.currentTimeMillis() < deadline) {
            evidence = runCatching {
                device.executeShellCommand("logcat -d -s NexusNovaOTA:V")
            }.getOrDefault("")
            if (evidence.contains("Activated OTA web version $expected")) {
                activated = true
                break
            }
            Thread.sleep(1_000L)
        }

        val prefs = runCatching {
            device.executeShellCommand(
                "run-as com.nexusnova.app sh -c 'cat /data/data/com.nexusnova.app/shared_prefs/nexusnova_ota_web_v3_atomic.xml 2>/dev/null'"
            )
        }.getOrDefault("")

        val payload = runCatching {
            device.executeShellCommand(
                "run-as com.nexusnova.app sh -c 'test -s /data/data/com.nexusnova.app/files/nexusnova-ota-web/versions/$expected/index.html && echo PAYLOAD_PRESENT'"
            )
        }.getOrDefault("")

        assertTrue(
            "OTA did not activate on Android. logcat=$evidence prefs=$prefs payload=$payload",
            activated &&
                prefs.contains("active_version") &&
                prefs.contains(expected) &&
                payload.contains("PAYLOAD_PRESENT")
        )
    }
}
