package expo.modules.nativeaudio

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import android.util.Log

internal class SoundPoolClickPlayer : ClickPlayer {
  private val initLock = Any()

  private lateinit var context: Context

  private var soundPool: SoundPool? = null
  private var accentSoundId: Int = 0
  private var normalSoundId: Int = 0
  private var subdivisionSoundId: Int = 0

  @Volatile
  private var accentReady = false

  @Volatile
  private var normalReady = false

  @Volatile
  private var subdivisionReady = false

  private val statsLock = Any()
  private var accentPlays = 0
  private var normalPlays = 0
  private var subdivisionPlays = 0
  private var failedPlays = 0
  private var successfulPlays = 0

  fun areReady(): Boolean {
    return accentReady && normalReady && subdivisionReady
  }

  val failedPlayCount: Int
    get() = synchronized(statsLock) { failedPlays }

  override fun initialize(context: Context) {
    this.context = context
    synchronized(initLock) {
      if (areReady()) {
        return
      }

      releaseLocked()

      val audioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_GAME)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()

      val pool = SoundPool.Builder()
        .setMaxStreams(MAX_STREAMS)
        .setAudioAttributes(audioAttributes)
        .build()

      soundPool = pool

      pool.setOnLoadCompleteListener { _, sampleId, status ->
        if (status != 0) {
          Log.e(TAG, "Failed to load sampleId=$sampleId status=$status")
          return@setOnLoadCompleteListener
        }

        synchronized(initLock) {
          when (sampleId) {
            accentSoundId -> accentReady = true
            normalSoundId -> normalReady = true
            subdivisionSoundId -> subdivisionReady = true
          }

          if (areReady()) {
            warmUp(pool)
          }
        }
      }

      accentSoundId = pool.load(context, R.raw.click_accent, LOAD_PRIORITY)
      normalSoundId = pool.load(context, R.raw.click_normal, LOAD_PRIORITY)
      subdivisionSoundId = pool.load(context, R.raw.click_subdivision, LOAD_PRIORITY)

      if (accentSoundId == 0 || normalSoundId == 0 || subdivisionSoundId == 0) {
        Log.e(TAG, "Failed to queue one or more click sample loads")
      }
    }
  }

  override fun playAccent() {
    val ready = if (EXPERIMENT_UNIFIED_TIMBRE) normalReady else accentReady
    val soundId = if (EXPERIMENT_UNIFIED_TIMBRE) normalSoundId else accentSoundId

    if (!ready) {
      Log.w(TAG, "playAccent() called before sample was ready")
      return
    }

    val pool = soundPool ?: run {
      Log.w(TAG, "playAccent() aborted — soundPool is null")
      return
    }

    val streamId = pool.play(soundId, ACCENT_VOLUME, ACCENT_VOLUME, PLAY_PRIORITY, 0, 1f)
    recordPlayResult(sound = "accent", streamId = streamId) { accentPlays++ }
  }

  override fun playNormal() {
    if (!normalReady) {
      Log.w(TAG, "playNormal() called before sample was ready")
      return
    }

    val pool = soundPool ?: run {
      Log.w(TAG, "playNormal() aborted — soundPool is null")
      return
    }

    val streamId = pool.play(normalSoundId, NORMAL_VOLUME, NORMAL_VOLUME, PLAY_PRIORITY, 0, 1f)
    recordPlayResult(sound = "normal", streamId = streamId) { normalPlays++ }
  }

  override fun playSubdivision() {
    val ready = if (EXPERIMENT_UNIFIED_TIMBRE) normalReady else subdivisionReady
    val soundId = if (EXPERIMENT_UNIFIED_TIMBRE) normalSoundId else subdivisionSoundId

    if (!ready) {
      Log.w(TAG, "playSubdivision() called before sample was ready")
      return
    }

    val pool = soundPool ?: run {
      Log.w(TAG, "playSubdivision() aborted — soundPool is null")
      return
    }

    val streamId = pool.play(
      soundId,
      SUBDIVISION_VOLUME,
      SUBDIVISION_VOLUME,
      PLAY_PRIORITY,
      0,
      1f,
    )
    recordPlayResult(sound = "subdivision", streamId = streamId) { subdivisionPlays++ }
  }

  override fun release() {
    synchronized(initLock) {
      releaseLocked()
    }
  }

  private fun recordPlayResult(sound: String, streamId: Int, onSuccess: () -> Unit) {
    synchronized(statsLock) {
      if (streamId == 0) {
        failedPlays++
        return
      }

      onSuccess()
      successfulPlays++
    }
  }

  private fun releaseLocked() {
    soundPool?.release()
    soundPool = null
    accentSoundId = 0
    normalSoundId = 0
    subdivisionSoundId = 0
    accentReady = false
    normalReady = false
    subdivisionReady = false
    accentPlays = 0
    normalPlays = 0
    subdivisionPlays = 0
    failedPlays = 0
    successfulPlays = 0
  }

  private fun warmUp(pool: SoundPool) {
    pool.play(accentSoundId, 0f, 0f, PLAY_PRIORITY, 0, 1f)
    pool.play(normalSoundId, 0f, 0f, PLAY_PRIORITY, 0, 1f)
    pool.play(subdivisionSoundId, 0f, 0f, PLAY_PRIORITY, 0, 1f)
  }

  companion object {
    private const val TAG = "ClickSoundPlayer"
    /** Set to false after timbre perception experiment to restore per-role click samples. */
    private const val EXPERIMENT_UNIFIED_TIMBRE = true
    private const val MAX_STREAMS = 16
    private const val PLAY_PRIORITY = 1
    private const val LOAD_PRIORITY = 1
    private const val ACCENT_VOLUME = 1f
    private const val NORMAL_VOLUME = 0.85f
    private const val SUBDIVISION_VOLUME = 0.65f
  }
}
