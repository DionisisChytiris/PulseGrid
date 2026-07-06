package expo.modules.nativeaudio

import android.os.Handler
import android.os.HandlerThread
import android.os.Process
import android.util.Log
import kotlin.math.max

internal class MetronomeEngine(
  private val clickSoundPlayer: ClickSoundPlayer?,
  private val onTick: (
    sequence: Long,
    beatIndex: Int,
    beatNumber: Int,
    beatsPerMeasure: Int,
    subdivisionIndex: Int,
    isAccent: Boolean,
    timestampMs: Long,
  ) -> Unit,
) {
  private val lock = Any()

  @Volatile
  private var generation: Long = 0

  @Volatile
  private var isRunning: Boolean = false

  @Volatile
  private var isPaused: Boolean = false

  private var handlerThread: HandlerThread? = null
  private var handler: Handler? = null

  private var bpm: Double = 120.0
  private var beatsPerMeasure: Int = 4
  private var ticksPerBeat: Int = 1
  private var accentPattern: BooleanArray = booleanArrayOf(true, false, false, false)

  private var playbackMode: PlaybackMode = PlaybackMode.QUICK_METRONOME

  private var eventSource: EventSource = QuickMetronomeEventSource {
    QuickMetronomeState(
      bpm = 120.0,
      beatsPerMeasure = 4,
      ticksPerBeat = 1,
      accentPattern = booleanArrayOf(true, false, false, false),
    )
  }

  /** Monotonic anchor for absolute deadline scheduling (System.nanoTime domain). */
  private var anchorTimeNs: Long = 0

  /** Next subdivision-tick sequence to emit via [emitUiTick] (UI only). */
  private var nextUiSequence: Long = 0

  /**
   * Publication cursor: highest sequence whose audio has been enqueued in the current session.
   * Next unpublished sequence is [lastPublishedSequence] + 1.
   */
  private var lastPublishedSequence: Long = -1

  val running: Boolean
    get() = synchronized(lock) { isRunning }

  private data class TickSnapshot(
    val sequence: Long,
    val beatIndexInBar: Int,
    val beatNumber: Int,
    val beatsPerMeasure: Int,
    val subdivisionIndex: Int,
    val isAccent: Boolean,
    val timestampMs: Long,
    val scheduledDeadlineNs: Long,
  )

  /**
   * Partial musical-state update applied as one atomic timeline mutation.
   * Null fields are left unchanged.
   */
  private data class MusicalStateChange(
    val bpm: Double? = null,
    val ticksPerBeat: Int? = null,
    val accentPattern: BooleanArray? = null,
  )

  fun start(
    bpm: Double,
    beatsPerMeasure: Int,
    accentPattern: BooleanArray,
    ticksPerBeat: Int,
    mode: PlaybackMode = PlaybackMode.QUICK_METRONOME,
    timelineEvents: List<TimelinePlaybackEvent> = emptyList(),
  ) {
    val activeGeneration: Long
    synchronized(lock) {
      val wasRunning = isRunning
      if (wasRunning) {
        Log.w(TAG, "start() called while already running — stopping previous loop first")
      }

      haltLoopLocked(logStop = wasRunning)

      this.bpm = bpm.coerceAtLeast(1.0)
      this.beatsPerMeasure = beatsPerMeasure.coerceAtLeast(1)
      this.ticksPerBeat = normalizeTicksPerBeat(ticksPerBeat)
      this.accentPattern = copyAccentPattern(accentPattern)
      val effectiveMode = resolvePlaybackMode(mode, timelineEvents)
      playbackMode = effectiveMode
      eventSource = createEventSourceLocked(effectiveMode, timelineEvents)
      eventSource.reset()

      when (effectiveMode) {
        PlaybackMode.QUICK_METRONOME -> Log.i(TAG, "Playback mode: QUICK_METRONOME (event source: quick)")
        PlaybackMode.SONG_TIMELINE -> {
          Log.i(TAG, "Playback mode: SONG_TIMELINE (event source: adapter-fed, events=${timelineEvents.size})")
          (eventSource as? SongTimelineEventSource)?.logPreviewIfDebug(TAG)
        }
      }

      anchorTimeNs = System.nanoTime()
      nextUiSequence = 0
      lastPublishedSequence = -1
      isPaused = false

      activeGeneration = ++generation
      isRunning = true
    }

    publishLookaheadEvents()

    var firstSnapshot: TickSnapshot? = null
    synchronized(lock) {
      if (!isRunning || activeGeneration != generation) {
        return
      }

      firstSnapshot = snapshotForSequenceLocked(0, timestampMs = 0L)
      nextUiSequence = 1

      ensureHandler()?.post {
        synchronized(lock) {
          if (!isRunning || activeGeneration != generation) {
            return@post
          }
          scheduleNextUiTickLocked(activeGeneration)
        }
      }
    }

    firstSnapshot?.let { emitUiTick(it) }
  }

  fun updateTempo(bpm: Double) {
    applyMusicalStateChange(MusicalStateChange(bpm = bpm.coerceAtLeast(1.0)))
  }

  fun updateAccentPattern(accentPattern: BooleanArray) {
    applyMusicalStateChange(MusicalStateChange(accentPattern = accentPattern))
  }

  fun updateSubdivision(ticksPerBeat: Int) {
    applyMusicalStateChange(MusicalStateChange(ticksPerBeat = ticksPerBeat))
  }

  fun stop() {
    synchronized(lock) {
      if (!isRunning) {
        handler?.removeCallbacksAndMessages(null)
        return
      }

      haltLoopLocked(logStop = true)
    }
  }

  /**
   * Future: pause playback without resetting musical position.
   * Publication is suspended until [resume].
   */
  internal fun pause() {
    synchronized(lock) {
      if (!isRunning || isPaused) {
        return
      }

      isPaused = true
      handler?.removeCallbacksAndMessages(null)
    }
  }

  /**
   * Future: resume from paused position; republish audio from [nextUiSequence].
   */
  internal fun resume() {
    val activeGeneration: Long
    val snapshots: List<TickSnapshot>
    synchronized(lock) {
      if (!isRunning || !isPaused) {
        return
      }

      isPaused = false
      val now = System.nanoTime()
      anchorTimeNs = now - eventSource.offsetNsForSequence(nextUiSequence)
      rewindPublicationCursorLocked()
      assertSchedulingInvariantsLocked()
      snapshots = collectLookaheadSnapshotsLocked()
      activeGeneration = generation
      scheduleNextUiTickLocked(activeGeneration)
    }

    enqueueAudioSnapshots(snapshots)
  }

  /**
   * Future: seek to [targetSequence] for Song Timeline mode.
   * Resets playback position and republishes audio from the new sequence.
   */
  internal fun seekToSequence(targetSequence: Long) {
    val activeGeneration: Long
    val snapshots: List<TickSnapshot>
    synchronized(lock) {
      if (!isRunning) {
        return
      }

      val safeSequence = max(0L, targetSequence)
      nextUiSequence = safeSequence
      val now = System.nanoTime()
      anchorTimeNs = now - eventSource.offsetNsForSequence(safeSequence)
      rewindPublicationCursorLocked()
      isPaused = false
      assertSchedulingInvariantsLocked()
      snapshots = collectLookaheadSnapshotsLocked()
      activeGeneration = generation
      handler?.removeCallbacksAndMessages(null)
      scheduleNextUiTickLocked(activeGeneration)
    }

    enqueueAudioSnapshots(snapshots)
  }

  /**
   * Applies a musical parameter change atomically against the predictive scheduler.
   *
   * Live mutations retune the anchor for continuity at [nextUiSequence] but do not rewind
   * [lastPublishedSequence], so already-enqueued events remain unchanged.
   */
  private fun applyMusicalStateChange(change: MusicalStateChange) {
    val snapshots: List<TickSnapshot>
    synchronized(lock) {
      if (playbackMode == PlaybackMode.SONG_TIMELINE) {
        return
      }

      val bpmChange = change.bpm
      val subdivisionChange = change.ticksPerBeat
      val accentChange = change.accentPattern

      if (bpmChange != null) {
        val safeBpm = bpmChange.coerceAtLeast(1.0)
        if (isRunning && !isPaused && safeBpm != this.bpm) {
          retuneAnchorForContinuityLocked(safeBpm, ticksPerBeat)
        }
        this.bpm = safeBpm
      }

      if (subdivisionChange != null) {
        val safeTicksPerBeat = normalizeTicksPerBeat(subdivisionChange)
        if (safeTicksPerBeat != this.ticksPerBeat) {
          this.ticksPerBeat = safeTicksPerBeat
          if (isRunning && !isPaused) {
            retuneAnchorForContinuityLocked(bpm, safeTicksPerBeat)
          }
        }
      }

      if (accentChange != null) {
        this.accentPattern = copyAccentPattern(accentChange)
      }

      if (!isRunning || isPaused) {
        return
      }

      assertSchedulingInvariantsLocked()
      snapshots = collectLookaheadSnapshotsLocked()
    }

    enqueueAudioSnapshots(snapshots)
  }

  private fun haltLoopLocked(logStop: Boolean) {
    generation++
    isRunning = false
    isPaused = false
    handler?.removeCallbacksAndMessages(null)
    nextUiSequence = 0
    lastPublishedSequence = -1
    anchorTimeNs = 0
    playbackMode = PlaybackMode.QUICK_METRONOME
    eventSource = createQuickEventSourceLocked()
  }

  /** Caller must hold [lock]. */
  private fun resolvePlaybackMode(
    mode: PlaybackMode,
    timelineEvents: List<TimelinePlaybackEvent>,
  ): PlaybackMode {
    if (mode == PlaybackMode.SONG_TIMELINE && timelineEvents.isEmpty()) {
      Log.w(TAG, "SONG_TIMELINE requested without timeline events — fallback QUICK_METRONOME")
      return PlaybackMode.QUICK_METRONOME
    }

    return mode
  }

  /** Caller must hold [lock]. */
  private fun createEventSourceLocked(
    mode: PlaybackMode,
    timelineEvents: List<TimelinePlaybackEvent>,
  ): EventSource {
    return when (mode) {
      PlaybackMode.QUICK_METRONOME -> createQuickEventSourceLocked()
      PlaybackMode.SONG_TIMELINE -> SongTimelineEventSource(timelineEvents)
    }
  }

  /** Caller must hold [lock]. */
  private fun createQuickEventSourceLocked(): QuickMetronomeEventSource {
    return QuickMetronomeEventSource {
      QuickMetronomeState(
        bpm = bpm,
        beatsPerMeasure = beatsPerMeasure,
        ticksPerBeat = ticksPerBeat,
        accentPattern = accentPattern,
      )
    }
  }

  private fun ensureHandler(): Handler? {
    val existingThread = handlerThread
    if (existingThread != null && existingThread.isAlive && handler != null) {
      return handler
    }

    existingThread?.quitSafely()

    val metronomeThread = HandlerThread("NativeMetronomeEngine", Process.THREAD_PRIORITY_URGENT_AUDIO)
    metronomeThread.start()
    handlerThread = metronomeThread
    handler = Handler(metronomeThread.looper)
    return handler
  }

  private fun fireUiTick(activeGeneration: Long) {
    val snapshot: TickSnapshot?
    val snapshots: List<TickSnapshot>
    synchronized(lock) {
      if (!isRunning || isPaused || activeGeneration != generation) {
        return
      }

      val timestampMs = (System.nanoTime() - anchorTimeNs) / 1_000_000L
      snapshot = snapshotForSequenceLocked(nextUiSequence, timestampMs)
      nextUiSequence++

      if (!isRunning || activeGeneration != generation) {
        return
      }

      scheduleNextUiTickLocked(activeGeneration)
      assertSchedulingInvariantsLocked()
      snapshots = collectLookaheadSnapshotsLocked()
    }

    snapshot?.let { emitUiTick(it) }
    enqueueAudioSnapshots(snapshots)
  }

  /** Caller must hold [lock]. Pure musical snapshot for [sequence], or null past score end. */
  private fun snapshotForSequenceLocked(sequence: Long, timestampMs: Long): TickSnapshot? {
    val tick = eventSource.peekAt(sequence) ?: return null
    val scheduledDeadlineNs = anchorTimeNs + eventSource.offsetNsForSequence(sequence)

    return TickSnapshot(
      sequence = sequence,
      beatIndexInBar = tick.beatIndexInBar,
      beatNumber = tick.beatNumber,
      beatsPerMeasure = tick.beatsPerMeasure,
      subdivisionIndex = tick.subdivisionIndex,
      isAccent = tick.isAccent,
      timestampMs = timestampMs,
      scheduledDeadlineNs = scheduledDeadlineNs,
    )
  }

  /**
   * Publishes audio for every tick whose deadline falls within the lookahead horizon.
   * Advances [lastPublishedSequence] monotonically; never enqueues the same sequence twice.
   */
  private fun publishLookaheadEvents() {
    val snapshots: List<TickSnapshot>
    synchronized(lock) {
      if (!isRunning || isPaused) {
        return
      }

      assertSchedulingInvariantsLocked()
      snapshots = collectLookaheadSnapshotsLocked()
    }

    enqueueAudioSnapshots(snapshots)
  }

  /**
   * Caller must hold [lock].
   * Collects unpublished snapshots through the current lookahead horizon without enqueueing.
   */
  private fun collectLookaheadSnapshotsLocked(): List<TickSnapshot> {
    val snapshots = ArrayList<TickSnapshot>(8)
    val horizonNs = System.nanoTime() + computeLookaheadNsLocked()
    var sequence = lastPublishedSequence + 1
    var previousDeadlineNs = deadlineForSequenceLocked(
      if (lastPublishedSequence >= 0) lastPublishedSequence else 0,
    )

    if (lastPublishedSequence < 0) {
      previousDeadlineNs = Long.MIN_VALUE
    }

    while (true) {
      val deadlineNs = deadlineForSequenceLocked(sequence)
      if (deadlineNs > horizonNs) {
        break
      }

      val snapshot = snapshotForSequenceLocked(sequence, timestampMs = 0L) ?: break

      assertMonotonicDeadlineLocked(sequence, deadlineNs, previousDeadlineNs)
      snapshots.add(snapshot)
      lastPublishedSequence = sequence
      previousDeadlineNs = deadlineNs
      sequence++
    }

    return snapshots
  }

  /** Caller must hold [lock]. Preserves the musical instant of [nextUiSequence] across mutations. */
  private fun retuneAnchorForContinuityLocked(newBpm: Double, newTicksPerBeat: Int) {
    val now = System.nanoTime()
    anchorTimeNs = when (playbackMode) {
      PlaybackMode.QUICK_METRONOME ->
        now - quickTickOffsetNs(nextUiSequence, newBpm, newTicksPerBeat)
      PlaybackMode.SONG_TIMELINE ->
        now - eventSource.offsetNsForSequence(nextUiSequence)
    }
  }

  private fun quickTickOffsetNs(tickCount: Long, bpm: Double, ticksPerBeat: Int): Long {
    return (tickCount * beatDurationNs(bpm)) / ticksPerBeat
  }

  /** Caller must hold [lock]. Only for explicit position changes (seek / resume). */
  private fun rewindPublicationCursorLocked() {
    lastPublishedSequence = nextUiSequence - 1
  }

  /** Caller must hold [lock]. */
  private fun deadlineForSequenceLocked(sequence: Long): Long {
    return anchorTimeNs + eventSource.offsetNsForSequence(sequence)
  }

  /** Caller must hold [lock]. */
  private fun computeLookaheadNsLocked(): Long {
    val referenceSequence = max(0L, nextUiSequence)
    val tickIntervalNs = beatDurationNs(eventSource.bpmAt(referenceSequence)) /
      eventSource.ticksPerBeatAt(referenceSequence)
    val twoTicksNs = tickIntervalNs * 2
    return max(MIN_LOOKAHEAD_NS, twoTicksNs)
  }

  /** Caller must hold [lock]. */
  private fun estimateMaxLookaheadSequencesLocked(): Long {
    val referenceSequence = max(0L, nextUiSequence)
    val tickIntervalNs = beatDurationNs(eventSource.bpmAt(referenceSequence)) /
      eventSource.ticksPerBeatAt(referenceSequence)
    if (tickIntervalNs <= 0L) {
      return 2L
    }
    return (computeLookaheadNsLocked() / tickIntervalNs) + 2L
  }

  /** Debug-only scheduling invariant checks. */
  private fun assertSchedulingInvariantsLocked() {
    if (!Log.isLoggable(TAG, Log.DEBUG)) {
      return
    }

    if (lastPublishedSequence < -1) {
      Log.w(TAG, "Invariant: lastPublishedSequence < -1 ($lastPublishedSequence)")
    }

    val maxAllowedPublished = nextUiSequence + estimateMaxLookaheadSequencesLocked()
    if (lastPublishedSequence > maxAllowedPublished) {
      Log.w(
        TAG,
        "Invariant: lastPublishedSequence ($lastPublishedSequence) exceeds lookahead window " +
          "(nextUiSequence=$nextUiSequence, maxAllowed=$maxAllowedPublished)",
      )
    }
  }

  /** Debug-only: deadlines must strictly increase with sequence under a coherent musical state. */
  private fun assertMonotonicDeadlineLocked(
    sequence: Long,
    deadlineNs: Long,
    previousDeadlineNs: Long,
  ) {
    if (!Log.isLoggable(TAG, Log.DEBUG)) {
      return
    }

    if (deadlineNs <= 0L) {
      Log.w(TAG, "Invariant: non-positive deadline at sequence $sequence ($deadlineNs)")
    }

    if (previousDeadlineNs != Long.MIN_VALUE && deadlineNs <= previousDeadlineNs) {
      Log.w(
        TAG,
        "Invariant: non-monotonic deadline at sequence $sequence " +
          "(deadlineNs=$deadlineNs, previousDeadlineNs=$previousDeadlineNs)",
      )
    }
  }

  private fun enqueueAudioSnapshots(snapshots: List<TickSnapshot>) {
    for (snapshot in snapshots) {
      enqueueAudioForTick(snapshot)
    }
  }

  private fun enqueueAudioForTick(snapshot: TickSnapshot) {
    if (snapshot.subdivisionIndex == 0) {
      playClickForBeat(snapshot.isAccent, snapshot.scheduledDeadlineNs)
    } else {
      clickSoundPlayer?.playSubdivision(snapshot.scheduledDeadlineNs)
    }
  }

  private fun emitUiTick(snapshot: TickSnapshot) {
    onTick(
      snapshot.sequence,
      snapshot.beatIndexInBar,
      snapshot.beatNumber,
      snapshot.beatsPerMeasure,
      snapshot.subdivisionIndex,
      snapshot.isAccent,
      snapshot.timestampMs,
    )
  }

  /** Caller must hold lock. Waits until the absolute deadline, then fires the next UI tick. */
  private fun scheduleNextUiTickLocked(activeGeneration: Long) {
    if (eventSource.peekAt(nextUiSequence) == null) {
      return
    }

    val deadlineNs = deadlineForSequenceLocked(nextUiSequence)

    handler?.post {
      waitUntilDeadlineNs(deadlineNs)
      synchronized(lock) {
        fireUiTick(activeGeneration)
      }
    }
  }

  /**
   * Waits until [deadlineNs] using coarse sleep plus a short spin-wait.
   * Sleeps while more than ~5 ms remain; spins on [System.nanoTime] for the final ~5 ms.
   */
  private fun waitUntilDeadlineNs(deadlineNs: Long) {
    val spinThresholdNs = 5_000_000L

    while (true) {
      val remainingNs = deadlineNs - System.nanoTime()
      if (remainingNs <= 0L) {
        return
      }

      if (remainingNs > spinThresholdNs) {
        try {
          Thread.sleep(remainingNs / 1_000_000L)
        } catch (_: InterruptedException) {
          return
        }
        continue
      }
    }
  }

  private fun beatDurationNs(bpm: Double): Long {
    return max(1L, (60_000_000_000.0 / bpm).toLong())
  }

  private fun playClickForBeat(isAccent: Boolean, scheduledDeadlineNs: Long) {
    if (isAccent) {
      clickSoundPlayer?.playAccent(scheduledDeadlineNs)
    } else {
      clickSoundPlayer?.playNormal(scheduledDeadlineNs)
    }
  }

  private fun copyAccentPattern(pattern: BooleanArray): BooleanArray {
    return if (pattern.isEmpty()) {
      booleanArrayOf(true)
    } else {
      pattern.copyOf()
    }
  }

  private fun normalizeTicksPerBeat(value: Int): Int {
    return when (value) {
      2, 3, 4 -> value
      else -> 1
    }
  }

  companion object {
    private const val TAG = "MetronomeEngine"

    /** Minimum audio publication horizon (80 ms). */
    private const val MIN_LOOKAHEAD_NS = 80_000_000L
  }
}
