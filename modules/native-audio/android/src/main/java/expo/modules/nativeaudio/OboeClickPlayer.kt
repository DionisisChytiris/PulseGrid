package expo.modules.nativeaudio

import android.content.Context
import android.util.Log

internal class OboeClickPlayer : ClickPlayer {
  private val initLock = Any()

  @Volatile
  private var initialized = false

  fun areReady(): Boolean = initialized

  override fun initialize(context: Context) {
    if (initialized) {
      return
    }

    synchronized(initLock) {
      if (initialized) {
        return
      }

      try {
        System.loadLibrary("nativeaudio_oboe_stub")
      } catch (e: UnsatisfiedLinkError) {
        Log.e(AudioObservability.TAG_AUDIO, "Failed to load Oboe native library", e)
        return
      }

      initialized = nativeInitialize()
      if (!initialized) {
        Log.e(AudioObservability.TAG_AUDIO, "Oboe engine initialization failed")
      }
    }
  }

  override fun release() {
    if (!initialized) {
      return
    }

    synchronized(initLock) {
      if (!initialized) {
        return
      }

      nativeRelease()
      initialized = false
    }
  }

  override fun playAccent(scheduledDeadlineNs: Long) {
    if (!initialized) return
    nativeEnqueueClick(CLICK_TYPE_ACCENT, scheduledDeadlineNs)
  }

  override fun playNormal(scheduledDeadlineNs: Long) {
    if (!initialized) return
    nativeEnqueueClick(CLICK_TYPE_NORMAL, scheduledDeadlineNs)
  }

  override fun playSubdivision(scheduledDeadlineNs: Long) {
    if (!initialized) return
    nativeEnqueueClick(CLICK_TYPE_SUBDIVISION, scheduledDeadlineNs)
  }

  fun setNormalClickSound(soundId: Int) {
    if (!initialized) return
    nativeSetNormalClickSound(soundId)
  }

  fun setAccentClickSound(soundId: Int) {
    if (!initialized) return
    nativeSetAccentClickSound(soundId)
  }

  fun setSubdivisionClickSound(soundId: Int) {
    if (!initialized) return
    nativeSetSubdivisionClickSound(soundId)
  }

  fun previewNormalClick() {
    if (!initialized) return
    nativePreviewClick(CLICK_TYPE_NORMAL)
  }

  fun previewAccentClick() {
    if (!initialized) return
    nativePreviewClick(CLICK_TYPE_ACCENT)
  }

  fun previewSubdivisionClick() {
    if (!initialized) return
    nativePreviewClick(CLICK_TYPE_SUBDIVISION)
  }

  fun flushScheduledClicks() {
    if (!initialized) return
    nativeFlushScheduledClicks()
  }

  fun resumeScheduledClicks() {
    if (!initialized) return
    nativeResumeScheduledClicks()
  }

  companion object {
    private const val CLICK_TYPE_ACCENT = 0
    private const val CLICK_TYPE_NORMAL = 1
    private const val CLICK_TYPE_SUBDIVISION = 2

    @JvmStatic
    external fun nativeInitialize(): Boolean

    @JvmStatic
    external fun nativeRelease()

    @JvmStatic
    external fun nativeEnqueueClick(type: Int, scheduledDeadlineNs: Long)

    @JvmStatic
    external fun nativeSetNormalClickSound(soundId: Int)

    @JvmStatic
    external fun nativeSetAccentClickSound(soundId: Int)

    @JvmStatic
    external fun nativeSetSubdivisionClickSound(soundId: Int)

    @JvmStatic
    external fun nativePreviewClick(type: Int)

    @JvmStatic
    external fun nativeFlushScheduledClicks()

    @JvmStatic
    external fun nativeResumeScheduledClicks()
  }
}
