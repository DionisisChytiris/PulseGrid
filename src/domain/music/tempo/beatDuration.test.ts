import { BeatUnit } from '../BeatUnit';
import {
  createMeter,
  inferPulseBeatUnitFromMeter,
  inferTempoBeatUnitFromMeter,
} from '../Meter';
import { createTempoDefinition, createTempoDefinitionForMeter } from '../TempoDefinition';
import {
  computeBeatDurationNs,
  computePulseDurationNs,
  computeTimelineDeadlineOffsetsNs,
} from './beatDuration';
import { compileSong } from '../timelineCompiler/SongTimelineCompiler';
import { countEnabledClicks, createDefaultClickPattern, resolveClickPattern } from '../ClickPattern';
import { createBar } from '../Bar';
import { createSectionWithBars } from '../Section';
import { createSong } from '../Song';
import { downbeatAccentPattern, defaultAccentPatternFromMeter } from '../AccentPattern';

const BPM = 120;

function pulseSpacingNs(meter: ReturnType<typeof createMeter>): number {
  const tempo = createTempoDefinitionForMeter(BPM, meter);
  return computePulseDurationNs(tempo, inferPulseBeatUnitFromMeter(meter));
}

describe('computeBeatDurationNs', () => {
  it('returns quarter-note duration at 120 BPM', () => {
    const tempo = createTempoDefinition(120, BeatUnit.QUARTER);
    expect(computeBeatDurationNs(tempo)).toBe(500_000_000);
  });

  it('returns eighth-note duration at 120 BPM', () => {
    const tempo = createTempoDefinition(120, BeatUnit.EIGHTH);
    expect(computeBeatDurationNs(tempo)).toBe(250_000_000);
  });

  it('returns half-note duration at 120 BPM', () => {
    const tempo = createTempoDefinition(120, BeatUnit.HALF);
    expect(computeBeatDurationNs(tempo)).toBe(1_000_000_000);
  });

  it('throws for non-positive BPM', () => {
    expect(() => computeBeatDurationNs(createTempoDefinition(0, BeatUnit.QUARTER))).toThrow(
      RangeError,
    );
  });
});

describe('denominator-driven click spacing', () => {
  it('infers beat unit directly from denominator', () => {
    expect(inferTempoBeatUnitFromMeter(createMeter(4, 2))).toBe(BeatUnit.HALF);
    expect(inferTempoBeatUnitFromMeter(createMeter(4, 4))).toBe(BeatUnit.QUARTER);
    expect(inferTempoBeatUnitFromMeter(createMeter(4, 8))).toBe(BeatUnit.EIGHTH);
    expect(inferTempoBeatUnitFromMeter(createMeter(6, 16))).toBe(BeatUnit.SIXTEENTH);
  });

  it('gives 4/4 and 4/8 different wall-clock spacing at the same BPM', () => {
    const fourFour = pulseSpacingNs(createMeter(4, 4));
    const fourEight = pulseSpacingNs(createMeter(4, 8));

    expect(fourEight).toBeLessThan(fourFour);
    expect(fourFour).toBe(500_000_000);
    expect(fourEight).toBe(250_000_000);
  });

  it('gives 4/4 and 4/2 different wall-clock spacing at the same BPM', () => {
    const fourFour = pulseSpacingNs(createMeter(4, 4));
    const fourTwo = pulseSpacingNs(createMeter(4, 2));

    expect(fourTwo).toBeGreaterThan(fourFour);
    expect(fourTwo).toBe(fourFour * 2);
    expect(fourFour).toBe(500_000_000);
    expect(fourTwo).toBe(1_000_000_000);
  });

  it('gives 6/8 and 6/4 different wall-clock spacing at the same numerator', () => {
    const sixEight = createMeter(6, 8);
    const sixFour = createMeter(6, 4);

    expect(inferPulseBeatUnitFromMeter(sixEight)).toBe(BeatUnit.EIGHTH);
    expect(inferPulseBeatUnitFromMeter(sixFour)).toBe(BeatUnit.QUARTER);
    expect(pulseSpacingNs(sixEight)).toBe(250_000_000);
    expect(pulseSpacingNs(sixFour)).toBe(500_000_000);
  });

  it('places one click per numerator step in default patterns', () => {
    const meters = [createMeter(4, 4), createMeter(4, 8), createMeter(4, 2), createMeter(6, 8), createMeter(6, 4)];

    for (const meter of meters) {
      const pattern = createDefaultClickPattern(meter);
      expect(pattern.steps).toHaveLength(meter.numerator);
      expect(countEnabledClicks(pattern)).toBe(meter.numerator);
    }
  });
});

