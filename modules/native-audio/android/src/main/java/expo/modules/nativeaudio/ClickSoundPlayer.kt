package expo.modules.nativeaudio

import android.content.Context

/** Forwards scheduled click events to the Oboe native engine. No timing logic here. */
internal class ClickSoundPlayer(private val context: Context) {
  private val oboePlayer = OboeClickPlayer()
  private val initLock = Any()

  @Volatile
  private var initialized = false

  fun initialize() {
    if (initialized) {
      return
    }

    synchronized(initLock) {
      if (initialized) {
        return
      }

      oboePlayer.initialize(context)
      initialized = true
    }
  }

  fun release() {
    if (!initialized) {
      return
    }

    synchronized(initLock) {
      if (!initialized) {
        return
      }

      oboePlayer.release()
      initialized = false
    }
  }

  fun areReady(): Boolean = oboePlayer.areReady()

  fun playAccent(scheduledDeadlineNs: Long) {
    oboePlayer.playAccent(scheduledDeadlineNs)
  }

  fun playNormal(scheduledDeadlineNs: Long) {
    oboePlayer.playNormal(scheduledDeadlineNs)
  }

  fun playSubdivision(scheduledDeadlineNs: Long) {
    oboePlayer.playSubdivision(scheduledDeadlineNs)
  }
}
