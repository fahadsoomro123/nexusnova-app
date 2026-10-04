package com.nexusnova.app.video

import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.Effects
import androidx.media3.effect.Crop
import androidx.media3.effect.ScaleAndRotateTransformation

/**
 * Converts the canonical NexusNova project state into Media3 Composition objects.
 *
 * The factory intentionally has no UI dependencies. That lets preview, playback,
 * and export consume the same composition graph once their runtime adapters are
 * connected.
 *
 * Current foundation supports:
 * - sequential video/image clips
 * - clip trim
 * - clip speed
 * - clip rotation/scale/flip
 * - clip audio mute/volume
 * - independent audio sequences
 *
 * Text, caption, transition, keyframe and arbitrary position rendering are kept
 * in the canonical model and are added to the composition layer in later phases
 * with explicit render/effect implementations rather than fake UI-only state.
 */
@UnstableApi
object VideoStudioCompositionFactory {

    fun build(project: VideoProject): Composition {
        require(project.clips.isNotEmpty()) { "A video project must contain at least one clip." }

        val timelineErrors = project.validateTimeline()
        require(timelineErrors.isEmpty()) {
            "Timeline is not exportable: " + timelineErrors.joinToString("; ")
        }

        require(project.transitions.isEmpty()) {
            "Transitions are present but the native transition renderer is not implemented yet."
        }

        val videoItems = project.clips.map(::buildVideoItem)
        val sequences = mutableListOf<EditedMediaItemSequence>()

        sequences += EditedMediaItemSequence.withVideoFrom(videoItems)

        val clipAudioItems = project.clips
            .filter { it.mediaType == MediaType.VIDEO && !it.muted && it.audioVolume > 0f }
            .map(::buildClipAudioItem)

        if (clipAudioItems.isNotEmpty()) {
            sequences += EditedMediaItemSequence.withAudioFrom(clipAudioItems)
        }

        project.audioTracks
            .filterNot { it.muted || it.volume <= 0f }
            .forEach { track ->
                sequences += buildAudioTrackSequence(track)
            }

        return Composition.Builder(*sequences.toTypedArray()).build()
    }

    private fun buildVideoItem(clip: VideoClip): EditedMediaItem {
        val mediaItem = buildMediaItem(
            clip = clip,
            includeImageDuration = clip.mediaType == MediaType.IMAGE,
            imageDurationMs = clip.timelineDurationMs()
        )

        val effects = buildVideoEffects(clip)

        val builder = EditedMediaItem.Builder(mediaItem)
            .setEffects(effects)
            .setSpeed(clip.speed.coerceIn(0.0625f, 16f))

        if (clip.mediaType == MediaType.IMAGE) {
            builder.setFrameRate(DEFAULT_IMAGE_FPS)
        }

        return builder.build()
    }

    private fun buildClipAudioItem(clip: VideoClip): EditedMediaItem {
        val mediaItem = buildMediaItem(clip = clip, includeImageDuration = false)
        val audioProcessors = buildVolumeProcessors(clip.audioVolume)

        return EditedMediaItem.Builder(mediaItem)
            .setEffects(Effects(audioProcessors, emptyList()))
            .setRemoveVideo(true)
            .setSpeed(clip.speed.coerceIn(0.0625f, 16f))
            .build()
    }

    private fun buildAudioTrackSequence(track: AudioTrack): EditedMediaItemSequence {
        require(track.startTimeMs >= 0L) { "Audio track start time cannot be negative." }
        require(track.trimInMs >= 0L) { "Audio track trim-in cannot be negative." }

        val clipping = MediaItem.ClippingConfiguration.Builder()
            .setStartPositionMs(track.trimInMs)
            .apply {
                track.trimOutMs?.let { setEndPositionMs(it) }
            }
            .build()

        val mediaItem = MediaItem.Builder()
            .setUri(track.sourceUri)
            .setClippingConfiguration(clipping)
            .build()

        val processed = EditedMediaItem.Builder(mediaItem)
            .setEffects(
                Effects(
                    buildVolumeProcessors(track.volume),
                    emptyList()
                )
            )
            .setRemoveVideo(true)
            .build()

        val builder = EditedMediaItemSequence.Builder(setOf(C.TRACK_TYPE_AUDIO))
        if (track.startTimeMs > 0L) builder.addGap(track.startTimeMs * 1000L)
        builder.addItem(processed)
        if (track.loop) builder.setIsLooping(true)
        return builder.build()
    }

    private fun buildMediaItem(
        clip: VideoClip,
        includeImageDuration: Boolean,
        imageDurationMs: Long = 0L
    ): MediaItem {
        val clipping = MediaItem.ClippingConfiguration.Builder()
            .setStartPositionMs(clip.trimInMs)
            .setEndPositionMs(clip.trimOutMs)
            .build()

        return MediaItem.Builder()
            .setUri(clip.sourceUri)
            .setClippingConfiguration(clipping)
            .apply {
                if (includeImageDuration) {
                    setImageDurationMs(imageDurationMs.coerceAtLeast(1L))
                }
            }
            .build()
    }

    private fun buildVideoEffects(clip: VideoClip): Effects {
        val effects = mutableListOf<androidx.media3.common.Effect>()

        if (clip.crop != null) {
            val c = clip.crop
            effects += Crop(
                c.left,
                c.right,
                c.bottom,
                c.top
            )
        }

        val scaleX = (if (clip.flipX) -1f else 1f) * clip.scale
        val scaleY = (if (clip.flipY) -1f else 1f) * clip.scale

        if (scaleX != 1f || scaleY != 1f || clip.rotationDegrees != 0f) {
            effects += ScaleAndRotateTransformation.Builder()
                .setScale(scaleX, scaleY)
                .setRotationDegrees(clip.rotationDegrees)
                .build()
        }

        return Effects(emptyList(), effects)
    }

    private fun buildVolumeProcessors(volume: Float): List<androidx.media3.common.audio.AudioProcessor> {
        val normalized = volume.coerceIn(0f, 1f)
        if (normalized >= 0.999f) return emptyList()

        val processor = androidx.media3.common.audio.ChannelMixingAudioProcessor()
        for (inputChannels in 1..6) {
            val matrix = androidx.media3.common.audio.ChannelMixingMatrix
                .createForConstantPower(inputChannels, inputChannels)
                .scaleBy(normalized)
            processor.putChannelMixingMatrix(matrix)
        }
        return listOf(processor)
    }

    private const val DEFAULT_IMAGE_FPS = 30
}
