package expo.modules.nativeaudio

import android.util.Log
import kotlin.math.max

/**
 * Deterministic iterator over a precompiled score event stream.
 * Supports sequential peek for publishLookaheadEvents without recomputing the Song.
 * When [loops] is true, sequences wrap forever with continuous deadline offsets.
 */
internal class SongTimelineEventSource(
  events: List<TimelinePlaybackEvent>,
  private var loops: Boolean = false,
) : EventSource {
  private val events: List<TimelinePlaybackEvent> = events.toList()
  private val deadlineOffsetNs: LongArray
  private val cycleDurationNs: Long
  /** When loops is turned off mid-cycle, play through this exclusive sequence then end. */
  private var loopEndExclusive: Long? = null

  init {
    deadlineOffsetNs = LongArray(this.events.size + 1)
    var offsetNs = 0L

    for (index in this.events.indices) {
      deadlineOffsetNs[index] = offsetNs
      offsetNs += tickDurationNs(this.events[index])
    }

    deadlineOffsetNs[this.events.size] = offsetNs
    cycleDurationNs = offsetNs
  }

  fun setLoops(enabled: Boolean, nextSequence: Long = 0L) {
    if (enabled) {
      loops = true
      loopEndExclusive = null
      return
    }

    loops = false
    if (events.isEmpty()) {
      loopEndExclusive = null
      return
    }

    // Finish the current cycle, then stop — never hard-cut mid-bar.
    val count = events.size.toLong()
    loopEndExclusive = ((nextSequence / count) + 1L) * count
  }

  fun isLooping(): Boolean = loops

  override fun reset() {
    // Precomputed stream — nothing to rewind.
  }

  override fun eventCount(): Int? {
    if (loops) {
      return null
    }
    val end = loopEndExclusive
    if (end != null) {
      return end.toInt()
    }
    return events.size
  }

  override fun peekAt(sequence: Long): EventSourceTick? {
    if (events.isEmpty()) {
      return null
    }

    val index = resolveEventIndex(sequence) ?: return null
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
    if (events.isEmpty()) {
      return 0L
    }

    if (sequence < 0L) {
      return 0L
    }

    val end = loopEndExclusive
    if (loops || (end != null && sequence < end)) {
      val count = events.size.toLong()
      val cycle = sequence / count
      val indexInCycle = (sequence % count).toInt()
      return cycle * cycleDurationNs + deadlineOffsetNs[indexInCycle]
    }

    val index = sequence.toInt()
    if (index >= events.size) {
      return deadlineOffsetNs[events.size]
    }
    return deadlineOffsetNs[index]
  }

  override fun bpmAt(sequence: Long): Double {
    if (events.isEmpty()) {
      return 120.0
    }

    val index = resolveEventIndex(sequence) ?: return events.last().bpm
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

  private fun resolveEventIndex(sequence: Long): Int? {
    if (sequence < 0L || events.isEmpty()) {
      return null
    }

    val end = loopEndExclusive
    if (end != null && sequence >= end) {
      return null
    }

    if (loops || end != null) {
      return (sequence % events.size).toInt()
    }

    val index = sequence.toInt()
    if (index >= events.size) {
      return null
    }
    return index
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
