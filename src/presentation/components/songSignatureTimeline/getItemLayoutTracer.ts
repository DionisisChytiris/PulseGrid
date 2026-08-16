/**
 * TEMP DEV-ONLY — FlatList getItemLayout call-site tracer.
 *
 * Counts every invocation; samples stacks (first N/sec + first sample per bucket).
 * Remove after the getItemLayout investigation.
 */

import { TEMP_ENABLE_PROFILER_CONSOLE_LOGS } from './songLineFollowProfiler';

export const TEMP_ENABLE_GET_ITEM_LAYOUT_TRACER = __DEV__ && true;

const SAMPLES_PER_SEC = 20;
const STACK_FRAMES = 10;

export type GetItemLayoutCallerKind =
  | 'onScroll'
  | 'scrollTo'
  | 'virtualization'
  | 'measurement'
  | 'render'
  | 'viewability'
  | 'unknown';

type BucketStats = {
  total: number;
  sampled: number;
  duringBarTransition: number;
  exampleStack?: string;
};

class GetItemLayoutTracer {
  private active = false;
  private sessionStartedAt = 0;
  private total = 0;
  private duringBarTransition = 0;
  private buckets = new Map<GetItemLayoutCallerKind, BucketStats>();
  private sampleWindowStartedAt = 0;
  private samplesInWindow = 0;
  private seenBucketSample = new Set<GetItemLayoutCallerKind>();
  /** Bars marked as “transition window” for a short time after bar index changes. */
  private barTransitionUntil = 0;
  private lastBarIndex = -999;
  private recentScrollEventUntil = 0;
  private recentScrollToUntil = 0;

  isActive(): boolean {
    return this.active;
  }

  startSession(): void {
    if (!TEMP_ENABLE_GET_ITEM_LAYOUT_TRACER || this.active) {
      return;
    }
    this.active = true;
    this.sessionStartedAt = performance.now();
    this.total = 0;
    this.duringBarTransition = 0;
    this.buckets.clear();
    this.sampleWindowStartedAt = this.sessionStartedAt;
    this.samplesInWindow = 0;
    this.seenBucketSample.clear();
    this.barTransitionUntil = 0;
    this.lastBarIndex = -999;
    this.recentScrollEventUntil = 0;
    this.recentScrollToUntil = 0;
    if (TEMP_ENABLE_PROFILER_CONSOLE_LOGS) {
      // eslint-disable-next-line no-console
      console.log('[GetItemLayoutTracer] session START');
    }
  }

  stopSessionAndPrint(): void {
    if (!TEMP_ENABLE_GET_ITEM_LAYOUT_TRACER || !this.active) {
      return;
    }
    const durationMs = Math.max(1, performance.now() - this.sessionStartedAt);
    const perSec = (this.total * 1000) / durationMs;
    const lines = [...this.buckets.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([kind, stats]) => {
        const pct = this.total > 0 ? (100 * stats.total) / this.total : 0;
        return (
          `  ${kind}: total=${stats.total} (${pct.toFixed(1)}%) ` +
          `barTransition=${stats.duringBarTransition} sampled=${stats.sampled}` +
          (stats.exampleStack ? `\n    eg:\n${stats.exampleStack}` : '')
        );
      });

    if (TEMP_ENABLE_PROFILER_CONSOLE_LOGS) {
      // eslint-disable-next-line no-console
      console.log(
        '[GetItemLayoutTracer] ===== SESSION SUMMARY =====\n' +
          `duration=${(durationMs / 1000).toFixed(2)}s\n` +
          `total getItemLayout=${this.total}\n` +
          `calls/sec=${perSec.toFixed(1)}\n` +
          `duringBarTransition=${this.duringBarTransition} ` +
          `(${this.total > 0 ? ((100 * this.duringBarTransition) / this.total).toFixed(1) : 0}%)\n` +
          `by call-site:\n${lines.join('\n') || '  (none)'}\n` +
          '[GetItemLayoutTracer] ===== END =====',
      );
    }
    this.active = false;
  }

  /** Call when Song Line bar index advances (store / transport). */
  noteBarIndex(barIndex: number): void {
    if (!this.active) {
      return;
    }
    if (barIndex === this.lastBarIndex) {
      return;
    }
    this.lastBarIndex = barIndex;
    // Short window: bar-change related VirtualizedList work often lands within ~1 frame–2 frames.
    this.barTransitionUntil = performance.now() + 48;
  }

  /** Call from FlatList onScroll handler (JS bridge). */
  noteOnScroll(): void {
    if (!this.active) {
      return;
    }
    this.recentScrollEventUntil = performance.now() + 32;
  }

