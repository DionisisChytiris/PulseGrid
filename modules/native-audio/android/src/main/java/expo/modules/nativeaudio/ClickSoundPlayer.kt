package expo.modules.nativeaudio

import android.content.Context

internal class ClickSoundPlayer(private val context: Context) {
  private val soundPoolPlayer = SoundPoolClickPlayer()
  private val oboePlayer = OboeClickPlayer()
  private val initLock = Any()

  @Volatile
  var useOboeEngine: Boolean = false

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

      soundPoolPlayer.initialize(context)
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

      soundPoolPlayer.release()
      oboePlayer.release()
      initialized = false
    }
  }

  fun playAccent() {
    if (useOboeEngine) {
      oboePlayer.playAccent()
    } else {
      soundPoolPlayer.playAccent()
    }
  }

  fun playNormal() {
    if (useOboeEngine) {
      oboePlayer.playNormal()
    } else {
      soundPoolPlayer.playNormal()
    }
  }

  fun playSubdivision() {
    if (useOboeEngine) {
      oboePlayer.playSubdivision()
    } else {
      soundPoolPlayer.playSubdivision()
    }
  }

  fun areReady(): Boolean {
    return soundPoolPlayer.areReady()
  }

  val failedPlayCount: Int
    get() = soundPoolPlayer.failedPlayCount
}
