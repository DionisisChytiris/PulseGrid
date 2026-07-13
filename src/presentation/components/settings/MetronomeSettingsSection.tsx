import { StyleSheet, Text, View } from 'react-native';

import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { studioColors } from '../../theme';
import { MetronomeSoundsSection } from './MetronomeSoundsSection';
import { SubdivisionAccentSection } from './SubdivisionAccentSection';

export function MetronomeSettingsSection() {
  const layout = useResponsiveLayout();

  return (
    <View style={[styles.section, { gap: layout.scale(20) }]}>
      <Text style={[styles.sectionTitle, { fontSize: layout.scale(18) }]}>Metronome Settings</Text>
      <SubdivisionAccentSection />
      <MetronomeSoundsSection />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
  },
  sectionTitle: {
    color: studioColors.textPrimary,
    fontWeight: '600',
  },
});
