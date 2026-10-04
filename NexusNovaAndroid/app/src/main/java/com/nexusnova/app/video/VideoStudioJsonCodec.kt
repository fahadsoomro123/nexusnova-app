package com.nexusnova.app.video

import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import kotlin.math.roundToLong

/**
 * Adapter between the existing WebView editor payload and the canonical native
 * VideoProject model. It deliberately accepts only the fields we can validate
 * and keeps unknown UI-only fields out of the media engine.
 */
object VideoStudioJsonCodec {

    fun decodeProject(
        payload: JSONObject,
        registry: VideoMediaRegistry
    ): VideoProject {
        val clipsJson = payload.optJSONArray("clips")
            ?: throw IllegalArgumentException("Video project has no clips.")

        val clips = ArrayList<VideoClip>(clipsJson.length())
        var timelineStartMs = 0L

        for (index in 0 until clipsJson.length()) {
            val raw = clipsJson.optJSONObject(index)
                ?: throw IllegalArgumentException("Clip " + (index + 1) + " is invalid.")

            val sourceKey = raw.optString("nativeSourceKey").trim()
                .ifBlank { raw.optString("sourceKey").trim() }
            val entry = registry.resolve(sourceKey)
                ?: throw IllegalArgumentException("Native media source is unavailable for clip " + (index + 1) + ".")

            val mediaType = when (raw.optString("kind", "video").lowercase()) {
                "image", "photo" -> MediaType.IMAGE
                else -> MediaType.VIDEO
            }

            val sourceDurationMs = secondsToMs(
                raw.optDouble("sourceDuration", raw.optDouble("out", 0.1))
            ).coerceAtLeast(1L)

            val trimInMs = secondsToMs(raw.optDouble("in", 0.0)).coerceIn(0L, sourceDurationMs - 1L)
            val requestedOutMs = secondsToMs(
                raw.optDouble("out", sourceDurationMs.toDouble() / 1000.0)
            )
            val trimOutMs = requestedOutMs.coerceIn(trimInMs + 1L, sourceDurationMs)

            val speed = raw.optDouble("speed", 1.0).toFloat().coerceIn(0.0625f, 16f)
            val volume = raw.optDouble("volume", 1.0).toFloat().coerceIn(0f, 1f)

            val clip = VideoClip(
                id = raw.optString("id").trim().ifBlank { UUID.randomUUID().toString() },
                sourceUri = entry.uri,
                mediaType = mediaType,
                sourceDurationMs = sourceDurationMs,
                timelineStartMs = timelineStartMs,
                trimInMs = trimInMs,
                trimOutMs = trimOutMs,
                speed = speed,
                audioVolume = volume,
                muted = raw.optBoolean("muted", false),
                scale = raw.optDouble("scale", 1.0).toFloat().coerceAtLeast(0.01f),
                rotationDegrees = raw.optDouble("rotation", 0.0).toFloat(),
                flipX = raw.optBoolean("flipX", false),
                flipY = raw.optBoolean("flipY", false)
            )

            clips += clip
            timelineStartMs += clip.timelineDurationMs()
        }

        return VideoProject(
            projectId = payload.optString("projectId").trim().ifBlank { UUID.randomUUID().toString() },
            projectName = payload.optString("projectName").trim().ifBlank { "NexusNova Project" },
            canvas = CanvasState(
                ratio = parseRatio(payload.optString("ratio", "16:9")),
                background = parseBackground(payload.optString("background", "black"))
            ),
            clips = clips,
            audioTracks = decodeAudioTracks(payload.optJSONArray("audioTracks"), registry),
            textOverlays = decodeTextOverlays(payload.optJSONArray("textOverlays")),
            captions = decodeCaptions(payload.optJSONArray("captions")),
            transitions = decodeTransitions(payload.optJSONArray("transitions"))
        )
    }

