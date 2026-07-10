import { expandBarToEvents } from './SongPlaybackCompiler';
import { defaultAccentPatternFromMeter } from '../AccentPattern';
import { createBar } from '../Bar';
import { createMeter } from '../Meter';
import { createSection } from '../Section';

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
