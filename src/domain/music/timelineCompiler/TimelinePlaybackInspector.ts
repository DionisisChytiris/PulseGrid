import { downbeatAccentPattern, type SongAccentPattern } from '../AccentPattern';
import { createBar } from '../Bar';
import { createMeter } from '../Meter';
import { createSection } from '../Section';
import { createSong, type Song } from '../Song';
import { locateBarsInSong } from '../SongUtils';
import { createTempoDefinitionForMeter } from '../TempoDefinition';
import type { SubdivisionKind } from '../../valueObjects/Subdivision';
import type { TimelineCompiledPlaybackSequence } from './TimelineCompiledPlaybackSequence';
import type { TimelinePlaybackEvent } from './TimelinePlaybackEvent';
import { compileSong } from './SongTimelineCompiler';

export type TimelineValidationSeverity = 'error' | 'warning' | 'info';

export type TimelineValidationIssue = {
  readonly code: string;
  readonly severity: TimelineValidationSeverity;
  readonly message: string;
  readonly context?: Readonly<Record<string, string | number | boolean>>;
};

export type TimelineTempoChange = {
  readonly barId: string;
  readonly sectionId: string;
  readonly barInstanceIndex: number;
  readonly previousBpm: number;
  readonly newBpm: number;
  readonly sequenceIndex: number;
};

export type TimelineStressTestResult = {
  readonly barInstanceCount: number;
  readonly firstHash: string;
  readonly secondHash: string;
  readonly deterministic: boolean;
};

export type TimelineValidationSummary = {
  readonly totalEvents: number;
  readonly totalBarInstances: number;
  readonly uniqueSectionIds: number;
  readonly uniqueBarIds: number;
  readonly tempoChangeCount: number;
};

export type TimelineValidationReport = {
  readonly valid: boolean;
  readonly issueCount: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly issues: readonly TimelineValidationIssue[];
  readonly tempoChanges: readonly TimelineTempoChange[];
  readonly summary: TimelineValidationSummary;
  readonly hash: string;
  readonly stressTest?: TimelineStressTestResult;
};

export type ValidateTimelineOptions = {
  readonly log?: boolean;
  readonly stressTest?: boolean;
  readonly stressTestBarCount?: number;
  readonly sourceSong?: Song;
};

type BarInstanceGroup = {
  readonly events: readonly TimelinePlaybackEvent[];
  readonly startSequenceIndex: number;
};

const SUBDIVISION_KINDS: readonly SubdivisionKind[] = [
  'quarter',
  'eighth',
  'triplet',
  'sixteenth',
];

function pushIssue(
  issues: TimelineValidationIssue[],
  issue: TimelineValidationIssue,
): void {
  issues.push(issue);
}

function isValidAccentPattern(
  pattern: SongAccentPattern | null | undefined,
): pattern is SongAccentPattern {
  if (pattern === null || pattern === undefined) {
    return false;
  }

  if (pattern.kind === 'steps') {
    return Array.isArray(pattern.steps) && pattern.steps.length > 0;
  }

  if (pattern.kind === 'grouped') {
    return (
      Array.isArray(pattern.groups) &&
      pattern.groups.length > 0 &&
      pattern.groups.every((size) => Number.isInteger(size) && size > 0)
    );
  }

  return false;
}

function groupBarInstances(events: readonly TimelinePlaybackEvent[]): BarInstanceGroup[] {
  const groups: BarInstanceGroup[] = [];
  let cursor = 0;

  while (cursor < events.length) {
    const first = events[cursor];
    const expectedBeats = first.beatsPerBar;
    const instanceEvents: TimelinePlaybackEvent[] = [];

    for (
      let beatIndex = 0;
      beatIndex < expectedBeats && cursor < events.length;
      beatIndex += 1, cursor += 1
    ) {
      instanceEvents.push(events[cursor]);
    }

    groups.push({
      events: instanceEvents,
      startSequenceIndex: first.sequenceIndex,
    });
  }

  return groups;
}

