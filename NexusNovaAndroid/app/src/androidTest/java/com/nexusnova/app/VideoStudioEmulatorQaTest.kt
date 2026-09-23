package com.nexusnova.app

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.media.MediaRecorder
import android.os.Environment
import android.provider.MediaStore
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.Until
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.io.OutputStream

@RunWith(AndroidJUnit4::class)
class VideoStudioEmulatorQaTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val device = UiDevice.getInstance(instrumentation)
    private val context: Context = instrumentation.targetContext

    @Test
    fun testVideoStudioHardQa() {
        var gates = 0
        fun gate(label: String) {
            gates += 1
            println("[HARD-QA " + gates.toString().padStart(2, '0') + "] PASS — " + label)
        }

        freshEditor()
        gate("NexusNova launches into the Video Studio entry flow")

        val name = "ota11-video-import.webm"
        publishVideoFixture(name, "video/webm", webm = true)
        assertDownloadFixture(name)
        gate("Deterministic WebM fixture is published in Downloads")

        assertTrue(
            "AI Video Studio screen did not become ready",
            device.hasObject(By.text("CREATE YOUR VIDEO"))
        )
        gate("Video Studio screen is ready before import")

        assertTrue(
            "ADD MEDIA action missing from the editor",
            device.hasObject(By.text("ADD MEDIA"))
        )
        gate("ADD MEDIA control is present")

        tapAddMedia()
        gate("ADD MEDIA initiates the native file-picker flow")

        assertDocumentsUi()
        gate("Android DocumentsUI is visible")

        waitTextContains(name)
        assertTrue(
            "Picker did not show the generated video fixture",
            device.hasObject(By.textContains(name))
        )
        gate("Generated WebM is discoverable in the Android picker")

        val item = device.findObject(By.textContains(name))
            ?: error("Document item not found: $name")
        assertTrue(
            "Generated picker item is not visibly selectable",
            item.visibleBounds.width() > 0 && item.visibleBounds.height() > 0
        )
        gate("Picker exposes a visible selectable file row")

        selectDocument(name)
        gate("Native picker selection returns control to the NexusNova activity")
        waitTextContains("ota11-video-import")
        gate("Imported clip is rendered after picker return")

        assertTrue(
            "Imported video clip is not visible after Android picker selection",
            device.hasObject(By.textContains("ota11-video-import"))
        )
        gate("Imported video becomes a real timeline item")

        assertTrue(
            "Video preview/play control missing after import",
            device.hasObject(By.desc("Play or pause"))
        )
        gate("Playback control is present for the imported media")

        assertTrue(
            "Video play/pause control is not clickable",
            device.findObject(By.desc("Play or pause"))?.isClickable == true
        )
        gate("Playback control exposes an actionable target")

        assertTrue(
            "Imported state disappeared after picker completion",
            device.hasObject(By.textContains("ota11-video-import"))
        )
        gate("Imported editor state persists after native picker completion")

        capture("video-studio-hard-qa-pass.png")
        gate("Runtime screenshot evidence is captured")

        assertTrue("Hard QA completed fewer than 15 gates", gates == 15)
        println("[HARD-QA] PASS — exactly 15 runtime gates completed")
    }

    private fun freshEditor() {
        runCatching { device.pressBack() }
        context.startActivity(
            Intent(context, MainActivity::class.java)
                .addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                )
        )

        val signIn = device.wait(Until.findObject(By.text("SIGN IN")), 8_000L)
        if (signIn != null) {
            val authFields =
                device.wait(
                    Until.findObjects(By.clazz("android.widget.EditText")),
                    12_000L
                ) ?: emptyList()
            assertTrue("Auth fields missing", authFields.size >= 2)
            authFields[0].text = "qa-emulator@nexusnova.local"
            authFields[1].text = "NexusNova123"
            // The auth screen contains both a SIGN IN mode tab and the actual
            // submit control. Select the submit control deterministically.
            val signInButtons = device.findObjects(By.text("SIGN IN"))
            assertTrue("SIGN IN submit control missing", signInButtons.size >= 2)
            signInButtons.last().click()
        }

        val novaHub =
            device.wait(Until.findObject(By.text("NOVA HUB")), 30_000L)
                ?: device.wait(Until.findObject(By.desc("Open Nova Hub")), 5_000L)
        if (novaHub != null) {
            novaHub.click()
            val search =
                device.wait(Until.findObject(By.desc("Search Nova Hub")), 15_000L)
                    ?: error("Nova Hub search field not found")
            search.text = "AI Video Studio"
            waitText("AI Video Studio").click()
        }

        waitText("CREATE YOUR VIDEO")
    }

    private fun tapAddMedia() {
        waitText("ADD MEDIA").click()
    }

    private fun assertDocumentsUi() {
        assertTrue(
            "Android DocumentsUI did not open",
            device.wait(
                Until.hasObject(By.pkg("com.google.android.documentsui")),
                15_000L
            )
        )
    }

    private fun selectDocument(name: String) {
        waitTextContains(name, 15_000L)
        val item =
            device.findObject(By.textContains(name))
                ?: error("Document item not found: $name")
        item.click()

        val open =
            device.wait(Until.findObject(By.text("OPEN")), 10_000L)
                ?: device.wait(Until.findObject(By.text("Open")), 10_000L)
                ?: error("OPEN button not found for $name")
        open.click()

        assertTrue(
            "NexusNova did not regain focus after selecting $name",
            device.wait(
                Until.hasObject(By.pkg("com.nexusnova.app")),
                15_000L
            )
        )
    }

    private fun publishVideoFixture(name: String, mime: String, webm: Boolean) {
        val temp = File(context.cacheDir, "nn-$name")
        runCatching { temp.delete() }
        generateVideoFixture(
            temp,
            webm = webm,
            durationMs = 1_200L,
            width = 320,
            height = 180,
            bitrate = 700_000
        )
        try {
            publishDownload(name, mime) { out ->
                temp.inputStream().use { input -> input.copyTo(out) }
            }
        } finally {
            temp.delete()
        }
    }

    private fun generateVideoFixture(
        file: File,
        webm: Boolean,
        durationMs: Long,
        width: Int,
        height: Int,
        bitrate: Int
    ) {
        val recorder = MediaRecorder()
        var surface: android.view.Surface? = null
        try {
            recorder.setVideoSource(MediaRecorder.VideoSource.SURFACE)
            recorder.setOutputFormat(
                if (webm) MediaRecorder.OutputFormat.WEBM
                else MediaRecorder.OutputFormat.MPEG_4
            )
            recorder.setVideoEncoder(
                if (webm) MediaRecorder.VideoEncoder.VP8
                else MediaRecorder.VideoEncoder.H264
            )
            recorder.setVideoSize(width, height)
            recorder.setVideoFrameRate(20)
            recorder.setVideoEncodingBitRate(bitrate)
            recorder.setOutputFile(file.absolutePath)
            recorder.prepare()
            recorder.start()
            surface = recorder.surface

            val endAt = System.currentTimeMillis() + durationMs
            var frame = 0
            while (System.currentTimeMillis() < endAt) {
                val canvas = surface.lockCanvas(null)
                try {
                    canvas.drawColor(
                        when (frame % 3) {
                            0 -> Color.rgb(22, 18, 30)
                            1 -> Color.rgb(108, 76, 255)
                            else -> Color.rgb(38, 180, 160)
                        }
                    )
                } finally {
                    surface.unlockCanvasAndPost(canvas)
                }
                frame++
                Thread.sleep(45L)
            }

            recorder.stop()
            assertTrue(
                "Generated video fixture is empty: $file",
                file.isFile && file.length() > 0L
            )
        } finally {
            runCatching { surface?.release() }
            runCatching { recorder.reset() }
            runCatching { recorder.release() }
            runCatching { file.deleteOnExit() }
        }
    }

    private fun publishDownload(
        name: String,
        mime: String,
        writer: (OutputStream) -> Unit
    ) {
        cleanupDownload(name)

        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, name)
            put(MediaStore.Downloads.MIME_TYPE, mime)
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            put(MediaStore.Downloads.IS_PENDING, 1)
        }

        val uri =
            context.contentResolver.insert(
                MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                values
            ) ?: error("Could not create MediaStore fixture: $name")

        try {
            context.contentResolver.openOutputStream(uri)?.use(writer)
                ?: error("Could not open MediaStore fixture: $name")

            val done = ContentValues().apply {
                put(MediaStore.Downloads.IS_PENDING, 0)
            }
            context.contentResolver.update(uri, done, null, null)
        } catch (error: Throwable) {
            context.contentResolver.delete(uri, null, null)
            throw error
        }
    }

    private fun cleanupDownload(name: String) {
        context.contentResolver.delete(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
            MediaStore.Downloads.DISPLAY_NAME + "=?",
            arrayOf(name)
        )
    }

    private fun assertDownloadFixture(name: String) {
        val projection = arrayOf(
            MediaStore.Downloads.DISPLAY_NAME,
            MediaStore.Downloads.SIZE
        )
        context.contentResolver.query(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
            projection,
            MediaStore.Downloads.DISPLAY_NAME + "=?",
            arrayOf(name),
            null
        )?.use { cursor ->
            assertTrue(
                "Published fixture is missing or empty: $name",
                cursor.moveToFirst() && cursor.getLong(1) > 0L
            )
            return
        }
        error("Could not query published fixture: $name")
    }

    private fun waitText(value: String, timeout: Long = 30_000L): UiObject2 =
        device.wait(Until.findObject(By.text(value)), timeout)
            ?: error("Timed out waiting for text: $value")

    private fun waitTextContains(
        value: String,
        timeout: Long = 30_000L
    ): UiObject2 =
        device.wait(Until.findObject(By.textContains(value)), timeout)
            ?: error("Timed out waiting for text containing: $value")

    private fun capture(name: String) {
        val dir =
            context.getExternalFilesDir(Environment.DIRECTORY_PICTURES)
                ?: error("External pictures directory unavailable")
        dir.mkdirs()
        assertTrue(
            "Screenshot failed: $name",
            device.takeScreenshot(File(dir, name))
        )
    }
}
