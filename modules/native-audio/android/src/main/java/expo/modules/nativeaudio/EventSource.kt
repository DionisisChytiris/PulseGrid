package expo.modules.nativeaudio

/**
 * Supplies musical tick data and monotonic deadline offsets for MetronomeEngine.
 * Quick mode is unbounded; song mode is finite and precomputed.
 */
internal interface EventSource {
  fun reset()

  /** Null when the stream is unbounded (quick metronome). */
  fun eventCount(): Int?

  fun peekAt(sequence: Long): EventSourceTick?

  /** Nanoseconds from score start to the deadline of [sequence]. */
  fun offsetNsForSequence(sequence: Long): Long

  /** BPM at [sequence] for lookahead horizon estimation. */
  fun bpmAt(sequence: Long): Double

  /** Subdivision ticks per beat at [sequence] for lookahead estimation. */
  fun ticksPerBeatAt(sequence: Long): Int
}
