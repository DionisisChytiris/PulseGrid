#include "OboeEngine.h"

#include <ctime>
#include <android/log.h>

namespace {
constexpr const char* kLogTagOboe = "PulseGrid-Oboe";
constexpr const char* kLogTagEngine = "OboeEngine";
constexpr const char* kTimelineHw = "HW_TIMESTAMP";
constexpr const char* kTimelineSoftware = "SOFTWARE_ESTIMATE";
constexpr int64_t kNanosecondsPerSecond = 1000000000LL;

// CLOCK_MONOTONIC origin for software timeline fallback (matches System.nanoTime domain).
int64_t monotonicNowNs() {
  timespec ts{};
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return static_cast<int64_t>(ts.tv_sec) * kNanosecondsPerSecond + static_cast<int64_t>(ts.tv_nsec);
}

int32_t frameOffsetForDeadline(
    int64_t scheduledDeadlineNs,
    int64_t bufferStartTimeNs,
    int32_t sampleRate,
    int32_t numFrames) {
  if (numFrames <= 0 || sampleRate <= 0) {
    return -1;
  }

  const int64_t deltaNs = scheduledDeadlineNs - bufferStartTimeNs;
  if (deltaNs < 0) {
    return 0;
  }

  const int64_t frameOffset = (deltaNs * sampleRate) / kNanosecondsPerSecond;
  if (frameOffset >= numFrames) {
    return -1;
  }

  return static_cast<int32_t>(frameOffset);
}

int64_t softwareBufferStartTimeNs(
    int64_t streamStartTimeNs,
    int64_t framesWritten,
    int32_t sampleRate) {
  return streamStartTimeNs + (framesWritten * kNanosecondsPerSecond / sampleRate);
}

struct BufferTimeline {
  int64_t bufferStartTimeNs = 0;
  int64_t bufferEndTimeNs = 0;
  const char* source = kTimelineSoftware;
};

BufferTimeline resolveBufferTimeline(
    oboe::AudioStream* audioStream,
    int32_t numFrames,
    int64_t framesWritten,
    int32_t sampleRate,
    int64_t streamStartTimeNs) {
  const int64_t nsPerBuffer =
      static_cast<int64_t>(numFrames) * kNanosecondsPerSecond / sampleRate;

  BufferTimeline timeline{};
  timeline.source = kTimelineSoftware;
  timeline.bufferStartTimeNs =
      softwareBufferStartTimeNs(streamStartTimeNs, framesWritten, sampleRate);
  timeline.bufferEndTimeNs = timeline.bufferStartTimeNs + nsPerBuffer;

  if (audioStream == nullptr || sampleRate <= 0) {
    return timeline;
  }

  const auto timestampResult = audioStream->getTimestamp(CLOCK_MONOTONIC);
  const int64_t bufferStartFrame = audioStream->getFramesWritten();

  if (!timestampResult) {
    return timeline;
  }

  const int64_t referenceFrame = timestampResult.value().position;
  const int64_t referenceTimeNs = timestampResult.value().timestamp;

  const int64_t frameDelta = bufferStartFrame - referenceFrame;
  const int64_t bufferStartTimeNs =
      referenceTimeNs + (frameDelta * kNanosecondsPerSecond) / sampleRate;

  timeline.source = kTimelineHw;
  timeline.bufferStartTimeNs = bufferStartTimeNs;
  timeline.bufferEndTimeNs = bufferStartTimeNs + nsPerBuffer;
  return timeline;
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

  const BufferTimeline timeline = resolveBufferTimeline(
      audioStream,
      numFrames,
      framesWritten_,
      sampleRate_,
      streamStartTimeNs_);

  drainQueue(
      timeline.bufferStartTimeNs,
      timeline.bufferEndTimeNs,
      numFrames,
      timeline.source);

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

void OboeStreamDataCallback::drainQueue(
    int64_t bufferStartTimeNs,
    int64_t bufferEndTimeNs,
    int32_t numFrames,
    const char* timelineSource) {
  ClickEvent event{};
  while (queue_->peek(event)) {
    if (event.scheduledDeadlineNs > bufferEndTimeNs) {
      break;
    }

    if (!queue_->pop(event)) {
      break;
    }

    const int32_t frameOffset =
        frameOffsetForDeadline(event.scheduledDeadlineNs, bufferStartTimeNs, sampleRate_, numFrames);
    if (frameOffset < 0) {
      continue;
    }

    switch (event.type) {
      case ClickType::Accent:
        renderer_->accentPlayer().start(frameOffset);
        break;
      case ClickType::Normal:
        renderer_->normalPlayer().start(frameOffset);
        break;
      case ClickType::Subdivision:
        renderer_->subdivisionPlayer().start(frameOffset);
        break;
    }

    __android_log_print(
        ANDROID_LOG_DEBUG,
        kLogTagOboe,
        "timeline=%s scheduled_ns=%lld buffer_start_ns=%lld frame_offset=%d",
        timelineSource,
        static_cast<long long>(event.scheduledDeadlineNs),
        static_cast<long long>(bufferStartTimeNs),
        frameOffset);
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
        ANDROID_LOG_ERROR, kLogTagEngine, "Failed to open output stream: %s",
        oboe::convertToText(result));
    stream_.reset();
    initialized_ = false;
    running_ = false;
    return false;
  }

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
          ANDROID_LOG_WARN, kLogTagEngine, "Stream close returned: %s",
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
        ANDROID_LOG_WARN,
        kLogTagOboe,
        "stream_start skipped — already running");
    return;
  }

  streamCallback_.setStopWhenIdle(false);
  streamCallback_.setStreamStartTimeNs(monotonicNowNs());

  const oboe::Result result = stream_->requestStart();
  if (result != oboe::Result::OK) {
    __android_log_print(
        ANDROID_LOG_ERROR, kLogTagEngine, "Failed to start stream: %s",
        oboe::convertToText(result));
    return;
  }

  running_ = true;
  __android_log_print(ANDROID_LOG_INFO, kLogTagOboe, "stream_started");
}

void OboeEngine::stop() {
  if (stream_ == nullptr || !running_) {
    return;
  }

  const oboe::Result result = stream_->requestStop();
  if (result != oboe::Result::OK) {
    __android_log_print(
        ANDROID_LOG_WARN, kLogTagEngine, "Failed to stop stream: %s",
        oboe::convertToText(result));
  }

  running_ = false;
  __android_log_print(ANDROID_LOG_INFO, kLogTagOboe, "stream_stopped");
}

void OboeEngine::enqueueClick(ClickType type, int64_t scheduledDeadlineNs) {
  if (!acceptingClicks_.load(std::memory_order_acquire)) {
    return;
  }

  ClickEvent event{type, scheduledDeadlineNs};
  if (!eventQueue_.push(event)) {
    __android_log_print(ANDROID_LOG_WARN, kLogTagEngine, "Event queue full, click dropped");
  }
}

void OboeEngine::flushScheduledClicks() {
  acceptingClicks_.store(false, std::memory_order_release);
  eventQueue_.clear();
  renderer_.stopAllPlayers();
}

void OboeEngine::resumeScheduledClicks() {
  acceptingClicks_.store(true, std::memory_order_release);
}

void OboeEngine::previewClick(ClickType type) {
  switch (type) {
    case ClickType::Accent:
      renderer_.previewAccent();
      break;
    case ClickType::Normal:
      renderer_.previewNormal();
      break;
    case ClickType::Subdivision:
      renderer_.previewSubdivision();
      break;
  }
}

bool OboeEngine::isInitialized() const {
  return initialized_ && stream_ != nullptr;
}
