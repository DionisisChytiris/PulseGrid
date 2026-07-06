import type { CompiledPlaybackSequence } from '../compiler/CompiledPlaybackSequence';

import type { SongPlaybackCursor } from './SongPlaybackCursor';
import { beatDurationNs, type ScheduledTickSnapshot } from './ScheduledTickSnapshot';
import type { SongSchedulerAdapter } from './SongSchedulerAdapter';

export const DEFAULT_DRY_RUN_BPM = 120;

export type SongModeDryRunRunnerOptions = {
  /** Mock clock BPM when waiting between ticks (uses each snapshot's bpm by default). */
  readonly mockBpm?: number;
  /** Fixed interval in ms between ticks; overrides per-event BPM timing when set. */
  readonly tickIntervalMs?: number;
  readonly debugMode?: boolean;
  readonly debugTickPreviewCount?: number;
  readonly logEachTick?: boolean;
};

export type DryRunTimelineIssue = {
  readonly code: string;
  readonly message: string;
  readonly context?: Readonly<Record<string, number | string | boolean>>;
};

export type SongModeDryRunReport = {
  readonly running: boolean;
  readonly paused: boolean;
  readonly tickCount: number;
  readonly snapshots: readonly ScheduledTickSnapshot[];
  readonly monotonicDeadlines: boolean;
  readonly maxDeadlineDriftNs: number;
  readonly maxSimulatedDriftNs: number;
  readonly issues: readonly DryRunTimelineIssue[];
};

export type SongModeDryRunRunnerInput = {
  readonly adapter: SongSchedulerAdapter;
  readonly cursor: SongPlaybackCursor;
  readonly compiled: CompiledPlaybackSequence;
};

export interface SongModeDryRunRunner {
  readonly report: SongModeDryRunReport;
  start(): void;
  pause(): void;
  resume(): void;
  stop(): SongModeDryRunReport;
}

function getMonotonicNowNs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return Math.floor(performance.now() * 1_000_000);
  }

  return Date.now() * 1_000_000;
}

function beatDurationMs(bpm: number): number {
  return beatDurationNs(bpm) / 1_000_000;
}

function resolveTickDelayMs(
  snapshot: ScheduledTickSnapshot | null,
  options: SongModeDryRunRunnerOptions,
): number {
  if (options.tickIntervalMs !== undefined) {
    return Math.max(1, options.tickIntervalMs);
  }

  const bpm = snapshot?.bpm ?? options.mockBpm ?? DEFAULT_DRY_RUN_BPM;
  return Math.max(1, beatDurationMs(bpm));
}

function formatStructuredTick(snapshot: ScheduledTickSnapshot): string {
  return JSON.stringify({
    sequence: snapshot.sequence,
    scheduledDeadlineNs: snapshot.scheduledDeadlineNs,
    bpm: snapshot.bpm,
    barId: snapshot.barId,
    sectionId: snapshot.sectionId,
    accent: snapshot.isAccent,
    subdivisionIndex: snapshot.subdivisionIndex,
  });
}

function logTick(snapshot: ScheduledTickSnapshot, tickIndex: number): void {
  console.log(
    `[SongModeDryRun] tick=${tickIndex} seq=${snapshot.sequence} ` +
      `deadlineNs=${snapshot.scheduledDeadlineNs} bpm=${snapshot.bpm} ` +
      `bar=${snapshot.barId} section=${snapshot.sectionId} accent=${snapshot.isAccent}`,
  );
}

class SongModeDryRunRunnerImpl implements SongModeDryRunRunner {
  private readonly adapter: SongSchedulerAdapter;

  private readonly cursor: SongPlaybackCursor;

  private readonly compiled: CompiledPlaybackSequence;

  private readonly options: SongModeDryRunRunnerOptions;

  private readonly snapshots: ScheduledTickSnapshot[] = [];

  private readonly issues: DryRunTimelineIssue[] = [];

  private timerId: ReturnType<typeof setTimeout> | null = null;

  private running = false;

  private paused = false;

  private maxDeadlineDriftNs = 0;

  private maxSimulatedDriftNs = 0;

  private monotonicDeadlines = true;

