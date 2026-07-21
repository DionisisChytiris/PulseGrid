import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { studioColors } from '../../theme';
import { getTempoRingSegments } from './tempoRingColors';

const INITIAL_KNOB_ROTATION = -Math.PI / 2;
const SEGMENT_COUNT = 72;

type TempoRingProgressProps = {
  bpm: number;
  diameter: number;
  strokeWidth: number;
  trackColor?: string;
};

export function TempoRingProgress({
  bpm,
  diameter,
  strokeWidth,
  trackColor = studioColors.border,
}: TempoRingProgressProps) {
  const radius = (diameter - strokeWidth) / 2;
  const center = diameter / 2;
  const segmentLength = Math.max(4, strokeWidth * 0.92);
  const segmentThickness = Math.max(3, strokeWidth * 0.55);

  const segments = useMemo(() => getTempoRingSegments(bpm, SEGMENT_COUNT), [bpm]);

  return (
    <>
      <View
        style={[
          styles.trackRing,
          {
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            borderWidth: strokeWidth,
            borderColor: trackColor,
          },
        ]}
      />

      {segments.map((segment, index) => {
        const angle = INITIAL_KNOB_ROTATION + segment.ratio * Math.PI * 2;
        const left = center + radius * Math.cos(angle) - segmentThickness / 2;
        const top = center + radius * Math.sin(angle) - segmentLength / 2;

        return (
          <View
            key={`${segment.ratio}-${index}`}
            style={[
              styles.segment,
              {
                width: segmentThickness,
                height: segmentLength,
                left,
                top,
                backgroundColor: segment.color,
                borderRadius: segmentThickness / 2,
                transform: [{ rotate: `${angle + Math.PI / 2}rad` }],
              },
            ]}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  trackRing: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  segment: {
    position: 'absolute',
  },
});
