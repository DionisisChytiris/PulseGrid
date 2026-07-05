#include <jni.h>
#include <android/log.h>

#include "OboeEngine.h"

namespace {
constexpr const char* kLogTag = "PulseGrid-Oboe";

OboeEngine* gEngine = nullptr;
}

extern "C" {

JNIEXPORT jboolean JNICALL
Java_expo_modules_nativeaudio_OboeClickPlayer_nativeInitialize(
    JNIEnv* /*env*/,
    jclass /*clazz*/) {
  if (gEngine != nullptr) {
    gEngine->start();
    return JNI_TRUE;
  }

  gEngine = new OboeEngine();
  if (!gEngine->initialize()) {
    delete gEngine;
    gEngine = nullptr;
    return JNI_FALSE;
  }

  gEngine->start();
  return JNI_TRUE;
}

JNIEXPORT void JNICALL
Java_expo_modules_nativeaudio_OboeClickPlayer_nativeRelease(
    JNIEnv* /*env*/,
    jclass /*clazz*/) {
  if (gEngine != nullptr) {
    gEngine->shutdown();
    delete gEngine;
    gEngine = nullptr;
  }
}

JNIEXPORT void JNICALL
Java_expo_modules_nativeaudio_OboeClickPlayer_nativeEnqueueClick(
    JNIEnv* /*env*/,
    jclass /*clazz*/,
    jint type,
    jlong scheduledDeadlineNs) {
  if (gEngine != nullptr) {
    gEngine->enqueueClick(
        static_cast<ClickType>(type), static_cast<int64_t>(scheduledDeadlineNs));
  }
}

}  // extern "C"
