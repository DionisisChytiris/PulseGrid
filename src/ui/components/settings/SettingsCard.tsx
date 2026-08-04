import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { useCallback, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';

import { useResponsiveLayout } from '../../../presentation/layout/useResponsiveLayout';
import { studioColors } from '../../../presentation/theme';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental !== undefined
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type SettingsCardProps = {
  title: string;
  subtitle?: string;
  icon?: IoniconName;
  children: ReactNode;
  /** When true, header toggles content visibility. Default false (always expanded). */
  collapsible?: boolean;
  /** Initial expanded state when collapsible. Default false (collapsed). */
  defaultExpanded?: boolean;
};

/**
 * Shared container for Settings groups (Playback, Audio, Theme, etc.).
 * Presentation only — no business logic.
 */
export function SettingsCard({
  title,
  subtitle,
  icon,
  children,
  collapsible = false,
  defaultExpanded = false,
}: SettingsCardProps) {
  const layout = useResponsiveLayout();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasSubtitle = subtitle !== undefined && subtitle.length > 0;
  const padding = layout.scale(18);
  const contentGap = layout.scale(16);
  const iconSize = layout.scale(22);
  const showContent = !collapsible || expanded;

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((current) => !current);
  }, []);

  const header = (
    <View
      style={[
        styles.header,
        !hasSubtitle && styles.headerCentered,
        { gap: layout.scale(12) },
      ]}
    >
      {icon !== undefined ? (
        <View style={[styles.iconSlot, { width: iconSize + 4, height: iconSize + 4 }]}>
          <Ionicons name={icon} size={iconSize} color={studioColors.accent} />
        </View>
      ) : null}

      <View style={[styles.headerText, hasSubtitle && { gap: layout.scale(4) }]}>
        <Text style={[styles.title, { fontSize: layout.scale(17) }]}>{title}</Text>
        {/* {hasSubtitle ? (
          <Text
            style={[
              styles.subtitle,
              { fontSize: layout.scale(13), lineHeight: layout.scale(18) },
            ]}
          >
            {subtitle}
          </Text>
        ) : null} */}
      </View>

      {collapsible ? (
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={layout.scale(20)}
          color={studioColors.textSecondary}
        />
      ) : null}
    </View>
  );

  return (
    <View
      style={[
        styles.card,
        {
          padding,
          gap: showContent ? contentGap : 0,
        },
      ]}
    >
      {collapsible ? (
        <Pressable
          onPress={toggleExpanded}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${title}, ${expanded ? 'expanded' : 'collapsed'}`}
          style={({ pressed }) => pressed && styles.headerPressed}
        >
          {header}
        </Pressable>
      ) : (
        header
      )}

      {showContent ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: studioColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerCentered: {
    alignItems: 'center',
  },
  headerPressed: {
    opacity: 0.75,
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: studioColors.textPrimary,
    fontWeight: '600',
  },
  subtitle: {
    color: studioColors.textSecondary,
  },
  content: {
    width: '100%',
  },
});
