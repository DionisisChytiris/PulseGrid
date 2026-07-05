Cursor Prompt — find where audio is triggered

Paste this:

Find and map exactly where audio playback is triggered in the PulseGrid project.

GOAL:
Identify whether audio is triggered in:
- NativeAudioEngine (native layer)
- JavaScript layer (onTick handlers / services / Redux)
- Or both

---

REQUIREMENTS:

1. Search for all audio trigger calls:
   - playAccent()
   - playNormal()
   - NativeAudioModule.playAccent
   - NativeAudioModule.playNormal

2. Show EXACT call path for each:
   Example:
   onTick → NativeClickAudioTrigger → NativeAudioModule → native

3. Identify if audio is triggered:
   A) ONLY in native (best case)
   B) ONLY in JS (bad for timing)
   C) BOTH (bug risk)

4. Also check:
   - duplicated listeners
   - multiple subscriptions to onTick
   - any indirect audio triggers in Redux or services

---

OUTPUT FORMAT:

- Audio trigger locations list
- Call flow diagram in text
- Final classification: A / B / C
🧠 Why this is the right move

Right now you are at a point where:

timing is correct ✔
audio exists ✔
system complexity is increasing ⚠

So guessing would risk reintroducing:

double clicks
jitter
hidden JS latency bugs
🎯 What we’re trying to decide

After Cursor responds, we will know:

A — BEST CASE

Native-only audio → you are basically DONE

B — BAD CASE

JS audio → we move it to native

C — WORST CASE

both → we clean architecture properly