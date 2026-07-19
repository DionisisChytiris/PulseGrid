import { defaultAccentPatternFromMeter } from '../AccentPattern';
import { createBar } from '../Bar';
import { createMeter } from '../Meter';
import { createSectionWithBars } from '../Section';
import { createSong } from '../Song';
import { compileSong } from '../compiler/SongPlaybackCompiler';
import {
  pulseDurationMsFromDisplayBpm,
  toEngineBpm,
} from '../../metronome/PulseGridSettings';
import { serializeTimelineEventForNative } from '../../../infrastructure/audio/serializeTimelineForNative';
import { computeDeadlineOffsets } from './ScheduledTickSnapshot';

describe('Song timeline pulse rate matches Quick Metronome', () => {
  const displayBpm = 120;

  it.each([
    { meter: createMeter(4, 2), engineBpm: 60 },
    { meter: createMeter(4, 4), engineBpm: 120 },
    { meter: createMeter(7, 8, [2, 2, 3]), engineBpm: 240 },
    { meter: createMeter(7, 16, [3, 2, 2]), engineBpm: 480 },
  ])(
    'uses engine BPM $engineBpm for $meter.numerator/$meter.denominator @ 120',
    ({ meter, engineBpm }) => {
      const bar = createBar({
        id: 'bar',
        meter,
        accentPattern: defaultAccentPatternFromMeter(meter),
      });
      const song = createSong({
        id: 'pulse-match',
        name: 'Pulse Match',
        sections: [createSectionWithBars('main', 'Main', [bar])],
      });

      const compiled = compileSong(song, { defaultBpm: displayBpm });
      const event = compiled.events[0];

      expect(event).toBeDefined();
      expect(event!.bpm).toBe(displayBpm);
      expect(toEngineBpm(event!.bpm, event!.meter.denominator)).toBe(engineBpm);

      const native = serializeTimelineEventForNative(event!);
      expect(native.bpm).toBe(engineBpm);

      const offsets = computeDeadlineOffsets(compiled.events);
      const expectedPulseNs = Math.floor(60_000_000_000 / engineBpm);
      expect(offsets[1]! - offsets[0]!).toBe(expectedPulseNs);

      expect(pulseDurationMsFromDisplayBpm(displayBpm, meter.denominator)).toBe(
        60_000 / engineBpm,
      );
    },
  );
});
