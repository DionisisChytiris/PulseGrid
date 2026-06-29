Create an AccentPatternEditor component.

Location:

presentation/components/AccentPatternEditor.tsx

Requirements:

* Display one circle for each beat.
* Filled = accent.
* Empty = normal beat.
* Tapping a circle toggles the accent.
* Update Redux.
* PlaybackService should receive the updated AccentPattern.
* The RuntimeScheduler should immediately use the new pattern.

Do not implement musical validation inside the component.

Validation belongs to AccentPattern.
