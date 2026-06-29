Implement the PulseGrid Visual Feedback System.

## Objective

Create a configurable visual feedback system synchronized with metronome Tick events.

The animation must be driven entirely by Redux Tick updates.

No timing logic may exist in UI components.

---

Create:

presentation/components/

ScreenPulse.tsx

VisualFeedbackModeSelector.tsx

---

Visual Feedback Modes

Store in Redux:

```ts
type VisualFeedbackMode =
    | "off"
    | "dots"
    | "background"
    | "both";
```

Default:

```ts
"both"
```

---

ScreenPulse

Render an Animated.View behind the entire QuickMetronomeScreen.

Animation:

Normal background:

#121212

Normal beat:

animate to

#181818

Accent beat:

animate to

#232323

Fade back over approximately 150ms.

Do not flash instantly.

Use Animated interpolation.

---

BeatIndicator

Update BeatIndicator so it only animates when:

mode == "dots"

or

mode == "both"

---

ScreenPulse

Only animate when:

mode == "background"

or

mode == "both"

---

QuickMetronomeScreen

Add a "Visual Feedback" selector with four options:

• Off
• Beat Dots
• Background Pulse
• Both

Update Redux immediately.

Changing modes while playback is running should update the UI without restarting playback.

---

Architecture

QuickMetronomeScreen
↓
Redux Settings
↓
ScreenPulse
↓
BeatIndicator

Neither component contains timing logic.

All timing originates from Tick events emitted by the RuntimeScheduler.