function canonicalizeAccentPattern(pattern: SongAccentPattern): string {
  if (pattern.kind === 'steps') {
    return `steps:${pattern.steps.map((step) => (step ? '1' : '0')).join('')}`;
  }

  const accentGroupStarts = pattern.accentGroupStarts ?? true;
  return `grouped:${pattern.groups.join('+')}:${accentGroupStarts ? '1' : '0'}`;
}

function canonicalizeEvent(event: TimelinePlaybackEvent): string {
  return [
    event.sequenceIndex,
    event.scheduledBpm,
    event.beatDurationNs,
    event.beatsPerBar,
    event.subdivision,
    canonicalizeAccentPattern(event.accentPattern),
    event.barId,
    event.sectionId,
  ].join(':');
}

/** Deterministic fingerprint of a compiled timeline (stable across runs). */
export function computeTimelineHash(compiled: TimelineCompiledPlaybackSequence): string {
  const payload = compiled.events.map(canonicalizeEvent).join('|');
  return fnv1aHex(payload);
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function validateMonotonicSequence(
  events: readonly TimelinePlaybackEvent[],
  issues: TimelineValidationIssue[],
): void {
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const expected = index;

    if (event.sequenceIndex !== expected) {
      pushIssue(issues, {
        code: 'SEQUENCE_NOT_MONOTONIC',
        severity: 'error',
        message: `Expected sequenceIndex ${expected}, found ${event.sequenceIndex}`,
        context: { index, expected, actual: event.sequenceIndex },
      });
    }

    if (index > 0 && event.sequenceIndex !== events[index - 1].sequenceIndex + 1) {
      pushIssue(issues, {
        code: 'SEQUENCE_GAP',
        severity: 'error',
        message: 'sequenceIndex must increase by exactly 1 between consecutive events',
        context: {
          index,
          previous: events[index - 1].sequenceIndex,
          current: event.sequenceIndex,
        },
      });
    }
  }
}

function validateMeterAndBarInstances(
  groups: readonly BarInstanceGroup[],
  issues: TimelineValidationIssue[],
): void {
  groups.forEach((group, barInstanceIndex) => {
    const first = group.events[0];

    if (group.events.length === 0) {
      pushIssue(issues, {
        code: 'EMPTY_BAR_INSTANCE',
        severity: 'error',
        message: 'Bar instance produced zero events',
        context: { barInstanceIndex },
      });
      return;
    }

    if (first.beatsPerBar <= 0) {
      pushIssue(issues, {
        code: 'INVALID_BEATS_PER_BAR',
        severity: 'error',
        message: 'beatsPerBar must be a positive integer',
        context: { barInstanceIndex, beatsPerBar: first.beatsPerBar },
      });
    }

    if (group.events.length !== first.beatsPerBar) {
      pushIssue(issues, {
        code: 'METER_EVENT_COUNT_MISMATCH',
        severity: 'error',
        message: `Bar instance expected ${first.beatsPerBar} events, found ${group.events.length}`,
        context: {
          barInstanceIndex,
          barId: first.barId,
          sectionId: first.sectionId,
          expected: first.beatsPerBar,
          actual: group.events.length,
        },
      });
    }

    group.events.forEach((event, beatIndex) => {
      if (event.beatsPerBar !== first.beatsPerBar) {
        pushIssue(issues, {
          code: 'INCONSISTENT_BEATS_PER_BAR',
          severity: 'error',
          message: 'All events in a bar instance must share the same beatsPerBar',
          context: { barInstanceIndex, beatIndex, barId: event.barId },
        });
      }

      if (event.barId !== first.barId || event.sectionId !== first.sectionId) {
        pushIssue(issues, {
          code: 'BAR_INSTANCE_METADATA_MISMATCH',
          severity: 'error',
          message: 'All events in a bar instance must share barId and sectionId',
          context: {
            barInstanceIndex,
            beatIndex,
            expectedBarId: first.barId,
            actualBarId: event.barId,
          },
        });
      }
    });
  });
}

