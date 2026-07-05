#pragma once

#include <cstdint>

#include <oboe/Oboe.h>

#include "SamplePlayer.h"

class AudioRenderer {
public:
  AudioRenderer();

  void render(
      void* audioData,
      int32_t numFrames,
      int32_t channelCount,
      oboe::AudioFormat format);

  SamplePlayer& accentPlayer() { return accentPlayer_; }
  SamplePlayer& normalPlayer() { return normalPlayer_; }
  SamplePlayer& subdivisionPlayer() { return subdivisionPlayer_; }

  bool isIdle() const;

private:
  SamplePlayer accentPlayer_;
  SamplePlayer normalPlayer_;
  SamplePlayer subdivisionPlayer_;
};
