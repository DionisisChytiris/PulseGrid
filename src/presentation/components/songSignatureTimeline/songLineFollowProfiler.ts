/**
 * TEMP DEV-ONLY — follow-scroll hitch profiler.
 *
 * Measures JS rAF / UI frames / scrollTo / React commits / FlatList events and
 * correlates long frames. No production impact when disabled.
 *
 * Remove after the hitch diagnosis (or set TEMP_ENABLE_FOLLOW_SCROLL_PROFILER false).
 */

/** Master switch — must stay false in release builds (also gated by __DEV__). */
export const TEMP_ENABLE_FOLLOW_SCROLL_PROFILER = __DEV__ && true;

/**
 * Mute Metro console output while leaving collection/session logic intact.
 * Flip to true to restore hitch / rolling / session logs.
 */
export const TEMP_ENABLE_PROFILER_CONSOLE_LOGS = false;

const ROLLING_MS = 2000;
const HITCH_THRESHOLDS_MS = [20, 24, 32] as const;
const RING = 64;
const CORRELATE_WINDOW_MS = 80;

type NamedStat = { count: number; totalMs: number; maxMs: number };
type FlatListKind =
  | 'onScroll'
  | 'onLayout'
  | 'contentSizeChange'
  | 'viewableItemsChanged'
  | 'itemLayout';

type TimedMark = { at: number; label: string; value?: number };

export type FollowProfilerSnapshot = {
  durationMs: number;
  jsRaf: {
    count: number;
    avgDeltaMs: number;
    maxDeltaMs: number;
    longOver24: number;
    avgFps: number;
  };
  uiFrame: {
    count: number;
    avgDeltaMs: number;
    maxDeltaMs: number;
    longOver20: number;
    longOver24: number;
    longOver32: number;
    avgFps: number;
  };
  scroll: {
    jsRequests: number;
    uiExecutions: number;
    avgUiCallsPerSec: number;
    missedUiVsJs: number;
    skippedSameOffset: number;
  };
  react: Record<string, NamedStat>;
  flatList: Record<string, number>;
  hitchLog: string[];
};

function emptyNamed(): NamedStat {
  return { count: 0, totalMs: 0, maxMs: 0 };
}

function pushRing(buf: TimedMark[], mark: TimedMark): void {
  if (buf.length >= RING) {
    buf.shift();
  }
  buf.push(mark);
}

function marksInWindow(buf: readonly TimedMark[], at: number, windowMs: number): TimedMark[] {
  const lo = at - windowMs;
  return buf.filter((m) => m.at >= lo && m.at <= at + windowMs);
}

class SongLineFollowProfiler {
  private active = false;
  private sessionStartedAt = 0;
  private rollingStartedAt = 0;
  private rollingTimer: ReturnType<typeof setInterval> | null = null;

  // Session totals
  private jsRafCount = 0;
  private jsRafSumMs = 0;
  private jsRafMaxMs = 0;
  private jsLongOver24 = 0;
  private lastJsRafAt = 0;

  private uiFrameCount = 0;
  private uiFrameSumMs = 0;
  private uiFrameMaxMs = 0;
  private uiLongOver20 = 0;
  private uiLongOver24 = 0;
  private uiLongOver32 = 0;

  private jsScrollRequests = 0;
  private uiScrollExecutions = 0;
  private skippedSameOffset = 0;

  private react: Record<string, NamedStat> = {};
  private flatList: Record<string, number> = {};
  private hitchLog: string[] = [];

  // Rolling window (reset every ROLLING_MS)
  private rollJsRafCount = 0;
  private rollJsRafSumMs = 0;
  private rollJsRafMaxMs = 0;
  private rollJsLong24 = 0;
  private rollUiFrameCount = 0;
  private rollUiFrameSumMs = 0;
  private rollUiFrameMaxMs = 0;
  private rollUiLong20 = 0;
  private rollUiLong24 = 0;
  private rollUiLong32 = 0;
  private rollJsScroll = 0;
  private rollUiScroll = 0;
  private rollSkippedSame = 0;
  private rollReact: Record<string, NamedStat> = {};
  private rollFlatList: Record<string, number> = {};

  private recentJsRaf: TimedMark[] = [];
  private recentUiFrame: TimedMark[] = [];
  private recentScrollReq: TimedMark[] = [];
  private recentScrollExec: TimedMark[] = [];
  private recentReact: TimedMark[] = [];
  private recentFlatList: TimedMark[] = [];

