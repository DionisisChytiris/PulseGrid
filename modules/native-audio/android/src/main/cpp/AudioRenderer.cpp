#include "AudioRenderer.h"

#include <cstring>

#include "ClickSampleData.h"

AudioRenderer::AudioRenderer() {
  accentPlayer_.load(click_sample_data::kAccentPcm16Mono, click_sample_data::kAccentFrameCount);
  normalPlayer_.load(click_sample_data::kNormalPcm16Mono, click_sample_data::kNormalFrameCount);
  subdivisionPlayer_.load(
      click_sample_data::kSubdivisionPcm16Mono, click_sample_data::kSubdivisionFrameCount);
}

void AudioRenderer::render(
    void* audioData,
    int32_t numFrames,
    int32_t channelCount,
    oboe::AudioFormat format) {
  if (audioData == nullptr || numFrames <= 0 || channelCount <= 0) {
    return;
  }

  const size_t bytesPerFrame =
      static_cast<size_t>(channelCount) *
      static_cast<size_t>(oboe::convertFormatToSizeInBytes(format));
  std::memset(audioData, 0, static_cast<size_t>(numFrames) * bytesPerFrame);

  if (format != oboe::AudioFormat::I16) {
    return;
  }

  auto* pcm = static_cast<int16_t*>(audioData);

  if (accentPlayer_.isPlaying()) {
    accentPlayer_.render(pcm, numFrames, channelCount);
  }
  if (normalPlayer_.isPlaying()) {
    normalPlayer_.render(pcm, numFrames, channelCount);
  }
  if (subdivisionPlayer_.isPlaying()) {
    subdivisionPlayer_.render(pcm, numFrames, channelCount);
  }
}

bool AudioRenderer::isIdle() const {
  return !accentPlayer_.isPlaying() &&
         !normalPlayer_.isPlaying() &&
         !subdivisionPlayer_.isPlaying();
}
