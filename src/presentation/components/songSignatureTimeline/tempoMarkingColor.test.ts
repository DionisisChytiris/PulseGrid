import {
  FIRST_REV_COMPLETE_COLOR,
  getFirstRevColor,
  getSecondRevColor,
  getTempoRingColor,
} from '../metronome/tempoRingColors';

import {
  getSongLineRegionColors,
  getTempoMarkingColor,
} from './tempoMarkingColor';

describe('getTempoMarkingColor', () => {
  it('maps each BPM band along the Quick Metronome blue→purple palette', () => {
    expect(getTempoMarkingColor(30)).toBe(getFirstRevColor(0));
    expect(getTempoMarkingColor(60)).toBe(getFirstRevColor(0));
    expect(getTempoMarkingColor(61)).toBe(getTempoRingColor(75));
    expect(getTempoMarkingColor(90)).toBe(getTempoRingColor(75));
    expect(getTempoMarkingColor(91)).toBe(getTempoRingColor(120));
    expect(getTempoMarkingColor(120)).toBe(getTempoRingColor(120));
    expect(getTempoMarkingColor(121)).toBe(FIRST_REV_COMPLETE_COLOR);
    expect(getTempoMarkingColor(145)).toBe(FIRST_REV_COMPLETE_COLOR);
    expect(getTempoMarkingColor(146)).toBe(getSecondRevColor(0.25));
    expect(getTempoMarkingColor(170)).toBe(getSecondRevColor(0.25));
    expect(getTempoMarkingColor(171)).toBe(getSecondRevColor(0.5));
    expect(getTempoMarkingColor(190)).toBe(getSecondRevColor(0.5));
    expect(getTempoMarkingColor(191)).toBe(getSecondRevColor(1));
    expect(getTempoMarkingColor(240)).toBe(getSecondRevColor(1));
  });
});

describe('getSongLineRegionColors', () => {
  it('uses one bright BPM colour for meter, tempo, and accents', () => {
    const colors = getSongLineRegionColors(120);
    const tempo = getTempoMarkingColor(120);

    expect(colors.tempoColour).toBe(tempo);
    expect(colors.accentDotColour).toBe(tempo);
    expect(colors.timeSignatureColour).toBe(tempo);
  });
});
