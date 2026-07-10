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
  readonly sectionName: string;
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
