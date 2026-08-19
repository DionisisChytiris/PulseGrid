import {
  initialSectionCreateMode,
  segmentHasEstablishedSection,
} from './sectionCreateMode';

function segment(partial: {
  isSectionStart?: boolean;
  showSectionVisuals?: boolean;
  sectionName?: string;
}) {
  return {
    isSectionStart: partial.isSectionStart ?? true,
    showSectionVisuals: partial.showSectionVisuals ?? true,
    sectionName: partial.sectionName ?? '',
  };
}

describe('initialSectionCreateMode', () => {
  it('selects None when the bar does not start an explicit section', () => {
    expect(initialSectionCreateMode(segment({ showSectionVisuals: false, sectionName: 'Main' }))).toBe(
      'none',
    );
    expect(initialSectionCreateMode(segment({ isSectionStart: false, sectionName: 'Intro' }))).toBe(
      'none',
    );
    expect(segmentHasEstablishedSection(segment({ showSectionVisuals: false }))).toBe(false);
  });

  it('selects Preset when the bar starts a preset section', () => {
    expect(initialSectionCreateMode(segment({ sectionName: 'Intro' }))).toBe('preset');
    expect(initialSectionCreateMode(segment({ sectionName: 'Verse' }))).toBe('preset');
  });

  it('selects Custom when the bar starts a custom section', () => {
    expect(initialSectionCreateMode(segment({ sectionName: 'Delécluse 10' }))).toBe('custom');
  });
});
