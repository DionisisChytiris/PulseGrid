import type { TimingTick } from '../../domain/timing/TimingTick';

import {
  DEFAULT_TEMPO_TRAINER_SETTINGS,
  TempoTrainerService,
  type TempoTrainerSettings,
} from './TempoTrainerService';

function tick(partial: Partial<TimingTick> & Pick<TimingTick, 'beatNumber' | 'subdivisionIndex'>): TimingTick {
  return {
    sequence: partial.sequence ?? 0,
    beatNumber: partial.beatNumber,
    subdivisionIndex: partial.subdivisionIndex,
    isAccent: partial.isAccent ?? false,
    timestamp: partial.timestamp ?? 0,
  };
}

function enabledSettings(overrides: Partial<TempoTrainerSettings> = {}): TempoTrainerSettings {
  return {
    ...DEFAULT_TEMPO_TRAINER_SETTINGS,
    enabled: true,
    barsInterval: 2,
    bpmDelta: 5,
    maxBpm: 130,
    ...overrides,
  };
}

/** Emit one 3/4 bar of quarter pulses (final tick = beat 3). */
function playBar3_4(service: TempoTrainerService): void {
  service.onTick(tick({ beatNumber: 1, subdivisionIndex: 0 }));
  service.onTick(tick({ beatNumber: 2, subdivisionIndex: 0 }));
  service.onTick(tick({ beatNumber: 3, subdivisionIndex: 0 }));
}

