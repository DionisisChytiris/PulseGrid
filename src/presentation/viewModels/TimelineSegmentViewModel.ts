/** Presentation-only beat glyph for accent preview (▲ ○). */
export type AccentPreviewBeat = {
  readonly symbol: 'accent' | 'beat';
};

/** One numbered bar circle inside a timeline segment. */
export type BarIndicatorViewModel = {
  readonly barNumber: number;
  readonly label: string;
  readonly isActive: boolean;
  readonly isPast: boolean;
};

/**
 * Presentation view model for a horizontal timeline segment.
 * Derived from Song — never pass domain Song objects to timeline UI.
 */
export type TimelineSegmentViewModel = {
  readonly id: string;
  readonly title: string;
  readonly sectionId: string;
  readonly sectionName: string;
  /** True only for the first meter region of a Song.sections entry. */
  readonly isSectionStart: boolean;
  /** Palette index for this section, stable for the current timeline build. */
  readonly sectionColorIndex: number;
  /**
   * False for a lone implicit "Main" section — Timeline stays pre-section visually.
   * True once any explicit user-created/named section exists.
   */
  readonly showSectionVisuals: boolean;
  readonly meter: string;
  readonly numberOfBars: number;
  readonly startBar: number;
  readonly endBar: number;
  readonly barIndicators: readonly BarIndicatorViewModel[];
  readonly accentPreview: readonly AccentPreviewBeat[];
  readonly bpmOverride: number | null;
  readonly isActive: boolean;
  readonly activeBarIndex: number | null;
};

export type PlaybackStatusViewModel = {
  readonly sectionName: string;
  readonly currentBar: number;
  readonly totalBars: number;
  readonly currentBeat: number;
  readonly beatsInBar: number;
  readonly tempo: number | null;
  readonly meter: string;
  readonly isActive: boolean;
};
