package expo.modules.nativeaudio

internal object ClickSoundMapping {
  fun normalSoundId(value: String): Int {
    return when (value) {
      "soft" -> 1
      "digital" -> 2
      "bright" -> 3
      "cowbell" -> 4
      "woodblock_medium" -> 5
      "woodblock_high" -> 6
      "woodblock_low" -> 7
      else -> 0 // classic
    }
  }

  fun accentSoundId(value: String): Int {
    return when (value) {
      "strong_accent" -> 1
      "digital_accent" -> 2
      "cowbell_accent" -> 3
      "woodblock_medium" -> 4
      "woodblock_high" -> 5
      "woodblock_low" -> 6
      else -> 0 // classic_accent
    }
  }

  /** Bar uses BarSound indices; IDs match Accent until dedicated bar assets exist. */
  fun barSoundId(value: String): Int = accentSoundId(value)

  fun subdivisionSoundId(value: String): Int = normalSoundId(value)
}
