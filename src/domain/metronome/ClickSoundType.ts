/** Which click sound role plays for a scheduled pulse. */
export const ClickSoundType = {
  /** Regular pulse — quarter-note grid, or non-accented subdivision fill. */
  Normal: 'normal',
  /** Strong accent from the beat accent pattern. */
  BeatAccent: 'beat_accent',
  /** Medium accent from subdivision accent mode (e.g. GROUP_START). */
  SubdivisionAccent: 'subdivision_accent',
} as const;

export type ClickSoundType = (typeof ClickSoundType)[keyof typeof ClickSoundType];
