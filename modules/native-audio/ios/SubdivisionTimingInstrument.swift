import Foundation

/// Retained for call-site compatibility; timing investigation logging removed.
final class SubdivisionTimingInstrument {
  func reset() {
    // no-op
  }

  func recordTick(sequence: UInt64, timestampMs: Double, bpm: Double, subdivisionMultiplier: Int) {
    // no-op
  }
}