  isActive(): boolean {
    return this.active;
  }

  startSession(): void {
    if (!TEMP_ENABLE_FOLLOW_SCROLL_PROFILER || this.active) {
      return;
    }
    this.resetAll();
    this.active = true;
    this.sessionStartedAt = performance.now();
    this.rollingStartedAt = this.sessionStartedAt;
    this.rollingTimer = setInterval(() => this.printRolling(), ROLLING_MS);
    if (TEMP_ENABLE_PROFILER_CONSOLE_LOGS) {
      // eslint-disable-next-line no-console
      console.log('[FollowProfiler] session START');
    }
  }

  stopSessionAndPrint(): FollowProfilerSnapshot | null {
    if (!TEMP_ENABLE_FOLLOW_SCROLL_PROFILER || !this.active) {
      return null;
    }
    if (this.rollingTimer !== null) {
      clearInterval(this.rollingTimer);
      this.rollingTimer = null;
    }
    // Flush last partial rolling window.
    this.printRolling();
    const snap = this.snapshot();
    this.printSession(snap);
    this.active = false;
    return snap;
  }

  noteJsRaf(now: number = performance.now()): void {
    if (!this.active) {
      return;
    }
    if (this.lastJsRafAt > 0) {
      const delta = now - this.lastJsRafAt;
      this.jsRafCount += 1;
      this.jsRafSumMs += delta;
      if (delta > this.jsRafMaxMs) {
        this.jsRafMaxMs = delta;
      }
      if (delta > 24) {
        this.jsLongOver24 += 1;
        this.rollJsLong24 += 1;
        this.onLongFrame('js', delta, now);
      }
      this.rollJsRafCount += 1;
      this.rollJsRafSumMs += delta;
      if (delta > this.rollJsRafMaxMs) {
        this.rollJsRafMaxMs = delta;
      }
      pushRing(this.recentJsRaf, { at: now, label: 'jsRaf', value: delta });
    }
    this.lastJsRafAt = now;
  }

  /**
   * Long UI frames only (from runOnJS). Aggregates come from ingestUiFrameStats
   * so we never double-count.
   */
  noteUiLongFrame(deltaMs: number, timestampMs: number): void {
    if (!this.active) {
      return;
    }
    pushRing(this.recentUiFrame, {
      at: timestampMs,
      label: 'uiFrame',
      value: deltaMs,
    });
    if (deltaMs >= 20) {
      this.onLongFrame('ui', deltaMs, timestampMs);
    }
  }

  /** Every UI frame (including short) — batched via shared-value drain. */
  ingestUiFrameStats(stats: {
    count: number;
    sumMs: number;
    maxMs: number;
    long20: number;
    long24: number;
    long32: number;
  }): void {
    if (!this.active || stats.count <= 0) {
      return;
    }
    this.uiFrameCount += stats.count;
    this.uiFrameSumMs += stats.sumMs;
    if (stats.maxMs > this.uiFrameMaxMs) {
      this.uiFrameMaxMs = stats.maxMs;
    }
    this.uiLongOver20 += stats.long20;
    this.uiLongOver24 += stats.long24;
    this.uiLongOver32 += stats.long32;

    this.rollUiFrameCount += stats.count;
    this.rollUiFrameSumMs += stats.sumMs;
    if (stats.maxMs > this.rollUiFrameMaxMs) {
      this.rollUiFrameMaxMs = stats.maxMs;
    }
    this.rollUiLong20 += stats.long20;
    this.rollUiLong24 += stats.long24;
    this.rollUiLong32 += stats.long32;
  }

  noteJsScrollRequest(offset: number, now: number = performance.now()): void {
    if (!this.active) {
      return;
    }
    this.jsScrollRequests += 1;
    this.rollJsScroll += 1;
    pushRing(this.recentScrollReq, {
      at: now,
      label: 'jsScrollReq',
      value: offset,
    });
  }

  noteUiScrollExec(offset: number, skippedSame: boolean, now: number = performance.now()): void {
    if (!this.active) {
      return;
    }
    if (skippedSame) {
      this.skippedSameOffset += 1;
      this.rollSkippedSame += 1;
      pushRing(this.recentScrollExec, {
        at: now,
        label: 'scrollSkipSame',
        value: offset,
      });
      return;
    }
    this.uiScrollExecutions += 1;
    this.rollUiScroll += 1;
    pushRing(this.recentScrollExec, {
      at: now,
      label: 'uiScrollTo',
      value: offset,
    });
  }