function collectTempoChanges(
  groups: readonly BarInstanceGroup[],
  issues: TimelineValidationIssue[],
): TimelineTempoChange[] {
  const tempoChanges: TimelineTempoChange[] = [];
  let previousBpm: number | null = null;

  groups.forEach((group, barInstanceIndex) => {
    const first = group.events[0];
    if (first === undefined) {
      return;
    }

    if (!Number.isFinite(first.scheduledBpm) || first.scheduledBpm <= 0) {
      pushIssue(issues, {
        code: 'INVALID_SCHEDULED_BPM',
        severity: 'error',
        message: 'scheduledBpm must be a positive finite number',
        context: {
          barInstanceIndex,
          scheduledBpm: first.scheduledBpm,
          barId: first.barId,
        },
      });
      return;
    }

    group.events.forEach((event, beatIndex) => {
      if (event.scheduledBpm !== first.scheduledBpm) {
        pushIssue(issues, {
          code: 'TEMPO_GAP_IN_BAR',
          severity: 'error',
          message: 'All events in a bar instance must share the same scheduledBpm',
          context: {
            barInstanceIndex,
            beatIndex,
            barId: event.barId,
            expectedBpm: first.scheduledBpm,
            actualBpm: event.scheduledBpm,
          },
        });
      }

      if (event.beatDurationNs !== first.beatDurationNs) {
        pushIssue(issues, {
          code: 'BEAT_DURATION_GAP_IN_BAR',
          severity: 'error',
          message: 'All events in a bar instance must share the same beatDurationNs',
          context: {
            barInstanceIndex,
            beatIndex,
            barId: event.barId,
            expectedBeatDurationNs: first.beatDurationNs,
            actualBeatDurationNs: event.beatDurationNs,
          },
        });
      }

      if (!Number.isFinite(event.beatDurationNs) || event.beatDurationNs <= 0) {
        pushIssue(issues, {
          code: 'INVALID_BEAT_DURATION_NS',
          severity: 'error',
          message: 'beatDurationNs must be a positive finite number',
          context: {
            barInstanceIndex,
            beatIndex,
            beatDurationNs: event.beatDurationNs,
            barId: event.barId,
          },
        });
      }
    });

    if (previousBpm !== null && first.scheduledBpm !== previousBpm) {
      tempoChanges.push({
        barId: first.barId,
        sectionId: first.sectionId,
        barInstanceIndex,
        previousBpm,
        newBpm: first.scheduledBpm,
        sequenceIndex: first.sequenceIndex,
      });
    }

    previousBpm = first.scheduledBpm;
  });

  return tempoChanges;
}

function validateAccentIntegrity(
  events: readonly TimelinePlaybackEvent[],
  issues: TimelineValidationIssue[],
): void {
  events.forEach((event, index) => {
    if (!isValidAccentPattern(event.accentPattern)) {
      pushIssue(issues, {
        code: 'MISSING_ACCENT_PATTERN',
        severity: 'error',
        message: 'Each event must carry a valid accentPattern',
        context: { index, barId: event.barId, sectionId: event.sectionId },
      });
    }

    if (!SUBDIVISION_KINDS.includes(event.subdivision)) {
      pushIssue(issues, {
        code: 'INVALID_SUBDIVISION',
        severity: 'error',
        message: `Unsupported subdivision kind: ${String(event.subdivision)}`,
        context: { index, subdivision: String(event.subdivision) },
      });
    }
  });
}

