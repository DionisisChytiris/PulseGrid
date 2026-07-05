Here are the Cursor prompts broken into clean, safe steps so you can apply them without breaking your working timing system.

🧩 CURSOR PROMPT 1 — REPLACE CLICK SOUNDS (CRITICAL FOUNDATION)

Paste this first:

PROMPT 1

We have confirmed the metronome timing system is correct.

Now we must fix ONLY audio quality for dense subdivisions (16ths/triplets).

TASK

Replace existing metronome click audio assets with ultra-short, high-precision click samples.

REQUIREMENTS FOR NEW AUDIO FILES
Duration: 10–20ms max
Pure transient click (no decay, no reverb, no echo)
Mono WAV
44.1kHz sample rate
PCM 16-bit
Normalized (no clipping)
Two variants:
click_accent.wav (slightly louder or higher pitch)
click_normal.wav (shorter / softer transient)

Optional:

click_subdivision.wav (very light click for dense subdivisions)
UPDATE
Replace existing bundled assets in Android + iOS native resources
Ensure they are preloaded during initialize() only
Do NOT change any timing or scheduler logic
Do NOT modify MetronomeEngine or NativeTimingSource
EXPECTED RESULT

Clicks should be extremely short and suitable for 75–100ms spacing (16th notes at 160–200 BPM).

🧩 CURSOR PROMPT 2 — ANDROID SOUNDPOOL FIX

Paste this after Prompt 1 is done:

PROMPT 2

Now improve Android playback stability for fast subdivisions.

FILE

ClickSoundPlayer.kt

TASKS
Increase SoundPool capacity:
Change maxStreams from 4 → 8 or 12
Improve priority handling:
accent sound priority = 2
normal/sub sound priority = 1
Ensure playback stability:
Log returned streamId from SoundPool.play()
Remove unnecessary synchronized(lock) around play() calls
(keep only initialization protection if needed)
DO NOT change:
MetronomeEngine
emitTickLocked
timing logic
subdivision calculation
GOAL

Prevent audio dropouts and masking when multiple subdivision clicks overlap at high BPM.

🧩 CURSOR PROMPT 3 — IOS AUDIO FIX

Paste this for iOS layer:

PROMPT 3

Improve iOS click playback for dense subdivisions.

FILES
ClickSoundPlayer.swift
MetronomeEngine.swift (audio part only)
TASKS
Preload updated ultra-short click samples in initialize()
Ensure AVAudioPlayer / AudioEngine:
allows overlapping playback (multiple instances)
does NOT restart or cut previous clicks unless necessary
Accent handling:
accent click must not be interrupted by subdivision clicks
Optimize for low latency:
avoid reloading audio per tick
reuse prepared audio objects if applicable
DO NOT CHANGE
timing engine
tick scheduling
subdivision logic
GOAL

Clean, immediate playback with no delay or masking at high subdivision density.

🧩 CURSOR PROMPT 4 — VALIDATION CHECK (IMPORTANT)

After implementation, run this:

PROMPT 4

Validate metronome audio correctness.

TEST CASES
120 BPM 16th notes
177 BPM 16th notes
200–240 BPM triplets
CHECK
clicks are evenly spaced (no jitter perception)
no overlapping distortion
accent clearly distinguishable
no dropped beats
LOGS

If available, compare:

expected interval vs perceived stability
SoundPool streamId logs (Android)
RULE

If timing is modified, revert immediately — timing is already confirmed correct.

⚠️ FINAL WARNING (important for Cursor)

If Cursor tries to:

modify MetronomeEngine timing
change subdivision logic
alter tick scheduling

👉 STOP IT. That is not part of this fix.

🚀 RESULT YOU SHOULD GET AFTER ALL 3 PROMPTS
16th notes sound perfectly even
triplets stop “bouncing”
no beat boundary artifacts
clean metronome feel even at high BPM
stable audio under load