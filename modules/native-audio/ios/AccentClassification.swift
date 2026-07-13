import Foundation

/// Controls accent behavior for subdivision pulses only.
/// Independent from the beat-level accent pattern.
enum SubdivisionAccentMode {
  case off
  case groupStart
  case everyNth
  case custom
}

enum ClickSoundKind {
  case beatAccent
  case subdivisionAccent
  case normal
  case subdivision
}

enum AccentClassification {
  private static let defaultSubdivisionAccentMode: SubdivisionAccentMode = .off
  private static let defaultSubdivisionAccentEveryNth = 4
  private static let defaultSubdivisionAccentPattern: [Bool] = []

  static func resolveTickAccent(
    beatIndexInBar: Int,
    subdivisionIndex: Int,
    accentPattern: [Bool],
    ticksPerBeat: Int,
    subdivisionAccentMode: SubdivisionAccentMode = defaultSubdivisionAccentMode,
    subdivisionAccentEveryNth: Int = defaultSubdivisionAccentEveryNth,
    subdivisionAccentPattern: [Bool] = defaultSubdivisionAccentPattern
  ) -> Bool {
    let beatIsAccented = resolveBeatAccent(beatIndexInBar: beatIndexInBar, accentPattern: accentPattern)
    let subdivisionIsAccented = resolveSubdivisionAccent(
      beatIndexInBar: beatIndexInBar,
      subdivisionIndex: subdivisionIndex,
      ticksPerBeat: ticksPerBeat,
      subdivisionAccentMode: subdivisionAccentMode,
      subdivisionAccentEveryNth: subdivisionAccentEveryNth,
      subdivisionAccentPattern: subdivisionAccentPattern,
      beatIsAccented: beatIsAccented
    )

    return subdivisionIsAccented || (beatIsAccented && subdivisionIndex == 0)
  }

  static func resolveClickSoundKind(
    beatIndexInBar: Int,
    subdivisionIndex: Int,
    accentPattern: [Bool],
    ticksPerBeat: Int,
    subdivisionAccentMode: SubdivisionAccentMode = defaultSubdivisionAccentMode,
    subdivisionAccentEveryNth: Int = defaultSubdivisionAccentEveryNth,
    subdivisionAccentPattern: [Bool] = defaultSubdivisionAccentPattern
  ) -> ClickSoundKind {
    let beatIsAccented = resolveBeatAccent(beatIndexInBar: beatIndexInBar, accentPattern: accentPattern)

    if isBeatAccentHit(
      beatIsAccented: beatIsAccented,
      subdivisionIndex: subdivisionIndex,
      ticksPerBeat: ticksPerBeat
    ) {
      return .beatAccent
    }

    if resolveSubdivisionAccent(
      beatIndexInBar: beatIndexInBar,
      subdivisionIndex: subdivisionIndex,
      ticksPerBeat: ticksPerBeat,
      subdivisionAccentMode: subdivisionAccentMode,
      subdivisionAccentEveryNth: subdivisionAccentEveryNth,
      subdivisionAccentPattern: subdivisionAccentPattern,
      beatIsAccented: beatIsAccented
    ) {
      return .subdivisionAccent
    }

    return ticksPerBeat <= 1 ? .normal : .subdivision
  }

  static func resolveBeatAccent(beatIndexInBar: Int, accentPattern: [Bool]) -> Bool {
    if accentPattern.isEmpty {
      return false
    }

    return accentPattern[beatIndexInBar % accentPattern.count]
  }

  static func resolveSubdivisionAccent(
    beatIndexInBar: Int,
    subdivisionIndex: Int,
    ticksPerBeat: Int,
    subdivisionAccentMode: SubdivisionAccentMode,
    subdivisionAccentEveryNth: Int,
    subdivisionAccentPattern: [Bool],
    beatIsAccented: Bool
  ) -> Bool {
    if ticksPerBeat <= 1 || subdivisionIndex < 0 || subdivisionIndex >= ticksPerBeat {
      return false
    }

    switch subdivisionAccentMode {
    case .off:
      return false
    case .groupStart:
      return subdivisionIndex == 0
    case .everyNth:
      if subdivisionAccentEveryNth <= 0 {
        return false
      }

      let globalIndex = beatIndexInBar * ticksPerBeat + subdivisionIndex
      return globalIndex % subdivisionAccentEveryNth == 0
    case .custom:
      return resolveCustomSubdivisionAccent(
        subdivisionIndex: subdivisionIndex,
        pattern: subdivisionAccentPattern
      )
    }
  }

  static func resolveCustomSubdivisionAccent(
    subdivisionIndex: Int,
    pattern: [Bool]
  ) -> Bool {
    if pattern.isEmpty {
      return false
    }

    return pattern[subdivisionIndex % pattern.count]
  }

  private static func isBeatAccentHit(
    beatIsAccented: Bool,
    subdivisionIndex: Int,
    ticksPerBeat: Int
  ) -> Bool {
    if !beatIsAccented {
      return false
    }

    if ticksPerBeat <= 1 {
      return true
    }

    return subdivisionIndex == 0
  }
}
