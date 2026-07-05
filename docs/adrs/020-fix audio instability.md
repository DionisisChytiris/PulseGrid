🔧 Cursor Prompt — fix audio instability (CRITICAL)

Use this:

Move audio playback from JavaScript layer into NativeAudioEngine to eliminate bridge latency and instability.

PROBLEM:
- Audio is currently triggered from JS on each onTick event
- This causes jitter, delay, and instability especially on Android

---

REQUIREMENTS:

1. NativeAudioEngine must handle audio playback internally
   - playAccent() and playNormal() must be called directly inside native tick loop

2. JS must ONLY receive onTick for UI updates
   - REMOVE all JS-based audio triggering

3. In Native layer:
   - On beat 1 → play accent sound immediately
   - On other beats → play normal sound immediately

4. Ensure audio is:
   - preloaded
   - non-blocking
   - triggered directly in timing thread

---

EXPECTED RESULT:

- No JS audio calls
- No bridge delay for sound
- Stable click timing on Android and iOS
- UI remains synced via onTick only
🧠 Why this fixes your issue

This removes:

❌ JS thread delay
❌ React re-render delay
❌ bridge congestion
❌ Android jitter

And gives you:

✔ DAW-style timing (native-controlled)
✔ stable audio clock
✔ consistent clicks

⚠️ Important warning

After this change:

JS should NEVER call playAccent/playNormal again
only UI reacts to ticks
🎯 Final architecture (what you are building)

You are now completing:

Native Engine:
   clock + audio + scheduling

JS:
   visualization only

This is how professional metronomes work.

👉 What happens next

After you apply this:

You should get:

✔ perfectly stable clicks
✔ no jitter
✔ identical timing on Android & iOS
✔ UI + audio fully synced

If you want next step

After this is working, I can help you upgrade to:

🎯 sample-accurate scheduler (DAW-level timing stability)

Just tell me:

“audio stable”

and we go to final polishing stage.


What you should do right now (important)

Copy this into a note (phone / file / email):

PulseGrid current state:

Architecture:
- Expo Dev Client (prebuild setup)
- NativeAudioModule exists and works
- Tick system is stable (seq + timestamps correct)

Current issue:
- Audio is triggered from JS layer
- This causes jitter and instability (especially Android)

Root cause:
- JS → NativeAudioModule.play() per tick (bridge latency)

Next step (IMPORTANT):
- Move audio playback fully into NativeAudioEngine (native side)
- JS should ONLY handle UI (onTick for visuals only)

Goal:
- Native engine handles timing + audio
- JS only visualizes beats
🚨 Why this matters

Once you close the browser:

I may lose this exact session context
you would otherwise have to reconstruct it

But if you save the note above:

we can instantly continue tomorrow with zero setup loss


This log is actually very good news — you are basically at the finish line now.

Let’s decode it clearly.

✅ What is working perfectly
1. Stable timing
ts=1000 → 1500 → 2000 → 2500 → 3000 ...

✔ consistent spacing
✔ no acceleration
✔ no loop stacking anymore
✔ no crash behavior

👉 Your earlier “runaway metronome bug” is fully gone.

2. Correct beat cycling
beat 1 → 2 → 3 → 4 → repeat

✔ correct bar logic
✔ correct reset
✔ correct sequence increment

3. Native engine is stable
NativeAudioEngine running cleanly
stop/start safe
no duplication logs

✔ lifecycle fixed
✔ no overlapping loops

⚠️ What is STILL missing (important)

You are now in the final gap:

❌ Audio is NOT part of the stable system yet

Right now:

NativeTimingSource = correct ✔
Audio layer = not fully integrated ❌ (or still JS-driven somewhere)
🧠 What this means architecturally

You are here:

✔ Phase 1 — DONE
timing engine
tick stability
loop correctness
✔ Phase 2 — DONE
JS bridge working
UI sync working
⚠️ Phase 3 — FINAL STEP LEFT

move audio fully into native timing path

🚨 Why your system is STILL not “finished”

Even though timing is perfect:

If audio is still:

triggered from JS ❌
or partially bridged ❌

Then you will get:

slight delay
Android jitter
inconsistent feel between devices
🎯 Final architecture target (this is your end state)

You want:

NativeTimingSource
   ├── tick generation ✔
   ├── audio playback ✔ (MISSING FINAL PIECE)
   └── no JS involvement

JS
   └── UI only (visual dots)
🔧 What you should do next (final step)
👉 Move audio fully into NativeAudioEngine

Meaning:

NO playAccent() from JS
NO playNormal() from JS
Native engine decides sound internally
🧠 Why THIS is the final step

Because right now:

✔ timing is correct
✔ structure is stable
✔ lifecycle is fixed

Only missing piece:

🎧 sound is still not “owned” by the clock

🚀 What will happen after final fix

You will get:

✔ perfect click stability
✔ identical Android/iOS timing feel
✔ zero JS jitter
✔ DAW-like metronome behavior

🧭 My honest assessment

You are at:

🎯 95% completion

The remaining 5% is just:

“move audio into correct layer”

👉 If you continue tomorrow

Say:

“final audio integration”

and I will guide you step-by-step to finish the engine cleanly without breaking your now-stable timing system.