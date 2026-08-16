package expo.modules.nativeaudio

/**
 * String IDs from ClickSoundCatalog.ts → integer bank indices.
 * Order must match scripts/embed_click_pcm.py / ClickSampleData.h enums:
 *   Normal / Subdivision: classic=0, clave=1, bongo=2
 *   Accent: classic_accent=0, clave_accent=1, bongo_accent=2
 *   Bar: classic_bar=0, clave_bar=1, bongo_bar=2
 */
internal object ClickSoundMapping {
  fun normalSoundId(value: String): Int {
    return when (value) {
      "clave" -> 1
      "bongo" -> 2
      else -> 0 // classic
    }
  }

  fun accentSoundId(value: String): Int {
    return when (value) {
      "clave_accent" -> 1
      "bongo_accent" -> 2
      else -> 0 // classic_accent
    }
  }

  fun barSoundId(value: String): Int {
    return when (value) {
      "clave_bar" -> 1
      "bongo_bar" -> 2
      else -> 0 // classic_bar
    }
  }

  fun subdivisionSoundId(value: String): Int = normalSoundId(value)
}