  ingestUiScrollStats(executions: number, skippedSame: number): void {
    if (!this.active) {
      return;
    }
    this.uiScrollExecutions += executions;
    this.skippedSameOffset += skippedSame;
    this.rollUiScroll += executions;
    this.rollSkippedSame += skippedSame;
  }

  noteReactCommit(
    id: string,
    phase: string,
    actualDurationMs: number,
    now: number = performance.now(),
  ): void {
    if (!this.active) {
      return;
    }
    const key = `${id}:${phase}`;
    const session = (this.react[key] ??= emptyNamed());
    session.count += 1;
    session.totalMs += actualDurationMs;
    if (actualDurationMs > session.maxMs) {
      session.maxMs = actualDurationMs;
    }
    const roll = (this.rollReact[key] ??= emptyNamed());
    roll.count += 1;
    roll.totalMs += actualDurationMs;
    if (actualDurationMs > roll.maxMs) {
      roll.maxMs = actualDurationMs;
    }
    pushRing(this.recentReact, {
      at: now,
      label: key,
      value: actualDurationMs,
    });
    if (actualDurationMs >= 8 && TEMP_ENABLE_PROFILER_CONSOLE_LOGS) {
      // Contended commits only — avoids drowning Metro on LED-only updates.
      // eslint-disable-next-line no-console
      console.log(
        `[FollowProfiler] react ${key} ${actualDurationMs.toFixed(2)}ms @ ${now.toFixed(1)}`,
      );
    }
  }

  noteRender(component: string): void {
    if (!this.active) {
      return;
    }
    const key = `render:${component}`;
    const session = (this.react[key] ??= emptyNamed());
    session.count += 1;
    const roll = (this.rollReact[key] ??= emptyNamed());
    roll.count += 1;
    pushRing(this.recentReact, {
      at: performance.now(),
      label: key,
    });
  }

  noteFlatList(kind: FlatListKind, now: number = performance.now()): void {
    if (!this.active) {
      return;
    }
    this.flatList[kind] = (this.flatList[kind] ?? 0) + 1;
    this.rollFlatList[kind] = (this.rollFlatList[kind] ?? 0) + 1;
    pushRing(this.recentFlatList, { at: now, label: kind });
  }

  private onLongFrame(source: 'js' | 'ui', deltaMs: number, at: number): void {
    const threshold =
      deltaMs >= 32 ? 32 : deltaMs >= 24 ? 24 : 20;
    const nearby = {
      jsRaf: marksInWindow(this.recentJsRaf, at, CORRELATE_WINDOW_MS),
      uiFrame: marksInWindow(this.recentUiFrame, at, CORRELATE_WINDOW_MS),
      scrollReq: marksInWindow(this.recentScrollReq, at, CORRELATE_WINDOW_MS),
      scrollExec: marksInWindow(this.recentScrollExec, at, CORRELATE_WINDOW_MS),
      react: marksInWindow(this.recentReact, at, CORRELATE_WINDOW_MS),
      flatList: marksInWindow(this.recentFlatList, at, CORRELATE_WINDOW_MS),
    };

    const causeBits: string[] = [];
    if (nearby.jsRaf.some((m) => (m.value ?? 0) >= 24)) {
      causeBits.push('longJS');
    }
    if (nearby.uiFrame.some((m) => (m.value ?? 0) >= 24) || source === 'ui') {
      causeBits.push('longUI');
    }
    if (nearby.react.length > 0) {
      causeBits.push(`react×${nearby.react.length}`);
    }
    if (nearby.flatList.length > 0) {
      const kinds = nearby.flatList.map((m) => m.label).join(',');
      causeBits.push(`flatList[${kinds}]`);
    }
    if (nearby.scrollExec.some((m) => m.label === 'scrollSkipSame')) {
      causeBits.push('scrollSkip');
    }
    if (
      nearby.scrollReq.length > 0 &&
      nearby.scrollExec.filter((m) => m.label === 'uiScrollTo').length === 0 &&
      USE_PLACEHOLDER_SCROLL_GAP
    ) {
      causeBits.push('scrollGap');
    }
    if (causeBits.length === 0) {
      causeBits.push('nothingUnusualInWindow');
    }

    const line =
      `[FollowProfiler] HITCH ≥${threshold}ms ${source.toUpperCase()} ` +
      `delta=${deltaMs.toFixed(1)}ms @${at.toFixed(1)} ` +
      `correlates=[${causeBits.join(' | ')}] ` +
      `jsRafNearby=${nearby.jsRaf.length} uiNearby=${nearby.uiFrame.length} ` +
      `scrollReq=${nearby.scrollReq.length} scrollExec=${nearby.scrollExec.length} ` +
      `react=${nearby.react.length} flatList=${nearby.flatList.length}`;

    this.hitchLog.push(line);
    if (this.hitchLog.length > 200) {
      this.hitchLog.shift();
    }
    if (TEMP_ENABLE_PROFILER_CONSOLE_LOGS) {
      // eslint-disable-next-line no-console
      console.log(line);
    }
  }

