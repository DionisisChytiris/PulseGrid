import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { clickSoundService } from '../../../application/services/clickSoundServiceInstance';
import {
  ACCENT_CLICK_SOUNDS,
  BAR_CLICK_SOUNDS,
  NORMAL_CLICK_SOUNDS,
  type AccentClickSoundId,
  type BarClickSoundId,
  type NormalClickSoundId,
} from '../../../domain/metronome/ClickSoundCatalog';
import {
  selectAccentClickSound,
  selectBarClickSound,
  selectNormalClickSound,
} from '../../../features/settings/settingsSelectors';
import { useAppSelector } from '../../../store/hooks';
import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { SettingsSoundDropdown } from './SettingsSoundDropdown';

export function MetronomeSoundsSection() {
  const layout = useResponsiveLayout();
  const barClickSound = useAppSelector(selectBarClickSound);
  const accentClickSound = useAppSelector(selectAccentClickSound);
  const normalClickSound = useAppSelector(selectNormalClickSound);

  const onSelectBar = useCallback((soundId: BarClickSoundId) => {
    void clickSoundService.setBarClickSound(soundId);
  }, []);

  const onSelectAccent = useCallback((soundId: AccentClickSoundId) => {
    void clickSoundService.setAccentClickSound(soundId);
  }, []);

  const onSelectClick = useCallback((soundId: NormalClickSoundId) => {
    void clickSoundService.setNormalClickSound(soundId);
  }, []);

  return (
    <View style={[styles.group, { gap: layout.scale(14) }]}>
      <SettingsSoundDropdown
        label="Bar"
        value={barClickSound}
        options={BAR_CLICK_SOUNDS}
        onValueChange={onSelectBar}
        onPreview={(soundId) => clickSoundService.previewBarClick(soundId)}
      />

      <SettingsSoundDropdown
        label="Accent"
        value={accentClickSound}
        options={ACCENT_CLICK_SOUNDS}
        onValueChange={onSelectAccent}
        onPreview={(soundId) => clickSoundService.previewAccentClick(soundId)}
      />

      <SettingsSoundDropdown
        label="Click"
        value={normalClickSound}
        options={NORMAL_CLICK_SOUNDS}
        onValueChange={onSelectClick}
        onPreview={(soundId) => clickSoundService.previewNormalClick(soundId)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    width: '100%',
  },
});
