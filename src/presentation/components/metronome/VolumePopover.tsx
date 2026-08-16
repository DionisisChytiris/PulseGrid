import { StyleSheet, View } from 'react-native';

import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { studioColors } from '../../theme';
import { VolumeChannelControls } from '../settings/VolumeChannelControls';

export function VolumePopover() {
  const layout = useResponsiveLayout();
  const popoverWidth = Math.min(
    layout.scale(300, 0.1, 0.06),
    layout.contentMaxWidth,
  );

  return (
    <View
      accessibilityViewIsModal={false}
      pointerEvents="auto"
      style={[styles.popover, { width: popoverWidth, marginTop: layout.scale(4) }]}
    >
      <View style={styles.card} pointerEvents="auto">
        <VolumeChannelControls />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  popover: {
    position: 'absolute',
    top: '100%',
    left: 0,
    zIndex: 5,
    elevation: 8,
  },
  card: {
    backgroundColor: studioColors.surfaceElevated,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    paddingLeft: 18,
    paddingRight: 26,
    paddingTop: 18,
    paddingBottom: 18,
    overflow: 'visible',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
});
