import {
  MAX_BPM,
  MAX_ROTATION,
  MID_BPM,
  MID_ROTATION,
  MIN_BPM,
  MIN_ROTATION,
  bpmToRotation,
  clampRotation,
  rotationToBpm,
  shortestAngleDelta,
} from './bpmRotaryMapping';

describe('bpmRotaryMapping', () => {
  it('maps rotation endpoints to BPM anchors', () => {
    expect(rotationToBpm(MIN_ROTATION)).toBeCloseTo(MIN_BPM);
    expect(rotationToBpm(MID_ROTATION)).toBeCloseTo(MID_BPM);
    expect(rotationToBpm(MAX_ROTATION)).toBeCloseTo(MAX_BPM);
  });

  it('maps BPM anchors to rotation endpoints', () => {
    expect(bpmToRotation(MIN_BPM)).toBeCloseTo(MIN_ROTATION);
    expect(bpmToRotation(MID_BPM)).toBeCloseTo(MID_ROTATION);
    expect(bpmToRotation(MAX_BPM)).toBeCloseTo(MAX_ROTATION);
  });

  it('is continuous at the 240 BPM / 2π transition', () => {
    const epsilon = 1e-6;
    expect(rotationToBpm(MID_ROTATION - epsilon)).toBeCloseTo(MID_BPM, 3);
    expect(rotationToBpm(MID_ROTATION + epsilon)).toBeCloseTo(MID_BPM, 3);
  });

  it('round-trips BPM through rotation within rounding', () => {
    const samples = [30, 120, 240, 400, 600];
    for (const bpm of samples) {
      const rotation = bpmToRotation(bpm);
      expect(Math.round(rotationToBpm(rotation))).toBe(bpm);
    }
  });

  it('clamps rotation to [0, 4π]', () => {
    expect(clampRotation(-1)).toBe(MIN_ROTATION);
    expect(clampRotation(MAX_ROTATION + 10)).toBe(MAX_ROTATION);
    expect(clampRotation(Math.PI)).toBe(Math.PI);
  });

  it('wraps 359° → 2° as a small positive delta', () => {
    const from = (359 * Math.PI) / 180;
    const to = (2 * Math.PI) / 180;
    expect(shortestAngleDelta(from, to)).toBeCloseTo((3 * Math.PI) / 180, 5);
  });

  it('wraps 2° → 359° as a small negative delta', () => {
    const from = (2 * Math.PI) / 180;
    const to = (359 * Math.PI) / 180;
    expect(shortestAngleDelta(from, to)).toBeCloseTo((-3 * Math.PI) / 180, 5);
  });
});
