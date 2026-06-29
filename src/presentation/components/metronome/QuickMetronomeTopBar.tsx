import { StyleSheet, View } from 'react-native';

import { PracticeTimer } from './PracticeTimer';

type QuickMetronomeTopBarProps = {
  isPlaying: boolean;
};

export function QuickMetronomeTopBar({ isPlaying }: QuickMetronomeTopBarProps) {
  return (
    <View style={styles.topBar}>
      <View style={styles.leftSlot} />
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
  },
});
