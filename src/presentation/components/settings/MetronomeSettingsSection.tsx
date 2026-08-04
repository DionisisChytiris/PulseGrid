import { StyleSheet, View } from 'react-native';

import { SettingsCard } from '../../../ui/components/settings/SettingsCard';
import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { MetronomeSoundsSection } from './MetronomeSoundsSection';
import { SubdivisionAccentSection } from './SubdivisionAccentSection';

export function MetronomeSettingsSection() {
  const layout = useResponsiveLayout();

  return (
    <View style={[styles.section, { gap: layout.scale(16) }]}>
      <SettingsCard
        title="Subdivision Accents"
        subtitle="Choose how subdivision beats are accented."
        icon="pulse-outline"
        collapsible
      >
        <SubdivisionAccentSection />
      </SettingsCard>

      <SettingsCard
        title="Click Sounds"
        subtitle="Choose Bar, Accent, and Click sounds."
        icon="musical-notes-outline"
        collapsible
      >
        <MetronomeSoundsSection />
      </SettingsCard>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
  },
});
