import { getAnalytics, logEvent } from '@react-native-firebase/analytics';

import { resolvePlaybackStopEvent } from './resolvePlaybackStopEvent';

type AnalyticsParams = Record<string, string | number | boolean>;

export type AnalyticsScreenName =
  | 'quick_metronome'
  | 'timeline_library'
  | 'timeline_editor'
  | 'settings';

export type TempoSetMethod = 'slider' | 'buttons' | 'typing' | 'tap_tempo';

export type AnalyticsSubdivision = 'base' | 'eighth' | 'triplet' | 'sixteenth';

export type TimeSignatureMethod = 'preset' | 'custom';

const AnalyticsEvents = {
  APP_STARTED: 'app_started',
  SCREEN_VIEWED: 'screen_viewed',
  METRONOME_STARTED: 'metronome_started',
  METRONOME_STOPPED: 'metronome_stopped',
  TEMPO_SET: 'tempo_set',
  SUBDIVISION_SELECTED: 'subdivision_selected',
  TIME_SIGNATURE_SELECTED: 'time_signature_selected',
  SOUND_SELECTED: 'sound_selected',
  TIMELINE_CREATED: 'timeline_created',
  TIMELINE_OPENED: 'timeline_opened',
  TIMELINE_PLAYBACK_STARTED: 'timeline_playback_started',
  TIMELINE_PLAYBACK_STOPPED: 'timeline_playback_stopped',
} as const;

const SCREEN_VIEW_DEDUP_MS = 750;

/**
 * Thin wrapper around React Native Firebase Analytics.
 * UI and domain code should call this singleton instead of importing Firebase.
 */
class AnalyticsServiceImpl {
  private metronomeStartedAtMs: number | null = null;
  private timelineStartedAtMs: number | null = null;
  private lastScreenView: { screen: AnalyticsScreenName; atMs: number } | null = null;

  private logEvent(name: string, params?: AnalyticsParams): void {
    try {
      logEvent(getAnalytics(), name, params);
    } catch (error: unknown) {
      console.warn(`[AnalyticsService] Failed to log "${name}"`, error);
    }
  }

  /** Fired once when the JS application starts. */
  logAppStarted(): void {
    this.logEvent(AnalyticsEvents.APP_STARTED);
  }

  /** Fired when a main screen becomes focused. */
  logScreenViewed(screen: AnalyticsScreenName): void {
    const nowMs = Date.now();
    if (
      this.lastScreenView !== null &&
      this.lastScreenView.screen === screen &&
      nowMs - this.lastScreenView.atMs < SCREEN_VIEW_DEDUP_MS
    ) {
      return;
    }

    this.lastScreenView = { screen, atMs: nowMs };
    this.logEvent(AnalyticsEvents.SCREEN_VIEWED, { screen });
  }

  /** Fired when the user starts Quick Metronome (not Timeline). */
  logMetronomeStarted(params: {
    bpm: number;
    timeSignature: string;
    subdivision: AnalyticsSubdivision;
    sound: string;
  }): void {
    this.metronomeStartedAtMs = Date.now();
    this.logEvent(AnalyticsEvents.METRONOME_STARTED, {
      bpm: params.bpm,
      time_signature: params.timeSignature,
      subdivision: params.subdivision,
      sound: params.sound,
    });
  }

  /**
   * Fired when the user stops Quick Metronome.
   * Skipped if it was not running or duration is under 2 seconds.
   */
  logMetronomeStopped(): void {
    const payload = resolvePlaybackStopEvent(this.metronomeStartedAtMs, Date.now());
    this.metronomeStartedAtMs = null;
    if (payload === null) {
      return;
    }
    this.logEvent(AnalyticsEvents.METRONOME_STOPPED, payload);
  }

  /** Fired once when a BPM gesture/commit finishes. */
  logTempoSet(bpm: number, method: TempoSetMethod): void {
    this.logEvent(AnalyticsEvents.TEMPO_SET, { bpm, method });
  }

  /** Fired when the user applies a subdivision. */
  logSubdivisionSelected(subdivision: AnalyticsSubdivision): void {
    this.logEvent(AnalyticsEvents.SUBDIVISION_SELECTED, { subdivision });
  }

  /** Fired when the user applies a time signature. */
  logTimeSignatureSelected(signature: string, method: TimeSignatureMethod): void {
    this.logEvent(AnalyticsEvents.TIME_SIGNATURE_SELECTED, { signature, method });
  }

  /** Fired when the user selects a different click sound. */
  logSoundSelected(sound: string): void {
    this.logEvent(AnalyticsEvents.SOUND_SELECTED, { sound });
  }

  /** Fired when a new timeline is persisted. */
  logTimelineCreated(): void {
    this.logEvent(AnalyticsEvents.TIMELINE_CREATED, { source: 'new' });
  }

  /** Fired when a timeline finishes loading in the editor. */
  logTimelineOpened(isDemo: boolean): void {
    this.logEvent(AnalyticsEvents.TIMELINE_OPENED, { is_demo: isDemo });
  }

  /** Fired when Timeline playback actually starts (not Quick Metronome). */
  logTimelinePlaybackStarted(barCount: number): void {
    this.timelineStartedAtMs = Date.now();
    this.logEvent(AnalyticsEvents.TIMELINE_PLAYBACK_STARTED, { bar_count: barCount });
  }

  /**
   * Fired when Timeline playback actually stops.
   * Skipped if it was not running or duration is under 2 seconds.
   */
  logTimelinePlaybackStopped(barCount: number): void {
    const payload = resolvePlaybackStopEvent(this.timelineStartedAtMs, Date.now());
    this.timelineStartedAtMs = null;
    if (payload === null) {
      return;
    }
    this.logEvent(AnalyticsEvents.TIMELINE_PLAYBACK_STOPPED, {
      ...payload,
      bar_count: barCount,
    });
  }
}

/** App-wide Firebase Analytics singleton. */
export const AnalyticsService = new AnalyticsServiceImpl();
