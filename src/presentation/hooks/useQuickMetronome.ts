import { useMemo, useState } from 'react';

import { PlaybackService } from '../../application/services/PlaybackService';
import { nativeAudioBridge } from '../../infrastructure/audio/NativeAudioBridge';
import { store } from '../../store';
import {
  selectAccentPattern,
  selectBpm,
  selectCurrentBeat,
  selectCurrentSubdivisionIndex,
  selectIsAccent,
  selectIsPlaying,
  selectSubdivision,
  selectTimeSignature,
} from '../../features/metronome/metronomeSelectors';
import type { TimeSignature } from '../../domain/entities/Metronome';
import type { SubdivisionKind } from '../../domain/valueObjects/Subdivision';
import { useAppDispatch, useAppSelector } from '../../store/hooks';

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
  const subdivision = useAppSelector(selectSubdivision);
  const currentBeat = useAppSelector(selectCurrentBeat);
  const currentSubdivisionIndex = useAppSelector(selectCurrentSubdivisionIndex);
  const isAccent = useAppSelector(selectIsAccent);
  const [tapTempoHintVisible, setTapTempoHintVisible] = useState(false);

  const playbackService = useMemo(
    () => new PlaybackService(dispatch, () => store.getState(), nativeAudioBridge),
    [dispatch],
  );

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
    subdivision,
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
    onBpmChange: (value: number) => playbackService.setBpm(value),
    onTimeSignatureChange: (value: TimeSignature) => playbackService.setTimeSignature(value),
    onAccentPatternChange: (pattern: boolean[]) => playbackService.setAccentPattern(pattern),
    onSubdivisionChange: (value: SubdivisionKind) => playbackService.setSubdivision(value),
    onTapTempo,
    onTapTempoHelp,
  };
}
