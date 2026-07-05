#include "SamplePlayer.h"

#include <algorithm>

void SamplePlayer::load(const int16_t* samples, const std::size_t frameCount) {
  stop();
  samples_ = samples;
  frameCount_ = frameCount;
  position_ = 0;
}

void SamplePlayer::start(const int32_t frameOffset) {
  if (samples_ == nullptr || frameCount_ == 0) {
    return;
  }

  position_ = 0;
  startFrameOffset_ = frameOffset < 0 ? 0 : frameOffset;
  playing_ = true;
}

void SamplePlayer::stop() {
  playing_ = false;
  position_ = 0;
  startFrameOffset_ = 0;
}

void SamplePlayer::render(
    int16_t* interleavedOutput,
    const int32_t numFrames,
    const int32_t channelCount) {
  if (!playing_ || samples_ == nullptr || frameCount_ == 0 || interleavedOutput == nullptr ||
      numFrames <= 0 || channelCount <= 0) {
    return;
  }

  for (int32_t frame = 0; frame < numFrames; ++frame) {
    if (!playing_) {
      break;
    }

    if (frame < startFrameOffset_) {
      continue;
    }

    if (position_ >= frameCount_) {
      playing_ = false;
      break;
    }

    const int16_t sample = samples_[position_++];
    for (int32_t channel = 0; channel < channelCount; ++channel) {
      const int32_t index = frame * channelCount + channel;
      const int32_t mixed =
          static_cast<int32_t>(interleavedOutput[index]) + static_cast<int32_t>(sample);
      interleavedOutput[index] =
          static_cast<int16_t>(std::clamp(mixed, static_cast<int32_t>(-32768), static_cast<int32_t>(32767)));
    }
  }

  // Continuation in the next callback buffer always begins at frame 0.
  startFrameOffset_ = 0;
}

bool SamplePlayer::isPlaying() const {
  return playing_;
}