function validateStructuralSanity(
  compiled: TimelineCompiledPlaybackSequence,
  groups: readonly BarInstanceGroup[],
  issues: TimelineValidationIssue[],
  sourceSong?: Song,
): void {
  if (compiled.totalDurationBeats !== compiled.events.length) {
    pushIssue(issues, {
      code: 'TOTAL_DURATION_MISMATCH',
      severity: 'error',
      message: 'totalDurationBeats must equal events.length',
      context: {
        totalDurationBeats: compiled.totalDurationBeats,
        eventCount: compiled.events.length,
      },
    });
  }

  if (compiled.metadata.totalBars !== groups.length) {
    pushIssue(issues, {
      code: 'METADATA_BAR_COUNT_MISMATCH',
      severity: 'error',
      message: 'metadata.totalBars must match compiled bar instance count',
      context: {
        metadataTotalBars: compiled.metadata.totalBars,
        compiledBarInstances: groups.length,
      },
    });
  }

  if (compiled.metadata.totalSections <= 0 && compiled.events.length > 0) {
    pushIssue(issues, {
      code: 'INVALID_SECTION_METADATA',
      severity: 'warning',
      message: 'Compiled timeline has events but metadata.totalSections is zero',
      context: { totalSections: compiled.metadata.totalSections },
    });
  }

  if (compiled.events.length === 0 && compiled.metadata.totalBars > 0) {
    pushIssue(issues, {
      code: 'EMPTY_COMPILED_TIMELINE',
      severity: 'error',
      message: 'Compiled timeline has no events but metadata reports bars',
      context: { totalBars: compiled.metadata.totalBars },
    });
  }

  if (sourceSong !== undefined) {
    const emptySections = sourceSong.sections.filter((section) => section.bars.length === 0);
    for (const section of emptySections) {
      pushIssue(issues, {
        code: 'ZERO_LENGTH_SECTION',
        severity: 'warning',
        message: `Section "${section.name}" contains no bars`,
        context: { sectionId: section.id, sectionName: section.name },
      });
    }

    const locatedBars = locateBarsInSong(sourceSong);
    if (locatedBars.length !== groups.length) {
      pushIssue(issues, {
        code: 'REPEAT_EXPANSION_MISMATCH',
        severity: 'error',
        message: 'Compiled bar instance count does not match source repeat expansion',
        context: {
          sourceBarInstances: locatedBars.length,
          compiledBarInstances: groups.length,
        },
      });
    }

    for (const located of locatedBars) {
      if (located.bar.meter.numerator <= 0) {
        pushIssue(issues, {
          code: 'INVALID_SOURCE_METER',
          severity: 'error',
          message: 'Source bar meter numerator must be positive',
          context: {
            barId: located.bar.id,
            numerator: located.bar.meter.numerator,
          },
        });
      }
    }
  }
}

export function buildStressTestSong(barInstanceCount: number): Song {
  if (!Number.isInteger(barInstanceCount) || barInstanceCount < 1) {
    throw new RangeError('barInstanceCount must be a positive integer');
  }

  const meters = [
    createMeter(4, 4),
    createMeter(7, 8),
    createMeter(3, 4),
    createMeter(13, 16),
  ] as const;

  const bars = Array.from({ length: barInstanceCount }, (_, index) => {
    const meter = meters[index % meters.length];
    return createBar({
      id: `stress-bar-${index}`,
      meter,
      accentPattern: downbeatAccentPattern(meter.numerator),
      repeatCount: 1,
      ...(index % 97 === 0
        ? {
            tempoDefinition: createTempoDefinitionForMeter(72 + (index % 60), meter),
            tempoTransition: 'instant' as const,
          }
        : {}),
    });
  });

  return createSong({
    id: 'timeline-stress-song',
    name: `Stress Test (${barInstanceCount} bars)`,
    sections: [
      createSection({
        id: 'stress-section',
        name: 'Stress',
        bars,
      }),
    ],
  });
}

function runStressTest(barInstanceCount: number): TimelineStressTestResult {
  const song = buildStressTestSong(barInstanceCount);
  const firstCompiled = compileSong(song);
  const secondCompiled = compileSong(song);
  const firstHash = computeTimelineHash(firstCompiled);
  const secondHash = computeTimelineHash(secondCompiled);

  return {
    barInstanceCount,
    firstHash,
    secondHash,
    deterministic: firstHash === secondHash,
  };
}

function buildSummary(
  events: readonly TimelinePlaybackEvent[],
  groups: readonly BarInstanceGroup[],
  tempoChanges: readonly TimelineTempoChange[],
): TimelineValidationSummary {
  return {
    totalEvents: events.length,
    totalBarInstances: groups.length,
    uniqueSectionIds: new Set(events.map((event) => event.sectionId)).size,
    uniqueBarIds: new Set(events.map((event) => event.barId)).size,
    tempoChangeCount: tempoChanges.length,
  };
}