describe('TempoTrainerService', () => {
  let bpm: number;
  let setBpmCalls: number[];
  let beatsPerMeasure: number;
  let ticksPerBeat: number;
  let service: TempoTrainerService;

  beforeEach(() => {
    bpm = 100;
    setBpmCalls = [];
    beatsPerMeasure = 3;
    ticksPerBeat = 1;
    service = new TempoTrainerService({
      getBpm: () => bpm,
      setBpm: (next) => {
        setBpmCalls.push(next);
        bpm = next;
      },
      getBeatsPerMeasure: () => beatsPerMeasure,
      getTicksPerBeat: () => ticksPerBeat,
    });
  });

  it('counts completed bars at end-of-bar (first downbeat does not increment)', () => {
    service.setSettings(enabledSettings({ barsInterval: 4 }));

    service.onTick(tick({ beatNumber: 1, subdivisionIndex: 0 }));
    expect(service.getStatus().completedBars).toBe(0);

    service.onTick(tick({ beatNumber: 2, subdivisionIndex: 0 }));
    expect(service.getStatus().completedBars).toBe(0);

    service.onTick(tick({ beatNumber: 3, subdivisionIndex: 0 }));
    expect(service.getStatus().completedBars).toBe(1);

    service.onTick(tick({ beatNumber: 1, subdivisionIndex: 0 }));
    expect(service.getStatus().completedBars).toBe(1);
  });

  it('counts completed bars correctly across two full bars', () => {
    service.setSettings(enabledSettings({ barsInterval: 4 }));

    playBar3_4(service);
    expect(service.getStatus().completedBars).toBe(1);

    playBar3_4(service);
    expect(service.getStatus().completedBars).toBe(2);
  });

  it('queues BPM at end of bar; applies once after next beat 1', () => {
    service.setSettings(enabledSettings({ barsInterval: 2, bpmDelta: 5, maxBpm: 200 }));

    playBar3_4(service);
    playBar3_4(service);
    expect(setBpmCalls).toEqual([]);
    expect(bpm).toBe(100);

    // Next downbeat plays first; apply happens in onTick after it is received.
    service.onTick(tick({ beatNumber: 1, subdivisionIndex: 0 }));
    expect(setBpmCalls).toEqual([105]);
    expect(bpm).toBe(105);
  });

  it('does not apply on final tick of the completed bar', () => {
    service.setSettings(enabledSettings({ barsInterval: 2, bpmDelta: 5, maxBpm: 200 }));

    playBar3_4(service);
    playBar3_4(service);
    expect(setBpmCalls).toEqual([]);

    service.onTick(tick({ beatNumber: 2, subdivisionIndex: 0 }));
    expect(setBpmCalls).toEqual([]);
  });

  it('ignores non-final subdivision ticks within a beat', () => {
    ticksPerBeat = 2;
    beatsPerMeasure = 3;
    service.setSettings(enabledSettings({ barsInterval: 1 }));

    service.onTick(tick({ beatNumber: 1, subdivisionIndex: 0 }));
    service.onTick(tick({ beatNumber: 1, subdivisionIndex: 1 }));
    service.onTick(tick({ beatNumber: 2, subdivisionIndex: 0 }));
    service.onTick(tick({ beatNumber: 2, subdivisionIndex: 1 }));
    service.onTick(tick({ beatNumber: 3, subdivisionIndex: 0 }));
    expect(service.getStatus().completedBars).toBe(0);
    expect(setBpmCalls).toEqual([]);

    service.onTick(tick({ beatNumber: 3, subdivisionIndex: 1 }));
    expect(service.getStatus().completedBars).toBe(1);
    expect(setBpmCalls).toEqual([]);

    service.onTick(tick({ beatNumber: 1, subdivisionIndex: 0 }));
    expect(setBpmCalls).toEqual([105]);
  });

  it('first downbeat does not increment', () => {
    service.setSettings(enabledSettings());
    service.onTick(tick({ beatNumber: 1, subdivisionIndex: 0 }));
    expect(service.getStatus().completedBars).toBe(0);
    expect(service.getStatus().barsTowardNext).toBe(0);
  });

  it('3/4 every 2 bars +5: old BPM through beat 1, then apply', () => {
    service.setSettings(enabledSettings({ barsInterval: 2, bpmDelta: 5, maxBpm: 200 }));

    playBar3_4(service);
    playBar3_4(service);
    expect(bpm).toBe(100);

    service.onTick(tick({ beatNumber: 1, subdivisionIndex: 0 }));
    expect(setBpmCalls).toEqual([105]);
    expect(bpm).toBe(105);

    // Remaining beats of the new bar do not re-apply
    service.onTick(tick({ beatNumber: 2, subdivisionIndex: 0 }));
    service.onTick(tick({ beatNumber: 3, subdivisionIndex: 0 }));
    expect(setBpmCalls).toEqual([105]);
  });

  it('increases BPM every N completed bars', () => {
    service.setSettings(enabledSettings({ barsInterval: 2, bpmDelta: 5, maxBpm: 200 }));

    playBar3_4(service);
    playBar3_4(service);
    expect(setBpmCalls).toEqual([]);

    playBar3_4(service); // starts with beat 1 → apply 105; completes bar 3
    expect(setBpmCalls).toEqual([105]);

    playBar3_4(service); // completes bar 4 → queues; no apply until next beat 1
    expect(setBpmCalls).toEqual([105]);

    service.onTick(tick({ beatNumber: 1, subdivisionIndex: 0 }));
    expect(setBpmCalls).toEqual([105, 110]);
  });

  it('clamps at maximum BPM', () => {
    bpm = 128;
    service.setSettings(enabledSettings({ barsInterval: 1, bpmDelta: 5, maxBpm: 130 }));

    playBar3_4(service);
    expect(setBpmCalls).toEqual([]);
    service.onTick(tick({ beatNumber: 1, subdivisionIndex: 0 }));
    expect(setBpmCalls).toEqual([130]);
    expect(bpm).toBe(130);

    // Finish bar then next end queues nothing useful at max
    service.onTick(tick({ beatNumber: 2, subdivisionIndex: 0 }));
    service.onTick(tick({ beatNumber: 3, subdivisionIndex: 0 }));
    service.onTick(tick({ beatNumber: 1, subdivisionIndex: 0 }));
    expect(setBpmCalls).toEqual([130]);
    expect(bpm).toBe(130);
  });

  it('resets on stop and clears pending', () => {
    service.setSettings(enabledSettings({ barsInterval: 2 }));
    playBar3_4(service);
    playBar3_4(service);
    expect(service.getStatus().completedBars).toBe(2);

    service.onPlaybackStopped();
    expect(service.getStatus().completedBars).toBe(0);

    service.onTick(tick({ beatNumber: 1, subdivisionIndex: 0 }));
    expect(setBpmCalls).toEqual([]);
  });

  it('resets when Enable becomes ON', () => {
    service.setSettings(enabledSettings({ barsInterval: 4 }));
    playBar3_4(service);
    expect(service.getStatus().completedBars).toBe(1);

    service.setSettings({ ...enabledSettings({ barsInterval: 4 }), enabled: false });
    service.setSettings(enabledSettings({ barsInterval: 4 }));
    expect(service.getStatus().completedBars).toBe(0);

    service.onTick(tick({ beatNumber: 1, subdivisionIndex: 0 }));
    expect(service.getStatus().completedBars).toBe(0);
  });

  it('disabled trainer never changes BPM', () => {
    service.setSettings({ ...enabledSettings({ barsInterval: 1 }), enabled: false });

    playBar3_4(service);
    playBar3_4(service);
    service.onTick(tick({ beatNumber: 1, subdivisionIndex: 0 }));
    expect(service.getStatus().completedBars).toBe(0);
    expect(setBpmCalls).toEqual([]);
  });

  it('resets on playback started', () => {
    service.setSettings(enabledSettings({ barsInterval: 4 }));
    playBar3_4(service);
    expect(service.getStatus().completedBars).toBe(1);

    service.onPlaybackStarted();
    expect(service.getStatus().completedBars).toBe(0);
  });
});

