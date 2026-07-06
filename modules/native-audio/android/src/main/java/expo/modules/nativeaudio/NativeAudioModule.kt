package expo.modules.nativeaudio

import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NativeAudioModule : Module() {

  private val metronomeEngine: MetronomeEngine by lazy { createMetronomeEngine() }

  private val clickSoundPlayer: ClickSoundPlayer? by lazy {
    appContext.reactContext?.let { ClickSoundPlayer(it) }
  }

  @Volatile
  private var audioInitialized = false

  private val initLock = Any()

  override fun definition() = ModuleDefinition {
    Name("NativeAudioModule")

    Events("onTick")

    OnDestroy {
      clickSoundPlayer?.release()
      audioInitialized = false
    }

    Function("initialize") {
      synchronized(initLock) {
        if (audioInitialized) {
          return@synchronized
        }

        AudioObservability.logBackend()
        clickSoundPlayer?.initialize()
        audioInitialized = true
      }
    }

    Function("areSoundsReady") {
      clickSoundPlayer?.areReady() ?: true
    }

    Function("start") { options: Map<String, Any?> ->
      if (metronomeEngine.running) {
        Log.w(TAG, "start() called while already running — stopping previous loop first")
      }

      val bpm = readDouble(options["bpm"]) ?: 120.0
      val beatsPerMeasure = readInt(options["beatsPerMeasure"]) ?: 4
      val accentPattern = readAccentPattern(options["accentPattern"], beatsPerMeasure)
      val ticksPerBeat = readTicksPerBeat(options["subdivision"])
      val playbackMode = readPlaybackMode(options["playbackMode"])
      val timelineEvents = if (playbackMode == PlaybackMode.SONG_TIMELINE) {
        readTimelineEvents(options["timelineEvents"])
      } else {
        emptyList()
      }

      metronomeEngine.start(
        bpm,
        beatsPerMeasure,
        accentPattern,
        ticksPerBeat,
        playbackMode,
        timelineEvents,
      )
    }

    Function("stop") {
      metronomeEngine.stop()
    }

    Function("setTempo") { bpm: Double ->
      metronomeEngine.updateTempo(bpm)
    }

    Function("setAccentPattern") { accentPattern: List<Boolean> ->
      metronomeEngine.updateAccentPattern(readAccentPatternList(accentPattern))
    }

    Function("setSubdivision") { subdivision: String ->
      metronomeEngine.updateSubdivision(readTicksPerBeat(subdivision))
    }
  }

  private fun createMetronomeEngine(): MetronomeEngine {
    return MetronomeEngine(
      clickSoundPlayer,
      onTick = { sequence,
                 beatIndex,
                 beatNumber,
                 beatsPerMeasure,
                 subdivisionIndex,
                 isAccent,
                 timestampMs ->

        sendEvent(
          "onTick",
          mapOf(
            "sequence" to sequence,
            "beatIndex" to beatIndex,
            "beatNumber" to beatNumber,
            "beatsPerMeasure" to beatsPerMeasure,
            "subdivisionIndex" to subdivisionIndex,
            "isAccent" to isAccent,
            "timestamp" to timestampMs.toDouble(),
          ),
        )
      },
    )
  }

  private fun readPlaybackMode(value: Any?): PlaybackMode {
    return when (value as? String) {
      "song_timeline" -> PlaybackMode.SONG_TIMELINE
      else -> PlaybackMode.QUICK_METRONOME
    }
  }

  private fun readTimelineEvents(value: Any?): List<TimelinePlaybackEvent> {
    val rawEvents = value as? List<*> ?: return emptyList()

    return rawEvents.mapNotNull { entry ->
      val map = entry as? Map<*, *> ?: return@mapNotNull null

      TimelinePlaybackEvent(
        sequence = readLong(map["sequence"]) ?: 0L,
        bpm = readDouble(map["bpm"])?.coerceAtLeast(1.0) ?: 120.0,
        accent = map["accent"] as? Boolean ?: false,
        subdivisionIndex = readInt(map["subdivisionIndex"]) ?: 0,
        beatIndexInBar = readInt(map["beatIndexInBar"]) ?: 0,
        beatsPerMeasure = readInt(map["beatsPerMeasure"])?.coerceAtLeast(1) ?: 4,
        barId = map["barId"] as? String ?: "",
        sectionId = map["sectionId"] as? String ?: "",
      )
    }
  }

  private fun readLong(value: Any?): Long? {
    return when (value) {
      is Int -> value.toLong()
      is Double -> value.toLong()
      is Long -> value
      else -> null
    }
  }

  private fun readDouble(value: Any?): Double? {
    return when (value) {
      is Double -> value
      is Int -> value.toDouble()
      is Float -> value.toDouble()
      else -> null
    }
  }

  private fun readInt(value: Any?): Int? {
    return when (value) {
      is Int -> value
      is Double -> value.toInt()
      else -> null
    }
  }

  private fun readTicksPerBeat(value: Any?): Int {
    return when (value) {
      "eighth" -> 2
      "triplet" -> 3
      "sixteenth" -> 4
      else -> 1
    }
  }

  private fun readAccentPatternList(pattern: List<Boolean>): BooleanArray {
    if (pattern.isEmpty()) {
      return booleanArrayOf(true)
    }
    return pattern.toBooleanArray()
  }

  private fun readAccentPattern(value: Any?, beatsPerMeasure: Int): BooleanArray {
    val pattern = (value as? List<*>)?.map {
      when (it) {
        is Boolean -> it
        else -> false
      }
    }

    if (pattern.isNullOrEmpty()) {
      return BooleanArray(beatsPerMeasure) { index -> index == 0 }
    }

    return BooleanArray(beatsPerMeasure) { index ->
      pattern.getOrElse(index) { index == 0 }
    }
  }

  companion object {
    private const val TAG = "NativeAudioModule"
  }
}
