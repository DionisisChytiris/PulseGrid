#pragma once

#include <cstdint>

#include <oboe/Oboe.h>

#include "ClickSampleData.h"
#include "SamplePlayer.h"

class AudioRenderer {
public:
  AudioRenderer();

  void render(
      void* audioData,
      int32_t numFrames,
      int32_t channelCount,
      oboe::AudioFormat format);

  void selectNormalSound(click_sample_data::NormalSound sound);
  void selectAccentSound(click_sample_data::AccentSound sound);
  void selectSubdivisionSound(click_sample_data::NormalSound sound);
  void previewAccent();
  void previewNormal();
  void previewSubdivision();
  void stopAllPlayers();

  SamplePlayer& accentPlayer() { return accentPlayer_; }
  SamplePlayer& normalPlayer() { return normalPlayer_; }
  SamplePlayer& subdivisionPlayer() { return subdivisionPlayer_; }

  bool isIdle() const;

private:
  void loadNormalSound(click_sample_data::NormalSound sound);
  void loadAccentSound(click_sample_data::AccentSound sound);
  void loadSubdivisionSound(click_sample_data::NormalSound sound);

  SamplePlayer accentPlayer_;
  SamplePlayer normalPlayer_;
  SamplePlayer subdivisionPlayer_;
  click_sample_data::NormalSound selectedNormalSound_ =
      click_sample_data::NormalSound::Classic;
  click_sample_data::AccentSound selectedAccentSound_ =
      click_sample_data::AccentSound::Classic;
  click_sample_data::NormalSound selectedSubdivisionSound_ =
      click_sample_data::NormalSound::Classic;
};
