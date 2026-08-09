package expo.modules.nativeaudio

import android.util.Log
import kotlin.math.max

/**
 * Deterministic iterator over a precompiled score event stream.
 * Supports sequential peek for publishLookaheadEvents without recomputing the Song.
 * When [loops] is true, sequences wrap forever with continuous deadline offsets.
 *
 * Optional [loopStartIndex] skips a leading preparation prefix (e.g. count-in) on wrap:
 * the first pass plays indices `0 .. size-1`, then wraps into `loopStartIndex .. size-1`.
 */
internal class SongTimelineEventSource(
  events: List<TimelinePlaybackEvent>,
  private var loops: Boolean = false,
  loopStartIndex: Int = 0,
) : EventSource {
  private val events: List<TimelinePlaybackEvent> = events.toList()
  private val deadlineOffsetNs: LongArray
  private val cycleDurationNs: Long
  private val loopStartIndex: Int =
    if (this.events.isEmpty()) {
      0
    } else {
      loopStartIndex.coerceIn(0, this.events.lastIndex)
    }
  private val scoreCycleDurationNs: Long
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
    scoreCycleDurationNs =
      if (this.events.isEmpty()) {
        0L
      } else {
        deadlineOffsetNs[this.events.size] - deadlineOffsetNs[this.loopStartIndex]
      }
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
      return loopingOffsetNs(sequence)
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
      return loopingEventIndex(sequence)
    }

    val index = sequence.toInt()
    if (index >= events.size) {
      return null
    }
    return index
  }

  /**
   * First pass: indices `0 .. count-1` (may include preparation).
   * Later passes: wrap within `loopStartIndex .. count-1` only.
   */
  private fun loopingEventIndex(sequence: Long): Int {
    val count = events.size.toLong()
    if (sequence < count) {
      return sequence.toInt()
    }

    val scoreLen = count - loopStartIndex.toLong()
    if (scoreLen <= 0L) {
      return 0
    }

    val wrapped = sequence - count
    return loopStartIndex + (wrapped % scoreLen).toInt()
  }

  private fun loopingOffsetNs(sequence: Long): Long {
    val count = events.size.toLong()
    if (sequence < count) {
      return deadlineOffsetNs[sequence.toInt()]
    }

    val scoreLen = count - loopStartIndex.toLong()
    if (scoreLen <= 0L) {
      return deadlineOffsetNs[events.size]
    }

    val wrapped = sequence - count
    val cycle = wrapped / scoreLen
    val indexInScore = (wrapped % scoreLen).toInt()
    val scoreIndex = loopStartIndex + indexInScore
    val withinScoreNs = deadlineOffsetNs[scoreIndex] - deadlineOffsetNs[loopStartIndex]
    return deadlineOffsetNs[events.size] + cycle * scoreCycleDurationNs + withinScoreNs
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
