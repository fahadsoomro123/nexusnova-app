package com.nexusnova.app

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.Until
import org.junit.Assert.assertFalse
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
    fun test01PhotoPicker() {
        freshEditor()
        publishBitmap("photo-picker.png", Bitmap.CompressFormat.PNG, "image/png")
        tapAddMedia()
        assertDocumentsUi()
        assertTrue("Photo fixture not visible in picker", device.wait(Until.hasObject(By.textContains("photo-picker.png")), 15_000L))
        device.pressBack()
    }

    @Test
    fun test02PhotoImport() {
        freshEditor()
        publishBitmap("photo-import.png", Bitmap.CompressFormat.PNG, "image/png")
        importNamed("photo-import.png")
        assertTrue("Photo clip missing after import", device.hasObject(By.textContains("photo-import")))
    }

    @Test
    fun test03PhotoPreview() {
        freshEditor()
        publishBitmap("photo-preview.png", Bitmap.CompressFormat.PNG, "image/png")
        importNamed("photo-preview.png")
        waitTextContains("photo-preview")
        assertTrue("Photo preview play control missing", device.hasObject(By.desc("Play or pause")))
        capture("video-studio-photo-preview.png")
    }

    @Test
    fun test04VideoPicker() {
        freshEditor()
        publishFixtureToDownloads("video-picker.webm", "video/webm")
        tapAddMedia()
        assertDocumentsUi()
        assertTrue("Video fixture not visible in picker", device.wait(Until.hasObject(By.textContains("video-picker.webm")), 15_000L))
        device.pressBack()
    }

    @Test
    fun test05VideoImport() {
        freshEditor()
        publishFixtureToDownloads("video-import.webm", "video/webm")
        importNamed("video-import.webm")
        assertTrue("Video clip missing after import", device.hasObject(By.textContains("video-import")))
    }

    @Test
    fun test06VideoPreview() {
        freshEditor()
        publishFixtureToDownloads("video-preview.webm", "video/webm")
        importNamed("video-preview.webm")
        waitTextContains("video-preview")
        assertTrue("Video preview play control missing", device.hasObject(By.desc("Play or pause")))
        capture("video-studio-video-preview.png")
    }

    @Test
    fun test07LargeVideoHandling() {
        freshEditor()
        publishFixtureToDownloads("large-video.mp4", "video/mp4")
        importNamed("large-video.mp4", 30_000L)
        assertTrue("Large video did not import", device.hasObject(By.textContains("large-video")))
    }

    @Test
    fun test08ImageFormatCoverage() {
        freshEditor()
        publishBitmap("format-png.png", Bitmap.CompressFormat.PNG, "image/png")
        publishBitmap("format-jpeg.jpg", Bitmap.CompressFormat.JPEG, "image/jpeg")
        publishBitmap("format-webp.webp", webpFormat(), "image/webp")
        importNamed("format-png.png")
        importNamed("format-jpeg.jpg")
        importNamed("format-webp.webp")
        assertTrue("PNG missing", device.hasObject(By.textContains("format-png")))
        assertTrue("JPEG missing", device.hasObject(By.textContains("format-jpeg")))
        assertTrue("WebP missing", device.hasObject(By.textContains("format-webp")))
    }

    @Test
    fun test09VideoFormatCoverage() {
        freshEditor()
        publishFixtureToDownloads("format-webm.webm", "video/webm")
        publishFixtureToDownloads("format-mp4.mp4", "video/mp4")
        importNamed("format-webm.webm")
        importNamed("format-mp4.mp4")
        assertTrue("WebM missing", device.hasObject(By.textContains("format-webm")))
        assertTrue("MP4 missing", device.hasObject(By.textContains("format-mp4")))
    }

    @Test
    fun test10InvalidMediaRejected() {
        freshEditor()
        publishRaw("corrupt-video.webm", "video/webm", "this-is-not-a-valid-webm".toByteArray())
        tapAddMedia()
        assertDocumentsUi()
        selectDocument("corrupt-video.webm")
        waitText("No media was imported.", 12_000L)
    }

    @Test
    fun test11PickerInterruptionRetry() {
        freshEditor()
        publishBitmap("retry-photo.png", Bitmap.CompressFormat.PNG, "image/png")
        tapAddMedia()
        assertDocumentsUi()
        device.pressBack()
        assertTrue("App did not regain focus after picker interruption", device.wait(Until.hasObject(By.pkg("com.nexusnova.app")), 10_000L))
        tapAddMedia()
        assertDocumentsUi()
        selectDocument("retry-photo.png")
        waitTextContains("retry-photo")
    }

    @Test
    fun test12CancelImport() {
        freshEditor()
        publishBitmap("cancel-photo.png", Bitmap.CompressFormat.PNG, "image/png")
        tapAddMedia()
        assertDocumentsUi()
        device.pressBack()
        waitText("CREATE YOUR VIDEO")
        assertFalse("Cancel unexpectedly mutated the project", device.hasObject(By.textContains("cancel-photo")))
    }

    @Test
    fun test13ImportAndAiWorkflow() {
        freshEditor()
        publishBitmap("ai-photo.png", Bitmap.CompressFormat.PNG, "image/png")
        importNamed("ai-photo.png")
        waitTextContains("ai-photo")
        waitTextContains("AI Lab").click()
        assertTrue("AI Director action missing after import", device.hasObject(By.text("AI DIRECTOR")))
        assertTrue("AI Captions action missing after import", device.hasObject(By.text("AUTO CAPTIONS")))
    }

    @Test
    fun test14ImportAndEditorWorkflow() {
        freshEditor()
        publishBitmap("editor-photo.png", Bitmap.CompressFormat.PNG, "image/png")
        importNamed("editor-photo.png")
        waitTextContains("editor-photo")
        waitText("SPLIT").click()
        assertTrue("Editor split did not create a second timeline clip", device.hasObject(By.textContains("2 clips")))
        waitText("EDIT")
    }

    @Test
    fun test15ImportAndExportWorkflow() {
        freshEditor()
        publishBitmap("export-photo.png", Bitmap.CompressFormat.PNG, "image/png")
        importNamed("export-photo.png")
        waitTextContains("export-photo")
        waitText("EXPORT VIDEO").click()
        val completed = waitForAnyText(30_000L, "Export complete", "Export ready", "download requested")
        assertTrue("Import + export workflow did not reach an honest terminal result", completed)
    }

    private fun freshEditor() {
        runCatching { device.pressBack() }
        device.executeShellCommand("am force-stop com.nexusnova.app")
        context.startActivity(
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        )

        val signIn = device.wait(Until.findObject(By.text("SIGN IN")), 8_000L)
        if (signIn != null) {
            val authFields = device.wait(Until.findObjects(By.clazz("android.widget.EditText")), 12_000L) ?: emptyList()
            assertTrue("Auth fields missing", authFields.size >= 2)
            authFields[0].text = "qa-emulator@nexusnova.local"
            authFields[1].text = "NexusNova123"
            waitText("SIGN IN").click()
        }

        val novaHub = device.wait(Until.findObject(By.text("NOVA HUB")), 25_000L)
        if (novaHub != null) {
            novaHub.click()
            val search = device.wait(Until.findObject(By.desc("Search Nova Hub")), 15_000L)
                ?: error("Nova Hub search field not found")
            search.text = "AI Video Studio"
            waitText("AI Video Studio").click()
        }
        waitText("CREATE YOUR VIDEO")
    }

    private fun tapAddMedia() {
        waitText("ADD MEDIA").click()
    }

    private fun importNamed(name: String, timeout: Long = 20_000L) {
        tapAddMedia()
        assertDocumentsUi()
        selectDocument(name)
        waitTextContains(name.substringBeforeLast('.'), timeout)
    }

    private fun assertDocumentsUi() {
        assertTrue(
            "Android DocumentsUI did not open",
            device.wait(Until.hasObject(By.pkg("com.google.android.documentsui")), 15_000L)
        )
    }

    private fun selectDocument(name: String) {
        waitTextContains(name, 15_000L)
        val item = device.findObject(By.textContains(name)) ?: error("Document item not found: $name")
        item.click()
        val open = device.wait(Until.findObject(By.text("OPEN")), 10_000L)
            ?: device.wait(Until.findObject(By.text("Open")), 10_000L)
            ?: error("OPEN button not found for $name")
        open.click()
        assertTrue(
            "NexusNova did not regain focus after selecting $name",
            device.wait(Until.hasObject(By.pkg("com.nexusnova.app")), 15_000L)
        )
    }

    private fun publishFixtureToDownloads(name: String, mime: String) {
        val source = File(context.filesDir, "qa/$name")
        assertTrue("Fixture missing from test app: $name", source.isFile && source.length() > 0)
        publishDownload(name, mime) { out ->
            source.inputStream().use { input -> input.copyTo(out) }
        }
    }

    private fun publishBitmap(name: String, format: Bitmap.CompressFormat, mime: String) {
        val bitmap = Bitmap.createBitmap(32, 32, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.rgb(108, 76, 255))
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; textSize = 10f }
        canvas.drawText("NN", 7f, 20f, paint)
        publishDownload(name, mime) { out ->
            assertTrue("Bitmap encoding failed: $name", bitmap.compress(format, 90, out))
        }
        bitmap.recycle()
    }

    private fun webpFormat(): Bitmap.CompressFormat {
        require(Build.VERSION.SDK_INT >= 30) { "WebP test requires Android 11+" }
        return Bitmap.CompressFormat.WEBP_LOSSY
    }

    private fun publishRaw(name: String, mime: String, bytes: ByteArray) {
        publishDownload(name, mime) { out -> out.write(bytes) }
    }

    private fun publishDownload(name: String, mime: String, writer: (OutputStream) -> Unit) {
        cleanupDownload(name)
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, name)
            put(MediaStore.Downloads.MIME_TYPE, mime)
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val uri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: error("Could not create MediaStore fixture: $name")
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

    private fun waitForAnyText(timeout: Long, vararg values: String): Boolean {
        val deadline = System.currentTimeMillis() + timeout
        while (System.currentTimeMillis() < deadline) {
            if (values.any { device.hasObject(By.textContains(it)) }) return true
            Thread.sleep(250L)
        }
        return false
    }

    private fun waitText(value: String, timeout: Long = 30_000L): UiObject2 =
        device.wait(Until.findObject(By.text(value)), timeout)
            ?: error("Timed out waiting for text: $value")

    private fun waitTextContains(value: String, timeout: Long = 30_000L): UiObject2 =
        device.wait(Until.findObject(By.textContains(value)), timeout)
            ?: error("Timed out waiting for text containing: $value")

    private fun capture(name: String) {
        val dir = context.getExternalFilesDir(Environment.DIRECTORY_PICTURES)
            ?: error("External pictures directory unavailable")
        dir.mkdirs()
        assertTrue("Screenshot failed: $name", device.takeScreenshot(File(dir, name)))
    }
}
