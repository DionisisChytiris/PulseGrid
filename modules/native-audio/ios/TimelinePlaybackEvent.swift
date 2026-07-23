import Foundation

/// One compiled score tick from SongPlaybackCompiler (JS wire format).
struct TimelinePlaybackEvent {
  let sequence: UInt64
  let bpm: Double
  let accent: Bool
  let subdivisionIndex: Int
  let beatIndexInBar: Int
  let beatsPerMeasure: Int
  let barId: String
  let sectionId: String
}
