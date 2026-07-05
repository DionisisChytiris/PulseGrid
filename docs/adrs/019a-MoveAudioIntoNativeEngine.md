🔧 STEP 2 — MOVE AUDIO INTO NATIVE ENGINE

Now edit your NativeAudioEngine (native side).

You will integrate audio directly into the tick function:

Cursor prompt (use this EXACTLY)
Move audio playback fully into NativeAudioEngine.

GOAL:
Native engine must handle BOTH timing and audio playback.

---

REQUIREMENTS:

1. Inside native onTick / scheduling loop:
   - If beat == 1 → playAccent()
   - Else → playNormal()

2. Remove ANY requirement for JS to trigger audio

3. Ensure audio is:
   - preloaded in initialize()
   - non-blocking
   - executed in native thread (not JS bridge timing dependent)

4. JS must NOT call:
   - playAccent()
   - playNormal()

5. Keep JS only for onTick UI updates

---

EXPECTED RESULT:

- Click sound is generated directly in native engine
- No JS involvement in audio path
- No delay from React Native bridge
- Stable timing preserved exactly as current system
🔧 STEP 3 — VERIFY ARCHITECTURE AFTER CHANGE

After implementation, check logs:

GOOD result:
onTick → UI update only
(no audio logs in JS)

AND:

native engine triggers sound internally (no JS calls)