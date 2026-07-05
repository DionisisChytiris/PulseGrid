#include "OboeEngine.h"

#include <chrono>
#include <android/log.h>

#ifndef NDEBUG
#include <ctime>
#endif

namespace {
constexpr const char* kLogTag = "OboeEngine";

int64_t nowNs() {
  return std::chrono::duration_cast<std::chrono::nanoseconds>(
             std::chrono::steady_clock::now().time_since_epoch())
      .count();
}

#ifndef NDEBUG
// Matches Android System.nanoTime() (CLOCK_MONOTONIC).
int64_t monotonicNowNs() {
  timespec ts{};
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return static_cast<int64_t>(ts.tv_sec) * 1'000'000'000LL + static_cast<int64_t>(ts.tv_nsec);
}
#endif

void logStreamConfiguration(const oboe::AudioStream& stream) {
  __android_log_print(ANDROID_LOG_INFO, kLogTag, "sample rate=%d", stream.getSampleRate());
  __android_log_print(ANDROID_LOG_INFO, kLogTag, "channel count=%d", stream.getChannelCount());
  __android_log_print(ANDROID_LOG_INFO, kLogTag, "frames per burst=%d", stream.getFramesPerBurst());
  __android_log_print(
      ANDROID_LOG_INFO, kLogTag, "performance mode=%s",
      oboe::convertToText(stream.getPerformanceMode()));
  __android_log_print(
      ANDROID_LOG_INFO, kLogTag, "sharing mode=%s",
      oboe::convertToText(stream.getSharingMode()));
  __android_log_print(
      ANDROID_LOG_INFO, kLogTag, "format=%s",
      oboe::convertToText(stream.getFormat()));
}
}  // namespace

// --- OboeStreamDataCallback ---

OboeStreamDataCallback::OboeStreamDataCallback(AudioRenderer* renderer, ClickEventQueue* queue)
    : renderer_(renderer), queue_(queue) {}

oboe::DataCallbackResult OboeStreamDataCallback::onAudioReady(
    oboe::AudioStream* audioStream,
    void* audioData,
    int32_t numFrames) {
  if (audioStream == nullptr || audioData == nullptr || numFrames <= 0 || renderer_ == nullptr) {
    return oboe::DataCallbackResult::Continue;
  }

  const int64_t nsPerBuffer =
      static_cast<int64_t>(numFrames) * 1'000'000'000LL / sampleRate_;
  const int64_t bufferStartTimeNs =
      streamStartTimeNs_ + (framesWritten_ * 1'000'000'000LL / sampleRate_);
  const int64_t bufferEndTimeNs = bufferStartTimeNs + nsPerBuffer;

  drainQueue(bufferStartTimeNs, bufferEndTimeNs);

  renderer_->render(
      audioData,
      numFrames,
      audioStream->getChannelCount(),
      audioStream->getFormat());

  framesWritten_ += numFrames;

  if (stopWhenIdle_ && renderer_->isIdle()) {
    stopWhenIdle_ = false;
    return oboe::DataCallbackResult::Stop;
  }

  return oboe::DataCallbackResult::Continue;
}

void OboeStreamDataCallback::drainQueue(int64_t /*bufferStartTimeNs*/, int64_t bufferEndTimeNs) {
  ClickEvent event{};
  while (queue_->peek(event)) {
    if (event.timestampNs > bufferEndTimeNs) {
      break;
    }

    if (!queue_->pop(event)) {
      break;
    }

    switch (event.type) {
      case ClickType::Accent:
        renderer_->accentPlayer().start();
        break;
      case ClickType::Normal:
        renderer_->normalPlayer().start();
        break;
      case ClickType::Subdivision:
        renderer_->subdivisionPlayer().start();
        break;
    }

#ifndef NDEBUG
    const int64_t actualNs = monotonicNowNs();
    const int64_t deltaUs = (actualNs - event.timestampNs) / 1000LL;
    __android_log_print(
        ANDROID_LOG_DEBUG,
        "PulseGrid-Oboe",
        "type=%d scheduled_ns=%lld actual_ns=%lld delta_us=%lld",
        static_cast<int>(event.type),
        static_cast<long long>(event.timestampNs),
        static_cast<long long>(actualNs),
        static_cast<long long>(deltaUs));
#endif
  }
}

// --- OboeEngine ---

OboeEngine::~OboeEngine() {
  shutdown();
}

bool OboeEngine::initialize() {
  if (initialized_ && stream_ != nullptr) {
    return true;
  }

  if (initialized_ || stream_ != nullptr) {
    shutdown();
  }

  oboe::AudioStreamBuilder builder;
  const oboe::Result result = builder.setDirection(oboe::Direction::Output)
                                   ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
                                   ->setSharingMode(oboe::SharingMode::Exclusive)
                                   ->setFormat(oboe::AudioFormat::I16)
                                   ->setChannelCount(oboe::ChannelCount::Mono)
                                   ->setDataCallback(&streamCallback_)
                                   ->openStream(stream_);

  if (result != oboe::Result::OK || stream_ == nullptr) {
    __android_log_print(
        ANDROID_LOG_ERROR, kLogTag, "Failed to open output stream: %s",
        oboe::convertToText(result));
    stream_.reset();
    initialized_ = false;
    running_ = false;
    return false;
  }

  logStreamConfiguration(*stream_);
  streamCallback_.setSampleRate(stream_->getSampleRate());
  initialized_ = true;
  running_ = false;
  return true;
}

void OboeEngine::shutdown() {
  stop();

  if (stream_ != nullptr) {
    const oboe::Result closeResult = stream_->close();
    if (closeResult != oboe::Result::OK) {
      __android_log_print(
          ANDROID_LOG_WARN, kLogTag, "Stream close returned: %s",
          oboe::convertToText(closeResult));
    }
    stream_.reset();
  }

  initialized_ = false;
  running_ = false;
}

void OboeEngine::start() {
  if (!initialized_ || stream_ == nullptr) {
    return;
  }

  if (running_) {
    __android_log_print(
        ANDROID_LOG_ERROR,
        "PulseGrid-Oboe",
        "OboeEngine already running, skipping start()");
    return;
  }

  streamCallback_.setStopWhenIdle(false);
  streamCallback_.setStreamStartTimeNs(nowNs());

  const oboe::Result result = stream_->requestStart();
  if (result != oboe::Result::OK) {
    __android_log_print(
        ANDROID_LOG_ERROR, kLogTag, "Failed to start stream: %s",
        oboe::convertToText(result));
    return;
  }

  running_ = true;
  __android_log_print(
      ANDROID_LOG_ERROR,
      "PulseGrid-Oboe",
      "Oboe stream started");
}

void OboeEngine::stop() {
  if (stream_ == nullptr || !running_) {
    return;
  }

  const oboe::Result result = stream_->requestStop();
  if (result != oboe::Result::OK) {
    __android_log_print(
        ANDROID_LOG_WARN, kLogTag, "Failed to stop stream: %s",
        oboe::convertToText(result));
  }

  running_ = false;
}

void OboeEngine::enqueueClick(ClickType type, int64_t timestampNs) {
  ClickEvent event{type, timestampNs};
  if (!eventQueue_.push(event)) {
    __android_log_print(ANDROID_LOG_WARN, kLogTag, "Event queue full, click dropped");
  }
}

bool OboeEngine::isInitialized() const {
  return initialized_ && stream_ != nullptr;
}
