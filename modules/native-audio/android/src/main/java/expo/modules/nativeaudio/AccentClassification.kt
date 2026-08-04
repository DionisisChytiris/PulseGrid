package expo.modules.nativeaudio

/**
 * Controls accent behavior for subdivision pulses only.
 * Independent from the beat-level accent pattern.
 */
internal enum class SubdivisionAccentMode {
  OFF,
  GROUP_START,
  EVERY_NTH,
  CUSTOM,
}

/**
 * Live audible roles. [SUBDIVISION] is retained for compatibility only (unused for ticks).
 */
internal enum class ClickSoundKind {
  BAR,
  ACCENT,
  CLICK,
  SUBDIVISION,
}

internal object AccentClassification {
  private val defaultSubdivisionAccentMode = SubdivisionAccentMode.OFF
  private const val defaultSubdivisionAccentEveryNth = 4
  private val defaultSubdivisionAccentPattern = booleanArrayOf()
  private const val defaultBarStartEnabled = true

  fun resolveTickAccent(
    beatIndexInBar: Int,
    subdivisionIndex: Int,
    accentPattern: BooleanArray,
    ticksPerBeat: Int,
    subdivisionAccentMode: SubdivisionAccentMode = defaultSubdivisionAccentMode,
    subdivisionAccentEveryNth: Int = defaultSubdivisionAccentEveryNth,
    subdivisionAccentPattern: BooleanArray = defaultSubdivisionAccentPattern,
  ): Boolean {
    val beatIsAccented = resolveBeatAccent(beatIndexInBar, accentPattern)
    val subdivisionIsAccented = resolveSubdivisionAccent(
      beatIndexInBar,
      subdivisionIndex,
      ticksPerBeat,
      subdivisionAccentMode,
      subdivisionAccentEveryNth,
      subdivisionAccentPattern,
      beatIsAccented,
    )

    return subdivisionIsAccented || (beatIsAccented && subdivisionIndex == 0)
  }

  /**
   * Priority: Bar Start (downbeat only, when enabled) → accent logic → Click.
   * Quick Metronome: beat-accent pattern does not apply to beat 1 (Bar Start owns that slot).
   * Subdivision accents still apply on every beat, including beat 1.
   */
  fun resolveClickSoundKind(
    beatIndexInBar: Int,
    subdivisionIndex: Int,
    accentPattern: BooleanArray,
    ticksPerBeat: Int,
    subdivisionAccentMode: SubdivisionAccentMode = defaultSubdivisionAccentMode,
    subdivisionAccentEveryNth: Int = defaultSubdivisionAccentEveryNth,
    subdivisionAccentPattern: BooleanArray = defaultSubdivisionAccentPattern,
    barStartEnabled: Boolean = defaultBarStartEnabled,
  ): ClickSoundKind {
    if (barStartEnabled && isBarStartHit(beatIndexInBar, subdivisionIndex)) {
      return ClickSoundKind.BAR
    }

    val beatIsAccented = resolveBeatAccent(beatIndexInBar, accentPattern)
    // Beat 1 main-beat accent is owned by Bar Start; do not fall through to accentPattern[0].
    val beatAccentForHit = beatIndexInBar != 0 && beatIsAccented

    if (isBeatAccentHit(beatAccentForHit, subdivisionIndex, ticksPerBeat)) {
      return ClickSoundKind.ACCENT
    }

    if (
      resolveSubdivisionAccent(
        beatIndexInBar,
        subdivisionIndex,
        ticksPerBeat,
        subdivisionAccentMode,
        subdivisionAccentEveryNth,
        subdivisionAccentPattern,
        beatIsAccented,
      )
    ) {
      return ClickSoundKind.ACCENT
    }

    return ClickSoundKind.CLICK
  }

  /**
   * Song timeline: accent from compiled event; Bar Start only overrides the downbeat when enabled.
   * Disabling Bar Start removes only BAR — compiled accent on beat 1 still applies.
   */
  fun resolveClickSoundKindFromTickAccent(
    isAccent: Boolean,
    beatIndexInBar: Int,
    subdivisionIndex: Int,
    barStartEnabled: Boolean = defaultBarStartEnabled,
  ): ClickSoundKind {
    if (barStartEnabled && isBarStartHit(beatIndexInBar, subdivisionIndex)) {
      return ClickSoundKind.BAR
    }

    if (isAccent) {
      return ClickSoundKind.ACCENT
    }

    return ClickSoundKind.CLICK
  }

  fun resolveBeatAccent(beatIndexInBar: Int, accentPattern: BooleanArray): Boolean {
    if (accentPattern.isEmpty()) {
      return false
    }

    return accentPattern[beatIndexInBar % accentPattern.size]
  }

  fun resolveSubdivisionAccent(
    beatIndexInBar: Int,
    subdivisionIndex: Int,
    ticksPerBeat: Int,
    subdivisionAccentMode: SubdivisionAccentMode,
    subdivisionAccentEveryNth: Int,
    subdivisionAccentPattern: BooleanArray,
    beatIsAccented: Boolean,
  ): Boolean {
    if (ticksPerBeat <= 1 || subdivisionIndex < 0 || subdivisionIndex >= ticksPerBeat) {
      return false
    }

    return when (subdivisionAccentMode) {
      SubdivisionAccentMode.OFF -> false
      SubdivisionAccentMode.GROUP_START -> subdivisionIndex == 0
      SubdivisionAccentMode.EVERY_NTH -> {
        if (subdivisionAccentEveryNth <= 0) {
          false
        } else {
          val globalIndex = beatIndexInBar * ticksPerBeat + subdivisionIndex
          globalIndex % subdivisionAccentEveryNth == 0
        }
      }
      SubdivisionAccentMode.CUSTOM -> resolveCustomSubdivisionAccent(
        subdivisionIndex,
        subdivisionAccentPattern,
      )
    }
  }

  fun resolveCustomSubdivisionAccent(
    subdivisionIndex: Int,
    pattern: BooleanArray,
  ): Boolean {
    if (pattern.isEmpty()) {
      return false
    }

    return pattern[subdivisionIndex % pattern.size]
  }

  private fun isBarStartHit(
    beatIndexInBar: Int,
    subdivisionIndex: Int,
  ): Boolean {
    return beatIndexInBar == 0 && subdivisionIndex == 0
  }

  private fun isBeatAccentHit(
    beatIsAccented: Boolean,
    subdivisionIndex: Int,
    ticksPerBeat: Int,
  ): Boolean {
    if (!beatIsAccented) {
      return false
    }

    if (ticksPerBeat <= 1) {
      return true
    }

    return subdivisionIndex == 0
  }
}
