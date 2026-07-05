package expo.modules.nativeaudio

import android.content.Context

internal interface ClickPlayer {
  fun initialize(context: Context)
  fun release()
  fun playAccent(scheduledDeadlineNs: Long)
  fun playNormal(scheduledDeadlineNs: Long)
  fun playSubdivision(scheduledDeadlineNs: Long)
}
