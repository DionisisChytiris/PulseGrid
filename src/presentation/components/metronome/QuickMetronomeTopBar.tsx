import { StyleSheet, View } from 'react-native';

import type { TempoTrainerSettings } from '../../../application/services/TempoTrainerService';

import { PracticeTimer } from './PracticeTimer';
import { PracticeTrainerButton, PracticeTrainerPopup } from './PracticeTrainerPopup';

type QuickMetronomeTopBarProps = {
  isPlaying: boolean;
  bpm: number;
  trainerSettings: TempoTrainerSettings;
  trainerPopupVisible: boolean;
  onTrainerPress: () => void;
  onTrainerSettingsChange: (settings: TempoTrainerSettings) => void;
};

export function QuickMetronomeTopBar({
  isPlaying,
  bpm,
  trainerSettings,
  trainerPopupVisible,
  onTrainerPress,
  onTrainerSettingsChange,
}: QuickMetronomeTopBarProps) {
  return (
    <View style={styles.topBar} pointerEvents="box-none">
      <View style={styles.leftSlot} pointerEvents="box-none">
        <PracticeTrainerButton
          isActive={trainerPopupVisible}
          trainerEnabled={trainerSettings.enabled}
          onPress={onTrainerPress}
        />
        <PracticeTrainerPopup
          visible={trainerPopupVisible}
          bpm={bpm}
          settings={trainerSettings}
          onSettingsChange={onTrainerSettingsChange}
        />
      </View>
      <PracticeTimer isPlaying={isPlaying} />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    minHeight: 44,
    marginBottom: 8,
  },
  leftSlot: {
    flex: 1,
    position: 'relative',
  },
});