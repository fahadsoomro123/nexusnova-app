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

        // The dedicated gate installs the debug build onto a fresh emulator.
        // Do not clear the target package from inside its own instrumentation run:
        // that can terminate UiAutomation/instrumentation before the test body begins.
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
        runCatching {
            device.executeShellCommand("am start -n com.nexusnova.app/.MainActivity")
        }

        val authFields = device.wait(
            Until.findObjects(By.clazz("android.widget.EditText")),
            30_000L
        )?.filter { bounds ->
            val rect = bounds.visibleBounds
            rect.width() > 0 && rect.height() > 0
        } ?: emptyList()
        assertTrue("visible auth fields missing", authFields.size >= 2)
        authFields[0].text = "qa-emulator@nexusnova.local"
        authFields[1].text = "NexusNova123"

        capture("auth-before-submit.png")
        clickSignInSubmit()
        Thread.sleep(1_500L)
        capture("auth-after-submit.png")
        waitForMineScreen()
        openNovaHubDock()

        val search = findNovaHubSearch()
        search.text = "AI Video Studio"
        val openVideo = device.wait(
            Until.findObject(By.desc("Open AI Video Studio")),
            15_000L
        ) ?: device.wait(
            Until.findObject(By.textContains("AI Video Studio")),
            15_000L
        ) ?: error("AI Video Studio launch control not found")
        openVideo.click()

        waitText("CREATE YOUR VIDEO")
        capture("video-studio-before-picker.png")

        assertTrue("MINE dock leaked into Video Studio", !device.hasObject(By.text("MINE")))
        assertTrue("NOVA HUB dock leaked into Video Studio", !device.hasObject(By.text("NOVA HUB")))

        device.findObject(By.textContains("ADD MEDIA")).click()
        waitForDocumentsUi()
        selectDocument("video-studio-video-qa.webm")
        waitTextContains("video-qa")
        waitTextContains("1 clip")
        assertTrue(
            "video preview not visible after native import",
            !device.hasObject(By.text("CREATE YOUR VIDEO"))
        )

        device.findObject(By.textContains("ADD MEDIA")).click()
        waitForDocumentsUi()
        selectDocument("video-studio-photo-qa.png")
        waitTextContains("photo-qa")
        waitTextContains("2 clips")
        capture("video-studio-after-import.png")

        device.findObject(By.textContains("EXPORT VIDEO")).click()
        waitText("SHARE / SAVE EXPORT", 60_000L)
        capture("video-studio-after-export.png")

        device.pressBack()
        waitDescription("Open Nova Hub")
        assertTrue("dock was not restored after leaving Video Studio", device.hasObject(By.desc("Open Mine")))
        assertTrue("dock was not restored after leaving Video Studio", device.hasObject(By.desc("Open Nova Hub")))

        cleanupDownload("video-studio-photo-qa.png")
        cleanupDownload("video-studio-video-qa.webm")
    }

    private fun clickSignInSubmit() {
        // WebView can expose both the auth-mode tab and the form submit button as
        // the same text. Try every visible SIGN IN control from the lowest one up,
        // confirming the real navigation result after each tap.
        val deadline = System.currentTimeMillis() + 30_000L
        while (System.currentTimeMillis() < deadline) {
            val matches = device.findObjects(By.text("SIGN IN"))
                .filter { it.visibleBounds.width() > 0 && it.visibleBounds.height() > 0 }
                .sortedByDescending { it.visibleBounds.bottom }

            if (matches.isNotEmpty()) {
                for (target in matches) {
                    val rect = target.visibleBounds
                    android.util.Log.i("VideoStudioQA", "Trying SIGN IN bounds: $rect; matches=${matches.size}")
                    device.click(rect.centerX(), rect.centerY())
                    if (waitForMineScreen(4_000L)) return
                }
            }
            Thread.sleep(250)
        }

        // Final real touch fallback: tap the lower auth-card action region, never
        // synthesize a form submission. This is equivalent to a user's finger tap.
        device.click((device.displayWidth * 0.5f).toInt(), (device.displayHeight * 0.79f).toInt())
        if (!waitForMineScreen(5_000L)) {
            error("Timed out after trying visible SIGN IN controls")
        }
    }

    private fun waitForMineScreen(timeout: Long = 30_000L): Boolean {
        val end = System.currentTimeMillis() + timeout
        while (System.currentTimeMillis() < end) {
            val visibleMine = sequenceOf(
                device.findObjects(By.text("Mine")),
                device.findObjects(By.text("MINE")),
                device.findObjects(By.textContains("Mine"))
            ).flatten().firstOrNull {
                val rect = it.visibleBounds
                rect.width() > 40 && rect.height() > 20
            }
            if (visibleMine != null) {
                android.util.Log.i("VideoStudioQA", "Visible Mine confirmation bounds: ${visibleMine.visibleBounds}")
                return true
            }
            Thread.sleep(250)
        }
        return false
    }

    private fun findNovaHubSearch() : androidx.test.uiautomator.UiObject2 {
        val deadline = System.currentTimeMillis() + 15_000L
        while (System.currentTimeMillis() < deadline) {
            device.findObject(By.desc("Search Nova Hub"))?.let { return it }
            device.findObject(By.text("Search Nova Hub"))?.let { return it }
            val edit = device.findObjects(By.clazz("android.widget.EditText"))
                .firstOrNull { it.visibleBounds.width() > 80 && it.visibleBounds.height() > 30 }
            if (edit != null) {
                android.util.Log.i("VideoStudioQA", "Using visible Nova Hub EditText bounds: ${edit.visibleBounds}")
                return edit
            }
            Thread.sleep(250)
        }
        error("Nova Hub search field not found")
    }

    private fun waitText(value: String, timeout: Long = 30_000L) =
        device.wait(Until.findObject(By.text(value)), timeout)
            ?: error("Timed out waiting for text: $value")

    private fun waitTextContains(value: String, timeout: Long = 30_000L) =
        device.wait(Until.findObject(By.textContains(value)), timeout)
            ?: error("Timed out waiting for text containing: $value")

    private fun waitDescription(value: String, timeout: Long = 30_000L) =
        device.wait(Until.findObject(By.desc(value)), timeout)
            ?: error("Timed out waiting for description: $value")

    private fun openNovaHubDock() {
        val accessible = device.wait(Until.findObject(By.desc("Open Nova Hub")), 2_000L)
        if (accessible != null) {
            accessible.click()
            return
        }
        val x = (device.displayWidth * 0.62f).toInt()
        val y = (device.displayHeight * 0.93f).toInt()
        device.click(x, y)
    }

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
        device.executeShellCommand("screencap -p /sdcard/Download/nxqa-${name}")
    }
}
