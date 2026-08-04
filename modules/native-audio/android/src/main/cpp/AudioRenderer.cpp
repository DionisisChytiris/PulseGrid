#include "AudioRenderer.h"

#include <cstring>

namespace {
void loadSample(
    SamplePlayer& player,
    const int16_t* samples,
    std::size_t frameCount) {
  player.load(samples, frameCount);
}

void loadAccentPcm(
    SamplePlayer& player,
    click_sample_data::AccentSound sound) {
  switch (sound) {
    case click_sample_data::AccentSound::Classic:
      loadSample(player, click_sample_data::kAccentClassicPcm16Mono,
                 click_sample_data::kAccentClassicFrameCount);
      break;
    case click_sample_data::AccentSound::Strong:
      loadSample(player, click_sample_data::kAccentStrongPcm16Mono,
                 click_sample_data::kAccentStrongFrameCount);
      break;
    case click_sample_data::AccentSound::Digital:
      loadSample(player, click_sample_data::kAccentDigitalPcm16Mono,
                 click_sample_data::kAccentDigitalFrameCount);
      break;
    case click_sample_data::AccentSound::Cowbell:
      loadSample(player, click_sample_data::kAccentCowbellPcm16Mono,
                 click_sample_data::kAccentCowbellFrameCount);
      break;
  }
}
}  // namespace

AudioRenderer::AudioRenderer() {
  loadNormalSound(click_sample_data::NormalSound::Classic);
  loadAccentSound(click_sample_data::AccentSound::Classic);
  // Temporary: Strong so BAR buffer content differs from Accent (Classic).
  loadBarSound(click_sample_data::AccentSound::Strong);
  loadSubdivisionSound(click_sample_data::NormalSound::Classic);
}

void AudioRenderer::loadNormalSound(click_sample_data::NormalSound sound) {
  selectedNormalSound_ = sound;
  switch (sound) {
    case click_sample_data::NormalSound::Classic:
      loadSample(normalPlayer_, click_sample_data::kNormalClassicPcm16Mono,
                 click_sample_data::kNormalClassicFrameCount);
      break;
    case click_sample_data::NormalSound::Soft:
      loadSample(normalPlayer_, click_sample_data::kNormalSoftPcm16Mono,
                 click_sample_data::kNormalSoftFrameCount);
      break;
    case click_sample_data::NormalSound::Digital:
      loadSample(normalPlayer_, click_sample_data::kNormalDigitalPcm16Mono,
                 click_sample_data::kNormalDigitalFrameCount);
      break;
    case click_sample_data::NormalSound::Bright:
      loadSample(normalPlayer_, click_sample_data::kNormalBrightPcm16Mono,
                 click_sample_data::kNormalBrightFrameCount);
      break;
    case click_sample_data::NormalSound::Cowbell:
      loadSample(normalPlayer_, click_sample_data::kNormalCowbellPcm16Mono,
                 click_sample_data::kNormalCowbellFrameCount);
      break;
  }
}

void AudioRenderer::loadAccentSound(click_sample_data::AccentSound sound) {
  selectedAccentSound_ = sound;
  loadAccentPcm(accentPlayer_, sound);
}

void AudioRenderer::loadBarSound(click_sample_data::AccentSound sound) {
  selectedBarSound_ = sound;
  // Bar reuses accent PCM until dedicated bar assets exist.
  loadAccentPcm(barPlayer_, sound);
}

void AudioRenderer::loadSubdivisionSound(click_sample_data::NormalSound sound) {
  selectedSubdivisionSound_ = sound;
  switch (sound) {
    case click_sample_data::NormalSound::Classic:
      loadSample(subdivisionPlayer_, click_sample_data::kSubdivisionClassicPcm16Mono,
                 click_sample_data::kSubdivisionClassicFrameCount);
      break;
    case click_sample_data::NormalSound::Soft:
      loadSample(subdivisionPlayer_, click_sample_data::kSubdivisionSoftPcm16Mono,
                 click_sample_data::kSubdivisionSoftFrameCount);
      break;
    case click_sample_data::NormalSound::Digital:
      loadSample(subdivisionPlayer_, click_sample_data::kSubdivisionDigitalPcm16Mono,
                 click_sample_data::kSubdivisionDigitalFrameCount);
      break;
    case click_sample_data::NormalSound::Bright:
      loadSample(subdivisionPlayer_, click_sample_data::kSubdivisionBrightPcm16Mono,
                 click_sample_data::kSubdivisionBrightFrameCount);
      break;
    case click_sample_data::NormalSound::Cowbell:
      loadSample(subdivisionPlayer_, click_sample_data::kSubdivisionCowbellPcm16Mono,
                 click_sample_data::kSubdivisionCowbellFrameCount);
      break;
  }
}

void AudioRenderer::selectNormalSound(click_sample_data::NormalSound sound) {
  if (sound == selectedNormalSound_) {
    return;
  }
  loadNormalSound(sound);
}

void AudioRenderer::selectAccentSound(click_sample_data::AccentSound sound) {
  if (sound == selectedAccentSound_) {
    return;
  }
  loadAccentSound(sound);
}

void AudioRenderer::selectBarSound(click_sample_data::AccentSound sound) {
  if (sound == selectedBarSound_) {
    return;
  }
  loadBarSound(sound);
}

void AudioRenderer::selectSubdivisionSound(click_sample_data::NormalSound sound) {
  if (sound == selectedSubdivisionSound_) {
    return;
  }
  loadSubdivisionSound(sound);
}

void AudioRenderer::previewAccent() {
  accentPlayer_.start(0);
}

void AudioRenderer::previewNormal() {
  normalPlayer_.start(0);
}

void AudioRenderer::previewBar() {
  barPlayer_.start(0);
}

void AudioRenderer::previewSubdivision() {
  subdivisionPlayer_.start(0);
}

void AudioRenderer::stopAllPlayers() {
  accentPlayer_.stop();
  normalPlayer_.stop();
  barPlayer_.stop();
  subdivisionPlayer_.stop();
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

  if (barPlayer_.isPlaying()) {
    barPlayer_.render(pcm, numFrames, channelCount);
  }
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
  return !barPlayer_.isPlaying() &&
         !accentPlayer_.isPlaying() &&
         !normalPlayer_.isPlaying() &&
         !subdivisionPlayer_.isPlaying();
}