    private fun decodeAudioTracks(
        json: JSONArray?,
        registry: VideoMediaRegistry
    ): List<AudioTrack> {
        if (json == null) return emptyList()

        val tracks = ArrayList<AudioTrack>(json.length())
        for (index in 0 until json.length()) {
            val raw = json.optJSONObject(index) ?: continue
            val sourceKey = raw.optString("nativeSourceKey").trim()
                .ifBlank { raw.optString("sourceKey").trim() }
            val uri = registry.resolve(sourceKey)?.uri
                ?: throw IllegalArgumentException("Native audio source is unavailable for track " + (index + 1) + ".")

            tracks += AudioTrack(
                id = raw.optString("id").trim().ifBlank { UUID.randomUUID().toString() },
                sourceUri = uri,
                startTimeMs = secondsToMs(raw.optDouble("startTime", 0.0)).coerceAtLeast(0L),
                trimInMs = secondsToMs(raw.optDouble("trimIn", 0.0)).coerceAtLeast(0L),
                trimOutMs = raw.optDouble("trimOut", -1.0)
                    .takeIf { it >= 0.0 }
                    ?.let(::secondsToMs),
                volume = raw.optDouble("volume", 1.0).toFloat().coerceIn(0f, 1f),
                muted = raw.optBoolean("muted", false),
                loop = raw.optBoolean("loop", false)
            )
        }
        return tracks
    }

    private fun decodeTextOverlays(json: JSONArray?): List<TextOverlay> {
        if (json == null) return emptyList()
        val overlays = ArrayList<TextOverlay>(json.length())
        for (index in 0 until json.length()) {
            val raw = json.optJSONObject(index) ?: continue
            overlays += TextOverlay(
                id = raw.optString("id").trim().ifBlank { UUID.randomUUID().toString() },
                text = raw.optString("text"),
                startTimeMs = secondsToMs(raw.optDouble("startTime", 0.0)).coerceAtLeast(0L),
                endTimeMs = secondsToMs(raw.optDouble("endTime", 0.0)).coerceAtLeast(1L),
                x = raw.optDouble("x", 0.0).toFloat(),
                y = raw.optDouble("y", 0.0).toFloat(),
                scale = raw.optDouble("scale", 1.0).toFloat().coerceAtLeast(0.01f),
                rotationDegrees = raw.optDouble("rotation", 0.0).toFloat(),
                styleId = raw.optString("styleId", "default")
            )
        }
        return overlays
    }

    private fun decodeCaptions(json: JSONArray?): List<CaptionSegment> {
        if (json == null) return emptyList()
        val captions = ArrayList<CaptionSegment>(json.length())
        for (index in 0 until json.length()) {
            val raw = json.optJSONObject(index) ?: continue
            captions += CaptionSegment(
                id = raw.optString("id").trim().ifBlank { UUID.randomUUID().toString() },
                startTimeMs = secondsToMs(raw.optDouble("startTime", 0.0)).coerceAtLeast(0L),
                endTimeMs = secondsToMs(raw.optDouble("endTime", 0.0)).coerceAtLeast(1L),
                text = raw.optString("text"),
                styleId = raw.optString("styleId", "default")
            )
        }
        return captions
    }

    private fun decodeTransitions(json: JSONArray?): List<TransitionSpec> {
        if (json == null) return emptyList()
        val transitions = ArrayList<TransitionSpec>(json.length())
        for (index in 0 until json.length()) {
            val raw = json.optJSONObject(index) ?: continue
            transitions += TransitionSpec(
                id = raw.optString("id").trim().ifBlank { UUID.randomUUID().toString() },
                fromClipId = raw.optString("fromClipId"),
                toClipId = raw.optString("toClipId"),
                type = when (raw.optString("type").lowercase()) {
                    "fade" -> TransitionType.FADE
                    "dissolve" -> TransitionType.DISSOLVE
                    "wipe" -> TransitionType.WIPE
                    "slide" -> TransitionType.SLIDE
                    else -> TransitionType.NONE
                },
                durationMs = secondsToMs(raw.optDouble("duration", 0.0)).coerceAtLeast(0L)
            )
        }
        return transitions
    }

    private fun parseRatio(value: String): CanvasRatio = when (value.trim()) {
        "9:16" -> CanvasRatio.RATIO_9_16
        "1:1" -> CanvasRatio.RATIO_1_1
        "4:5" -> CanvasRatio.RATIO_4_5
        else -> CanvasRatio.RATIO_16_9
    }

    private fun parseBackground(value: String): CanvasBackground = when (value.trim().lowercase()) {
        "white", "#ffffff" -> CanvasBackground.WHITE
        "transparent", "none" -> CanvasBackground.TRANSPARENT
        else -> CanvasBackground.BLACK
    }

    private fun secondsToMs(value: Double): Long =
        (value.coerceAtLeast(0.0) * 1000.0).roundToLong()
}
