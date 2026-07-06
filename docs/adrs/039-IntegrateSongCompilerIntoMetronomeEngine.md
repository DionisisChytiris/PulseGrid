Good — this next step is where people usually break their architecture if they’re not careful, so we’ll keep it very controlled.

You are not replacing anything yet. You are only adding a second input path into the existing engine.

Cursor Prompt — Integrate Song Compiler into MetronomeEngine (SAFE DUAL MODE)
Goal:
Integrate SongPlaybackCompiler output into MetronomeEngine as an optional input source WITHOUT breaking existing Quick Metronome mode.

This is a DUAL MODE ARCHITECTURE step:
- Quick Metronome (existing behavior) MUST NOT change
- Song Timeline mode is ADDITIVE only

DO NOT modify:
- OboeEngine
- ClickSoundPlayer
- ClickEventQueue
- NativeAudioModule
- existing scheduling logic

---

1. Add new input mode to MetronomeEngine:

enum PlaybackMode {
  QUICK_METRONOME,
  SONG_TIMELINE
}

---

2. Extend MetronomeEngine.start() signature (or equivalent internal config):

Optional parameter:
- compiledSequence?: CompiledPlaybackSequence
- mode: PlaybackMode

Default behavior:
- If compiledSequence is null → use QUICK_METRONOME logic (existing system unchanged)
- If compiledSequence is provided → use SONG_TIMELINE mode

---

3. Add internal event source abstraction:

Create interface:

interface EventSource {
  nextEvent(): PlaybackEvent?
  reset(): void
}

Implement:

A. QuickMetronomeEventSource
- wraps existing MetronomeEngine tick logic
- preserves all current behavior exactly

B. SongTimelineEventSource
- consumes CompiledPlaybackSequence.events
- returns events sequentially

---

4. Modify scheduler input ONLY:

Where MetronomeEngine currently does:
- calculate tick internally

Replace ONLY the source of “next event” with EventSource abstraction.

DO NOT change:
- waitUntilDeadlineNs()
- publishLookaheadEvents()
- Oboe enqueue logic
- timing math

---

5. Critical constraint:

Quick Metronome path must produce:
- identical scheduledDeadlineNs behavior as before
- identical audio timing
- identical logs (no regression)

Song Timeline path:
- uses precomputed PlaybackEvent stream
- feeds same enqueueAudioForTick() function
- reuses ALL existing Oboe pipeline unchanged

---

6. Lookahead compatibility:

SongTimelineEventSource must support:
- peeking ahead N events for publishLookaheadEvents()
- no recomputation of Song structure during playback
- deterministic iteration only

---

7. Safety rules:

- NO modification to OboeEngine
- NO modification to ClickSoundPlayer
- NO change to frameOffset logic
- NO change to HW timestamp logic

This is a scheduler input swap only.

---

8. Debug logging (add only if not present):

Log when mode switches:

- QUICK_METRONOME
- SONG_TIMELINE

Log:
- sequence source type
- first 10 events preview (debug only)

---

Expected result:

MetronomeEngine can now run in two modes:

1. Quick Mode → current behavior (unchanged)
2. Song Mode → driven by compiled SongPlaybackCompiler output

Both paths ultimately feed the same Oboe pipeline.

---

Success criteria:
- Quick Metronome behaves EXACTLY as before
- Song Timeline plays correctly using compiled events
- No changes in Oboe or audio rendering layer
Why this is the critical architecture step

This gives you:

✔ Safe dual-mode engine (VERY important)

You now have:

legacy real-time tick engine
new compiled timeline engine

running side-by-side safely

✔ Zero-risk migration path

You can now:

test Song Mode without breaking Quick Mode
compare outputs
switch dynamically
✔ Clean separation of concerns
SongCompiler = “what to play”
MetronomeEngine = “when to play it”
Oboe = “how it sounds”

This is exactly how professional audio systems are structured.

What you unlock next (important)

After this step, you are ready for:

👉 Milestone 3: “Song Timeline Playback UI”

That’s where you:

render bars visually
scroll timeline
show playhead
edit structure

AND it will actually drive audio correctly.