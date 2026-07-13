package expo.modules.nativeaudio

internal object SubdivisionAccentModeMapping {
  fun fromString(value: String): SubdivisionAccentMode {
    return when (value) {
      "group_start" -> SubdivisionAccentMode.GROUP_START
      "every_nth" -> SubdivisionAccentMode.EVERY_NTH
      "custom" -> SubdivisionAccentMode.CUSTOM
      else -> SubdivisionAccentMode.OFF
    }
  }
}
