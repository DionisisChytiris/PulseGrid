package expo.modules.nativeaudio

import android.util.Log

internal object OboeSelfTest {
  private const val TAG = "OboeSelfTest"

  init {
    try {
      System.loadLibrary("nativeaudio_oboe_stub")
    } catch (e: UnsatisfiedLinkError) {
      Log.e(TAG, "Failed to load native library", e)
    }
  }

  @JvmStatic
  external fun nativeRunOboeSelfTest()

  fun run() {
    Thread(
      {
        Log.i(TAG, "Running Oboe self-test on background thread")
        nativeRunOboeSelfTest()
      },
      "OboeSelfTest",
    ).start()
  }
}
