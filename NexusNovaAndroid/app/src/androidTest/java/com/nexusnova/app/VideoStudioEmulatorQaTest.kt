package com.nexusnova.app

import android.content.ContentValues
import android.content.Intent
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.Base64

@RunWith(AndroidJUnit4::class)
class VideoStudioEmulatorQaTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val device = UiDevice.getInstance(instrumentation)
    private val context = instrumentation.targetContext

    @Test
    fun videoStudioFullscreenScopedDockAndNativeMediaPicker() {
        require(Build.VERSION.SDK_INT >= 29)
        publishDownload("video-studio-photo-qa.png", "image/png", Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="))

        context.startActivity(
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        )

        val authFields = device.wait(Until.findObjects(By.clazz("android.widget.EditText")), 30_000L)
            ?: emptyList()
        assertTrue("auth fields missing", authFields.size >= 2)
        authFields[0].text = "qa-emulator@nexusnova.local"
        authFields[1].text = "NexusNova123"
        waitText("SIGN IN").click()

        openNovaHub()
        val search = device.wait(Until.findObject(By.desc("Search Nova Hub")), 15_000L)
            ?: error("Nova Hub search field not found")
        search.text = "AI Video Studio"
        waitText("AI Video Studio").click()

        waitText("CREATE YOUR VIDEO")
        capture("video-studio-before-picker.png")
        assertTrue("MINE dock leaked into Video Studio", !device.hasObject(By.text("MINE")))
        assertTrue("NOVA HUB dock leaked into Video Studio", !device.hasObject(By.text("NOVA HUB")))

        device.findObject(By.textContains("ADD MEDIA")).click()
        waitForDocumentsUi()
        selectDocument("video-studio-video-qa.webm")
        waitTextContains("video-qa")
        waitTextContains("1 clip •")
        assertTrue("timeline scrubber missing after video import", device.hasObject(By.desc("Timeline position")))

        // Verify real editor state changes, not only import UI.
        waitText("DUPLICATE").click()
        waitTextContains("2 clips •")
        waitText("DELETE").click()
        waitText("1 clip •")
        waitText("SPEED").click()
        waitTextContains("1.00×")
        waitText("EDIT").click()

        device.findObject(By.textContains("ADD MEDIA")).click()
        waitForDocumentsUi()
        selectDocument("video-studio-photo-qa.png")
        waitTextContains("photo-qa")
        waitTextContains("2 clips •")
        capture("video-studio-after-import.png")

        // Restart the real app process, then prove media can be imported again.
        device.executeShellCommand("am force-stop com.nexusnova.app")
        context.startActivity(
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        )
        openNovaHub()
        val searchAgain = device.wait(Until.findObject(By.desc("Search Nova Hub")), 15_000L)
            ?: error("Nova Hub search field missing after restart")
        searchAgain.text = "AI Video Studio"
        waitText("AI Video Studio").click()
        waitText("CREATE YOUR VIDEO")
        device.findObject(By.textContains("ADD MEDIA")).click()
        waitForDocumentsUi()
        selectDocument("video-studio-photo-qa.png")
        waitTextContains("photo-qa")
        waitTextContains("1 clip •")
        device.pressBack()
        waitForNovaHubVisible()
        assertTrue("dock was not restored after leaving Video Studio", device.hasObject(By.desc("Open Mine")))
        cleanupDownload("video-studio-photo-qa.png")
    }

    private fun openNovaHub(timeout: Long = 30_000L) {
        val search = device.wait(Until.findObject(By.desc("Search Nova Hub")), 4_000L)
        if (search != null) return
        val hub = device.wait(Until.findObject(By.desc("Open Nova Hub")), timeout)
            ?: error("Nova Hub navigation control not found after sign-in")
        hub.click()
    }

    private fun waitForNovaHubVisible(timeout: Long = 15_000L) {
        assertTrue(
            "Nova Hub did not become visible after leaving Video Studio",
            device.wait(Until.hasObject(By.desc("Search Nova Hub")), timeout)
                || device.wait(Until.hasObject(By.desc("Open Nova Hub")), 1_000L)
        )
    }

    private fun waitText(value: String, timeout: Long = 30_000L) =
        device.wait(Until.findObject(By.text(value)), timeout)
            ?: error("Timed out waiting for text: $value")

    private fun waitTextContains(value: String, timeout: Long = 30_000L) =
        device.wait(Until.findObject(By.textContains(value)), timeout)
            ?: error("Timed out waiting for text containing: $value")

    private fun waitForDocumentsUi() {
        assertTrue(
            "Android DocumentsUI did not open",
            device.wait(Until.hasObject(By.pkg("com.google.android.documentsui")), 15_000L)
        )
    }

    private fun selectDocument(name: String) {
        waitTextContains(name)
        device.findObject(By.textContains(name)).click()
        val open = device.wait(Until.findObject(By.text("OPEN")), 10_000L)
            ?: device.wait(Until.findObject(By.text("Open")), 10_000L)
            ?: error("OPEN button not found for $name")
        open.click()
        assertTrue(
            "NexusNova did not regain focus",
            device.wait(Until.hasObject(By.pkg("com.nexusnova.app")), 15_000L)
        )
    }

    private fun publishDownload(name: String, mime: String, bytes: ByteArray) {
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, name)
            put(MediaStore.Downloads.MIME_TYPE, mime)
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val uri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: error("Could not create MediaStore fixture: $name")
        context.contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
            ?: error("Could not write MediaStore fixture: $name")
        values.clear()
        values.put(MediaStore.Downloads.IS_PENDING, 0)
        context.contentResolver.update(uri, values, null, null)
    }

    private fun cleanupDownload(name: String) {
        context.contentResolver.delete(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
            "${MediaStore.Downloads.DISPLAY_NAME}=?",
            arrayOf(name)
        )
    }

    private fun capture(name: String) {
        val dir = context.getExternalFilesDir(Environment.DIRECTORY_PICTURES)
            ?: error("External pictures directory unavailable")
        dir.mkdirs()
        assertTrue("Screenshot failed: $name", device.takeScreenshot(File(dir, name)))
    }
}