export function validateTimeline(
  compiled: TimelineCompiledPlaybackSequence,
  options: ValidateTimelineOptions = {},
): TimelineValidationReport {
  const issues: TimelineValidationIssue[] = [];
  const groups = groupBarInstances(compiled.events);

  validateMonotonicSequence(compiled.events, issues);
  validateMeterAndBarInstances(groups, issues);
  const tempoChanges = collectTempoChanges(groups, issues);
  validateAccentIntegrity(compiled.events, issues);
  validateStructuralSanity(compiled, groups, issues, options.sourceSong);

  let stressTest: TimelineStressTestResult | undefined;
  if (options.stressTest) {
    const barCount = options.stressTestBarCount ?? 1000;
    stressTest = runStressTest(barCount);

    if (!stressTest.deterministic) {
      pushIssue(issues, {
        code: 'STRESS_TEST_NON_DETERMINISTIC',
        severity: 'error',
        message: 'Stress test compile produced different hashes on consecutive runs',
        context: {
          barInstanceCount: stressTest.barInstanceCount,
          firstHash: stressTest.firstHash,
          secondHash: stressTest.secondHash,
        },
      });
    } else {
      pushIssue(issues, {
        code: 'STRESS_TEST_PASSED',
        severity: 'info',
        message: `Stress test passed for ${stressTest.barInstanceCount} bar instances`,
        context: {
          barInstanceCount: stressTest.barInstanceCount,
          hash: stressTest.firstHash,
        },
      });
    }
  }

  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const hash = computeTimelineHash(compiled);

  const report: TimelineValidationReport = {
    valid: errorCount === 0,
    issueCount: issues.length,
    errorCount,
    warningCount,
    issues,
    tempoChanges,
    summary: buildSummary(compiled.events, groups, tempoChanges),
    hash,
    ...(stressTest === undefined ? {} : { stressTest }),
  };

  if (options.log) {
    logTimelineSummary(compiled, report);
  }

  return report;
}

export function logTimelineSummary(
  compiled: TimelineCompiledPlaybackSequence,
  report?: TimelineValidationReport,
): void {
  const resolvedReport = report ?? validateTimeline(compiled);
  const tag = '[TimelinePlaybackInspector]';
  const { summary, metadata } = {
    summary: resolvedReport.summary,
    metadata: compiled.metadata,
  };

  console.log(
    `${tag} song="${metadata.songName}" valid=${resolvedReport.valid} ` +
      `events=${summary.totalEvents} bars=${summary.totalBarInstances} hash=${resolvedReport.hash}`,
  );
  console.log(
    `${tag} issues: errors=${resolvedReport.errorCount} warnings=${resolvedReport.warningCount} ` +
      `tempoChanges=${summary.tempoChangeCount} sections=${summary.uniqueSectionIds}`,
  );

  if (resolvedReport.tempoChanges.length > 0) {
    console.log(`${tag} tempo changes:`);
    for (const change of resolvedReport.tempoChanges.slice(0, 20)) {
      console.log(
        `${tag}   bar=${change.barId} instance=${change.barInstanceIndex} ` +
          `seq=${change.sequenceIndex} ${change.previousBpm} -> ${change.newBpm} bpm`,
      );
    }

    if (resolvedReport.tempoChanges.length > 20) {
      console.log(`${tag}   ... +${resolvedReport.tempoChanges.length - 20} more`);
    }
  }

  if (resolvedReport.stressTest) {
    console.log(
      `${tag} stressTest bars=${resolvedReport.stressTest.barInstanceCount} ` +
        `deterministic=${resolvedReport.stressTest.deterministic} ` +
        `hash=${resolvedReport.stressTest.firstHash}`,
    );
  }

  const errors = resolvedReport.issues.filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    console.log(`${tag} errors:`);
    for (const issue of errors.slice(0, 10)) {
      console.log(`${tag}   [${issue.code}] ${issue.message}`);
    }
  }
}
