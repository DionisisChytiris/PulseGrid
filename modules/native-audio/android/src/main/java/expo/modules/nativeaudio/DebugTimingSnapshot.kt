package expo.modules.nativeaudio

/** TEMP: debug timing overlay payload — remove with DebugTimingOverlay. */
internal data class DebugTimingSnapshot(
  val sequence: Long,
  val bpm: Double,
  val subdivision: String,
  val latenessUs: Long,
  val avgLatenessUs: Long,
  val maxLatenessUs: Long,
  val playbackFailures: Int,
)
