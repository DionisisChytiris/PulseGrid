#include <jni.h>
#include <android/log.h>
#include <thread>
#include <chrono>

#include "OboeEngine.h"

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_nativeaudio_OboeSelfTest_nativeRunOboeSelfTest(
    JNIEnv* /*env*/,
    jclass /*clazz*/) {
  constexpr const char* kLogTag = "OboeSelfTest";

  __android_log_print(ANDROID_LOG_INFO, kLogTag, "self-test: begin");

  OboeEngine engine;
  if (!engine.initialize()) {
    __android_log_print(ANDROID_LOG_ERROR, kLogTag, "self-test: initialize failed");
    return;
  }

  engine.start();

  // Enqueue a normal click at "now" so it renders in the next callback.
  auto nowNs = std::chrono::duration_cast<std::chrono::nanoseconds>(
                   std::chrono::steady_clock::now().time_since_epoch())
                   .count();
  engine.enqueueClick(ClickType::Normal, nowNs);

  // Wait for the sample to finish (~10 ms at 44100 Hz) plus margin.
  std::this_thread::sleep_for(std::chrono::milliseconds(100));

  engine.shutdown();

  __android_log_print(ANDROID_LOG_INFO, kLogTag, "self-test: complete");
}
