Phase 3 — Professional Metronome Features
Step 1 — Accent Patterns ⭐⭐⭐⭐⭐ (Highest Priority)

Currently, every bar is:

4/4
> • • •

You want to support patterns like:

4/4
> • • •

7/8
> • > • > • •

5/8
> • • > •

9/8
> • • > • • > • •
Cursor Prompt
Implement configurable accent patterns.

GOAL:
Replace the fixed "beat 1 accented" behavior with configurable accent patterns.

Requirements:

- Create an AccentPattern domain model.
- Store the pattern as an array of booleans.

Examples:

4/4
[true,false,false,false]

3/4
[true,false,false]

7/8 (3+2+2)
[true,false,false,true,false,true,false]

The NativeAudioEngine must use the accent pattern when generating clicks.

JS sends the pattern once whenever it changes.

Do not generate accents in JS.

Redux only stores the selected pattern.

Keep timing logic unchanged.
Step 2 — Subdivisions ⭐⭐⭐⭐⭐

Support:

Quarter notes

Eighth notes

Sixteenth notes

Triplets (later)

Example:

120 BPM

Quarter:

1 2 3 4

Eighth:

1 & 2 & 3 & 4 &

Sixteenth:

1 e & a
Cursor Prompt
Add subdivisions to the native timing engine.

Requirements:

Supported values:

- Quarter
- Eighth
- Sixteenth

Native engine generates subdivision ticks.

Accent only the first beat of each measure.

Expose subdivision selection through Redux.

UI displays current subdivision.

Do not use JS timers.

Do not modify existing timing architecture.


Additional requirement:

Add support for Eighth-Note Triplets as an additional subdivision.

Requirements:
- Treat triplets as 3 subdivision ticks per beat.
- The native timing engine must generate all triplet ticks.
- Do not use JavaScript timers.
- Keep the existing timing architecture unchanged.
- Accent only the first beat of each measure; all triplet subdivision ticks use the normal click.
- Add Triplets as a selectable subdivision in Redux.
- Update the UI to display and allow selection of Triplets alongside Quarter, Eighth, and Sixteenth.
- Send subdivision changes to the native engine through the existing NativeAudioModule API.
- Implement triplets without affecting the stability or accuracy of the existing native timing engine.

uneven triples and 16th sounds on fast tempo
"Review the Android ClickSoundPlayer implementation. Determine whether rapid consecutive SoundPool.play() calls reuse or interrupt the same stream, and whether the bundled click samples are appropriate for 16th notes and triplets at 200+ BPM. Do not modify timing logic—only analyze the audio playback path and recommend improvements.


Add temporary JS bridge logging to debug NativeAudioEngine tick flow.

IMPORTANT RULES:
- Do NOT modify NativeAudioEngine (Android/Kotlin)
- Do NOT change timing logic or scheduling
- Do NOT add any JS timers or intervals
- Do NOT affect audio playback or beat generation
- This is ONLY for debugging visibility in JS layer

GOAL:
We need to visually confirm tick flow coming from native engine in JavaScript.

TASK:

1. Locate the JS listener/bridge that receives NativeAudioEngine "onTick" events.

2. Add logging in JS ONLY:

   console.log("[Subdivision]", event);

3. Ensure logs include:
   - seq (tick sequence)
   - beat number
   - timestamp if available

4. If Redux middleware or event handler exists, log there instead of duplicating listeners.

5. Do NOT create new listeners or duplicate subscriptions.

6. Keep logging minimal and performant (no heavy string formatting).

EXPECTED RESULT:
- Every native tick is visible in Metro/Expo console
- Logs should help verify subdivision correctness and beat grouping
- No impact on audio timing or performance

This is a temporary debugging layer only. It must be easy to remove later.






Step 3 — Tap Tempo ⭐⭐⭐⭐

This is a surprisingly important feature.

Cursor Prompt
Implement Tap Tempo.

Requirements:

- Add a Tap Tempo button.

- Record timestamps of taps.

- Average the last 4–8 intervals.

- Convert interval to BPM.

- Clamp BPM to valid limits.

- Ignore taps separated by more than 2 seconds.

- Update NativeAudioEngine tempo immediately without restarting playback.

Keep all timing inside the native engine.
Step 4 — Beat Flash Animation ⭐⭐⭐

You've already experimented with this.

Now polish it.

Instead of changing the whole screen color, animate just the beat indicator:

Active beat grows
Slight glow
Fade back smoothly

This keeps the UI clean and avoids distracting flashes.

Step 5 — Advanced Time Signatures ⭐⭐⭐⭐

Support:

2/4
3/4
4/4
5/4
6/8
7/8
9/8
12/8

The domain should validate them.

The native engine should accept them without special cases.

Step 6 — Playback Controls ⭐⭐⭐

Add:

Count-in
Auto-stop after X bars
Loop indefinitely
Continue from current beat
Reset to beat 1

These are all playback behaviors, so they belong in the PlaybackService, not the UI.

Step 7 — Presets ⭐⭐⭐⭐

Allow users to save configurations like:

Jazz Swing
120 BPM
4/4
Swing subdivision

Rock
140 BPM
4/4

Practice
60 BPM
Accent every beat

Store them using your persistence layer.

📁 After Phase 3, your architecture will look like this
presentation/
    QuickMetronomeScreen

application/
    PlaybackService
    TapTempoService

domain/
    AccentPattern
    TimeSignature
    Tempo
    Song

infrastructure/
    NativeAudioEngine
    ClickSoundPlayer
    NativeAudioModule

features/
    metronome
    settings

store/
    Redux

theme/
utils/
🏁 My recommendation

Build them in this exact order:

✅ Accent Patterns
✅ Subdivisions
✅ Tap Tempo
✅ Beat Animation
✅ Advanced Time Signatures
✅ Playback Controls
✅ Presets

This sequence minimizes risk because it extends your finished native engine instead of modifying its core timing logic. By the end of Phase 3, PulseGrid will have the feature set expected from a serious metronome while keeping the architecture you've worked hard to establish.