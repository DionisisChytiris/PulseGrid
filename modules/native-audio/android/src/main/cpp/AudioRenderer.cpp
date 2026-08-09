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
    case click_sample_data::AccentSound::WoodblockMedium:
      loadSample(player, click_sample_data::kAccentWoodblockMediumPcm16Mono,
                 click_sample_data::kAccentWoodblockMediumFrameCount);
      break;
    case click_sample_data::AccentSound::WoodblockHigh:
      loadSample(player, click_sample_data::kAccentWoodblockHighPcm16Mono,
                 click_sample_data::kAccentWoodblockHighFrameCount);
      break;
    case click_sample_data::AccentSound::WoodblockLow:
      loadSample(player, click_sample_data::kAccentWoodblockLowPcm16Mono,
                 click_sample_data::kAccentWoodblockLowFrameCount);
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
    case click_sample_data::BarSound::Strong:
      loadSample(player, click_sample_data::kBarStrongPcm16Mono,
                 click_sample_data::kBarStrongFrameCount);
      break;
    case click_sample_data::BarSound::Digital:
      loadSample(player, click_sample_data::kBarDigitalPcm16Mono,
                 click_sample_data::kBarDigitalFrameCount);
      break;
    case click_sample_data::BarSound::Cowbell:
      loadSample(player, click_sample_data::kBarCowbellPcm16Mono,
                 click_sample_data::kBarCowbellFrameCount);
      break;
    case click_sample_data::BarSound::WoodblockMedium:
      loadSample(player, click_sample_data::kBarWoodblockMediumPcm16Mono,
                 click_sample_data::kBarWoodblockMediumFrameCount);
      break;
    case click_sample_data::BarSound::WoodblockHigh:
      loadSample(player, click_sample_data::kBarWoodblockHighPcm16Mono,
                 click_sample_data::kBarWoodblockHighFrameCount);
      break;
    case click_sample_data::BarSound::WoodblockLow:
      loadSample(player, click_sample_data::kBarWoodblockLowPcm16Mono,
                 click_sample_data::kBarWoodblockLowFrameCount);
      break;
  }
}
}  // namespace

AudioRenderer::AudioRenderer() {
  loadNormalSound(click_sample_data::NormalSound::Classic);
  loadAccentSound(click_sample_data::AccentSound::Classic);
  // Temporary: Strong so BAR buffer content differs from Accent (Classic).
  loadBarSound(click_sample_data::BarSound::Strong);
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
    case click_sample_data::NormalSound::WoodblockMedium:
      loadSample(normalPlayer_, click_sample_data::kNormalWoodblockMediumPcm16Mono,
                 click_sample_data::kNormalWoodblockMediumFrameCount);
      break;
    case click_sample_data::NormalSound::WoodblockHigh:
      loadSample(normalPlayer_, click_sample_data::kNormalWoodblockHighPcm16Mono,
                 click_sample_data::kNormalWoodblockHighFrameCount);
      break;
    case click_sample_data::NormalSound::WoodblockLow:
      loadSample(normalPlayer_, click_sample_data::kNormalWoodblockLowPcm16Mono,
                 click_sample_data::kNormalWoodblockLowFrameCount);
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
    case click_sample_data::NormalSound::WoodblockMedium:
      loadSample(subdivisionPlayer_, click_sample_data::kSubdivisionWoodblockMediumPcm16Mono,
                 click_sample_data::kSubdivisionWoodblockMediumFrameCount);
      break;
    case click_sample_data::NormalSound::WoodblockHigh:
      loadSample(subdivisionPlayer_, click_sample_data::kSubdivisionWoodblockHighPcm16Mono,
                 click_sample_data::kSubdivisionWoodblockHighFrameCount);
      break;
    case click_sample_data::NormalSound::WoodblockLow:
      loadSample(subdivisionPlayer_, click_sample_data::kSubdivisionWoodblockLowPcm16Mono,
                 click_sample_data::kSubdivisionWoodblockLowFrameCount);
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
