package expo.modules.nativeaudio

internal object ClickSoundMapping {
  fun normalSoundId(value: String): Int {
    return when (value) {
      "soft" -> 1
      "digital" -> 2
      "bright" -> 3
      "cowbell" -> 4
      else -> 0 // classic
    }
  }

  fun accentSoundId(value: String): Int {
    return when (value) {
      "strong_accent" -> 1
      "digital_accent" -> 2
      "cowbell_accent" -> 3
      else -> 0 // classic_accent
    }
  }

  fun subdivisionSoundId(value: String): Int = normalSoundId(value)
}