  /** Call just before JS/UI follow scroll apply (scrollTo / scrollToOffset request). */
  noteScrollToRequest(): void {
    if (!this.active) {
      return;
    }
    this.recentScrollToUntil = performance.now() + 32;
  }

  noteCall(index: number): void {
    if (!TEMP_ENABLE_GET_ITEM_LAYOUT_TRACER || !this.active) {
      return;
    }

    const now = performance.now();
    this.total += 1;
    const inBarTransition = now <= this.barTransitionUntil;
    if (inBarTransition) {
      this.duringBarTransition += 1;
    }

    const hints = {
      inOnScrollWindow: now <= this.recentScrollEventUntil,
      inScrollToWindow: now <= this.recentScrollToUntil,
    };

    if (now - this.sampleWindowStartedAt >= 1000) {
      this.sampleWindowStartedAt = now;
      this.samplesInWindow = 0;
    }

    const underRateLimit = this.samplesInWindow < SAMPLES_PER_SEC;
    // Cheap path for every call — no Error/stack allocation.
    let kind: GetItemLayoutCallerKind = classifyFromHints(hints);

    let top: string | undefined;
    const needsFirstBucketStack = !this.seenBucketSample.has(kind);
    if (underRateLimit || needsFirstBucketStack) {
      const stack = captureStack();
      kind = classifyCaller(stack, hints);
      top = formatTopFrames(stack, STACK_FRAMES);
      this.samplesInWindow += 1;
      this.seenBucketSample.add(kind);
    }

    const bucket = this.buckets.get(kind) ?? {
      total: 0,
      sampled: 0,
      duringBarTransition: 0,
    };
    bucket.total += 1;
    if (inBarTransition) {
      bucket.duringBarTransition += 1;
    }

    if (top !== undefined) {
      bucket.sampled += 1;
      if (bucket.exampleStack === undefined) {
        bucket.exampleStack = top;
      }
      this.buckets.set(kind, bucket);
      if (TEMP_ENABLE_PROFILER_CONSOLE_LOGS) {
        // eslint-disable-next-line no-console
        console.log(
          `[GetItemLayoutTracer] sample @${now.toFixed(1)} idx=${index} ` +
            `kind=${kind} barTransition=${inBarTransition ? 1 : 0}\n${top}`,
        );
      }
      return;
    }

    this.buckets.set(kind, bucket);
  }
}

function captureStack(): string {
  const err = new Error();
  return typeof err.stack === 'string' ? err.stack : '';
}

function formatTopFrames(stack: string, maxFrames: number): string {
  const frames = stack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('Error'));
  // Drop this tracer frames when present.
  const filtered = frames.filter(
    (line) =>
      !line.includes('getItemLayoutTracer') &&
      !line.includes('GetItemLayoutTracer') &&
      !line.includes('noteCall') &&
      !line.includes('captureStack') &&
      !line.includes('formatTopFrames') &&
      !line.includes('classifyCaller') &&
      !line.includes('classifyFromHints'),
  );
  const chosen = (filtered.length >= 3 ? filtered : frames).slice(0, maxFrames);
  return chosen.map((line) => `    ${line}`).join('\n');
}

function classifyFromHints(hints: {
  inOnScrollWindow: boolean;
  inScrollToWindow: boolean;
}): GetItemLayoutCallerKind {
  if (hints.inScrollToWindow) {
    return 'scrollTo';
  }
  if (hints.inOnScrollWindow) {
    return 'onScroll';
  }
  return 'unknown';
}

function classifyCaller(
  stack: string,
  hints: { inOnScrollWindow: boolean; inScrollToWindow: boolean },
): GetItemLayoutCallerKind {
  const s = stack;

  // Prefer explicit VirtualizedList symbols when available.
  if (
    /scrollTo(?:Offset)?/i.test(s) ||
    /scrollTo\.js/i.test(s) ||
    /dispatchCommand/i.test(s)
  ) {
    return 'scrollTo';
  }
  if (/onScroll|_onScroll|handleScroll|scrollEvent/i.test(s)) {
    return 'onScroll';
  }
  if (
    /viewability|computeViewable|onViewableItemsChanged|_updateViewableItems/i.test(
      s,
    )
  ) {
    return 'viewability';
  }
  if (/onCellLayout|_onCellLayout|measureLayout|onLayout/i.test(s)) {
    return 'measurement';
  }
  if (
    /updateCellsToRender|_updateCellsToRender|computeWindowedRenderLimits|_pushCells|_fillRate|_renderMask/i.test(
      s,
    )
  ) {
    return 'virtualization';
  }
  if (/render|commit|performUnitOfWork|finishedWork/i.test(s)) {
    return 'render';
  }

  return classifyFromHints(hints);
}

export const getItemLayoutTracer = new GetItemLayoutTracer();
