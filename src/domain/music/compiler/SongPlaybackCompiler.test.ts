import { compileSong, expandBarToEvents, resolveTempoAtPosition } from './SongPlaybackCompiler';
import { defaultAccentPatternFromMeter } from '../AccentPattern';
import { createBar } from '../Bar';
import { createMeter } from '../Meter';
import { createSection } from '../Section';
import { createSong } from '../Song';
import { createTempoDefinitionForMeter } from '../TempoDefinition';

describe('SongPlaybackCompiler pulse cells', () => {
  it('emits seven pulse cells for 7/8', () => {
    const meter = createMeter(7, 8, [2, 2, 3]);
    const bar = createBar({
      id: 'bar-7-8',
      meter,
      accentPattern: defaultAccentPatternFromMeter(meter),
    });

    const events = expandBarToEvents(bar, {
      section: createSection({ id: 'main', name: 'Main', bars: [bar] }),
      sectionId: 'main',
      globalBarIndex: 0,
      repeatIndex: 0,
      bpm: 120,
      tempoChangedOnThisBar: false,
      startingSequence: 0,
      startingGlobalTickIndex: 0,
    });

    expect(events).toHaveLength(7);
    expect(events.map((event) => event.accent)).toEqual([
      true,
      false,
      true,
      false,
      true,
      false,
      false,
    ]);
  });

  it('emits eleven pulse cells for 11/16', () => {
    const meter = createMeter(11, 16, [4, 4, 3]);
    const bar = createBar({
      id: 'bar-11-16',
      meter,
      accentPattern: defaultAccentPatternFromMeter(meter),
    });

    const events = expandBarToEvents(bar, {
      section: createSection({ id: 'main', name: 'Main', bars: [bar] }),
      sectionId: 'main',
      globalBarIndex: 0,
      repeatIndex: 0,
      bpm: 120,
      tempoChangedOnThisBar: false,
      startingSequence: 0,
      startingGlobalTickIndex: 0,
    });

    expect(events).toHaveLength(11);
  });
});

describe('SongPlaybackCompiler song tempo inheritance', () => {
  it('returns to song defaultBpm after a segment override ends', () => {
    const meter = createMeter(4, 4);
    const barA = createBar({
      id: 'a',
      meter,
      accentPattern: defaultAccentPatternFromMeter(meter),
    });
    const barB = createBar({
      id: 'b',
      meter,
      accentPattern: defaultAccentPatternFromMeter(meter),
      tempoDefinition: createTempoDefinitionForMeter(95, meter),
    });
    const barC = createBar({
      id: 'c',
      meter,
      accentPattern: defaultAccentPatternFromMeter(meter),
    });

    const song = createSong({
      id: 'tempo-inherit',
      name: 'Tempo inherit',
      defaultBpm: 120,
      sections: [createSection({ id: 'main', name: 'Main', bars: [barA, barB, barC] })],
    });

    const compiled = compileSong(song, { defaultBpm: song.defaultBpm });

    expect(compiled.events[0]?.bpm).toBe(120);
    expect(compiled.events[4]?.bpm).toBe(95);
    expect(compiled.events[8]?.bpm).toBe(120);
    expect(resolveTempoAtPosition(song, 0, 120)).toBe(120);
    expect(resolveTempoAtPosition(song, 1, 120)).toBe(95);
    expect(resolveTempoAtPosition(song, 2, 120)).toBe(120);
  });
});
