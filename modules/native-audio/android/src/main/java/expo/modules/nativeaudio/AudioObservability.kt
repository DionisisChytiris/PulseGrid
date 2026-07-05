package expo.modules.nativeaudio

import android.util.Log

/** Production logcat tags for Oboe audio lifecycle. */
internal object AudioObservability {
  const val TAG_AUDIO = "PulseGrid-Audio"
  const val TAG_OBOE = "PulseGrid-Oboe"

  fun logBackend() {
    Log.i(TAG_AUDIO, "backend=OBOE")
  }
}
