#pragma once

#include <cstdint>

enum class ClickType : uint8_t {
  Accent = 0,
  Normal = 1,
  Subdivision = 2,
  Bar = 3,
};

struct ClickEvent {
  ClickType type;
  /** Absolute monotonic playback deadline from MetronomeEngine (System.nanoTime domain). */
  int64_t scheduledDeadlineNs;
};
