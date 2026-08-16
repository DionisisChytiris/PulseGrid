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
    case click_sample_data::AccentSound::Clave:
      loadSample(player, click_sample_data::kAccentClavePcm16Mono,
                 click_sample_data::kAccentClaveFrameCount);
      break;
    case click_sample_data::AccentSound::Bongo:
      loadSample(player, click_sample_data::kAccentBongoPcm16Mono,
                 click_sample_data::kAccentBongoFrameCount);
      break;
  }
}

void loadBarPcm(
    SamplePlayer& player,
    click_sample_data::BarSound sound) {
  switch (sound) {
    case click_sample_data::BarSound::Classic:
      loadSample(player, click_sample_data::kBarClassicPcm16Mono,
                 click_sample_data::kBarClassicFrameCount);
      break;
    case click_sample_data::BarSound::Clave:
      loadSample(player, click_sample_data::kBarClavePcm16Mono,
                 click_sample_data::kBarClaveFrameCount);
      break;
    case click_sample_data::BarSound::Bongo:
      loadSample(player, click_sample_data::kBarBongoPcm16Mono,
                 click_sample_data::kBarBongoFrameCount);
      break;
  }
}
}  // namespace

AudioRenderer::AudioRenderer() {
  loadNormalSound(click_sample_data::NormalSound::Classic);
  loadAccentSound(click_sample_data::AccentSound::Classic);
  loadBarSound(click_sample_data::BarSound::Classic);
  loadSubdivisionSound(click_sample_data::NormalSound::Classic);
  barPlayer_.setGain(0.70f);
  accentPlayer_.setGain(0.65f);
  normalPlayer_.setGain(0.60f);
}

void AudioRenderer::loadNormalSound(click_sample_data::NormalSound sound) {
  selectedNormalSound_ = sound;
  switch (sound) {
    case click_sample_data::NormalSound::Classic:
      loadSample(normalPlayer_, click_sample_data::kNormalClassicPcm16Mono,
                 click_sample_data::kNormalClassicFrameCount);
      break;
    case click_sample_data::NormalSound::Clave:
      loadSample(normalPlayer_, click_sample_data::kNormalClavePcm16Mono,
                 click_sample_data::kNormalClaveFrameCount);
      break;
    case click_sample_data::NormalSound::Bongo:
      loadSample(normalPlayer_, click_sample_data::kNormalBongoPcm16Mono,
                 click_sample_data::kNormalBongoFrameCount);
      break;
  }
}

void AudioRenderer::loadAccentSound(click_sample_data::AccentSound sound) {
  selectedAccentSound_ = sound;
  loadAccentPcm(accentPlayer_, sound);
}

void AudioRenderer::loadBarSound(click_sample_data::BarSound sound) {
  selectedBarSound_ = sound;
  loadBarPcm(barPlayer_, sound);
}

void AudioRenderer::loadSubdivisionSound(click_sample_data::NormalSound sound) {
  selectedSubdivisionSound_ = sound;
  switch (sound) {
    case click_sample_data::NormalSound::Classic:
      loadSample(subdivisionPlayer_, click_sample_data::kSubdivisionClassicPcm16Mono,
                 click_sample_data::kSubdivisionClassicFrameCount);
      break;
    case click_sample_data::NormalSound::Clave:
      loadSample(subdivisionPlayer_, click_sample_data::kSubdivisionClavePcm16Mono,
                 click_sample_data::kSubdivisionClaveFrameCount);
      break;
    case click_sample_data::NormalSound::Bongo:
      loadSample(subdivisionPlayer_, click_sample_data::kSubdivisionBongoPcm16Mono,
                 click_sample_data::kSubdivisionBongoFrameCount);
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

void AudioRenderer::selectBarSound(click_sample_data::BarSound sound) {
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

void AudioRenderer::setBarGain(float gain) {
  barPlayer_.setGain(gain);
}

void AudioRenderer::setAccentGain(float gain) {
  accentPlayer_.setGain(gain);
}

void AudioRenderer::setNormalGain(float gain) {
  normalPlayer_.setGain(gain);
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
