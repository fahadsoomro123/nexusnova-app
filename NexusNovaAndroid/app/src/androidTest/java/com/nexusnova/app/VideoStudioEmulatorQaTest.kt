package com.nexusnova.app

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
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
        assertTrue("WebM fixture type mismatch", webm)
        val bytes = Base64.decode(WEBM_FIXTURE_BASE64, Base64.DEFAULT)
        assertTrue("Static WebM fixture is empty", bytes.isNotEmpty())
        publishDownload(name, mime) { out -> out.write(bytes) }
    }

    companion object {
        private const val WEBM_FIXTURE_BASE64 = "Process started with PID 15468 (shell: powershell)Initial output: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"
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
