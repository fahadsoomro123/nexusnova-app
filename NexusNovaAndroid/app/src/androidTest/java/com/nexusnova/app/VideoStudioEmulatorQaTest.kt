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
    private val testContext = instrumentation.context

    @Test
    fun videoStudioFullscreenScopedDockAndNativeMediaPicker() {
        require(Build.VERSION.SDK_INT >= 29)

        instrumentation.uiAutomation.executeShellCommand("pm clear com.nexusnova.app").close()
        cleanupDownload("video-studio-video-qa.webm")
        cleanupDownload("video-studio-photo-qa.png")

        publishAssetDownload("video-studio-video-qa.webm", "video/webm")
        publishDownload(
            "video-studio-photo-qa.png",
            "image/png",
            Base64.getDecoder().decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
            )
        )

        context.startActivity(
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        )

        val authFields = device.wait(
            Until.findObjects(By.clazz("android.widget.EditText")),
            30_000L
        ) ?: emptyList()
        assertTrue("auth fields missing", authFields.size >= 2)
        authFields[0].text = "qa-emulator@nexusnova.local"
        authFields[1].text = "NexusNova123"

        waitText("SIGN IN").click()
        waitText("NOVA HUB").click()

        val search = device.wait(
            Until.findObject(By.desc("Search Nova Hub")),
            15_000L
        ) ?: error("Nova Hub search field not found")
        search.text = "AI Video Studio"
        waitText("AI Video Studio").click()

        waitText("CREATE YOUR VIDEO")
        capture("video-studio-before-picker.png")

        assertTrue("MINE dock leaked into Video Studio", !device.hasObject(By.text("MINE")))
        assertTrue("NOVA HUB dock leaked into Video Studio", !device.hasObject(By.text("NOVA HUB")))

        // Native video import: the workflow generates the fixture into the test APK,
        // this test publishes it to MediaStore/Downloads, and DocumentsUI must expose it.
        device.findObject(By.textContains("ADD MEDIA")).click()
        waitForDocumentsUi()
        selectDocument("video-studio-video-qa.webm")
        waitTextContains("video-qa")
        waitTextContains("1 clip")
        assertTrue(
            "video preview not visible after native import",
            !device.hasObject(By.text("CREATE YOUR VIDEO"))
        )

        // Native photo import: second DocumentsUI selection must append to the same timeline.
        device.findObject(By.textContains("ADD MEDIA")).click()
        waitForDocumentsUi()
        selectDocument("video-studio-photo-qa.png")
        waitTextContains("photo-qa")
        waitTextContains("2 clips")
        capture("video-studio-after-import.png")

        // Android export gate: render the imported timeline and require the real
        // result panel before leaving the editor. Save/share stays explicit.
        device.findObject(By.textContains("EXPORT VIDEO")).click()
        waitText("SHARE / SAVE EXPORT", 60_000L)
        capture("video-studio-after-export.png")

        // Leave Video Studio. The normal global dock must return immediately.
        device.pressBack()
        waitText("NOVA HUB")
        assertTrue("dock was not restored after leaving Video Studio", device.hasObject(By.text("MINE")))
        assertTrue("dock was not restored after leaving Video Studio", device.hasObject(By.text("NOVA HUB")))

        cleanupDownload("video-studio-photo-qa.png")
        cleanupDownload("video-studio-video-qa.webm")
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
            device.wait(
                Until.hasObject(By.pkg("com.google.android.documentsui")),
                15_000L
            )
        )
    }

    private fun selectDocument(name: String) {
        waitTextContains(name)
        device.findObject(By.textContains(name)).click()
        val open = device.wait(
            Until.findObject(By.text("OPEN")),
            10_000L
        ) ?: device.wait(
            Until.findObject(By.text("Open")),
            10_000L
        ) ?: error("OPEN button not found for $name")
        open.click()
        assertTrue(
            "NexusNova did not regain focus",
            device.wait(Until.hasObject(By.pkg("com.nexusnova.app")), 15_000L)
        )
    }

    private fun publishAssetDownload(name: String, mime: String) {
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, name)
            put(MediaStore.Downloads.MIME_TYPE, mime)
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val uri = context.contentResolver.insert(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
            values
        ) ?: error("Could not create MediaStore asset fixture: $name")

        try {
            testContext.assets.open(name).use { input ->
                context.contentResolver.openOutputStream(uri)?.use { output ->
                    input.copyTo(output)
                } ?: error("Could not write MediaStore asset fixture: $name")
            }
        } catch (error: Throwable) {
            context.contentResolver.delete(uri, null, null)
            throw error
        }

        values.clear()
        values.put(MediaStore.Downloads.IS_PENDING, 0)
        context.contentResolver.update(uri, values, null, null)
    }

    private fun publishDownload(name: String, mime: String, bytes: ByteArray) {
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, name)
            put(MediaStore.Downloads.MIME_TYPE, mime)
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val uri = context.contentResolver.insert(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
            values
        ) ?: error("Could not create MediaStore fixture: $name")

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
