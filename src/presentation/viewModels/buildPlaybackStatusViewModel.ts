import type { Song } from '../../domain/music/Song';
import { formatMeter } from '../../domain/music/Meter';
import { locateBarsInSong } from '../../domain/music/SongUtils';

import { buildTimelineSegmentViewModels, type TimelinePlaybackContext } from './buildTimelineSegmentViewModels';
import type { PlaybackStatusViewModel } from './TimelineSegmentViewModel';

export type PlaybackTickContext = {
  readonly beatIndexInBar: number | null;
  readonly beatsPerMeasure: number | null;
  readonly bpm: number | null;
  readonly meterLabel: string | null;
  readonly sectionId: string | null;
};

export function buildPlaybackStatusViewModel(
  song: Song,
  playback: TimelinePlaybackContext & {
    readonly totalBars: number;
    readonly tick: PlaybackTickContext;
  },
): PlaybackStatusViewModel {
  const segments = buildTimelineSegmentViewModels(song, playback);
  const activeSegment = segments.find((segment) => segment.isActive);
  const locatedBar =
    locateBarsInSong(song).find((entry) => entry.globalBarIndex === playback.currentBarIndex) ??
    null;

  const sectionName =
    song.sections.find((section) => section.id === playback.tick.sectionId)?.name ??
    activeSegment?.sectionName ??
    song.sections[0]?.name ??
    '—';

  const meter =
    playback.tick.meterLabel ??
    (locatedBar === null ? '—' : formatMeter(locatedBar.bar.meter));

  const beatsInBar =
    playback.tick.beatsPerMeasure ??
    (locatedBar === null ? 4 : locatedBar.bar.meter.numerator);

  const currentBeat =
    playback.tick.beatIndexInBar !== null ? playback.tick.beatIndexInBar + 1 : 1;

  return {
    sectionName,
    currentBar: playback.currentBarIndex + 1,
    totalBars: Math.max(playback.totalBars, 1),
    currentBeat,
    beatsInBar,
    tempo: playback.tick.bpm,
    meter,
    isActive: playback.isTimelineActive,
  };
}
