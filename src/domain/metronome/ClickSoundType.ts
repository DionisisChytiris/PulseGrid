/** Which click sound role plays for a scheduled pulse. */
export const ClickSoundType = {
  /** First beat of the measure when Bar Start is enabled. */
  Bar: 'bar',
  /** Accented by beat pattern or subdivision accent logic. */
  Accent: 'accent',
  /** Unaccented beat starts and all subdivision fills. */
  Click: 'click',
} as const;

export type ClickSoundType = (typeof ClickSoundType)[keyof typeof ClickSoundType];
