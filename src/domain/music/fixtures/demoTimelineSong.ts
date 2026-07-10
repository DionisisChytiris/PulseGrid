import { createAccentPatternGrouped, createAccentPatternSteps } from '../AccentPattern';
import { createBar } from '../Bar';
import { createMeter } from '../Meter';
import { createSectionWithBars } from '../Section';
import { createSong, type Song } from '../Song';
import { createTempoDefinitionForMeter } from '../TempoDefinition';

/** Demo score for Song Timeline UI — mixed meters and a tempo change. */
export function createDemoTimelineSong(): Song {
  return createSong({
    id: 'demo-timeline-song',
    name: 'Timeline Demo',
    sections: [
      createSectionWithBars('intro', 'Intro', [
        {
          id: 'intro-bar-1',
          meter: createMeter(4, 4),
          accentPattern: createAccentPatternSteps([true, false, false, false]),
        },
        {
          id: 'intro-bar-2',
          meter: createMeter(7, 8),
          accentPattern: createAccentPatternGrouped([3, 2, 2]),
        },
      ]),
      createSectionWithBars('verse', 'Verse', [
        {
          id: 'verse-bar-1',
          meter: createMeter(4, 4),
          accentPattern: createAccentPatternSteps([true, false, true, false]),
          tempoDefinition: createTempoDefinitionForMeter(96, createMeter(4, 4)),
          tempoTransition: 'instant',
        },
        {
          id: 'verse-bar-2',
          meter: createMeter(3, 4),
          accentPattern: createAccentPatternSteps([true, false, false]),
          repeatCount: 2,
        },
      ]),
    ],
  });
}
