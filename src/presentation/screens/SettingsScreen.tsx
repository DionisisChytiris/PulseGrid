import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MetronomeSettingsSection } from '../components/settings/MetronomeSettingsSection';
import { useResponsiveLayout } from '../layout/useResponsiveLayout';
import { studioColors } from '../theme';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: layout.horizontalPadding,
        },
      ]}
    >
      <View style={[styles.inner, { maxWidth: layout.isTablet ? 560 : layout.contentMaxWidth }]}>
        <Text style={[styles.title, { fontSize: layout.scale(24) }]}>Settings</Text>
        <MetronomeSettingsSection />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: studioColors.background,
  },
  content: {
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    gap: 24,
  },
  title: {
    fontWeight: '600',
    color: studioColors.textPrimary,
    marginBottom: 4,
  },
});
