import { useCallback } from 'react';

import {
  CLICK_VOLUME_CHANNELS,
  type ClickVolumeChannel,
  type ClickVolumes,
} from '../../domain/metronome/ClickVolume';
import { selectClickVolumes } from '../../features/settings/settingsSelectors';
import { clickVolumeChanged } from '../../features/settings/settingsSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';

export function useClickVolumes(): {
  volumes: ClickVolumes;
  setChannelVolume: (channel: ClickVolumeChannel, value: number) => void;
} {
  const dispatch = useAppDispatch();
  const volumes = useAppSelector(selectClickVolumes);

  const setChannelVolume = useCallback(
    (channel: ClickVolumeChannel, value: number) => {
      if (volumes[channel] === value) {
        return;
      }
      const meta = CLICK_VOLUME_CHANNELS.find((item) => item.key === channel);
      if (meta) {
        console.log(`${meta.logLabel}:`, value);
      }
      dispatch(clickVolumeChanged({ channel, value }));
    },
    [dispatch, volumes],
  );

  return { volumes, setChannelVolume };
}
