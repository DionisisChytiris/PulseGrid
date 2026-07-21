import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { studioColors } from '../../theme';

type EclipseCoronaGlowProps = {
  /** Whether the corona should be visible (press held). */
  active: boolean;
  /** Corona color used for the visible glow only. */
  color: string;
  diameter: number;
  strokeWidth: number;
};

const LAYER_COUNT = 14;
const SHOW_MS = 70;
const FADE_MS = 280;

/** Soft fade reaches ~100px outside the BPM circle. */
const OUTER_EXTENT_PX = 100;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Press-and-hold solar eclipse corona glow.
 *
 * Critical: glow layers fade independently from the opaque center mask.
 * Fading the whole group would make the filled disks show through as a
 * solid colored ball during release — that must never happen.
 */
export function EclipseCoronaGlow({ active, color, diameter, strokeWidth }: EclipseCoronaGlowProps) {
  const [visible, setVisible] = useState(active);
  const glowOpacity = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    if (active) {
      setVisible(true);
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: SHOW_MS,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(glowOpacity, {
      toValue: 0,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setVisible(false);
        glowOpacity.setValue(0);
      }
    });
  }, [active, glowOpacity]);

  const layers = useMemo(() => {
    // Start just outside the ring edge so light hugs the BPM circle.
    const startExtra = Math.max(6, strokeWidth * 0.35);
    const maxExtra = OUTER_EXTENT_PX;

    return Array.from({ length: LAYER_COUNT }, (_, index) => {
      const t = index / (LAYER_COUNT - 1);
      // Bias density toward the ring (more layers near the edge).
      const easedT = Math.pow(t, 0.72);
      const extra = startExtra + (maxExtra - startExtra) * easedT;
      const size = diameter + extra * 2;

      const half = size / 2;
      const left = diameter / 2 - half;
      const top = left;

      // ~100% near ring → ~50% mid → ~10% outer → transparent
      const layerAlpha = clamp01(1.0 * Math.pow(1 - easedT, 1.85));

      return { index, size, left, top, layerAlpha };
    });
  }, [diameter, strokeWidth]);

  // Mask slightly larger than the BPM circle so soft inner edges stay covered.
  const maskSize = diameter + Math.max(2, strokeWidth * 0.15);
  const maskOffset = (diameter - maskSize) / 2;

  if (!visible) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        {
          width: diameter,
          height: diameter,
        },
      ]}
    >
      {/* Glow only — opacity animates here, never on the mask. */}
      <Animated.View style={[styles.glowGroup, { opacity: glowOpacity }]}>
        {layers.map((layer) => (
          <View
            key={layer.index}
            style={[
              styles.layer,
              {
                width: layer.size,
                height: layer.size,
                left: layer.left,
                top: layer.top,
                borderRadius: layer.size / 2,
                backgroundColor: color,
                opacity: layer.layerAlpha,
              },
            ]}
          />
        ))}
      </Animated.View>

      {/*
        Opaque moon mask. Stays fully opaque for the entire fade so the
        colored disks never flash as a solid ball in the center.
      */}
      <View
        pointerEvents="none"
        style={[
          styles.cutout,
          {
            width: maskSize,
            height: maskSize,
            left: maskOffset,
            top: maskOffset,
            borderRadius: maskSize / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'visible',
  },
  glowGroup: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible',
  },
  layer: {
    position: 'absolute',
  },
  cutout: {
    position: 'absolute',
    backgroundColor: studioColors.background,
  },
});
