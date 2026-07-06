package expo.modules.nativeaudio

/** Musical tick data for one scheduler sequence (no timing fields). */
internal data class EventSourceTick(
  val beatIndexInBar: Int,
  val beatNumber: Int,
  val beatsPerMeasure: Int,
  val subdivisionIndex: Int,
  val isAccent: Boolean,
)
