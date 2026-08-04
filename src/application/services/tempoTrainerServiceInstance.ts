import { store } from '../../store';
import { Subdivision } from '../../domain/valueObjects/Subdivision';

import { playbackService } from './playbackServiceInstance';
import { TempoTrainerService } from './TempoTrainerService';

/**
 * Quick Metronome Practice Trainer singleton.
 * Never imported by Song Timeline / SongPlaybackService.
 */
export const tempoTrainerService = new TempoTrainerService({
  getBpm: () => store.getState().metronome.bpm,
  setBpm: (bpm) => playbackService.setBpm(bpm),
  getBeatsPerMeasure: () => store.getState().metronome.timeSignature.numerator,
  getTicksPerBeat: () =>
    Subdivision.fromKind(store.getState().metronome.subdivision).getTicksPerBeat(),
});

playbackService.attachTempoTrainer(tempoTrainerService);