  constructor(input: SongModeDryRunRunnerInput, options: SongModeDryRunRunnerOptions = {}) {
    this.adapter = input.adapter;
    this.cursor = input.cursor;
    this.compiled = input.compiled;
    this.options = options;
  }

  get report(): SongModeDryRunReport {
    return this.buildReport();
  }

  start(): void {
    this.clearTimer();
    this.snapshots.length = 0;
    this.issues.length = 0;
    this.maxDeadlineDriftNs = 0;
    this.maxSimulatedDriftNs = 0;
    this.monotonicDeadlines = true;

    const anchorTimeNs = getMonotonicNowNs();
    this.adapter.setAnchorTimeNs(anchorTimeNs);
    this.adapter.reset();
    this.cursor.play();

    this.running = true;
    this.paused = false;

    console.log(`[SongModeDryRun] start anchorNs=${anchorTimeNs} events=${this.compiled.events.length}`);
    this.scheduleNextTick(null);
  }

  pause(): void {
    if (!this.running || this.paused) {
      return;
    }

    this.paused = true;
    this.cursor.pause();
    this.clearTimer();
    console.log('[SongModeDryRun] paused');
  }

  resume(): void {
    if (!this.running || !this.paused) {
      return;
    }

    this.paused = false;
    this.cursor.play();
    console.log('[SongModeDryRun] resumed');
    this.scheduleNextTick(this.snapshots[this.snapshots.length - 1] ?? null);
  }

  stop(): SongModeDryRunReport {
    this.running = false;
    this.paused = false;
    this.cursor.stop();
    this.clearTimer();

    const finalReport = this.buildReport();
    console.log(
      `[SongModeDryRun] stop ticks=${finalReport.tickCount} ` +
        `monotonic=${finalReport.monotonicDeadlines} ` +
        `maxDeadlineDriftNs=${finalReport.maxDeadlineDriftNs} ` +
        `maxSimulatedDriftNs=${finalReport.maxSimulatedDriftNs}`,
    );

    return finalReport;
  }

  private scheduleNextTick(previousSnapshot: ScheduledTickSnapshot | null): void {
    if (!this.running || this.paused) {
      return;
    }

    const delayMs = resolveTickDelayMs(previousSnapshot, this.options);
    this.timerId = setTimeout(() => {
      this.timerId = null;
      this.runMockSchedulerTick();
    }, delayMs);
  }

  private runMockSchedulerTick(): void {
    if (!this.running || this.paused) {
      return;
    }

    const simulatedNowNs = getMonotonicNowNs();
    const snapshot = this.adapter.nextScheduledEvent();

    if (snapshot === null) {
      console.log('[SongModeDryRun] completed — no more events');
      this.running = false;
      return;
    }

    this.verifySnapshot(snapshot, simulatedNowNs);
    this.snapshots.push(snapshot);

    const tickIndex = this.snapshots.length - 1;
    const shouldLog = this.options.logEachTick ?? true;

    if (shouldLog) {
      logTick(snapshot, tickIndex);
    }

    const previewCount = this.options.debugTickPreviewCount ?? 20;
    if (this.options.debugMode && tickIndex < previewCount) {
      console.log(`[SongModeDryRun] preview ${formatStructuredTick(snapshot)}`);
    }

    this.scheduleNextTick(snapshot);
  }

