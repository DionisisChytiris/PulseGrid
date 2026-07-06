package expo.modules.nativeaudio

import kotlin.math.max

internal data class QuickMetronomeState(
  val bpm: Double,
  val beatsPerMeasure: Int,
  val ticksPerBeat: Int,
  val accentPattern: BooleanArray,
)

/**
 * Wraps existing quick-metronome tick derivation.
 * Reads live engine state so tempo / subdivision / accent mutations stay identical.
 */
internal class QuickMetronomeEventSource(
  private val stateProvider: () -> QuickMetronomeState,
) : EventSource {
  override fun reset() {
    // Stateless — musical state lives on MetronomeEngine.
  }

  override fun eventCount(): Int? = null

  override fun peekAt(sequence: Long): EventSourceTick {
    val state = stateProvider()
    val subdivisionIndex = (sequence % state.ticksPerBeat).toInt()
    val beatIndexInBar = ((sequence / state.ticksPerBeat) % state.beatsPerMeasure).toInt()
    val beatNumber = beatIndexInBar + 1
    val isAccent = isAccentForTick(beatIndexInBar, subdivisionIndex, state.accentPattern)

    return EventSourceTick(
      beatIndexInBar = beatIndexInBar,
      beatNumber = beatNumber,
      beatsPerMeasure = state.beatsPerMeasure,
      subdivisionIndex = subdivisionIndex,
      isAccent = isAccent,
    )
  }

  override fun offsetNsForSequence(sequence: Long): Long {
    val state = stateProvider()
    return tickOffsetNs(sequence, state.bpm, state.ticksPerBeat)
  }

  override fun bpmAt(sequence: Long): Double {
    return stateProvider().bpm
  }

  override fun ticksPerBeatAt(sequence: Long): Int {
    return stateProvider().ticksPerBeat
  }

  private fun isAccentForTick(
    beatIndexInBar: Int,
    subdivisionIndex: Int,
    accentPattern: BooleanArray,
  ): Boolean {
    if (subdivisionIndex != 0) {
      return false
    }

    return accentPattern[beatIndexInBar % accentPattern.size]
  }

  private fun tickOffsetNs(tickCount: Long, bpm: Double, ticksPerBeat: Int): Long {
    return (tickCount * beatDurationNs(bpm)) / ticksPerBeat
  }

  private fun beatDurationNs(bpm: Double): Long {
    return max(1L, (60_000_000_000.0 / bpm).toLong())
  }
}
