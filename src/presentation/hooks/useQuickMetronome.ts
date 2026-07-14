import { useState } from 'react';

import { playbackService } from '../../application/services/playbackServiceInstance';
import { subdivisionAccentSettingsService } from '../../application/services/subdivisionAccentSettingsServiceInstance';
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
