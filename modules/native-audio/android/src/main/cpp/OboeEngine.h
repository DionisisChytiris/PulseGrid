#pragma once

#include <memory>

#include <oboe/Oboe.h>

#include "AudioRenderer.h"
#include "ClickEvent.h"
#include "ClickEventQueue.h"

class OboeEngine;

class OboeStreamDataCallback : public oboe::AudioStreamDataCallback {
public:
  OboeStreamDataCallback(AudioRenderer* renderer, ClickEventQueue* queue);

  oboe::DataCallbackResult onAudioReady(
      oboe::AudioStream* audioStream,
      void* audioData,
      int32_t numFrames) override;

  void setStreamStartTimeNs(int64_t ns) {
    streamStartTimeNs_ = ns;
    framesWritten_ = 0;
  }
  void setSampleRate(int32_t rate) { sampleRate_ = rate; }
  void setStopWhenIdle(bool value) { stopWhenIdle_ = value; }

private:
  void drainQueue(
      int64_t bufferStartTimeNs,
      int64_t bufferEndTimeNs,
      int32_t numFrames,
      const char* timelineSource);

  AudioRenderer* renderer_;
  ClickEventQueue* queue_;
  int64_t streamStartTimeNs_ = 0;
  int32_t sampleRate_ = 44100;
  int64_t framesWritten_ = 0;
  bool stopWhenIdle_ = false;
};

class OboeEngine {
public:
  OboeEngine() = default;
  ~OboeEngine();

  bool initialize();
  void shutdown();
  void start();
  void stop();
  bool isInitialized() const;

  void enqueueClick(ClickType type, int64_t scheduledDeadlineNs);

private:
  std::shared_ptr<oboe::AudioStream> stream_;
  AudioRenderer renderer_;
  ClickEventQueue eventQueue_;
  OboeStreamDataCallback streamCallback_{&renderer_, &eventQueue_};
  bool initialized_ = false;
  bool running_ = false;
};
