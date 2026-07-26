import {
  compileSongTimeline,
  computeTimelineDeadlineOffsetsNs,
  getTotalBars,
  resolveAccentFlags,
  type Song,
  type SongAccentPattern,
} from '../../domain/music';
import { buildTimelineSegments } from '../../components/songTimeline/buildTimelineSegments';
import { overviewTempoMarkings } from '../components/songSignatureTimeline/overviewTempoMarkings';

export type SongStatistics = {
  readonly totalBars: number;
  readonly totalSegments: number;
  readonly globalBpm: number;
  readonly tempoChangeCount: number;
  readonly estimatedDurationLabel: string;
  readonly totalBeats: number;
  readonly uniqueMeterCount: number;
  readonly uniqueMeters: readonly string[];
  readonly accentPatternCount: number;
  readonly mostCommonAccentLabel: string | null;
  readonly songName: string;
  readonly lastModifiedLabel: string | null;
};

const NS_PER_MS = 1_000_000;

/** Compact, single-line name for an accent flag pattern. */
export function formatAccentPatternName(flags: readonly boolean[]): string {
  if (flags.length === 0) {
    return 'Custom';
  }

  const accentCount = flags.filter(Boolean).length;
  const downbeatOnly = flags[0] === true && flags.slice(1).every((flag) => !flag);
  const allAccented = accentCount === flags.length;
  const noneAccented = accentCount === 0;
  const offbeatsOnly =
    flags[0] === false && flags.length > 1 && flags.slice(1).every(Boolean);

  if (downbeatOnly) {
    return 'Downbeat';
  }
  if (allAccented) {
    return 'All Beats';
  }
  if (noneAccented) {
    return 'None';
  }
  if (offbeatsOnly) {
    return 'Offbeats';
  }

  // Keep unknown patterns compact (no spaces) so stats cards stay single-line.
  return flags.map((accent) => (accent ? '▲' : '○')).join('');
}

function accentPatternKey(pattern: SongAccentPattern, beatCount: number): string {
  return resolveAccentFlags(pattern, beatCount)
    .map((accent) => (accent ? '1' : '0'))
    .join('');
}

/** Formats nanoseconds as m:ss or h:mm:ss for DAW-style duration display. */
export function formatEstimatedDurationNs(durationNs: number): string {
  if (!Number.isFinite(durationNs) || durationNs <= 0) {
    return '0:00';
  }

  const totalSeconds = Math.round(durationNs / NS_PER_MS / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
  }

  return `${minutes}:${paddedSeconds}`;
}

function formatLastModified(updatedAt: number): string | null {
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
    return null;
  }

  try {
    return new Date(updatedAt).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

/**
 * Derives read-only song overview stats for the Song Statistics sheet.
 * Reuses timeline segments + timeline compile — no separate playback path.
 */
export function buildSongStatistics(song: Song): SongStatistics {
  const segments = buildTimelineSegments(song);
  const totalBars = getTotalBars(song);
  const totalSegments = segments.length;

  const tempoMarkings = overviewTempoMarkings(segments, song.defaultBpm);
  const markingCount = tempoMarkings.filter((bpm) => bpm !== null).length;
  const tempoChangeCount = Math.max(0, markingCount - 1);

  const uniqueMeters: string[] = [];
  const seenMeters = new Set<string>();
  for (const segment of segments) {
    if (!seenMeters.has(segment.meterLabel)) {
      seenMeters.add(segment.meterLabel);
      uniqueMeters.push(segment.meterLabel);
    }
  }

  const accentWeights = new Map<string, { bars: number; label: string }>();
  for (const segment of segments) {
    const beatCount = Math.max(1, segment.meter.numerator);
    const key = accentPatternKey(segment.accentPattern, beatCount);
    const label = formatAccentPatternName(
      resolveAccentFlags(segment.accentPattern, beatCount),
    );
    const existing = accentWeights.get(key);
    if (existing === undefined) {
      accentWeights.set(key, { bars: segment.numberOfBars, label });
    } else {
      existing.bars += segment.numberOfBars;
    }
  }

  let mostCommonAccentLabel: string | null = null;
  let mostCommonBars = 0;
  for (const entry of accentWeights.values()) {
    if (entry.bars > mostCommonBars) {
      mostCommonBars = entry.bars;
      mostCommonAccentLabel = entry.label;
    }
  }

  let totalBeats = 0;
  let estimatedDurationLabel = '0:00';

  try {
    const compiled = compileSongTimeline(song, { defaultBpm: song.defaultBpm });
    totalBeats = compiled.totalDurationBeats;
    const offsets = computeTimelineDeadlineOffsetsNs(
      compiled.events.map((event) => event.beatDurationNs),
    );
    estimatedDurationLabel = formatEstimatedDurationNs(offsets[offsets.length - 1] ?? 0);
  } catch {
    // Empty or invalid songs still show structure/tempo cards.
  }

  return {
    totalBars,
    totalSegments,
    globalBpm: song.defaultBpm,
    tempoChangeCount,
    estimatedDurationLabel,
    totalBeats,
    uniqueMeterCount: uniqueMeters.length,
    uniqueMeters,
    accentPatternCount: accentWeights.size,
    mostCommonAccentLabel,
    songName: song.name.trim().length > 0 ? song.name.trim() : 'Untitled',
    lastModifiedLabel: formatLastModified(song.updatedAt),
  };
}
