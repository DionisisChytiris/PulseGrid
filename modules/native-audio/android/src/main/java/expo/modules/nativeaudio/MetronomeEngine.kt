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
  /** TEMP: mirrors selected Logcat debug lines to JS via Expo sendEvent. */
  private val onDebugLog: ((tag: String, payload: Map<String, Any?>) -> Unit)? = null,
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
  private var subdivisionAccentMode: SubdivisionAccentMode = SubdivisionAccentMode.OFF
  private var subdivisionAccentEveryNth: Int = 4
  private var subdivisionAccentPattern: BooleanArray = booleanArrayOf()

  @Volatile
  private var barStartEnabled: Boolean = true

  private var playbackMode: PlaybackMode = PlaybackMode.QUICK_METRONOME

  private var eventSource: EventSource = QuickMetronomeEventSource {
    QuickMetronomeState(
      bpm = 120.0,
      beatsPerMeasure = 4,
      ticksPerBeat = 1,
      accentPattern = booleanArrayOf(true, false, false, false),
      subdivisionAccentMode = SubdivisionAccentMode.OFF,
      subdivisionAccentEveryNth = 4,
      subdivisionAccentPattern = booleanArrayOf(),
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

  /**
   * Bumped on every live musical retune so in-flight [waitUntilDeadlineNs] loops and
   * Handler runnables that captured an old absolute deadline abort without firing.
   */
  @Volatile
  private var uiDeadlineEpoch: Long = 0

  /**
   * TEMP debug — increments on each live BPM retune so publications can be correlated
   * with TempoRetuneDebug. Does not affect scheduling.
   */
  private var tempoRetuneEpoch: Long = 0

  /**
   * TEMP debug — sequence → last enqueued scheduledDeadlineNs for duplicate detection.
   * Does not affect scheduling.
   */
  private val debugPublishedDeadlinesNs = java.util.concurrent.ConcurrentHashMap<Long, Long>()

  /**
   * TEMP debug — payloads captured under [lock], flushed to Metro outside the lock
   * (same Expo sendEvent bridge as TempoRetuneDebug).
   */
  private val pendingPublishDebug = ArrayList<Map<String, Any?>>(16)

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
    /** TEMP debug — bpm / ticks used when this snapshot's deadline was computed. */
    val publishBpm: Double = 0.0,
    val publishTicksPerBeat: Int = 1,
    val publishAnchorTimeNs: Long = 0L,
    val tempoRetuneEpoch: Long = 0L,
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
    timelineLoops: Boolean = false,
    timelineStartSequence: Long = 0L,
  ) {
    val activeGeneration: Long
    val startSequence: Long
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
      eventSource = createEventSourceLocked(effectiveMode, timelineEvents, timelineLoops)
      eventSource.reset()

      when (effectiveMode) {
        PlaybackMode.QUICK_METRONOME -> Log.i(TAG, "Playback mode: QUICK_METRONOME (event source: quick)")
        PlaybackMode.SONG_TIMELINE -> {
          Log.i(
            TAG,
            "Playback mode: SONG_TIMELINE (event source: adapter-fed, events=${timelineEvents.size}, " +
              "loops=$timelineLoops, startSeq=$timelineStartSequence)",
          )
          (eventSource as? SongTimelineEventSource)?.logPreviewIfDebug(TAG)
        }
      }

      startSequence = if (effectiveMode == PlaybackMode.SONG_TIMELINE) {
        timelineStartSequence.coerceAtLeast(0L)
      } else {
        0L
      }

      // Anchor so the start sequence is imminent (preserve mid-song play-from-here timing).
      val nowNs = System.nanoTime()
      anchorTimeNs = nowNs - eventSource.offsetNsForSequence(startSequence)
      nextUiSequence = startSequence
      lastPublishedSequence = startSequence - 1
      isPaused = false

      activeGeneration = ++generation
      isRunning = true
    }

    publishLookaheadEvents(activeGeneration)

    var firstSnapshot: TickSnapshot? = null
    synchronized(lock) {
      if (!isRunning || activeGeneration != generation) {
        return
      }

      firstSnapshot = snapshotForSequenceLocked(startSequence, timestampMs = 0L)
      nextUiSequence = startSequence + 1

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

  fun setTimelineLoops(enabled: Boolean) {
    synchronized(lock) {
      val source = eventSource as? SongTimelineEventSource ?: return
      source.setLoops(enabled, nextUiSequence)
    }
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

  fun updateSubdivisionAccentMode(mode: SubdivisionAccentMode) {
    synchronized(lock) {
      subdivisionAccentMode = mode
    }
  }

  fun updateSubdivisionAccentEveryNth(everyNth: Int) {
    synchronized(lock) {
      subdivisionAccentEveryNth = everyNth.coerceIn(1, 16)
    }
  }

  fun updateSubdivisionAccentPattern(pattern: BooleanArray) {
    synchronized(lock) {
      subdivisionAccentPattern = pattern.copyOf()
    }
  }

  fun updateBarStartEnabled(enabled: Boolean) {
    synchronized(lock) {
      // TEMP debug — remove after native barStart propagation diagnosis
      android.util.Log.d(
        "BarStartDebug",
        "Android MetronomeEngine.updateBarStartEnabled previous=$barStartEnabled new=$enabled",
      )
      barStartEnabled = enabled
    }
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
      snapshots = collectLookaheadSnapshotsLocked("resume")
      activeGeneration = generation
      scheduleNextUiTickLocked(activeGeneration)
    }

    enqueueAudioSnapshots(snapshots, activeGeneration)
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
      snapshots = collectLookaheadSnapshotsLocked("seekToSequence")
      activeGeneration = generation
      handler?.removeCallbacksAndMessages(null)
      scheduleNextUiTickLocked(activeGeneration)
    }

    enqueueAudioSnapshots(snapshots, activeGeneration)
  }

  /**
   * Applies a musical parameter change atomically against the predictive scheduler.
   *
   * Live Quick Metronome mutations retune the anchor by preserving the just-emitted
   * sequence (when on a beat boundary) so the next sequence sits on the new BPM grid.
   * After a retune, pending UI waiters and lookahead audio committed under the old
   * anchor are discarded and regenerated from [deadlineForSequenceLocked].
   */
  private fun applyMusicalStateChange(change: MusicalStateChange) {
    val snapshots: List<TickSnapshot>?
    val activeGeneration: Long
    var tempoRetuneDebug: Map<String, Any?>? = null
    var collectReason = "applyMusicalStateChange"
    var discardedStaleSchedule = false
    synchronized(lock) {
      if (playbackMode == PlaybackMode.SONG_TIMELINE) {
        return
      }

      val bpmChange = change.bpm
      val subdivisionChange = change.ticksPerBeat
      val accentChange = change.accentPattern
      var anchorRetuned = false

      if (bpmChange != null) {
        val safeBpm = bpmChange.coerceAtLeast(1.0)
        if (isRunning && !isPaused && safeBpm != this.bpm) {
          // TEMP debug — remove after live tempo timing diagnosis
          val oldBpm = this.bpm
          val oldAnchorTimeNs = anchorTimeNs
          val pivotSequence = if (nextUiSequence > 0L) nextUiSequence - 1L else 0L
          val preservedDeadlineNs = deadlineForSequenceLocked(pivotSequence)
          retuneAnchorForContinuityLocked(safeBpm, ticksPerBeat)
          tempoRetuneEpoch += 1
          anchorRetuned = true
          Log.d(
            "TempoRetuneDebug",
            "updateTempo oldBpm=$oldBpm newBpm=$safeBpm " +
              "oldAnchorTimeNs=$oldAnchorTimeNs newAnchorTimeNs=$anchorTimeNs " +
              "preservedDeadlineNs=$preservedDeadlineNs pivotSequence=$pivotSequence " +
              "nextUiSequence=$nextUiSequence",
          )
          queuePublishDebugLocked(
            mapOf(
              "kind" to "afterRetune",
              "epoch" to tempoRetuneEpoch,
              "oldBpm" to oldBpm,
              "newBpm" to safeBpm,
              "lastPublishedSequence" to lastPublishedSequence,
              "nextUiSequence" to nextUiSequence,
              "anchorTimeNs" to anchorTimeNs.toString(),
              "note" to "invalidating UI waiter + republishing pending Oboe clicks",
            ),
          )
          tempoRetuneDebug = mapOf(
            "kind" to "updateTempo",
            "oldBpm" to oldBpm,
            "newBpm" to safeBpm,
            "oldAnchorTimeNs" to oldAnchorTimeNs.toString(),
            "newAnchorTimeNs" to anchorTimeNs.toString(),
            "preservedDeadlineNs" to preservedDeadlineNs.toString(),
            "pivotSequence" to pivotSequence,
          )
          collectReason = "applyMusicalStateChange_afterTempo"
        }
        this.bpm = safeBpm
      }

      if (subdivisionChange != null) {
        val safeTicksPerBeat = normalizeTicksPerBeat(subdivisionChange)
        if (safeTicksPerBeat != this.ticksPerBeat) {
          // Retune before mutating ticks so deadlineForSequenceLocked still
          // reflects the pre-change schedule (same order as the BPM path).
          if (isRunning && !isPaused) {
            retuneAnchorForContinuityLocked(bpm, safeTicksPerBeat)
            anchorRetuned = true
          }
          this.ticksPerBeat = safeTicksPerBeat
        }
      }

      if (accentChange != null) {
        this.accentPattern = copyAccentPattern(accentChange)
      }

      if (!isRunning || isPaused) {
        snapshots = null
        activeGeneration = generation
      } else {
        if (anchorRetuned) {
          // Drop any Handler runnable / in-flight sleep that captured D_old, then
          // rewind the audio publication cursor so lookahead can republish N+1…
          // under the new anchor. UI is rescheduled only after Oboe flush (below)
          // so a due D_new cannot race ahead of the queue clear.
          invalidatePendingUiDeadlineLocked()
          rewindPublicationCursorLocked()
          discardedStaleSchedule = true
        }
        assertSchedulingInvariantsLocked()
        snapshots = collectLookaheadSnapshotsLocked(collectReason)
        activeGeneration = generation
      }
    }

    // Emit outside the lock (same pattern as onTick → sendEvent).
    tempoRetuneDebug?.let { emitDebugLog("TempoRetuneDebug", it) }
    if (discardedStaleSchedule) {
      // Clear clicks queued with old deadlines, then accept republished ones.
      clickSoundPlayer?.flushScheduledClicks()
      clickSoundPlayer?.resumeScheduledClicks()
    }
    if (snapshots != null) {
      enqueueAudioSnapshots(snapshots, activeGeneration)
    }
    if (discardedStaleSchedule) {
      synchronized(lock) {
        if (isRunning && !isPaused) {
          scheduleNextUiTickLocked(generation)
        }
      }
    }
  }

  private fun haltLoopLocked(logStop: Boolean) {
    generation++
    isRunning = false
    isPaused = false
    handler?.removeCallbacksAndMessages(null)
    nextUiSequence = 0
    lastPublishedSequence = -1
    uiDeadlineEpoch = 0
    tempoRetuneEpoch = 0
    debugPublishedDeadlinesNs.clear()
    pendingPublishDebug.clear()
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
    timelineLoops: Boolean = false,
  ): EventSource {
    return when (mode) {
      PlaybackMode.QUICK_METRONOME -> createQuickEventSourceLocked()
      PlaybackMode.SONG_TIMELINE -> SongTimelineEventSource(timelineEvents, timelineLoops)
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
        subdivisionAccentMode = subdivisionAccentMode,
        subdivisionAccentEveryNth = subdivisionAccentEveryNth,
        subdivisionAccentPattern = subdivisionAccentPattern,
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
    val snapshots: List<TickSnapshot>?
    var fireUiTickDebug: Map<String, Any?>? = null
    var shouldEmitTick = false
    synchronized(lock) {
      if (!isRunning || isPaused || activeGeneration != generation) {
        return
      }

      val sequence = nextUiSequence
      val nowNs = System.nanoTime()
      val deadlineNs = deadlineForSequenceLocked(sequence)
      val currentAnchorTimeNs = anchorTimeNs
      val timestampMs = (nowNs - currentAnchorTimeNs) / 1_000_000L
      snapshot = snapshotForSequenceLocked(sequence, timestampMs)
      nextUiSequence++

      // TEMP debug — remove after live tempo timing diagnosis
      Log.d(
        "TempoRetuneDebug",
        "fireUiTick sequence=$sequence beatNumber=${snapshot?.beatNumber} " +
          "nanoTime=$nowNs deadlineNs=$deadlineNs anchorTimeNs=$currentAnchorTimeNs " +
          "nextUiSequence=$nextUiSequence timestampMs=$timestampMs",
      )
      fireUiTickDebug = mapOf(
        "kind" to "fireUiTick",
        "sequence" to sequence,
        "beatNumber" to (snapshot?.beatNumber ?: -1),
        "nanoTime" to nowNs.toString(),
        "deadlineNs" to deadlineNs.toString(),
        "anchorTimeNs" to currentAnchorTimeNs.toString(),
        "timestampMs" to timestampMs,
      )

      if (!isRunning || activeGeneration != generation) {
        // Prior behavior: abort emit/schedule; still mirror the debug line to JS.
        snapshots = null
        shouldEmitTick = false
      } else {
        scheduleNextUiTickLocked(activeGeneration)
        assertSchedulingInvariantsLocked()
        snapshots = collectLookaheadSnapshotsLocked("fireUiTick")
        shouldEmitTick = true
      }
    }

    // Emit outside the lock (same pattern as onTick → sendEvent).
    fireUiTickDebug?.let { emitDebugLog("TempoRetuneDebug", it) }
    if (shouldEmitTick) {
      snapshot?.let { emitUiTick(it) }
      if (snapshots != null) {
        enqueueAudioSnapshots(snapshots, activeGeneration)
      }
    }
  }

  /** TEMP: Logcat + optional JS mirror. Caller should invoke outside [lock]. */
  private fun emitDebugLog(tag: String, payload: Map<String, Any?>) {
    onDebugLog?.invoke(tag, payload)
  }

  /** TEMP: Logcat always; Metro via [emitDebugLog]. Caller must be outside [lock]. */
  private fun logPublishDebug(payload: Map<String, Any?>) {
    Log.d("TempoPublishDebug", formatPublishDebug(payload))
    emitDebugLog("TempoPublishDebug", payload)
  }

  /** TEMP: Logcat under lock; Metro deferred until [flushPublishDebug]. Caller must hold [lock]. */
  private fun queuePublishDebugLocked(payload: Map<String, Any?>) {
    Log.d("TempoPublishDebug", formatPublishDebug(payload))
    pendingPublishDebug.add(payload)
  }

  /** TEMP: flush queued collect/retune publish logs to Metro. Outside [lock]. */
  private fun flushPublishDebug() {
    val batch: List<Map<String, Any?>>
    synchronized(lock) {
      if (pendingPublishDebug.isEmpty()) {
        return
      }
      batch = ArrayList(pendingPublishDebug)
      pendingPublishDebug.clear()
    }
    for (payload in batch) {
      emitDebugLog("TempoPublishDebug", payload)
    }
  }

  private fun formatPublishDebug(payload: Map<String, Any?>): String {
    return payload.entries.joinToString(" ") { "${it.key}=${it.value}" }
  }

  /** Caller must hold [lock]. Pure musical snapshot for [sequence], or null past score end. */
  private fun snapshotForSequenceLocked(sequence: Long, timestampMs: Long): TickSnapshot? {
    val tick = eventSource.peekAt(sequence) ?: return null
    val scheduledDeadlineNs = anchorTimeNs + eventSource.offsetNsForSequence(sequence)
    val publishBpm = eventSource.bpmAt(sequence)
    val publishTicksPerBeat = eventSource.ticksPerBeatAt(sequence)

    return TickSnapshot(
      sequence = sequence,
      beatIndexInBar = tick.beatIndexInBar,
      beatNumber = tick.beatNumber,
      beatsPerMeasure = tick.beatsPerMeasure,
      subdivisionIndex = tick.subdivisionIndex,
      isAccent = tick.isAccent,
      timestampMs = timestampMs,
      scheduledDeadlineNs = scheduledDeadlineNs,
      publishBpm = publishBpm,
      publishTicksPerBeat = publishTicksPerBeat,
      publishAnchorTimeNs = anchorTimeNs,
      tempoRetuneEpoch = tempoRetuneEpoch,
    )
  }

  /**
   * Publishes audio for every tick whose deadline falls within the lookahead horizon.
   * Advances [lastPublishedSequence] monotonically; never enqueues the same sequence twice.
   */
  private fun publishLookaheadEvents(activeGeneration: Long) {
    val snapshots: List<TickSnapshot>
    synchronized(lock) {
      if (!isRunning || isPaused) {
        return
      }

      assertSchedulingInvariantsLocked()
      snapshots = collectLookaheadSnapshotsLocked("publishLookaheadEvents")
    }

    enqueueAudioSnapshots(snapshots, activeGeneration)
  }

  /**
   * Caller must hold [lock].
   * Collects unpublished snapshots through the current lookahead horizon without enqueueing.
   */
  private fun collectLookaheadSnapshotsLocked(debugReason: String = "unspecified"): List<TickSnapshot> {
    // TEMP debug — cursor state before advancing publication.
    val beforeLastPublished = lastPublishedSequence
    val beforeNextUi = nextUiSequence
    queuePublishDebugLocked(
      mapOf(
        "kind" to "collectBefore",
        "reason" to debugReason,
        "lastPublishedSequence" to beforeLastPublished,
        "nextUiSequence" to beforeNextUi,
        "anchorTimeNs" to anchorTimeNs.toString(),
        "bpm" to eventSource.bpmAt(max(0L, beforeNextUi)),
        "tempoRetuneEpoch" to tempoRetuneEpoch,
        "generation" to generation,
        "startCollectFrom" to (beforeLastPublished + 1),
      ),
    )

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

    val firstSeq = snapshots.firstOrNull()?.sequence
    val lastSeq = snapshots.lastOrNull()?.sequence
    queuePublishDebugLocked(
      mapOf(
        "kind" to "collectAfter",
        "reason" to debugReason,
        "lastPublishedSequence" to lastPublishedSequence,
        "nextUiSequence" to nextUiSequence,
        "firstSequenceCollected" to firstSeq,
        "lastSequenceCollected" to lastSeq,
        "snapshotCount" to snapshots.size,
        "horizonNs" to horizonNs.toString(),
        "tempoRetuneEpoch" to tempoRetuneEpoch,
        "generation" to generation,
      ),
    )

    return snapshots
  }

  /**
   * Caller must hold [lock].
   *
   * Quick Metronome live tempo/subdivision mutations pivot on the last emitted
   * sequence when [nextUiSequence] > 0:
   *
   *   deadline'(pivot) = deadline_old(pivot)   // already-fired beat stays put
   *   deadline'(pivot+1) = deadline_old(pivot) + newTickInterval
   *
   * i.e. do **not** preserve the old upcoming-beat wall deadline (which left one
   * old-tempo step after a beat-boundary setBpm). [deadlineForSequenceLocked] still
   * reads pre-mutation bpm/ticks from [eventSource] for the preserved pivot.
   *
   * Song Timeline branch keeps the prior rebase-to-now behavior (unused by
   * [applyMusicalStateChange], which no-ops Song Timeline mutations earlier).
   */
  private fun retuneAnchorForContinuityLocked(newBpm: Double, newTicksPerBeat: Int) {
    when (playbackMode) {
      PlaybackMode.QUICK_METRONOME -> {
        // Pivot = last emitted sequence on a beat-boundary apply (nextUi already advanced).
        // When nextUiSequence == 0 there is no prior beat; preserve sequence 0.
        val pivotSequence = if (nextUiSequence > 0L) nextUiSequence - 1L else 0L
        val preservedDeadlineNs = deadlineForSequenceLocked(pivotSequence)
        val newOffsetNs = quickTickOffsetNs(pivotSequence, newBpm, newTicksPerBeat)
        anchorTimeNs = preservedDeadlineNs - newOffsetNs
      }
      PlaybackMode.SONG_TIMELINE -> {
        val now = System.nanoTime()
        anchorTimeNs = now - eventSource.offsetNsForSequence(nextUiSequence)
      }
    }
  }

  private fun quickTickOffsetNs(tickCount: Long, bpm: Double, ticksPerBeat: Int): Long {
    return (tickCount * beatDurationNs(bpm)) / ticksPerBeat
  }

  /** Caller must hold [lock]. Only for explicit position changes (seek / resume / live retune). */
  private fun rewindPublicationCursorLocked() {
    lastPublishedSequence = nextUiSequence - 1
    // Sequences at/after nextUi will be republished; drop old deadline tracking so
    // regeneration is not mistaken for a duplicate enqueue.
    val firstFuture = nextUiSequence
    val staleKeys = debugPublishedDeadlinesNs.keys.filter { it >= firstFuture }
    for (key in staleKeys) {
      debugPublishedDeadlinesNs.remove(key)
    }
  }

  /**
   * Caller must hold [lock].
   * Invalidates any absolute UI deadline captured before the latest retune.
   * Does not by itself reschedule — caller must [scheduleNextUiTickLocked].
   */
  private fun invalidatePendingUiDeadlineLocked() {
    uiDeadlineEpoch++
    handler?.removeCallbacksAndMessages(null)
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

  private fun enqueueAudioSnapshots(snapshots: List<TickSnapshot>, activeGeneration: Long) {
    // Always flush collect/retune publish logs collected under the lock — even if
    // this batch is empty (common when lookahead already covers the horizon).
    flushPublishDebug()

    if (snapshots.isEmpty()) {
      logPublishDebug(
        mapOf(
          "kind" to "enqueueBatchEmpty",
          "activeGeneration" to activeGeneration,
        ),
      )
      return
    }

    val latestTempoRetuneEpoch: Long
    synchronized(lock) {
      if (!isRunning || generation != activeGeneration) {
        logPublishDebug(
          mapOf(
            "kind" to "enqueueSkipped",
            "count" to snapshots.size,
            "activeGeneration" to activeGeneration,
            "engineGeneration" to generation,
            "isRunning" to isRunning,
          ),
        )
        return
      }
      latestTempoRetuneEpoch = tempoRetuneEpoch
    }

    val enqueueTimeNs = System.nanoTime()
    logPublishDebug(
      mapOf(
        "kind" to "enqueueBatchStart",
        "count" to snapshots.size,
        "enqueueTimeNs" to enqueueTimeNs.toString(),
        "firstSeq" to snapshots.first().sequence,
        "lastSeq" to snapshots.last().sequence,
        "activeGeneration" to activeGeneration,
        "latestTempoRetuneEpoch" to latestTempoRetuneEpoch,
      ),
    )

    for (snapshot in snapshots) {
      // TEMP: duplicate / conflicting-deadline detection (engine cursor should prevent this).
      val previousDeadline = debugPublishedDeadlinesNs.put(snapshot.sequence, snapshot.scheduledDeadlineNs)
      if (previousDeadline != null) {
        logPublishDebug(
          mapOf(
            "kind" to "duplicateSequencePublish",
            "sequence" to snapshot.sequence,
            "previousDeadlineNs" to previousDeadline.toString(),
            "newDeadlineNs" to snapshot.scheduledDeadlineNs.toString(),
            "sameDeadline" to (previousDeadline == snapshot.scheduledDeadlineNs),
            "tempoRetuneEpoch" to snapshot.tempoRetuneEpoch,
          ),
        )
      }

      enqueueAudioForTick(snapshot, enqueueTimeNs, latestTempoRetuneEpoch)
    }
  }

  /**
   * Exact handoff to the audio engine: classify click, then
   * [ClickSoundPlayer] → [OboeClickPlayer.nativeEnqueueClick].
   */
  private fun enqueueAudioForTick(
    snapshot: TickSnapshot,
    enqueueTimeNs: Long,
    latestTempoRetuneEpoch: Long,
  ) {
    // Song timeline: use compiled event accent on the snapshot.
    // Quick Metronome: resolve from the live session accentPattern (unchanged).
    val soundKind =
      if (playbackMode == PlaybackMode.SONG_TIMELINE) {
        AccentClassification.resolveClickSoundKindFromTickAccent(
          isAccent = snapshot.isAccent,
          beatIndexInBar = snapshot.beatIndexInBar,
          subdivisionIndex = snapshot.subdivisionIndex,
          barStartEnabled = barStartEnabled,
        )
      } else {
        AccentClassification.resolveClickSoundKind(
          beatIndexInBar = snapshot.beatIndexInBar,
          subdivisionIndex = snapshot.subdivisionIndex,
          accentPattern = accentPattern,
          ticksPerBeat = ticksPerBeat,
          subdivisionAccentMode = subdivisionAccentMode,
          subdivisionAccentEveryNth = subdivisionAccentEveryNth,
          subdivisionAccentPattern = subdivisionAccentPattern,
          barStartEnabled = barStartEnabled,
        )
      }

    val relativeToLatestEpoch =
      if (snapshot.tempoRetuneEpoch == latestTempoRetuneEpoch) {
        "atOrAfterLatestRetune"
      } else {
        "beforeLatestRetune(staleEpoch)"
      }

    // TEMP: definitive per-click audio enqueue log (not UI scheduling).
    logPublishDebug(
      mapOf(
        "kind" to "audioEnqueue",
        "sequence" to snapshot.sequence,
        "beatNumber" to snapshot.beatNumber,
        "subdivision" to snapshot.subdivisionIndex,
        "scheduledDeadlineNs" to snapshot.scheduledDeadlineNs.toString(),
        "enqueueTimeNs" to enqueueTimeNs.toString(),
        "bpm" to snapshot.publishBpm,
        "ticksPerBeat" to snapshot.publishTicksPerBeat,
        "anchorTimeNs" to snapshot.publishAnchorTimeNs.toString(),
        "tempoRetuneEpoch" to snapshot.tempoRetuneEpoch,
        "relativeToLatestEpoch" to relativeToLatestEpoch,
        "soundKind" to soundKind.name,
        "hasClickSoundPlayer" to (clickSoundPlayer != null),
      ),
    )

    // TEMP debug — remove after native barStart propagation diagnosis
    if (snapshot.beatIndexInBar == 0 && snapshot.subdivisionIndex == 0) {
      android.util.Log.d(
        "BarStartDebug",
        "Android classify beat1 barStartEnabled=$barStartEnabled soundKind=$soundKind",
      )
    }

    when (soundKind) {
      ClickSoundKind.BAR -> clickSoundPlayer?.playBar(snapshot.scheduledDeadlineNs)
      ClickSoundKind.ACCENT -> clickSoundPlayer?.playAccent(snapshot.scheduledDeadlineNs)
      ClickSoundKind.CLICK -> clickSoundPlayer?.playNormal(snapshot.scheduledDeadlineNs)
      // Compatibility: subdivision bank unused; route to Click.
      ClickSoundKind.SUBDIVISION -> clickSoundPlayer?.playNormal(snapshot.scheduledDeadlineNs)
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

  /**
   * Caller must hold lock. Posts a waiter that sleeps until the absolute deadline of
   * [nextUiSequence], then fires. The deadline is captured once at post time; a live
   * retune bumps [uiDeadlineEpoch] and must reschedule so this runnable never fires
   * on a stale deadline.
   */
  private fun scheduleNextUiTickLocked(activeGeneration: Long) {
    if (eventSource.peekAt(nextUiSequence) == null) {
      return
    }

    val deadlineNs = deadlineForSequenceLocked(nextUiSequence)
    val deadlineEpoch = uiDeadlineEpoch

    handler?.post {
      waitUntilDeadlineNs(deadlineNs, deadlineEpoch)
      synchronized(lock) {
        // Retune superseded this waiter — a fresh schedule already owns nextUiSequence.
        if (deadlineEpoch != uiDeadlineEpoch) {
          return@synchronized
        }
        if (!isRunning || isPaused || activeGeneration != generation) {
          return@synchronized
        }
        fireUiTick(activeGeneration)
      }
    }
  }

  /**
   * Waits until [deadlineNs] using coarse sleep plus a short spin-wait.
   * Sleeps in short chunks so a concurrent retune ([deadlineEpoch] mismatch) can
   * abort without finishing a sleep toward [D_old].
   */
  private fun waitUntilDeadlineNs(deadlineNs: Long, deadlineEpoch: Long) {
    val spinThresholdNs = 5_000_000L
    val maxChunkSleepMs = 5L

    while (true) {
      if (deadlineEpoch != uiDeadlineEpoch) {
        return
      }

      val remainingNs = deadlineNs - System.nanoTime()
      if (remainingNs <= 0L) {
        return
      }

      if (remainingNs > spinThresholdNs) {
        val sleepMs = minOf(maxChunkSleepMs, remainingNs / 1_000_000L).coerceAtLeast(1L)
        try {
          Thread.sleep(sleepMs)
        } catch (_: InterruptedException) {
          return
        }
        continue
      }

      // Final ~5 ms spin; still honor epoch invalidation.
    }
  }

  private fun beatDurationNs(bpm: Double): Long {
    return max(1L, (60_000_000_000.0 / bpm).toLong())
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
