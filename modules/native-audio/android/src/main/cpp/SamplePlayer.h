#pragma once

#include <cstddef>
#include <cstdint>

class SamplePlayer {
public:
  void load(const int16_t* samples, std::size_t frameCount);
  void start();
  void stop();
  void render(int16_t* interleavedOutput, int32_t numFrames, int32_t channelCount);
  bool isPlaying() const;

private:
  const int16_t* samples_ = nullptr;
  std::size_t frameCount_ = 0;
  std::size_t position_ = 0;
  bool playing_ = false;
};
