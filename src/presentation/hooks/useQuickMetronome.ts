import { useCallback, useEffect, useState } from 'react';

import { playbackService } from '../../application/services/playbackServiceInstance';
import { subdivisionAccentSettingsService } from '../../application/services/subdivisionAccentSettingsServiceInstance';
import {
  DEFAULT_TEMPO_TRAINER_SETTINGS,
  type TempoTrainerSettings,
} from '../../application/services/TempoTrainerService';
import { tempoTrainerService } from '../../application/services/tempoTrainerServiceInstance';
import {
  selectAccentPattern,
  selectBpm,
  selectFinerSubdivision,
  selectIsPlaying,
  selectSubdivision,
  selectSubdivisionAvailability,
  selectTimeSignature,
} from '../../features/metronome/metronomeSelectors';
import type { TimeSignature } from '../../domain/entities/Metronome';
import {
  ABSOLUTE_MAX_BPM,
  MIN_BPM,
  formatBpmClampToastMessage,
  maxBpmForSubdivision,
} from '../../domain/metronome/bpmLimits';
import type { FinerSubdivisionSelection } from '../../domain/metronome/PulseGridSettings';
import { resolveEngineSubdivision, toEngineBpm } from '../../domain/metronome/PulseGridSettings';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { finerSubdivisionChanged } from '../../features/metronome/metronomeSlice';

export { MIN_BPM } from '../../domain/metronome/bpmLimits';
/** @deprecated Prefer maxBpmForSubdivision / ABSOLUTE_MAX_BPM — absolute ceiling is quarter-note max. */
export const MAX_BPM = ABSOLUTE_MAX_BPM;

const TAP_TEMPO_INTRO =
  'Tap TAP at least 3 times in a steady beat to set the tempo. BPM updates from the 3rd tap. Pause longer than 2 seconds to start over. Hold TAP for help.';

function clampTrainerSettings(
  settings: TempoTrainerSettings,
  subdivisionMaxBpm: number,
): TempoTrainerSettings {
  return {
    enabled: settings.enabled,
    increaseMode: settings.increaseMode === 'time' ? 'time' : 'bars',
    barsInterval: Math.min(64, Math.max(1, Math.floor(settings.barsInterval))),
    timeIntervalSeconds: Math.min(3600, Math.max(1, Math.floor(settings.timeIntervalSeconds))),
    bpmDelta: Math.min(50, Math.max(1, Math.floor(settings.bpmDelta))),
    maxBpm: Math.min(subdivisionMaxBpm, Math.max(40, Math.floor(settings.maxBpm))),
  };
}

/**
 * Quick Metronome screen state/actions.
 * Intentionally does NOT subscribe to setTick fields (currentBeat /
 * currentSubdivisionIndex / isAccent) — beat LEDs use useBeatFlashPulse instead
 * so subdivision ticks do not re-render the whole screen.
 */
export function useQuickMetronome() {
  const dispatch = useAppDispatch();
  const bpm = useAppSelector(selectBpm);
  const isPlaying = useAppSelector(selectIsPlaying);
  const timeSignature = useAppSelector(selectTimeSignature);
  const accentPattern = useAppSelector(selectAccentPattern);
  const finerSubdivision = useAppSelector(selectFinerSubdivision);
  const subdivision = useAppSelector(selectSubdivision);
  const subdivisionAvailability = useAppSelector(selectSubdivisionAvailability);
  const [tapTempoHintVisible, setTapTempoHintVisible] = useState(false);
  const [trainerPopupVisible, setTrainerPopupVisible] = useState(false);
  const [trainerSettings, setTrainerSettings] = useState<TempoTrainerSettings>(
    DEFAULT_TEMPO_TRAINER_SETTINGS,
  );
  const [tempoClampMessage, setTempoClampMessage] = useState<string | null>(null);

  const subdivisionMaxBpm = maxBpmForSubdivision(subdivision);

  useEffect(() => {
    tempoTrainerService.setSettings(trainerSettings);
  }, [trainerSettings]);

  useEffect(() => {
    return playbackService.setBpmClampListener((adjustment) => {
      setTempoClampMessage(formatBpmClampToastMessage(adjustment));
    });
  }, []);

  // Keep trainer ceiling within the active subdivision cap.
  useEffect(() => {
    setTrainerSettings((previous) => clampTrainerSettings(previous, subdivisionMaxBpm));
  }, [subdivisionMaxBpm]);

  const onDismissTempoClampMessage = useCallback(() => {
    setTempoClampMessage(null);
  }, []);

  const onTapTempo = () => {
    playbackService.tapTempo();
  };

  const onTapTempoHelp = () => {
    setTapTempoHintVisible(true);
  };

  return {
    bpm,
    isPlaying,
    timeSignature,
    accentPattern,
    finerSubdivision,
    subdivisionAvailability,
    tapTempoHintVisible,
    tapTempoHintMessage: TAP_TEMPO_INTRO,
    onDismissTapTempoHint: () => setTapTempoHintVisible(false),
    tempoClampMessage,
    onDismissTempoClampMessage,
    trainerPopupVisible,
    trainerSettings,
    onTrainerPress: () => setTrainerPopupVisible((open) => !open),
    onTrainerPopupClose: () => setTrainerPopupVisible(false),
    onTrainerSettingsChange: (next: TempoTrainerSettings) => {
      setTrainerSettings(clampTrainerSettings(next, subdivisionMaxBpm));
    },
    minBpm: MIN_BPM,
    maxBpm: subdivisionMaxBpm,
    onStart: () => playbackService.start(),
    onStop: () => playbackService.stop(),
    onBpmChange: (value: number) =>
      playbackService.setBpm(toEngineBpm(value, timeSignature.denominator)),
    onTimeSignatureChange: (value: TimeSignature) => {
      playbackService.setTimeSignature(value);
      void subdivisionAccentSettingsService.syncCustomModeForSubdivision(
        resolveEngineSubdivision(value.denominator, null),
      );
    },
    onAccentPatternChange: (pattern: boolean[]) => playbackService.setAccentPattern(pattern),
    onSubdivisionChange: (value: FinerSubdivisionSelection) => {
      const engineSubdivision = resolveEngineSubdivision(timeSignature.denominator, value);
      dispatch(finerSubdivisionChanged(value));
      playbackService.setSubdivision(engineSubdivision);
      void subdivisionAccentSettingsService.syncCustomModeForSubdivision(engineSubdivision);
    },
    onTapTempo,
    onTapTempoHelp,
  };
}
