#pragma once

#include <cstdint>

enum class ClickType : uint8_t {
  Accent = 0,
  Normal = 1,
  Subdivision = 2,
};

struct ClickEvent {
  ClickType type;
  int64_t timestampNs;
};