  private verifySnapshot(snapshot: ScheduledTickSnapshot, simulatedNowNs: number): void {
    const previous = this.snapshots[this.snapshots.length - 1];

    if (previous !== undefined && snapshot.scheduledDeadlineNs <= previous.scheduledDeadlineNs) {
      this.monotonicDeadlines = false;
      this.issues.push({
        code: 'NON_MONOTONIC_DEADLINE',
        message: 'scheduledDeadlineNs must strictly increase between ticks',
        context: {
          sequence: snapshot.sequence,
          previousDeadlineNs: previous.scheduledDeadlineNs,
          currentDeadlineNs: snapshot.scheduledDeadlineNs,
        },
      });
    }

    const expectedOffsetNs = this.adapter.deadlineOffsets[snapshot.sequence] ?? 0;
    const expectedDeadlineNs = this.adapter.anchorTimeNs + expectedOffsetNs;
    const deadlineDriftNs = Math.abs(snapshot.scheduledDeadlineNs - expectedDeadlineNs);

    if (deadlineDriftNs > this.maxDeadlineDriftNs) {
      this.maxDeadlineDriftNs = deadlineDriftNs;
    }

    if (deadlineDriftNs > 0) {
      this.issues.push({
        code: 'DEADLINE_COMPUTATION_DRIFT',
        message: 'Snapshot deadline does not match adapter offset table',
        context: {
          sequence: snapshot.sequence,
          expectedDeadlineNs,
          actualDeadlineNs: snapshot.scheduledDeadlineNs,
          driftNs: deadlineDriftNs,
        },
      });
    }

    const simulatedDriftNs = Math.abs(simulatedNowNs - snapshot.scheduledDeadlineNs);
    if (simulatedDriftNs > this.maxSimulatedDriftNs) {
      this.maxSimulatedDriftNs = simulatedDriftNs;
    }
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private buildReport(): SongModeDryRunReport {
    return {
      running: this.running,
      paused: this.paused,
      tickCount: this.snapshots.length,
      snapshots: [...this.snapshots],
      monotonicDeadlines: this.monotonicDeadlines,
      maxDeadlineDriftNs: this.maxDeadlineDriftNs,
      maxSimulatedDriftNs: this.maxSimulatedDriftNs,
      issues: [...this.issues],
    };
  }
}

export function createSongModeDryRunRunner(
  input: SongModeDryRunRunnerInput,
  options?: SongModeDryRunRunnerOptions,
): SongModeDryRunRunner {
  return new SongModeDryRunRunnerImpl(input, options);
}

/**
 * Runs the full compiled timeline synchronously (no timer) for fast verification.
 * Does not call native audio or MetronomeEngine.
 */
export function runSongModeDryRunSync(
  input: SongModeDryRunRunnerInput,
  options: SongModeDryRunRunnerOptions = {},
): SongModeDryRunReport {
  const runner = createSongModeDryRunRunner(input, {
    ...options,
    logEachTick: options.logEachTick ?? false,
  });

  input.adapter.setAnchorTimeNs(0);
  input.adapter.reset();
  input.cursor.play();

  const snapshots: ScheduledTickSnapshot[] = [];
  let snapshot = input.adapter.nextScheduledEvent();

  while (snapshot !== null) {
    snapshots.push(snapshot);

    const previewCount = options.debugTickPreviewCount ?? 20;
    if (options.debugMode && snapshots.length <= previewCount) {
      console.log(`[SongModeDryRun:sync] preview ${formatStructuredTick(snapshot)}`);
    }

    snapshot = input.adapter.nextScheduledEvent();
  }

  input.cursor.stop();

  const issues: DryRunTimelineIssue[] = [];
  let monotonicDeadlines = true;
  let maxDeadlineDriftNs = 0;

  for (let index = 0; index < snapshots.length; index += 1) {
    const current = snapshots[index];
    const previous = snapshots[index - 1];

    if (previous !== undefined && current.scheduledDeadlineNs <= previous.scheduledDeadlineNs) {
      monotonicDeadlines = false;
      issues.push({
        code: 'NON_MONOTONIC_DEADLINE',
        message: 'scheduledDeadlineNs must strictly increase between ticks',
        context: { sequence: current.sequence },
      });
    }

    const expectedDeadlineNs =
      input.adapter.anchorTimeNs + (input.adapter.deadlineOffsets[current.sequence] ?? 0);
    const driftNs = Math.abs(current.scheduledDeadlineNs - expectedDeadlineNs);

    if (driftNs > maxDeadlineDriftNs) {
      maxDeadlineDriftNs = driftNs;
    }

    if (driftNs > 0) {
      issues.push({
        code: 'DEADLINE_COMPUTATION_DRIFT',
        message: 'Snapshot deadline does not match adapter offset table',
        context: { sequence: current.sequence, driftNs },
      });
    }
  }

  return {
    running: false,
    paused: false,
    tickCount: snapshots.length,
    snapshots,
    monotonicDeadlines,
    maxDeadlineDriftNs,
    maxSimulatedDriftNs: 0,
    issues,
  };
}
