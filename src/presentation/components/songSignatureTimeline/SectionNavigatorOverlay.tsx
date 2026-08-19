import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { studioColors } from '../../theme';

import {
  sectionTrackColor,
  sectionTrackLabelColor,
  type SectionNavigatorEntry,
} from './sectionTrackVisual';

/** Comfortable one-finger touch target in landscape. */
const SECTION_ROW_HEIGHT = 34;
const PANEL_PADDING_H = 12;
const PANEL_PADDING_V = 10;
const ROW_GAP = 8;

type Props = {
  sections: readonly SectionNavigatorEntry[];
  selectedSectionIndex?: number | null;
  onSectionPress?: (sectionIndex: number) => void;
};

/**
 * Section navigator panel — fixed above the Timeline while stopped.
 */
export function SectionNavigatorOverlay({
  sections,
  selectedSectionIndex = null,
  onSectionPress,
}: Props) {
  if (sections.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <View style={styles.panelSlot}>
        <View style={styles.panel}>
          <Text style={styles.title}>Sections</Text>
          <View style={styles.listViewport}>
            <ScrollView
              style={styles.listScroll}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {sections.map((section, index) => {
                const isSelected = selectedSectionIndex === index;

                return (
                  <Pressable
                    key={`${index}-${section.name}`}
                    onPress={() => onSectionPress?.(index)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Section ${index + 1}, ${section.name}`}
                    style={({ pressed }) => [
                      styles.row,
                      isSelected && {
                        backgroundColor: sectionTrackColor(section.colorIndex),
                      },
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rowText,
                        isSelected && {
                          fontWeight: '700',
                          color: sectionTrackLabelColor(section.colorIndex),
                        },
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {index + 1}. {section.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Fixed layer above the Timeline — horizontal scroll passes underneath. */
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
  },
  /** Left-side slot (~50% of the timeline viewport — matches Count-in footprint). */
  panelSlot: {
    width: '50%',
    height: '100%',
    paddingLeft: 32,
    paddingVertical: 8,
    pointerEvents: 'box-none',
  },
  /** Fixed-height panel; list scrolls inside when sections overflow. */
  panel: {
    width: '60%',
    height: '90%',
    alignSelf: 'flex-start',
    flexDirection: 'column',
    marginVertical: '5%',
    backgroundColor: studioColors.surface,
    borderRadius: 8,
    paddingHorizontal: PANEL_PADDING_H,
    paddingVertical: PANEL_PADDING_V,
    overflow: 'hidden',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: studioColors.textSecondary,
    marginBottom: 8,
    flexShrink: 0,
  },
  listViewport: {
    flex: 1,
    minHeight: 0,
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    gap: ROW_GAP,
  },
  row: {
    minHeight: SECTION_ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginHorizontal: -4,
    borderRadius: 6,
  },
  rowPressed: {
    opacity: 0.65,
  },
  rowText: {
    fontSize: 14,
    fontWeight: '600',
    color: studioColors.textPrimary,
  },
});
