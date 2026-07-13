Adding { id: 'clave', label: 'Clave' } to ClickSoundCatalog.ts only makes it appear in Settings and persist in Redux/AsyncStorage. Native code will not load or play it until you wire it through the rest of the pipeline.

Naming convention (important)
The project does not look for bare clave.wav. It expects this pattern:

Role	Filename
Normal beat
click_normal_clave.wav
Subdivision (required per normal sound)
click_subdivision_clave.wav
Put the source file at something like assets/audio/click_normal_clave.wav (or add it to the variant script), then copy into:

assets/audio/clicks/
modules/native-audio/android/src/main/res/raw/
modules/native-audio/ios/Assets/
generate_click_variants.py already copies into all three when you add a variant there.

WAV format: PCM16 mono (same as existing clicks).

Full checklist for a new normal sound clave
1. Domain catalog (you already know this)
src/domain/metronome/ClickSoundCatalog.ts:

{ id: 'clave', label: 'Clave' },
That updates the TypeScript type NormalClickSoundId automatically. Settings UI (MetronomeSoundSection) picks it up with no extra UI code.

Optional: add a test case in ClickSoundCatalog.test.ts.

2. Asset files
You need two WAVs:

click_normal_clave.wav
click_subdivision_clave.wav (quieter/shorter subdivision click — can be derived from the normal one)
Either:

Add to scripts/generate_click_variants.py in NORMAL_VARIANTS and SUBDIVISION_VARIANTS, then run the script, or
Manually place both files in res/raw/ and ios/Assets/ (and assets/audio/clicks/).
3. Android — embed PCM at build time
Run scripts/embed_click_pcm.py after adding click_normal_clave.wav and click_subdivision_clave.wav to res/raw/.

You must also edit the script to include the new files in NORMAL_SAMPLES / SUBDIVISION_SAMPLES — it does not auto-discover files.

That regenerates ClickSampleData.h with new PCM arrays and enum entries.

4. Android — C++ sample selection
modules/native-audio/android/src/main/cpp/ClickSampleData.h (generated):

Add Clave = 4 to enum class NormalSound
Bump kNormalSoundCount to 5
Add subdivision enum/array for clave
modules/native-audio/android/src/main/cpp/AudioRenderer.cpp:

New case in loadNormalSound() → load kNormalClavePcm16Mono
New case in loadSubdivisionForNormal() → load matching subdivision PCM
5. Android — string ID → int index
modules/native-audio/android/src/main/java/expo/modules/nativeaudio/ClickSoundMapping.kt:

"clave" -> 4
Without this, 'clave' from JS falls through to else -> 0 (classic).

6. iOS — resource name mapping
modules/native-audio/ios/ClickSoundPlayer.swift — normalResourceName(for:):

case "clave":
  return "clave"
iOS then loads click_normal_clave.wav and click_subdivision_clave.wav from the bundle (NativeAudioModule.podspec already bundles Assets/*.wav).

7. Rebuild native app
Metro reload is not enough. Run:

npx expo run:android
# and/or
npx expo run:ios
Android needs a native rebuild because PCM is compiled into the binary via ClickSampleData.h.

What you do not need to change
File	Why
ClickSoundService.ts
Already forwards any valid NormalClickSoundId
NativeAudioEngine.ts / NativeAudioModule.ts
Generic string bridge
MetronomeEngine.kt
Only plays accent/normal/subdiv — no file selection
OboeEngine / SamplePlayer
Playback only
settingsSlice.ts
Uses catalog types
Flow after you add clave
Settings picks "clave"
  → ClickSoundService.setNormalClickSound('clave')
  → NativeAudioModule.setNormalClickSound('clave')
  → Android: ClickSoundMapping → 4 → AudioRenderer.selectNormalSound(Clave)
  → iOS: normalResourceName → loads click_normal_clave.wav
If you also want a clave accent
Accent sounds are separate (ACCENT_CLICK_SOUNDS). You would add e.g. click_accent_clave.wav, extend ACCENT_CLICK_SOUNDS, ClickSoundMapping.accentSoundId, AudioRenderer accent cases, and iOS accentResourceName — same pattern as normal.

Short answer
ClickSoundCatalog.ts alone is step 1 of ~6. You also need:

Correctly named WAV files (click_normal_clave.wav + click_subdivision_clave.wav)
embed_click_pcm.py + regenerated ClickSampleData.h (Android)
AudioRenderer.cpp cases (Android)
ClickSoundMapping.kt (Android)
ClickSoundPlayer.swift mapping (iOS)
Native rebuild
If you want, I can implement the full clave wiring in a follow-up.


====================================================





If you want to create a WAV file in PCM16 mono (16-bit PCM, 1 channel), the method depends on the software you're using.

In Cubase (recommended)
Finish your project.
Go to File → Export → Audio Mixdown.
Set:
File Format: WAV
Sample Rate: e.g. 44.1 kHz or 48 kHz (whichever your project uses)
Bit Depth: 16 Bit
Under Channels, choose:
Mono (instead of Stereo)
Export.

The resulting file will be:

✅ WAV
✅ PCM 16-bit
✅ Mono