import Darwin
import Foundation

/**
 iOS-safe wrappers for Core Audio host time.

 macOS provides `AudioGetCurrentHostTime` / `AudioConvertHostTimeToNanos` /
 `AudioConvertNanosToHostTime` in CoreAudio HostTime.h. Those APIs are not
 available on iOS. Host time on iOS is `mach_absolute_time()` (same domain as
 `AVAudioTime.hostTime`); convert with `mach_timebase_info`.
 */
enum CoreHostTime {
  private static let timebase: mach_timebase_info_data_t = {
    var info = mach_timebase_info_data_t()
    mach_timebase_info(&info)
    return info
  }()

  static func current() -> UInt64 {
    mach_absolute_time()
  }

  static func toNanos(_ hostTime: UInt64) -> UInt64 {
    hostTime &* UInt64(timebase.numer) / UInt64(timebase.denom)
  }

  static func fromNanos(_ nanos: UInt64) -> UInt64 {
    nanos &* UInt64(timebase.denom) / UInt64(timebase.numer)
  }
}