  private printRolling(): void {
    if (!this.active) {
      return;
    }
    const now = performance.now();
    const windowMs = Math.max(1, now - this.rollingStartedAt);
    const jsFps =
      this.rollJsRafCount > 0 ? (this.rollJsRafCount * 1000) / windowMs : 0;
    const uiFps =
      this.rollUiFrameCount > 0 ? (this.rollUiFrameCount * 1000) / windowMs : 0;
    const scrollPerSec = (this.rollUiScroll * 1000) / windowMs;
    const missed = Math.max(0, this.rollJsScroll - this.rollUiScroll);

    const reactLines = Object.entries(this.rollReact)
      .map(([k, v]) =>
        v.totalMs > 0
          ? `${k}:${v.count} (sum ${v.totalMs.toFixed(1)}ms max ${v.maxMs.toFixed(1)}ms)`
          : `${k}:${v.count}`,
      )
      .join(', ');
    const flatLines = Object.entries(this.rollFlatList)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');

    if (TEMP_ENABLE_PROFILER_CONSOLE_LOGS) {
      // eslint-disable-next-line no-console
      console.log(
        `[FollowProfiler] ~${(windowMs / 1000).toFixed(1)}s window | ` +
          `JS fps=${jsFps.toFixed(1)} avgΔ=${avg(this.rollJsRafSumMs, this.rollJsRafCount).toFixed(1)}ms ` +
          `maxΔ=${this.rollJsRafMaxMs.toFixed(1)}ms long>24=${this.rollJsLong24} | ` +
          `UI fps=${uiFps.toFixed(1)} avgΔ=${avg(this.rollUiFrameSumMs, this.rollUiFrameCount).toFixed(1)}ms ` +
          `maxΔ=${this.rollUiFrameMaxMs.toFixed(1)}ms ≥20/24/32=${this.rollUiLong20}/${this.rollUiLong24}/${this.rollUiLong32} | ` +
          `scroll ui/s=${scrollPerSec.toFixed(1)} jsReq=${this.rollJsScroll} uiExec=${this.rollUiScroll} ` +
          `missed(js-ui)=${missed} skipSame=${this.rollSkippedSame} | ` +
          `react{${reactLines || 'none'}} flatList{${flatLines || 'none'}}`,
      );
    }

    this.resetRolling(now);
  }

  private printSession(snap: FollowProfilerSnapshot): void {
    if (!TEMP_ENABLE_PROFILER_CONSOLE_LOGS) {
      return;
    }
    // eslint-disable-next-line no-console
    console.log(
      '[FollowProfiler] ===== SESSION SUMMARY =====\n' +
        `duration=${(snap.durationMs / 1000).toFixed(2)}s\n` +
        `JS: fps=${snap.jsRaf.avgFps.toFixed(1)} avgΔ=${snap.jsRaf.avgDeltaMs.toFixed(2)}ms ` +
        `maxΔ=${snap.jsRaf.maxDeltaMs.toFixed(2)}ms long>24=${snap.jsRaf.longOver24} n=${snap.jsRaf.count}\n` +
        `UI: fps=${snap.uiFrame.avgFps.toFixed(1)} avgΔ=${snap.uiFrame.avgDeltaMs.toFixed(2)}ms ` +
        `maxΔ=${snap.uiFrame.maxDeltaMs.toFixed(2)}ms ≥20/24/32=` +
        `${snap.uiFrame.longOver20}/${snap.uiFrame.longOver24}/${snap.uiFrame.longOver32} n=${snap.uiFrame.count}\n` +
        `Scroll: jsReq=${snap.scroll.jsRequests} uiExec=${snap.scroll.uiExecutions} ` +
        `ui/s=${snap.scroll.avgUiCallsPerSec.toFixed(1)} missed=${snap.scroll.missedUiVsJs} ` +
        `skipSame=${snap.scroll.skippedSameOffset}\n` +
        `React: ${formatNamed(snap.react)}\n` +
        `FlatList: ${JSON.stringify(snap.flatList)}\n` +
        `Hitches logged: ${snap.hitchLog.length} (last 5 below)\n` +
        snap.hitchLog.slice(-5).join('\n') +
        '\n[FollowProfiler] ===== END =====',
    );
  }

