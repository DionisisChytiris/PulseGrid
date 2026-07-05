#pragma once

#include <atomic>
#include <cstddef>

#include "ClickEvent.h"

// Single-Producer Single-Consumer lock-free ring buffer.
// Producer: JNI/scheduler thread (enqueueClick).
// Consumer: Oboe audio callback thread (drain).
class ClickEventQueue {
public:
  static constexpr std::size_t kCapacity = 64;

  bool push(const ClickEvent& event) {
    const std::size_t currentTail = tail_.load(std::memory_order_relaxed);
    const std::size_t nextTail = (currentTail + 1) % kCapacity;

    if (nextTail == head_.load(std::memory_order_acquire)) {
      return false;  // full
    }

    buffer_[currentTail] = event;
    tail_.store(nextTail, std::memory_order_release);
    return true;
  }

  bool pop(ClickEvent& event) {
    const std::size_t currentHead = head_.load(std::memory_order_relaxed);

    if (currentHead == tail_.load(std::memory_order_acquire)) {
      return false;  // empty
    }

    event = buffer_[currentHead];
    head_.store((currentHead + 1) % kCapacity, std::memory_order_release);
    return true;
  }

  bool peek(ClickEvent& event) const {
    const std::size_t currentHead = head_.load(std::memory_order_acquire);

    if (currentHead == tail_.load(std::memory_order_acquire)) {
      return false;  // empty
    }

    event = buffer_[currentHead];
    return true;
  }

  bool isEmpty() const {
    return head_.load(std::memory_order_acquire) == tail_.load(std::memory_order_acquire);
  }

private:
  ClickEvent buffer_[kCapacity]{};
  std::atomic<std::size_t> head_{0};
  std::atomic<std::size_t> tail_{0};
};
