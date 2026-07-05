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

    Events("onTick", "onDebugTiming")

    OnDestroy {
      clickSoundPlayer?.release()
      audioInitialized = false
    }

    Function("initialize") {
      synchronized(initLock) {
        if (audioInitialized) {
          Log.d(TAG, "Already initialized, skipping")
        } else {
          clickSoundPlayer?.initialize()
          audioInitialized = true
        }
      }
    }

    Function("areSoundsReady") {
      clickSoundPlayer?.areReady() ?: true
    }

    Function("start") { options: Map<String, Any?> ->
      if (metronomeEngine.running) {
        Log.w(TAG, "NativeAudioModule.start() blocked duplicate — resetting running loop")
      }

      val bpm = readDouble(options["bpm"]) ?: 120.0
      val beatsPerMeasure = readInt(options["beatsPerMeasure"]) ?: 4
      val accentPattern = readAccentPattern(options["accentPattern"], beatsPerMeasure)
      val ticksPerBeat = readTicksPerBeat(options["subdivision"])

      metronomeEngine.start(bpm, beatsPerMeasure, accentPattern, ticksPerBeat)
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

    Function("setUseOboeEngine") { enabled: Boolean ->
      clickSoundPlayer?.useOboeEngine = enabled
    }

    if (BuildConfig.DEBUG) {
      Function("runOboeSelfTest") {
        OboeSelfTest.run()
      }
    }
  }

  private fun createMetronomeEngine(): MetronomeEngine {
    return MetronomeEngine(
      clickSoundPlayer,
      onTick = {
          sequence,
          beatIndex,
          beatNumber,
          beatsPerMeasure,
          subdivisionIndex,
          isAccent,
          timestampMs,
        ->
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
      onDebugTiming = { snapshot ->
        sendEvent(
          "onDebugTiming",
          mapOf(
            "sequence" to snapshot.sequence,
            "bpm" to snapshot.bpm,
            "subdivision" to snapshot.subdivision,
            "latenessUs" to snapshot.latenessUs.toDouble(),
            "avgLatenessUs" to snapshot.avgLatenessUs.toDouble(),
            "maxLatenessUs" to snapshot.maxLatenessUs.toDouble(),
            "playbackFailures" to snapshot.playbackFailures,
          ),
        )
      },
    )
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
    val pattern = (value as? List<*>)?.map { item ->
      when (item) {
        is Boolean -> item
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
