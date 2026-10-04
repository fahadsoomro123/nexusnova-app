package com.nexusnova.app.video

import android.content.Context
import android.os.Environment
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MimeTypes
import androidx.media3.common.Composition
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Native NexusNova export coordinator.
 *
 * Media3 performs the encoding asynchronously. UI layers receive lifecycle
 * and progress events through a small listener instead of owning media-engine
 * state themselves.
 */
class VideoStudioExporter(
    private val context: Context
) {

    interface Listener {
        fun onStarted(outputFile: File)
        fun onProgress(percent: Int)
        fun onCompleted(outputFile: File, result: ExportResult)
        fun onCancelled(outputFile: File?)
        fun onError(outputFile: File?, error: ExportException)
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val exporting = AtomicBoolean(false)
    private var transformer: Transformer? = null
    private var activeOutput: File? = null
    private var activeListener: Listener? = null
    private var progressRunnable: Runnable? = null

    /**
     * Starts a native MP4 export from the canonical NexusNova project state.
     *
     * Transformer instances must be accessed from one application thread, so
     * start/cancel are explicitly confined to the main application thread.
     * Media3 runs the actual media processing asynchronously.
     */
    fun start(project: VideoProject, listener: Listener): File {
        check(Looper.myLooper() == Looper.getMainLooper()) {
            "VideoStudioExporter.start must be called on the main application thread."
        }
        check(exporting.compareAndSet(false, true)) {
            "A Video Studio export is already running."
        }

        val outputDir = File(
            context.getExternalFilesDir(Environment.DIRECTORY_MOVIES)
                ?: File(context.filesDir, "exports"),
            "nexusnova-video"
        )
        if (!outputDir.exists() && !outputDir.mkdirs()) {
            exporting.set(false)
            throw IllegalStateException("Unable to create the NexusNova export directory.")
        }

        val outputFile = File(
            outputDir,
            "nexusnova-" + System.currentTimeMillis() + ".mp4"
        )

        val composition = try {
            VideoStudioCompositionFactory.build(project)
        } catch (error: Throwable) {
            exporting.set(false)
            throw error
        }

        activeOutput = outputFile
        activeListener = listener

        val activeTransformer = Transformer.Builder(context)
            .setVideoMimeType(MimeTypes.VIDEO_H264)
            .setAudioMimeType(MimeTypes.AUDIO_AAC)
            .addListener(object : Transformer.Listener {
                override fun onCompleted(
                    completedComposition: Composition,
                    result: ExportResult
                ) {
                    if (!isCurrent(activeTransformer = transformer)) return
                    exporting.set(false)
                    stopProgressPolling()
                    val output = activeOutput
                    val callback = activeListener
                    clearActive()
                    if (output != null && callback != null) {
                        callback.onCompleted(output, result)
                    }
                }

                override fun onError(
                    failedComposition: Composition,
                    result: ExportResult,
                    exception: ExportException
                ) {
                    if (!isCurrent(activeTransformer = transformer)) return
                    exporting.set(false)
                    stopProgressPolling()
                    val output = activeOutput
                    val callback = activeListener
                    clearActive()
                    callback?.onError(output, exception)
                }
            })
            .build()

        transformer = activeTransformer

        try {
            activeTransformer.start(composition, outputFile.absolutePath)
            listener.onStarted(outputFile)
            startProgressPolling(activeTransformer)
            return outputFile
        } catch (error: Throwable) {
            exporting.set(false)
            stopProgressPolling()
            clearActive()
            throw error
        }
    }

    fun cancel() {
        check(Looper.myLooper() == Looper.getMainLooper()) {
            "VideoStudioExporter.cancel must be called on the main application thread."
        }

        val current = transformer ?: return
        val output = activeOutput
        val callback = activeListener

        exporting.set(false)
        stopProgressPolling()
        transformer = null
        activeOutput = null
        activeListener = null

        current.cancel()
        callback?.onCancelled(output)
    }

    fun isExporting(): Boolean = exporting.get()

    private fun startProgressPolling(current: Transformer) {
        val holder = ProgressHolder()

        val runnable = object : Runnable {
            override fun run() {
                if (!exporting.get() || transformer !== current) return

                val state = current.getProgress(holder)
                if (state == Transformer.PROGRESS_STATE_AVAILABLE) {
                    activeListener?.onProgress(holder.progress.coerceIn(0, 100))
                }

                if (exporting.get() && transformer === current) {
                    mainHandler.postDelayed(this, 500L)
                }
            }
        }

        progressRunnable = runnable
        mainHandler.post(runnable)
    }

    private fun stopProgressPolling() {
        progressRunnable?.let(mainHandler::removeCallbacks)
        progressRunnable = null
    }

    private fun clearActive() {
        transformer = null
        activeOutput = null
        activeListener = null
    }

    private fun isCurrent(activeTransformer: Transformer?): Boolean =
        exporting.get() && transformer === activeTransformer
}
