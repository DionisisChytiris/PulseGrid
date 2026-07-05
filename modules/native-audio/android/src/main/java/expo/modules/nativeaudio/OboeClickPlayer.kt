package expo.modules.nativeaudio

import android.content.Context
import android.util.Log

internal class OboeClickPlayer : ClickPlayer {
  private val initLock = Any()

  @Volatile
  private var initialized = false

  override fun initialize(context: Context) {
    if (initialized) {
      Log.d(TAG, "Already initialized, skipping")
      return
    }

    synchronized(initLock) {
      if (initialized) {
        Log.d(TAG, "Already initialized, skipping")
        return
      }

      try {
        System.loadLibrary("nativeaudio_oboe_stub")
      } catch (e: UnsatisfiedLinkError) {
        Log.e(TAG, "Failed to load native library", e)
        return
      }

      initialized = nativeInitialize()
      if (initialized) {
        Log.i(TAG, "OboeEngine initialized")
      } else {
        Log.e(TAG, "OboeEngine initialization failed")
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
      Log.i(TAG, "OboeEngine released")
    }
  }

  override fun playAccent() {
    if (!initialized) return
    nativeEnqueueClick(CLICK_TYPE_ACCENT, System.nanoTime())
  }

  override fun playNormal() {
    if (!initialized) return
    nativeEnqueueClick(CLICK_TYPE_NORMAL, System.nanoTime())
  }

  override fun playSubdivision() {
    if (!initialized) return
    nativeEnqueueClick(CLICK_TYPE_SUBDIVISION, System.nanoTime())
  }

  companion object {
    private const val TAG = "OboeClickPlayer"

    private const val CLICK_TYPE_ACCENT = 0
    private const val CLICK_TYPE_NORMAL = 1
    private const val CLICK_TYPE_SUBDIVISION = 2

    @JvmStatic
    external fun nativeInitialize(): Boolean

    @JvmStatic
    external fun nativeRelease()

    @JvmStatic
    external fun nativeEnqueueClick(type: Int, timestampNs: Long)
  }
}
