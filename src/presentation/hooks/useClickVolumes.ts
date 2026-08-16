import { useCallback } from 'react';

import { clickSoundService } from '../../application/services/clickSoundServiceInstance';
import {
  type ClickVolumeChannel,
  type ClickVolumes,
} from '../../domain/metronome/ClickVolume';
import { selectClickVolumes } from '../../features/settings/settingsSelectors';
import { useAppSelector } from '../../store/hooks';

export function useClickVolumes(): {
  volumes: ClickVolumes;
  setChannelVolume: (channel: ClickVolumeChannel, value: number) => void;
} {
  const volumes = useAppSelector(selectClickVolumes);

  const setChannelVolume = useCallback(
    (channel: ClickVolumeChannel, value: number) => {
      if (volumes[channel] === value) {
        return;
      }
      void clickSoundService.setClickVolume(channel, value);
    },
    [volumes],
  );

  return { volumes, setChannelVolume };
}
