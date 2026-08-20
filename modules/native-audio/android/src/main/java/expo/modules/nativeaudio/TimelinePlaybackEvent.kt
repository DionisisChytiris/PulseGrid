package expo.modules.nativeaudio

/**
 * One compiled score tick passed from SongPlaybackCompiler (JS).
 * Timing is derived from [bpm] and [ticksPerBeat] when building offsets.
 */
internal data class TimelinePlaybackEvent(
  val sequence: Long,
  val bpm: Double,
  val accent: Boolean,
  val subdivisionIndex: Int,
  val ticksPerBeat: Int,
  val beatIndexInBar: Int,
  val beatsPerMeasure: Int,
  val barId: String,
  val sectionId: String,
)
