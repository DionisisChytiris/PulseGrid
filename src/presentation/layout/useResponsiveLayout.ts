import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

const TABLET_MIN_WIDTH = 768;
const COMPACT_MAX_WIDTH = 360;
const SHORT_MAX_HEIGHT = 700;
const ANDROID_DISPLAY_FONT_FACTOR = 0.88;

export type ResponsiveLayout = {
  width: number;
  height: number;
  isTablet: boolean;
  isCompact: boolean;
  isShort: boolean;
  isAndroid: boolean;
  horizontalPadding: number;
  contentMaxWidth: number;
  tabletTopInset: number;
  tabletBottomLift: number;
  sectionGap: number;
  scale: (base: number, tabletBoost?: number, compactShrink?: number) => number;
  displayFontSize: (base: number, tabletBoost?: number, compactShrink?: number) => number;
};

export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isTablet = width >= TABLET_MIN_WIDTH;
    const isCompact = width < COMPACT_MAX_WIDTH;
    const isShort = height < SHORT_MAX_HEIGHT;

    const horizontalPadding = isTablet ? 56 : isCompact ? 16 : 24;
    const contentMaxWidth = isTablet ? 520 : isCompact ? width - horizontalPadding * 2 : 400;
    const tabletTopInset = isTablet ? 20 : 0;
    const tabletBottomLift = isTablet ? 36 : 0;
    const sectionGap = isShort ? 22 : isTablet ? 44 : 36;

    const scale = (base: number, tabletBoost = 0.12, compactShrink = 0.1) => {
      if (isTablet) {
        return Math.round(base * (1 + tabletBoost));
      }
      if (isCompact) {
        return Math.round(base * (1 - compactShrink));
      }
      return base;
    };

    const displayFontSize = (base: number, tabletBoost = 0.12, compactShrink = 0.1) => {
      const scaled = scale(base, tabletBoost, compactShrink);
      return Platform.OS === 'android'
        ? Math.round(scaled * ANDROID_DISPLAY_FONT_FACTOR)
        : scaled;
    };

    return {
      width,
      height,
      isTablet,
      isCompact,
      isShort,
      isAndroid: Platform.OS === 'android',
      horizontalPadding,
      contentMaxWidth,
      tabletTopInset,
      tabletBottomLift,
      sectionGap,
      scale,
      displayFontSize,
    };
  }, [width, height]);
}

export function getBeatDotMetrics(
  beatCount: number,
  layout: ResponsiveLayout,
): { dotSize: number; gap: number; minHeight: number } {
  const availableWidth = Math.min(
    layout.width - layout.horizontalPadding * 2,
    layout.isTablet ? layout.width * 0.7 : layout.width - layout.horizontalPadding * 2,
  );

  const gap =
    beatCount > 14 ? 5 : beatCount > 10 ? 8 : beatCount > 6 ? 10 : layout.isTablet ? 16 : 12;

  const maxDot = layout.isTablet ? 20 : 16;
  const minDot = 7;
  const computed =
    beatCount > 0 ? (availableWidth - gap * (beatCount - 1)) / beatCount : maxDot;
  const dotSize = Math.max(minDot, Math.min(maxDot, computed));

  return {
    dotSize,
    gap,
    minHeight: Math.round(dotSize * 2.5),
  };
}
