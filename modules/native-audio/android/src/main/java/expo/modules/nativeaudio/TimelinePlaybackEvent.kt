package expo.modules.nativeaudio

/**
 * One compiled score tick passed from SongPlaybackCompiler (JS).
 * Timing is derived from [bpm] and [subdivisionIndex] when building offsets.
 */
internal data class TimelinePlaybackEvent(
  val sequence: Long,
  val bpm: Double,
  val accent: Boolean,
  val subdivisionIndex: Int,
  val beatIndexInBar: Int,
  val beatsPerMeasure: Int,
  val barId: String,
  val sectionId: String,
)
