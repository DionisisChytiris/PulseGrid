import { defaultAccentPatternFromMeter } from '../AccentPattern';
import { createBar } from '../Bar';
import { createMeter } from '../Meter';
import { createSection } from '../Section';
import { createSong } from '../Song';
import { expandBarToEvents } from '../compiler/SongPlaybackCompiler';
import type { SubdivisionKind } from '../../valueObjects/Subdivision';

import { barDurationNs, computeDeadlineOffsets, tickDurationNs } from './ScheduledTickSnapshot';

describe('subdivision preserves musical bar timing', () => {
  const meter = createMeter(4, 4);
  const bpm = 120;

  function expand(subdivision?: SubdivisionKind) {
    const bar = createBar({
      id: 'bar',
      meter,
      accentPattern: defaultAccentPatternFromMeter(meter),
      ...(subdivision === undefined || subdivision === 'quarter'
        ? {}
        : { subdivision }),
    });

    return expandBarToEvents(bar, {
      section: createSection({ id: 'main', name: 'Main', bars: [bar] }),
      sectionId: 'main',
      globalBarIndex: 0,
      repeatIndex: 0,
      bpm,
      tempoChangedOnThisBar: false,
      startingSequence: 0,
      startingGlobalTickIndex: 0,
    });
  }

  it('keeps total bar wall-clock duration identical across subdivisions', () => {
    const quarter = expand('quarter');
    const eighth = expand('eighth');
    const triplet = expand('triplet');
    const sixteenth = expand('sixteenth');

    expect(quarter).toHaveLength(4);
    expect(eighth).toHaveLength(8);
    expect(triplet).toHaveLength(12);
    expect(sixteenth).toHaveLength(16);

    const quarterNs = barDurationNs(quarter);
    expect(barDurationNs(eighth)).toBe(quarterNs);
    expect(barDurationNs(triplet)).toBe(quarterNs);
    expect(barDurationNs(sixteenth)).toBe(quarterNs);

    // One bar at 120 BPM in 4/4 = 4 quarter pulses.
    const pulseNs = tickDurationNs(quarter[0]!);
    expect(quarterNs).toBe(pulseNs * 4);
  });

  it('only shortens click spacing — primary pulses still sum to the same bar', () => {
    const sixteenth = expand('sixteenth');
    const offsets = computeDeadlineOffsets(sixteenth);

    // Four primary pulses → indices 0, 4, 8, 12
    const primaryGaps = [0, 4, 8, 12].map(
      (index) => offsets[index + 4]! - offsets[index]!,
    );
    expect(primaryGaps[0]).toBe(primaryGaps[1]);
    expect(primaryGaps[1]).toBe(primaryGaps[2]);
    expect(primaryGaps[2]).toBe(primaryGaps[3]);
    expect(primaryGaps[0]! * 4).toBe(barDurationNs(sixteenth));
  });
});
