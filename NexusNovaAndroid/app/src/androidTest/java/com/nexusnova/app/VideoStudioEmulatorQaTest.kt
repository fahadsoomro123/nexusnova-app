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
    fun testVideoImportEndToEnd() {
        freshEditor()
        val name = "ota11-video-import.webm"
        publishVideoFixture(name, "video/webm", webm = true)

        tapAddMedia()
        assertDocumentsUi()
        selectDocument(name)

        waitTextContains("ota11-video-import")
        assertTrue(
            "Imported video clip is not visible after Android picker selection",
            device.hasObject(By.textContains("ota11-video-import"))
        )
        assertTrue(
            "Video preview/play control missing after import",
            device.hasObject(By.desc("Play or pause"))
        )
        capture("video-studio-single-test-pass.png")
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