describe('TempoTrainerService time mode', () => {
  let bpm: number;
  let setBpmCalls: number[];
  let nowMs: number;
  let service: TempoTrainerService;

  beforeEach(() => {
    bpm = 120;
    setBpmCalls = [];
    nowMs = 1_000_000;
    service = new TempoTrainerService({
      getBpm: () => bpm,
      setBpm: (next) => {
        setBpmCalls.push(next);
        bpm = next;
      },
      getBeatsPerMeasure: () => 4,
      getTicksPerBeat: () => 1,
      nowMs: () => nowMs,
    });
  });

  function playBar4_4(): void {
    service.onTick(tick({ beatNumber: 1, subdivisionIndex: 0 }));
    service.onTick(tick({ beatNumber: 2, subdivisionIndex: 0 }));
    service.onTick(tick({ beatNumber: 3, subdivisionIndex: 0 }));
    service.onTick(tick({ beatNumber: 4, subdivisionIndex: 0 }));
  }

  it('queues time-based increase after interval and applies on next beat 1', () => {
    service.setSettings(
      enabledSettings({
        increaseMode: 'time',
        timeIntervalSeconds: 60,
        bpmDelta: 5,
        maxBpm: 200,
      }),
    );

    // Arms clock on first downbeat at t=1_000_000; next due at +60s.
    service.onTick(tick({ beatNumber: 1, subdivisionIndex: 0 }));
    expect(setBpmCalls).toEqual([]);

    nowMs += 59_000;
    service.onTick(tick({ beatNumber: 2, subdivisionIndex: 0 }));
    expect(setBpmCalls).toEqual([]);

    nowMs += 1_000; // hit 60s
    service.onTick(tick({ beatNumber: 3, subdivisionIndex: 0 }));
    expect(setBpmCalls).toEqual([]); // pending only — apply on next beat 1

    service.onTick(tick({ beatNumber: 4, subdivisionIndex: 0 }));
    expect(setBpmCalls).toEqual([]);

    service.onTick(tick({ beatNumber: 1, subdivisionIndex: 0 }));
    expect(setBpmCalls).toEqual([125]);
    expect(bpm).toBe(125);
  });

  it('supports multiple continuous time-based increases', () => {
    service.setSettings(
      enabledSettings({
        increaseMode: 'time',
        timeIntervalSeconds: 10,
        bpmDelta: 5,
        maxBpm: 200,
      }),
    );

    service.onTick(tick({ beatNumber: 1, subdivisionIndex: 0 }));

    nowMs += 10_000;
    service.onTick(tick({ beatNumber: 2, subdivisionIndex: 0 }));
    service.onTick(tick({ beatNumber: 1, subdivisionIndex: 0 }));
    expect(setBpmCalls).toEqual([125]);

    nowMs += 10_000;
    service.onTick(tick({ beatNumber: 2, subdivisionIndex: 0 }));
    service.onTick(tick({ beatNumber: 1, subdivisionIndex: 0 }));
    expect(setBpmCalls).toEqual([125, 130]);
  });

  it('does not use bar completions to increase in time mode', () => {
    service.setSettings(
      enabledSettings({
        increaseMode: 'time',
        timeIntervalSeconds: 60,
        barsInterval: 1,
        bpmDelta: 5,
        maxBpm: 200,
      }),
    );

    playBar4_4();
    playBar4_4();
    expect(setBpmCalls).toEqual([]);
  });
});
