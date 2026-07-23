import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  selectAccentPattern,
  selectCurrentBeat,
  selectIsPlaying,
  selectTimeSignature,
} from '../../../features/metronome/metronomeSelectors';
import { useAppSelector } from '../../../store/hooks';
import { getBeatDotMetrics, useResponsiveLayout } from '../../layout/useResponsiveLayout';

import { AccentPatternToggleRow } from './AccentPatternToggleRow';

type BeatIndicatorsProps = {
  onAccentPatternChange: (pattern: boolean[]) => void;
};

function BeatIndicatorsComponent({ onAccentPatternChange }: BeatIndicatorsProps) {
  const isPlaying = useAppSelector(selectIsPlaying);
  const currentBeat = useAppSelector(selectCurrentBeat);
  const accentPattern = useAppSelector(selectAccentPattern);
  const timeSignature = useAppSelector(selectTimeSignature);
  const beatCount = timeSignature.numerator;

  const layout = useResponsiveLayout();
  const { dotSize, gap, minHeight } = useMemo(
    () => getBeatDotMetrics(beatCount, layout),
    [beatCount, layout],
  );

  const pattern =
    accentPattern.length === beatCount
      ? accentPattern
      : Array.from({ length: beatCount }, (_, index) => accentPattern[index] ?? false);

  return (
    <View style={[styles.wrap, { minHeight, maxWidth: '100%' }]}>
      <AccentPatternToggleRow
        pattern={pattern}
        onChange={onAccentPatternChange}
        size={dotSize}
        gap={gap}
        isPlaying={isPlaying}
        currentBeat={currentBeat}
      />
    </View>
  );
}

export const BeatIndicators = memo(BeatIndicatorsComponent);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
