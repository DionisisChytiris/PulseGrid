Implement Tap Tempo.

Architecture:

QuickMetronomeScreen
↓
TapTempoButton
↓
PlaybackService
↓
TapTempoCalculator (domain)

Create:

domain/services/TapTempoCalculator.ts

Requirements:

Store the most recent tap timestamps.

Calculate BPM using the average interval between taps.

Ignore long pauses (>2 seconds).

Require at least 3 taps before producing a BPM.

Clamp BPM between 30 and 600.

PlaybackService should update Redux with the calculated BPM.

QuickMetronomeScreen should immediately update the BPM display.

Do not use React state for BPM calculations.

All tempo calculations belong in the domain.
