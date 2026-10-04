package com.nexusnova.app.video

import android.net.Uri

/**
 * Canonical, UI-agnostic edit model for NexusNova AI Video Studio.
 *
 * UI layers may serialize to/from this model, but playback and export should
 * ultimately consume this state rather than separate per-control variables.
 */
data class VideoProject(
    val projectId: String,
    val projectName: String = "NexusNova Project",
    val canvas: CanvasState = CanvasState(),
    val clips: List<VideoClip> = emptyList(),
    val audioTracks: List<AudioTrack> = emptyList(),
    val textOverlays: List<TextOverlay> = emptyList(),
    val captions: List<CaptionSegment> = emptyList(),
    val transitions: List<TransitionSpec> = emptyList()
) {
    fun durationMs(): Long =
        clips.maxOfOrNull { it.timelineStartMs + it.timelineDurationMs() } ?: 0L

    fun validateTimeline(): List<String> {
        val errors = mutableListOf<String>()
        var expectedStart = 0L
        clips.forEachIndexed { index, clip ->
            if (clip.timelineStartMs != expectedStart) {
                errors += "Clip " + (index + 1) + " starts at " + clip.timelineStartMs + "ms; expected " + expectedStart + "ms."
            }
            if (clip.trimOutMs <= clip.trimInMs) {
                errors += "Clip " + (index + 1) + " has an invalid trim range."
            }
            if (clip.speed <= 0f) {
                errors += "Clip " + (index + 1) + " has an invalid speed."
            }
            expectedStart = clip.timelineStartMs + clip.timelineDurationMs()
        }
        return errors
    }
}

data class CanvasState(
    val ratio: CanvasRatio = CanvasRatio.RATIO_16_9,
    val background: CanvasBackground = CanvasBackground.BLACK
)

enum class CanvasRatio(val width: Int, val height: Int) {
    RATIO_16_9(16, 9),
    RATIO_9_16(9, 16),
    RATIO_1_1(1, 1),
    RATIO_4_5(4, 5)
}

enum class CanvasBackground {
    BLACK,
    WHITE,
    TRANSPARENT
}

data class VideoClip(
    val id: String,
    val sourceUri: Uri,
    val mediaType: MediaType = MediaType.VIDEO,
    val sourceDurationMs: Long,
    val timelineStartMs: Long,
    val trimInMs: Long = 0L,
    val trimOutMs: Long = sourceDurationMs,
    val speed: Float = 1f,
    val audioVolume: Float = 1f,
    val muted: Boolean = false,
    val scale: Float = 1f,
    val rotationDegrees: Float = 0f,
    val flipX: Boolean = false,
    val flipY: Boolean = false,
    val crop: CropSpec? = null,
    val brightness: Float = 1f,
    val contrast: Float = 1f,
    val saturation: Float = 1f,
    val effectId: String = "none",
    val transformX: Float = 0f,
    val transformY: Float = 0f,
    val textOverlayIds: List<String> = emptyList(),
    val captionIds: List<String> = emptyList(),
    val motion: MotionSpec? = null
) {
    init {
        require(sourceDurationMs > 0) { "sourceDurationMs must be positive" }
        require(trimInMs >= 0) { "trimInMs must be non-negative" }
        require(trimOutMs > trimInMs) { "trimOutMs must be greater than trimInMs" }
        require(speed > 0f) { "speed must be positive" }
        require(audioVolume in 0f..1f) { "audioVolume must be in [0,1]" }
        require(scale > 0f) { "scale must be positive" }
    }

    fun trimmedDurationMs(): Long = trimOutMs - trimInMs

    fun timelineDurationMs(): Long =
        (trimmedDurationMs() / speed).toLong().coerceAtLeast(1L)
}

enum class MediaType {
    VIDEO,
    IMAGE
}

data class CropSpec(
    val left: Float,
    val right: Float,
    val bottom: Float,
    val top: Float
)

data class MotionSpec(
    val keyframes: List<Keyframe> = emptyList()
)

data class Keyframe(
    val timeMs: Long,
    val property: MotionProperty,
    val value: Float
)

enum class MotionProperty {
    X,
    Y,
    SCALE,
    ROTATION,
    OPACITY
}

data class AudioTrack(
    val id: String,
    val sourceUri: Uri,
    val startTimeMs: Long = 0L,
    val trimInMs: Long = 0L,
    val trimOutMs: Long? = null,
    val volume: Float = 1f,
    val muted: Boolean = false,
    val loop: Boolean = false
)

data class TextOverlay(
    val id: String,
    val text: String,
    val startTimeMs: Long,
    val endTimeMs: Long,
    val x: Float = 0f,
    val y: Float = 0f,
    val scale: Float = 1f,
    val rotationDegrees: Float = 0f,
    val styleId: String = "default"
)

data class CaptionSegment(
    val id: String,
    val startTimeMs: Long,
    val endTimeMs: Long,
    val text: String,
    val styleId: String = "default"
)

data class TransitionSpec(
    val id: String,
    val fromClipId: String,
    val toClipId: String,
    val type: TransitionType,
    val durationMs: Long
)

enum class TransitionType {
    NONE,
    FADE,
    DISSOLVE,
    WIPE,
    SLIDE
}
