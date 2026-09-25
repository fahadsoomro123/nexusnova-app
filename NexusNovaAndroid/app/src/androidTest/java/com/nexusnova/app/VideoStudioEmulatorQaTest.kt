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
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry
import androidx.test.runner.lifecycle.Stage
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
        var gates = 0
        fun gate(label: String) {
            gates += 1
            println("[HARD-QA " + gates.toString().padStart(2, '0') + "] PASS — " + label)
        }

        freshEditor()
        gate("NexusNova launches directly into the real Video Studio editor")

        val name = "ota11-video-import.webm"
        publishVideoFixture(name, "video/webm", webm = true)
        assertDownloadFixture(name)
        gate("Deterministic WebM fixture is published in Downloads")

        assertTrue("Video Studio DOM is not ready", qaEval("document.querySelector('.nx-video-flagship') ? 'ready' : ''") == "ready")
        val emptyState = qaEval("JSON.stringify({present:!!document.querySelector('[data-empty]'),visible:!!document.querySelector('[data-empty]:not(.nx-video-hidden)'),text:(document.querySelector('[data-empty]')?.textContent||'').trim()})")
        assertTrue("Video Studio empty state is missing before import", emptyState.contains("\"present\":true"))
        assertTrue("Video Studio empty state is not visibly rendered", emptyState.contains("\"visible\":true"))
        val emptyText = qaEval("document.querySelector('[data-empty]')?.textContent?.trim() || ''")
        assertTrue("Video Studio empty state has no user-facing content", emptyText.isNotBlank())
        gate("Video Studio screen is ready before import")

        val addPoint = qaPoint("[data-add]") ?: error("ADD MEDIA button has no measurable screen position")
        assertTrue("ADD MEDIA control missing from Video Studio", qaEval("document.querySelector('[data-add]') ? 'present' : ''") == "present")
        gate("ADD MEDIA control is present in the real editor DOM")

        device.click(addPoint.first, addPoint.second)
        gate("A real Android touch initiates the native file-picker flow")

        assertDocumentsUi()
        gate("Android DocumentsUI is visible")

        waitTextContains(name)
        assertTrue("Picker did not show the generated video fixture", device.hasObject(By.textContains(name)))
        gate("Generated WebM is discoverable in the Android picker")

        val item = device.findObject(By.textContains(name)) ?: error("Document item not found: $name")
        assertTrue("Generated picker item is not visibly selectable", item.visibleBounds.width() > 0 && item.visibleBounds.height() > 0)
        gate("Picker exposes a visible selectable file row")

        selectDocument(name)
        assertTrue("NexusNova activity did not regain focus", device.wait(Until.hasObject(By.pkg("com.nexusnova.app")), 15_000L))
        gate("Native picker selection returns control to the NexusNova activity")

        waitQa(30_000L) { qaEval("document.querySelectorAll('.nx-video-clip[data-id]').length") == "1" }
        val importedName = qaEval("document.querySelector('.nx-video-clip[data-id] .nx-video-clip-meta b')?.textContent || ''")
        assertTrue("Imported video filename is missing from the real timeline", importedName.contains("ota11-video-import"))
        gate("Imported video is rendered as a real timeline item after picker return")

        val playback = qaEval("JSON.stringify({visible:!!document.querySelector('[data-play]:not(.nx-video-hidden)'), aria:document.querySelector('[data-play]')?.getAttribute('aria-label')||'', source:document.querySelector('[data-main-video]')?.getAttribute('src')||''})")
        assertTrue("Playback control is missing after import", playback.contains("\"visible\":true"))
        assertTrue("Imported video has no preview source", playback.contains("\"source\":\"blob:"))
        assertTrue("Playback control lacks its actionable label", playback.contains("Play or pause"))
        gate("Imported video preview and playback control are live")

        val addAgainPoint = qaPoint("[data-add]") ?: error("ADD MEDIA control disappeared after import")
        assertTrue("Editor controls disappeared after import", qaEval("document.querySelectorAll('[data-tool]').length") == "10")
        gate("The full flagship editor remains mounted after native import")

        device.click(addAgainPoint.first, addAgainPoint.second)
        gate("Second real Android touch reopens the native picker")
        assertDocumentsUi()
        waitTextContains(name)
        gate("Native picker remains repeatable after an imported clip exists")

        device.pressBack()
        assertTrue("NexusNova activity did not return after cancelling the picker", device.wait(Until.hasObject(By.pkg("com.nexusnova.app")), 10_000L))
        assertTrue("Imported clip disappeared after picker cancellation", qaEval("document.querySelectorAll('.nx-video-clip[data-id]').length") == "1")
        capture("video-studio-hard-qa-pass.png")
        gate("Picker cancellation preserves the imported editor state and captures runtime evidence")

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

        val deadline = System.currentTimeMillis() + 30_000L
        var activity: MainActivity? = null
        while (System.currentTimeMillis() < deadline) {
            activity = currentMainActivity()
            if (activity != null && activity.qaEvaluateJavascript("typeof window.NexusNovaFresh !== 'undefined'", 1_500L) == "true") break
            Thread.sleep(350L)
        }
        assertTrue("MainActivity WebView did not expose the QA bridge", activity != null)
        assertTrue("NexusNovaFresh bootstrap never became available", activity?.qaEvaluateJavascript("typeof window.NexusNovaFresh !== 'undefined'") == "true")

        // Do not race the app's normal boot sequence. The DEBUG bridge is exposed
        // before the splash/auth route finishes, so a direct route call can be
        // overwritten by boot(). Wait until boot has mounted its first real route.
        waitQa(15_000L) {
            val route = qaEval("document.querySelector('#nx-stage')?.dataset.route || ''")
            route == "auth" || route == "mine" || route == "hub"
        }

        val opened = activity?.qaEvaluateJavascript("window.NexusNovaFresh.openAppDirectForQa('ai-video-studio'); 'opened'")?.contains("opened") == true
        assertTrue("Direct Video Studio QA route did not execute", opened)
        try {
            waitQa(30_000L) { qaEval("document.querySelector('.nx-video-flagship') ? 'ready' : ''") == "ready" }
        } catch (error: Throwable) {
            val diagnostic = qaEval(
                """JSON.stringify({
                    url: location.href,
                    route: document.querySelector('#nx-stage')?.dataset.route || '',
                    readyState: document.readyState,
                    bodyText: (document.body?.innerText || '').slice(0, 1200),
                    stageHtml: (document.querySelector('#nx-stage')?.innerHTML || '').slice(0, 3000),
                    appMountHtml: (document.querySelector('[data-app-mount]')?.innerHTML || '').slice(0, 3000)
                })"""
            )
            println("[HARD-QA-DIAGNOSTIC] $diagnostic")
            throw error
        }
    }

    private fun currentMainActivity(): MainActivity? {
        var found: MainActivity? = null
        instrumentation.runOnMainSync {
            found = ActivityLifecycleMonitorRegistry.getInstance()
                .getActivitiesInStage(Stage.RESUMED)
                .filterIsInstance<MainActivity>()
                .firstOrNull()
        }
        return found
    }

    private fun qaEval(script: String, timeoutMs: Long = 5_000L): String {
        val activity = currentMainActivity() ?: return ""
        val raw = activity.qaEvaluateJavascript(script, timeoutMs) ?: return ""
        return raw.trim().trim('"').replace("\\\"", "\"")
    }

    private fun waitQa(timeoutMs: Long, predicate: () -> Boolean) {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (predicate()) return
            Thread.sleep(200L)
        }
        error("Timed out waiting for Video Studio DOM condition")
    }

    private fun qaPoint(selector: String): Pair<Int, Int>? {
        val value = qaEval(
            """(() => {
              const el = document.querySelector(""" + selector.quoteJs() + """);
              if (!el) return '';
              const r = el.getBoundingClientRect();
              if (!(r.width > 0 && r.height > 0)) return '';
              return Math.round(r.left + r.width / 2) + ',' + Math.round(r.top + r.height / 2);
            })()"""
        )
        val parts = value.split(',')
        if (parts.size != 2) return null
        val x = parts[0].trim().toIntOrNull() ?: return null
        val y = parts[1].trim().toIntOrNull() ?: return null
        return x to y
    }

    private fun String.quoteJs(): String =
        "'" + replace("\\", "\\\\").replace("'", "\\'") + "'"

    private fun assertDocumentsUi() {
        assertTrue(
            "Android DocumentsUI did not open",
            device.wait(Until.hasObject(By.pkg("com.google.android.documentsui")), 15_000L)
        )
    }

    private fun selectDocument(name: String) {
        waitTextContains(name, 15_000L)
        val item = device.findObject(By.textContains(name))
            ?: error("Document item not found: $name")
        item.click()

        val open =
            device.wait(Until.findObject(By.text("OPEN")), 10_000L)
                ?: device.wait(Until.findObject(By.text("Open")), 10_000L)
                ?: error("OPEN button not found for $name")
        open.click()

        assertTrue(
            "NexusNova did not regain focus after selecting $name",
            device.wait(Until.hasObject(By.pkg("com.nexusnova.app")), 15_000L)
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