describe('computeTimelineDeadlineOffsetsNs', () => {
  it('accumulates precomputed pulse durations', () => {
    expect(computeTimelineDeadlineOffsetsNs([100, 200, 50])).toEqual([0, 100, 300, 350]);
  });
});

describe('SongTimelineCompiler', () => {
  it('emits one timeline event per numerator step', () => {
    const song = createSong({
      id: 'event-count',
      name: 'Event Count',
      sections: [
        createSectionWithBars('main', 'Main', [
          createBar({
            id: 'bar-4-4',
            meter: createMeter(4, 4),
            accentPattern: downbeatAccentPattern(4),
          }),
          createBar({
            id: 'bar-6-8',
            meter: createMeter(6, 8),
            accentPattern: downbeatAccentPattern(6),
          }),
        ]),
      ],
    });

    const compiled = compileSong(song, { defaultBpm: BPM });
    expect(compiled.events).toHaveLength(10);
    expect(compiled.events.slice(0, 4).every((event) => event.beatsPerBar === 4)).toBe(true);
    expect(compiled.events.slice(4).every((event) => event.beatsPerBar === 6)).toBe(true);
  });

  it('uses denominator-driven eighth spacing for 6/8', () => {
    const song = createSong({
      id: 'six-eight',
      name: 'Six Eight',
      sections: [
        createSectionWithBars('main', 'Main', [
          createBar({
            id: 'bar-6-8',
            meter: createMeter(6, 8),
            accentPattern: downbeatAccentPattern(6),
          }),
        ]),
      ],
    });

    const compiled = compileSong(song, { defaultBpm: BPM });
    const expected = 250_000_000;

    compiled.events.forEach((event) => {
      expect(event.beatDurationNs).toBe(expected);
    });
  });

  it('uses wider half-note spacing for 4/2 than quarter spacing for 4/4', () => {
    const fourFourSong = createSong({
      id: 'four-four',
      name: 'Four Four',
      sections: [
        createSectionWithBars('main', 'Main', [
          createBar({
            id: 'bar',
            meter: createMeter(4, 4),
            accentPattern: downbeatAccentPattern(4),
          }),
        ]),
      ],
    });

    const fourTwoSong = createSong({
      id: 'four-two',
      name: 'Four Two',
      sections: [
        createSectionWithBars('main', 'Main', [
          createBar({
            id: 'bar',
            meter: createMeter(4, 2),
            accentPattern: downbeatAccentPattern(4),
          }),
        ]),
      ],
    });

    const fourFourNs = compileSong(fourFourSong, { defaultBpm: BPM }).events[0]?.beatDurationNs;
    const fourTwoNs = compileSong(fourTwoSong, { defaultBpm: BPM }).events[0]?.beatDurationNs;

    expect(fourFourNs).toBeDefined();
    expect(fourTwoNs).toBeDefined();
    expect(fourTwoNs!).toBeGreaterThan(fourFourNs!);
  });

  it('produces eleven pulse cells for 11/16', () => {
    const meter = createMeter(11, 16, [4, 4, 3]);
    const compiled = compileSong(
      createSong({
        id: 'eleven-sixteenth',
        name: 'Eleven Sixteenth',
        sections: [
          createSectionWithBars('main', 'Main', [
            createBar({
              id: 'bar-11-16',
              meter,
              accentPattern: defaultAccentPatternFromMeter(meter),
            }),
          ]),
        ],
      }),
      { defaultBpm: BPM },
    );

    expect(compiled.events).toHaveLength(11);
  });

  it('produces seven pulse cells for 7/8', () => {
    const meter = createMeter(7, 8, [2, 2, 3]);
    const compiled = compileSong(
      createSong({
        id: 'seven-eight',
        name: 'Seven Eight',
        sections: [
          createSectionWithBars('main', 'Main', [
            createBar({
              id: 'bar-7-8',
              meter,
              accentPattern: defaultAccentPatternFromMeter(meter),
            }),
          ]),
        ],
      }),
      { defaultBpm: BPM },
    );

    expect(compiled.events).toHaveLength(7);
  });
});
