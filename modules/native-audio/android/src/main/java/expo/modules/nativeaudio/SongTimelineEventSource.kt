package expo.modules.nativeaudio

import android.util.Log
import kotlin.math.max

/**
 * Deterministic iterator over a precompiled score event stream.
 * Supports sequential peek for publishLookaheadEvents without recomputing the Song.
 */
internal class SongTimelineEventSource(
  events: List<TimelinePlaybackEvent>,
) : EventSource {
  private val events: List<TimelinePlaybackEvent> = events.toList()
  private val deadlineOffsetNs: LongArray

  init {
    deadlineOffsetNs = LongArray(this.events.size + 1)
    var offsetNs = 0L

    for (index in this.events.indices) {
      deadlineOffsetNs[index] = offsetNs
      offsetNs += tickDurationNs(this.events[index])
    }

    deadlineOffsetNs[this.events.size] = offsetNs
  }

  override fun reset() {
    // Precomputed stream — nothing to rewind.
  }

  override fun eventCount(): Int? = events.size

  override fun peekAt(sequence: Long): EventSourceTick? {
    val index = sequence.toInt()
    if (index < 0 || index >= events.size) {
      return null
    }

    val event = events[index]
    return EventSourceTick(
      beatIndexInBar = event.beatIndexInBar,
      beatNumber = event.beatIndexInBar + 1,
      beatsPerMeasure = event.beatsPerMeasure,
      subdivisionIndex = event.subdivisionIndex,
      isAccent = event.accent,
    )
  }

  override fun offsetNsForSequence(sequence: Long): Long {
    val index = sequence.toInt()
    if (index < 0) {
      return 0L
    }

    if (index >= events.size) {
      return deadlineOffsetNs[events.size]
    }

    return deadlineOffsetNs[index]
  }

  override fun bpmAt(sequence: Long): Double {
    val index = sequence.toInt().coerceIn(0, max(0, events.size - 1))
    if (events.isEmpty()) {
      return 120.0
    }

    return events[index].bpm
  }

  override fun ticksPerBeatAt(sequence: Long): Int {
    return 1
  }

  /** Debug-only preview of the first events in the compiled stream. */
  fun logPreviewIfDebug(tag: String) {
    if (!Log.isLoggable(tag, Log.DEBUG)) {
      return
    }

    val previewCount = minOf(PREVIEW_EVENT_COUNT, events.size)
    for (index in 0 until previewCount) {
      val event = events[index]
      Log.d(
        tag,
        "SongTimeline preview[$index]: seq=${event.sequence} bar=${event.barId} " +
          "bpm=${event.bpm} accent=${event.accent} beat=${event.beatIndexInBar + 1}/" +
          "${event.beatsPerMeasure} subdiv=${event.subdivisionIndex}",
      )
    }
  }

  private fun tickDurationNs(event: TimelinePlaybackEvent): Long {
    val beatDurationNs = beatDurationNs(event.bpm)
    if (event.subdivisionIndex <= 0) {
      return beatDurationNs
    }

    // Future: subdivisions within a beat share one beat duration.
    return beatDurationNs
  }

  private fun beatDurationNs(bpm: Double): Long {
    return max(1L, (60_000_000_000.0 / bpm).toLong())
  }

  companion object {
    private const val PREVIEW_EVENT_COUNT = 10
  }
}