  private snapshot(): FollowProfilerSnapshot {
    const durationMs = Math.max(1, performance.now() - this.sessionStartedAt);
    return {
      durationMs,
      jsRaf: {
        count: this.jsRafCount,
        avgDeltaMs: avg(this.jsRafSumMs, this.jsRafCount),
        maxDeltaMs: this.jsRafMaxMs,
        longOver24: this.jsLongOver24,
        avgFps: (this.jsRafCount * 1000) / durationMs,
      },
      uiFrame: {
        count: this.uiFrameCount,
        avgDeltaMs: avg(this.uiFrameSumMs, this.uiFrameCount),
        maxDeltaMs: this.uiFrameMaxMs,
        longOver20: this.uiLongOver20,
        longOver24: this.uiLongOver24,
        longOver32: this.uiLongOver32,
        avgFps: (this.uiFrameCount * 1000) / durationMs,
      },
      scroll: {
        jsRequests: this.jsScrollRequests,
        uiExecutions: this.uiScrollExecutions,
        avgUiCallsPerSec: (this.uiScrollExecutions * 1000) / durationMs,
        missedUiVsJs: Math.max(0, this.jsScrollRequests - this.uiScrollExecutions),
        skippedSameOffset: this.skippedSameOffset,
      },
      react: { ...this.react },
      flatList: { ...this.flatList },
      hitchLog: [...this.hitchLog],
    };
  }

  private resetRolling(now: number): void {
    this.rollingStartedAt = now;
    this.rollJsRafCount = 0;
    this.rollJsRafSumMs = 0;
    this.rollJsRafMaxMs = 0;
    this.rollJsLong24 = 0;
    this.rollUiFrameCount = 0;
    this.rollUiFrameSumMs = 0;
    this.rollUiFrameMaxMs = 0;
    this.rollUiLong20 = 0;
    this.rollUiLong24 = 0;
    this.rollUiLong32 = 0;
    this.rollJsScroll = 0;
    this.rollUiScroll = 0;
    this.rollSkippedSame = 0;
    this.rollReact = {};
    this.rollFlatList = {};
  }

  private resetAll(): void {
    this.jsRafCount = 0;
    this.jsRafSumMs = 0;
    this.jsRafMaxMs = 0;
    this.jsLongOver24 = 0;
    this.lastJsRafAt = 0;
    this.uiFrameCount = 0;
    this.uiFrameSumMs = 0;
    this.uiFrameMaxMs = 0;
    this.uiLongOver20 = 0;
    this.uiLongOver24 = 0;
    this.uiLongOver32 = 0;
    this.jsScrollRequests = 0;
    this.uiScrollExecutions = 0;
    this.skippedSameOffset = 0;
    this.react = {};
    this.flatList = {};
    this.hitchLog = [];
    this.recentJsRaf = [];
    this.recentUiFrame = [];
    this.recentScrollReq = [];
    this.recentScrollExec = [];
    this.recentReact = [];
    this.recentFlatList = [];
    this.resetRolling(performance.now());
  }
}

function avg(sum: number, count: number): number {
  return count > 0 ? sum / count : 0;
}

function formatNamed(map: Record<string, NamedStat>): string {
  return (
    Object.entries(map)
      .map(([k, v]) =>
        v.totalMs > 0
          ? `${k}:${v.count}(sum${v.totalMs.toFixed(1)}/max${v.maxMs.toFixed(1)})`
          : `${k}:${v.count}`,
      )
      .join(', ') || 'none'
  );
}

/** Enables scrollGap correlation when JS requested scroll but UI exec missing in window. */
const USE_PLACEHOLDER_SCROLL_GAP = true;

export const followProfiler = new SongLineFollowProfiler();

/** Safe no-op wrapper for render counting in leaf components. */
export function profileRender(component: string): void {
  if (!TEMP_ENABLE_FOLLOW_SCROLL_PROFILER) {
    return;
  }
  followProfiler.noteRender(component);
}
