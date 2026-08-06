import { useEffect, useState } from 'react';

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
  selectCurrentBeat,
  selectCurrentSubdivisionIndex,
  selectFinerSubdivision,
  selectIsAccent,
  selectIsPlaying,
  selectSubdivisionAvailability,
  selectTimeSignature,
} from '../../features/metronome/metronomeSelectors';
import type { TimeSignature } from '../../domain/entities/Metronome';
import type { FinerSubdivisionSelection } from '../../domain/metronome/PulseGridSettings';
import { resolveEngineSubdivision, toEngineBpm } from '../../domain/metronome/PulseGridSettings';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { finerSubdivisionChanged } from '../../features/metronome/metronomeSlice';

export const MIN_BPM = 30;
export const MAX_BPM = 600;

const TAP_TEMPO_INTRO =
  'Tap TAP at least 3 times in a steady beat to set the tempo. BPM updates from the 3rd tap. Pause longer than 2 seconds to start over. Hold TAP for help.';

function clampTrainerSettings(settings: TempoTrainerSettings): TempoTrainerSettings {
  return {
    enabled: settings.enabled,
    increaseMode: settings.increaseMode === 'time' ? 'time' : 'bars',
    barsInterval: Math.min(64, Math.max(1, Math.floor(settings.barsInterval))),
    timeIntervalSeconds: Math.min(3600, Math.max(1, Math.floor(settings.timeIntervalSeconds))),
    bpmDelta: Math.min(50, Math.max(1, Math.floor(settings.bpmDelta))),
    maxBpm: Math.min(MAX_BPM, Math.max(40, Math.floor(settings.maxBpm))),
  };
}

export function useQuickMetronome() {
  const dispatch = useAppDispatch();
  const bpm = useAppSelector(selectBpm);
  const isPlaying = useAppSelector(selectIsPlaying);
  const timeSignature = useAppSelector(selectTimeSignature);
  const accentPattern = useAppSelector(selectAccentPattern);
  const finerSubdivision = useAppSelector(selectFinerSubdivision);
  const subdivisionAvailability = useAppSelector(selectSubdivisionAvailability);
  const currentBeat = useAppSelector(selectCurrentBeat);
  const currentSubdivisionIndex = useAppSelector(selectCurrentSubdivisionIndex);
  const isAccent = useAppSelector(selectIsAccent);
  const [tapTempoHintVisible, setTapTempoHintVisible] = useState(false);
  const [trainerPopupVisible, setTrainerPopupVisible] = useState(false);
  const [trainerSettings, setTrainerSettings] = useState<TempoTrainerSettings>(
    DEFAULT_TEMPO_TRAINER_SETTINGS,
  );

  useEffect(() => {
    tempoTrainerService.setSettings(trainerSettings);
  }, [trainerSettings]);

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
    currentBeat,
    currentSubdivisionIndex,
    isAccent,
    tapTempoHintVisible,
    tapTempoHintMessage: TAP_TEMPO_INTRO,
    onDismissTapTempoHint: () => setTapTempoHintVisible(false),
    trainerPopupVisible,
    trainerSettings,
    onTrainerPress: () => setTrainerPopupVisible((open) => !open),
    onTrainerPopupClose: () => setTrainerPopupVisible(false),
    onTrainerSettingsChange: (next: TempoTrainerSettings) => {
      setTrainerSettings(clampTrainerSettings(next));
    },
    minBpm: MIN_BPM,
    maxBpm: MAX_BPM,
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
