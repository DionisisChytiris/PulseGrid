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

internal enum class ClickSoundKind {
  BEAT_ACCENT,
  SUBDIVISION_ACCENT,
  NORMAL,
  SUBDIVISION,
}

internal object AccentClassification {
  private val defaultSubdivisionAccentMode = SubdivisionAccentMode.OFF
  private const val defaultSubdivisionAccentEveryNth = 4
  private val defaultSubdivisionAccentPattern = booleanArrayOf()

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

  fun resolveClickSoundKind(
    beatIndexInBar: Int,
    subdivisionIndex: Int,
    accentPattern: BooleanArray,
    ticksPerBeat: Int,
    subdivisionAccentMode: SubdivisionAccentMode = defaultSubdivisionAccentMode,
    subdivisionAccentEveryNth: Int = defaultSubdivisionAccentEveryNth,
    subdivisionAccentPattern: BooleanArray = defaultSubdivisionAccentPattern,
  ): ClickSoundKind {
    val beatIsAccented = resolveBeatAccent(beatIndexInBar, accentPattern)

    if (isBeatAccentHit(beatIsAccented, subdivisionIndex, ticksPerBeat)) {
      return ClickSoundKind.BEAT_ACCENT
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
      return ClickSoundKind.SUBDIVISION_ACCENT
    }

    return if (ticksPerBeat <= 1) {
      ClickSoundKind.NORMAL
    } else {
      ClickSoundKind.SUBDIVISION
    }
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
