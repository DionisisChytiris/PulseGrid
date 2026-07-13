import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { clickSoundService } from '../../../application/services/clickSoundServiceInstance';
import {
  ACCENT_CLICK_SOUNDS,
  NORMAL_CLICK_SOUNDS,
  SUBDIVISION_CLICK_SOUNDS,
  type AccentClickSoundId,
  type NormalClickSoundId,
  type SubdivisionClickSoundId,
} from '../../../domain/metronome/ClickSoundCatalog';
import {
  selectAccentClickSound,
  selectNormalClickSound,
  selectSubdivisionClickSound,
} from '../../../features/settings/settingsSelectors';
import { useAppSelector } from '../../../store/hooks';
import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { studioColors } from '../../theme';
import { SettingsSoundDropdown } from './SettingsSoundDropdown';

export function MetronomeSoundsSection() {
  const layout = useResponsiveLayout();
  const normalClickSound = useAppSelector(selectNormalClickSound);
  const accentClickSound = useAppSelector(selectAccentClickSound);
  const subdivisionClickSound = useAppSelector(selectSubdivisionClickSound);

  const onSelectNormal = useCallback((soundId: NormalClickSoundId) => {
    void clickSoundService.setNormalClickSound(soundId);
  }, []);

  const onSelectAccent = useCallback((soundId: AccentClickSoundId) => {
    void clickSoundService.setAccentClickSound(soundId);
  }, []);

  const onSelectSubdivision = useCallback((soundId: SubdivisionClickSoundId) => {
    void clickSoundService.setSubdivisionClickSound(soundId);
  }, []);

  return (
    <View style={[styles.group, { gap: layout.scale(14) }]}>
      <Text style={[styles.groupLabel, { fontSize: layout.scale(13) }]}>Sounds</Text>

      <SettingsSoundDropdown
        label="Normal Click"
        value={normalClickSound}
        options={NORMAL_CLICK_SOUNDS}
        onValueChange={onSelectNormal}
        onPreview={(soundId) => clickSoundService.previewNormalClick(soundId)}
      />

      <SettingsSoundDropdown
        label="Accent Click"
        value={accentClickSound}
        options={ACCENT_CLICK_SOUNDS}
        onValueChange={onSelectAccent}
        onPreview={(soundId) => clickSoundService.previewAccentClick(soundId)}
      />

      <SettingsSoundDropdown
        label="Subdivision Click"
        value={subdivisionClickSound}
        options={SUBDIVISION_CLICK_SOUNDS}
        onValueChange={onSelectSubdivision}
        onPreview={(soundId) => clickSoundService.previewSubdivisionClick(soundId)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    width: '100%',
  },
  groupLabel: {
    color: studioColors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
});
