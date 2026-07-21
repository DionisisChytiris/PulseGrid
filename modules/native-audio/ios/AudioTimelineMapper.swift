import AVFoundation
import Foundation

/**
 Maps MetronomeEngine deadline nanoseconds (`DispatchTime` uptime domain)
 into `AVAudioTime` for `AVAudioPlayerNode` scheduling.

 Calibration measures the offset between Dispatch uptime ns and
 `CoreHostTime.toNanos(CoreHostTime.current())`, then builds
 host-time based `AVAudioTime` values (sample-frame placement inside the engine).
 */
final class AudioTimelineMapper {
  private let lock = NSLock()
  private var dispatchMinusHostNs: Int64 = 0
  private var sampleRate: Double = 44_100
  private var isCalibrated = false

  var calibrated: Bool {
    lock.lock()
    defer { lock.unlock() }
    return isCalibrated
  }

  func reset() {
    lock.lock()
    defer { lock.unlock() }
    isCalibrated = false
    dispatchMinusHostNs = 0
  }

  func calibrate(sampleRate: Double) {
    let dispatchNs = DispatchTime.now().uptimeNanoseconds
    let hostNs = CoreHostTime.toNanos(CoreHostTime.current())
    let skew = Int64(bitPattern: dispatchNs) - Int64(bitPattern: hostNs)

    lock.lock()
    self.sampleRate = sampleRate > 0 ? sampleRate : 44_100
    dispatchMinusHostNs = skew
    isCalibrated = true
    lock.unlock()

    print(
      "PulseGrid-AudioTimeline — calibrated sampleRate=\(self.sampleRate) dispatchMinusHostNs=\(skew)"
    )
  }

  /// Converts a MetronomeEngine deadline into an engine schedule time.
  func audioTime(forDeadlineNs deadlineNs: UInt64) -> AVAudioTime? {
    lock.lock()
    let ready = isCalibrated
    let skew = dispatchMinusHostNs
    let rate = sampleRate
    lock.unlock()

    guard ready else {
      return nil
    }

    let deadlineHostNs = UInt64(Int64(bitPattern: deadlineNs) - skew)
    let hostTime = CoreHostTime.fromNanos(deadlineHostNs)
    // Host-time AVAudioTime is resolved to sample frames by the audio engine.
    return AVAudioTime(hostTime: hostTime)
  }

  func debugSampleEstimate(forDeadlineNs deadlineNs: UInt64, renderAnchor: AVAudioTime?) -> AVAudioFramePosition? {
    lock.lock()
    let ready = isCalibrated
    let skew = dispatchMinusHostNs
    let rate = sampleRate
    lock.unlock()

    guard ready, let renderAnchor, renderAnchor.isHostTimeValid, renderAnchor.isSampleTimeValid else {
      return nil
    }

    let deadlineHostNs = UInt64(Int64(bitPattern: deadlineNs) - skew)
    let renderHostNs = CoreHostTime.toNanos(renderAnchor.hostTime)
    let deltaNs = Int64(bitPattern: deadlineHostNs) - Int64(bitPattern: renderHostNs)
    let deltaSamples = Int64((Double(deltaNs) * rate) / 1_000_000_000.0)
    return renderAnchor.sampleTime + deltaSamples
  }
}
