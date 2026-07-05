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

  private var handlerThread: HandlerThread? = null
  private var handler: Handler? = null

  private var bpm: Double = 120.0
  private var beatsPerMeasure: Int = 4
  private var ticksPerBeat: Int = 1
  private var accentPattern: BooleanArray = booleanArrayOf(true, false, false, false)

  /** Monotonic subdivision-tick counter — never wraps; used for absolute deadline scheduling. */
  private var totalTickCount: Long = 0
  private var anchorTimeNs: Long = 0

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

  fun start(
    bpm: Double,
    beatsPerMeasure: Int,
    accentPattern: BooleanArray,
    ticksPerBeat: Int,
  ) {
    val firstTick: TickSnapshot?
    synchronized(lock) {
      val wasRunning = isRunning
      if (wasRunning) {
        Log.w(TAG, "start() called while already running — stopping previous loop first")
      }

      haltLoopLocked(logStop = wasRunning)

      this.bpm = bpm.coerceAtLeast(1.0)
      this.beatsPerMeasure = beatsPerMeasure.coerceAtLeast(1)
      this.ticksPerBeat = normalizeTicksPerBeat(ticksPerBeat)
      this.accentPattern = if (accentPattern.isEmpty()) {
        booleanArrayOf(true)
      } else {
        accentPattern
      }

      totalTickCount = 0
      anchorTimeNs = System.nanoTime()

      val activeGeneration = ++generation
      isRunning = true

      firstTick = advanceTickLocked(activeGeneration, timestampMs = 0L)

      // Scheduled loop continues from tick 2 (totalTickCount is already 1).
      ensureHandler()?.post {
        synchronized(lock) {
          if (!isRunning || activeGeneration != generation) {
            return@post
          }
          scheduleNextTickLocked(activeGeneration)
        }
      }
    }

    firstTick?.let { dispatchTick(it) }
  }

  fun updateTempo(bpm: Double) {
    synchronized(lock) {
      if (!isRunning) {
        return
      }

      val safeBpm = bpm.coerceAtLeast(1.0)
      val now = System.nanoTime()
      anchorTimeNs = now - tickOffsetNs(totalTickCount, safeBpm, ticksPerBeat)
      this.bpm = safeBpm
    }
  }

  fun updateAccentPattern(accentPattern: BooleanArray) {
    synchronized(lock) {
      this.accentPattern = if (accentPattern.isEmpty()) {
        booleanArrayOf(true)
      } else {
        accentPattern
      }
    }
  }

  fun updateSubdivision(ticksPerBeat: Int) {
    synchronized(lock) {
      val safeTicksPerBeat = normalizeTicksPerBeat(ticksPerBeat)
      if (safeTicksPerBeat == this.ticksPerBeat) {
        return
      }

      val oldTicksPerBeat = this.ticksPerBeat
      val beatPosition = totalTickCount / oldTicksPerBeat
      totalTickCount = beatPosition * safeTicksPerBeat
      this.ticksPerBeat = safeTicksPerBeat

      if (isRunning) {
        val now = System.nanoTime()
        anchorTimeNs = now - tickOffsetNs(totalTickCount, bpm, safeTicksPerBeat)
      }
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

  private fun haltLoopLocked(logStop: Boolean) {
    generation++
    isRunning = false
    handler?.removeCallbacksAndMessages(null)
    totalTickCount = 0
    anchorTimeNs = 0
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

  private fun fireTick(activeGeneration: Long) {
    val snapshot: TickSnapshot?
    synchronized(lock) {
      if (!isRunning || activeGeneration != generation) {
        return
      }

      // Tick 1 is emitted synchronously in start(); scheduled ticks begin at tick 2+.
      if (totalTickCount == 0L) {
        Log.w(TAG, "fireTick ignored at tickCount=0 — tick 1 already handled in start()")
        return
      }

      val timestampMs = (System.nanoTime() - anchorTimeNs) / 1_000_000L
      snapshot = advanceTickLocked(activeGeneration, timestampMs)

      if (!isRunning || activeGeneration != generation) {
        return
      }

      scheduleNextTickLocked(activeGeneration)
    }

    snapshot?.let { dispatchTick(it) }
  }

  /** Advances tick counter under lock; audio + JS dispatch happen outside the lock. */
  private fun advanceTickLocked(activeGeneration: Long, timestampMs: Long): TickSnapshot? {
    if (!isRunning || activeGeneration != generation) {
      return null
    }

    val subdivisionIndex = (totalTickCount % ticksPerBeat).toInt()
    val beatIndexInBar = ((totalTickCount / ticksPerBeat) % beatsPerMeasure).toInt()
    val beatNumber = beatIndexInBar + 1
    val isAccent = isAccentForTick(beatIndexInBar, subdivisionIndex)
    val sequence = totalTickCount
    val scheduledDeadlineNs = anchorTimeNs + tickOffsetNs(sequence, bpm, ticksPerBeat)

    val snapshot = TickSnapshot(
      sequence = sequence,
      beatIndexInBar = beatIndexInBar,
      beatNumber = beatNumber,
      beatsPerMeasure = beatsPerMeasure,
      subdivisionIndex = subdivisionIndex,
      isAccent = isAccent,
      timestampMs = timestampMs,
      scheduledDeadlineNs = scheduledDeadlineNs,
    )

    totalTickCount++
    return snapshot
  }

  private fun dispatchTick(snapshot: TickSnapshot) {
    playClickForTick(snapshot)
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

  /** Caller must hold lock. Waits until the absolute deadline, then fires the next tick. */
  private fun scheduleNextTickLocked(activeGeneration: Long) {
    val deadlineNs = anchorTimeNs + tickOffsetNs(totalTickCount, bpm, ticksPerBeat)

    handler?.post {
      waitUntilDeadlineNs(deadlineNs)
      synchronized(lock) {
        fireTick(activeGeneration)
      }
    }
  }

  /**
   * Waits until [deadlineNs] using coarse sleep plus a short spin-wait.
   * Sleeps while more than ~5 ms remain; spins on [System.nanoTime] for the final ~5 ms.
   * postDelayed(ms) is too coarse for 16th/triplet intervals above ~110 BPM.
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

  /** Elapsed nanoseconds from anchor to subdivision tick [tickCount]. */
  private fun tickOffsetNs(tickCount: Long, bpm: Double, ticksPerBeat: Int): Long {
    return (tickCount * beatDurationNs(bpm)) / ticksPerBeat
  }

  private fun beatDurationNs(bpm: Double): Long {
    return max(1L, (60_000_000_000.0 / bpm).toLong())
  }

  private fun playClickForTick(snapshot: TickSnapshot) {
    if (snapshot.subdivisionIndex == 0) {
      playClickForBeat(snapshot.isAccent, snapshot.scheduledDeadlineNs)
    } else {
      clickSoundPlayer?.playSubdivision(snapshot.scheduledDeadlineNs)
    }
  }

  private fun playClickForBeat(isAccent: Boolean, scheduledDeadlineNs: Long) {
    if (isAccent) {
      clickSoundPlayer?.playAccent(scheduledDeadlineNs)
    } else {
      clickSoundPlayer?.playNormal(scheduledDeadlineNs)
    }
  }

  /** Accent on primary subdivision pulses only, per the configured accent pattern. */
  private fun isAccentForTick(beatIndexInBar: Int, subdivisionIndex: Int): Boolean {
    if (subdivisionIndex != 0) {
      return false
    }

    return accentPattern[beatIndexInBar % accentPattern.size]
  }

  private fun normalizeTicksPerBeat(value: Int): Int {
    return when (value) {
      2, 3, 4 -> value
      else -> 1
    }
  }

  companion object {
    private const val TAG = "MetronomeEngine"
  }
}
