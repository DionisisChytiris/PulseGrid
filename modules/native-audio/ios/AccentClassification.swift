import Foundation

/// Controls accent behavior for subdivision pulses only.
/// Independent from the beat-level accent pattern.
enum SubdivisionAccentMode {
  case off
  case groupStart
  case everyNth
  case custom
}

/// Live audible roles. `.subdivision` is retained for compatibility only (unused for ticks).
enum ClickSoundKind {
  case bar
  case accent
  case click
  case subdivision
}

enum AccentClassification {
  private static let defaultSubdivisionAccentMode: SubdivisionAccentMode = .off
  private static let defaultSubdivisionAccentEveryNth = 4
  private static let defaultSubdivisionAccentPattern: [Bool] = []
  private static let defaultBarStartEnabled = true

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

  /// Priority: Bar Start (downbeat only, when enabled) → accent logic → Click.
  /// Quick Metronome: beat-accent pattern does not apply to beat 1 (Bar Start owns that slot).
  /// Subdivision accents still apply on every beat, including beat 1.
  static func resolveClickSoundKind(
    beatIndexInBar: Int,
    subdivisionIndex: Int,
    accentPattern: [Bool],
    ticksPerBeat: Int,
    subdivisionAccentMode: SubdivisionAccentMode = defaultSubdivisionAccentMode,
    subdivisionAccentEveryNth: Int = defaultSubdivisionAccentEveryNth,
    subdivisionAccentPattern: [Bool] = defaultSubdivisionAccentPattern,
    barStartEnabled: Bool = defaultBarStartEnabled
  ) -> ClickSoundKind {
    if barStartEnabled && isBarStartHit(
      beatIndexInBar: beatIndexInBar,
      subdivisionIndex: subdivisionIndex
    ) {
      return .bar
    }

    let beatIsAccented = resolveBeatAccent(beatIndexInBar: beatIndexInBar, accentPattern: accentPattern)
    // Beat 1 main-beat accent is owned by Bar Start; do not fall through to accentPattern[0].
    let beatAccentForHit = beatIndexInBar != 0 && beatIsAccented

    if isBeatAccentHit(
      beatIsAccented: beatAccentForHit,
      subdivisionIndex: subdivisionIndex,
      ticksPerBeat: ticksPerBeat
    ) {
      return .accent
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
      return .accent
    }

    return .click
  }

  /// Song timeline: accent from compiled event; Bar Start only overrides the downbeat when enabled.
  /// Disabling Bar Start removes only BAR — compiled accent on beat 1 still applies.
  static func resolveClickSoundKindFromTickAccent(
    isAccent: Bool,
    beatIndexInBar: Int,
    subdivisionIndex: Int,
    barStartEnabled: Bool = defaultBarStartEnabled
  ) -> ClickSoundKind {
    if barStartEnabled && isBarStartHit(
      beatIndexInBar: beatIndexInBar,
      subdivisionIndex: subdivisionIndex
    ) {
      return .bar
    }

    if isAccent {
      return .accent
    }

    return .click
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

  private static func isBarStartHit(
    beatIndexInBar: Int,
    subdivisionIndex: Int
  ) -> Bool {
    beatIndexInBar == 0 && subdivisionIndex == 0
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
