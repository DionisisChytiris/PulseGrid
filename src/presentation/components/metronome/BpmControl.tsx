import { useMemo, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { studioColors } from '../../theme';
import { BpmCircularSlider } from './BpmCircularSlider';
import { DialTransportIcon } from './DialTransportIcon';

/** ~25% larger ring for Quick Metronome hero dial. */
export const BPM_DIAL_SIZE_SCALE = 1.25;

type BpmControlProps = {
  value: number;
  minimumValue: number;
  maximumValue: number;
  onValueChange: (value: number) => void;
  isPlaying: boolean;
  onTransportPress: () => void;
  onAccentPatternChange?: (pattern: boolean[]) => void;
  diameterScale?: number;
};

export function BpmControl({
  value,
  minimumValue,
  maximumValue,
  onValueChange,
  isPlaying,
  onTransportPress,
  onAccentPatternChange,
  diameterScale = BPM_DIAL_SIZE_SCALE,
}: BpmControlProps) {
  const layout = useResponsiveLayout();
  const [coronaActive, setCoronaActive] = useState(false);
  const [coronaColor, setCoronaColor] = useState('#00FF66');

  const metrics = useMemo(() => {
    const bpmFontSize = layout.displayFontSize(54 * diameterScale, 0.09, 0.11);
    // Slightly smaller than before for better balance under the BPM number.
    const iconSize = layout.scale(18 * diameterScale, 0.05, 0.05);

    return {
      bpmFontSize,
      bpmLineHeight: Math.round(bpmFontSize * 1.02),
      iconSize,
      iconGap: layout.scale(20 * diameterScale, 0.05, 0.05),
      // Lift the whole center cluster slightly so the BPM reads visually centered.
      centerLiftY: layout.scale(10 * diameterScale, 0.05, 0.05),
    };
  }, [diameterScale, layout]);

  const iconTop =
    '50%' as const;
  const iconMarginTop = metrics.bpmLineHeight / 2 + metrics.iconGap;

  const centerContent: ReactNode = (
    <View
      style={[
        styles.centerLayout,
        { transform: [{ translateY: -metrics.centerLiftY }] },
      ]}
    >
      <View style={styles.bpmAnchor} pointerEvents="none">
        <Text
          allowFontScaling={false}
          style={[
            styles.bpmValue,
            {
              fontSize: metrics.bpmFontSize,
              lineHeight: metrics.bpmLineHeight,
            },
            Platform.OS === 'android' && styles.bpmTextAndroid,
          ]}
        >
          {value}
        </Text>
      </View>

      <View
        style={[styles.iconAnchor, { top: iconTop, marginTop: iconMarginTop }]}
        pointerEvents="none"
      >
        <DialTransportIcon isPlaying={isPlaying} size={metrics.iconSize} />
      </View>
    </View>
  );

  const handleTransportPressIn = () => {
    // Color depends on which control is currently shown (play vs stop),
    // but the effect itself only exists while pressed.
    setCoronaColor(isPlaying ? '#C44DFF' : '#00FF66');
    setCoronaActive(true);
  };

  const handleTransportPressOut = () => {
    setCoronaActive(false);
  };

  return (
    <View style={styles.container}>
      <BpmCircularSlider
        value={value}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        onValueChange={onValueChange}
        coronaActive={coronaActive}
        coronaColor={coronaColor}
        diameterScale={diameterScale}
        onCenterPress={onTransportPress}
        onCenterPressIn={handleTransportPressIn}
        onCenterPressOut={handleTransportPressOut}
        centerAccessibilityLabel={isPlaying ? 'Stop metronome' : 'Start metronome'}
        onAccentPatternChange={onAccentPatternChange}
      >
        {centerContent}
      </BpmCircularSlider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLayout: {
    ...StyleSheet.absoluteFillObject,
  },
  bpmAnchor: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bpmValue: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: studioColors.textPrimary,
    textAlign: 'center',
  },
  bpmTextAndroid: {
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
