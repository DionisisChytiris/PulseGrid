import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import {
  bpmToRotation,
  clampRotation,
  rotationToBpm,
  shortestAngleDelta,
} from './bpmRotaryMapping';
import { getTempoRingColor } from './tempoRingColors';
import { TempoRingProgress } from './TempoRingProgress';
import { EclipseCoronaGlow } from './EclipseCoronaGlow';
import { ClockBeatIndicators } from './ClockBeatIndicators';

type BpmCircularSliderProps = {
  value: number;
  minimumValue: number;
  maximumValue: number;
  onValueChange: (value: number) => void;
  children: ReactNode;
  style?: ViewStyle;
  /** Scales ring diameter and proportional chrome (default 1). */
  diameterScale?: number;
  /** Corona effect is visual-only and should be triggered by press state. */
  coronaActive?: boolean;
  coronaColor?: string;
  onCenterPress?: () => void;
  onCenterPressIn?: () => void;
  onCenterPressOut?: () => void;
  centerAccessibilityLabel?: string;
  onAccentPatternChange?: (pattern: boolean[]) => void;
};

/** Visual rest position: thumb at the top of the ring. */
const INITIAL_KNOB_ROTATION = -Math.PI / 2;
const TWO_PI = Math.PI * 2;

export function BpmCircularSlider({
  value,
  minimumValue,
  maximumValue,
  onValueChange,
  children,
  style,
  diameterScale = 1,
  coronaActive = false,
  coronaColor = '#00FF66',
  onCenterPress,
  onCenterPressIn,
  onCenterPressOut,
  centerAccessibilityLabel,
  onAccentPatternChange,
}: BpmCircularSliderProps) {
  const layout = useResponsiveLayout();
  const diameter = useMemo(() => {
    const base = layout.isTablet ? 220 : layout.isCompact ? 176 : 196;
    return layout.scale(base * diameterScale, 0.05, 0.05);
  }, [diameterScale, layout]);
  const strokeWidth = layout.scale(10 * diameterScale, 0.05, 0.05);
  const thumbSize = layout.scale(12 * diameterScale, 0.05, 0.05);
  const grabPadding = layout.scale(28 * diameterScale, 0.05, 0.05);
  const centerInset = layout.scale(26 * diameterScale, 0.05, 0.05);
  const touchDiameter = diameter + grabPadding * 2;

  const centerRef = useRef({ x: 0, y: 0 });
  const radiusRef = useRef(0);
  const strokeWidthRef = useRef(strokeWidth);
  const grabPaddingRef = useRef(grabPadding);
  const centerInsetRef = useRef(centerInset);
  const minimumValueRef = useRef(minimumValue);
  const maximumValueRef = useRef(maximumValue);
  const knobRotationRef = useRef(bpmToRotation(value));
  const lastEmittedBpmRef = useRef(Math.round(value));
  const previousAngleRef = useRef<number | null>(null);
  const onValueChangeRef = useRef(onValueChange);
  const containerRef = useRef<View>(null);
  const isDraggingRef = useRef(false);
  /** Touch fires action on press-in; skip the following onPress so we don't toggle twice. */
  const centerActionHandledOnPressInRef = useRef(false);

  const [knobRotation, setKnobRotation] = useState(() => bpmToRotation(value));

  strokeWidthRef.current = strokeWidth;
  grabPaddingRef.current = grabPadding;
  centerInsetRef.current = centerInset;
  minimumValueRef.current = minimumValue;
  maximumValueRef.current = maximumValue;
  onValueChangeRef.current = onValueChange;

  // Sync knob position from external BPM changes (+/-, text input, tap tempo).
  useEffect(() => {
    if (!isDraggingRef.current) {
      const rotation = bpmToRotation(value);
      knobRotationRef.current = rotation;
      setKnobRotation(rotation);
      lastEmittedBpmRef.current = Math.round(value);
    }
  }, [value]);

  const measureCenter = () => {
    containerRef.current?.measureInWindow((x, y, width, height) => {
      centerRef.current = {
        x: x + width / 2,
        y: y + height / 2,
      };
    });
  };

  const touchAngle = (pageX: number, pageY: number) => {
    const { x, y } = centerRef.current;
    return Math.atan2(pageY - y, pageX - x);
  };

  const isOnRing = (pageX: number, pageY: number) => {
    const { x, y } = centerRef.current;
    const ringRadius = radiusRef.current;
    const stroke = strokeWidthRef.current;
    const grabPad = grabPaddingRef.current;

    if (ringRadius <= 0) {
      return true;
    }

    const dx = pageX - x;
    const dy = pageY - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const halfStroke = stroke / 2;
    const innerRingEdge = ringRadius - halfStroke;
    const maxCenterRadius = innerRingEdge - centerInsetRef.current;

    if (maxCenterRadius > 0 && distance < maxCenterRadius) {
      return false;
    }

    const innerTorus = ringRadius - halfStroke - grabPad;
    const outerTorus = ringRadius + halfStroke + grabPad;

    return distance >= innerTorus && distance <= outerTorus;
  };

  const applyRotationDelta = (deltaRadians: number) => {
    const nextRotation = clampRotation(knobRotationRef.current + deltaRadians);

    if (nextRotation === knobRotationRef.current) {
      return;
    }

    knobRotationRef.current = nextRotation;
    setKnobRotation(nextRotation);

    const nextBpm = Math.round(
      Math.min(
        maximumValueRef.current,
        Math.max(minimumValueRef.current, rotationToBpm(nextRotation)),
      ),
    );

    if (nextBpm !== lastEmittedBpmRef.current) {
      lastEmittedBpmRef.current = nextBpm;
      onValueChangeRef.current(nextBpm);
    }
  };

  const updateFromTouch = (pageX: number, pageY: number) => {
    const angle = touchAngle(pageX, pageY);
    const previous = previousAngleRef.current;

    if (previous === null) {
      previousAngleRef.current = angle;
      return;
    }

    const delta = shortestAngleDelta(previous, angle);
    previousAngleRef.current = angle;

    if (delta === 0) {
      return;
    }

    applyRotationDelta(delta);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (event) => {
        measureCenter();
        return isOnRing(event.nativeEvent.pageX, event.nativeEvent.pageY);
      },
      onMoveShouldSetPanResponder: (_event, gestureState) =>
        Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2,
      onPanResponderGrant: (event) => {
        measureCenter();
        isDraggingRef.current = true;
        previousAngleRef.current = touchAngle(
          event.nativeEvent.pageX,
          event.nativeEvent.pageY,
        );
      },
      onPanResponderMove: (event) => {
        updateFromTouch(event.nativeEvent.pageX, event.nativeEvent.pageY);
      },
      onPanResponderRelease: () => {
        previousAngleRef.current = null;
        isDraggingRef.current = false;
      },
      onPanResponderTerminate: () => {
        previousAngleRef.current = null;
        isDraggingRef.current = false;
      },
    }),
  ).current;

  const handleLayout = (_event: LayoutChangeEvent) => {
    measureCenter();
  };

  const radius = (diameter - strokeWidth) / 2;
  radiusRef.current = radius;
  const center = diameter / 2;
  const thumbAngle = INITIAL_KNOB_ROTATION + (knobRotation % TWO_PI);
  const thumbLeft = center + radius * Math.cos(thumbAngle) - thumbSize / 2;
  const thumbTop = center + radius * Math.sin(thumbAngle) - thumbSize / 2;
  const displayBpm = rotationToBpm(knobRotation);
  const thumbColor = getTempoRingColor(displayBpm);
  const innerRingEdge = radius - strokeWidth / 2;
  const centerPressRadius = Math.max(0, innerRingEdge - centerInset);
  const centerPressDiameter = centerPressRadius * 2;

  return (
    <View
      ref={containerRef}
      style={[styles.touchContainer, { width: touchDiameter, height: touchDiameter }, style]}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel="BPM circular slider"
      accessibilityValue={{
        min: minimumValue,
        max: maximumValue,
        now: value,
      }}
    >
      <View
        pointerEvents="none"
        style={[
          styles.visualContainer,
          {
            width: diameter,
            height: diameter,
            top: grabPadding,
            left: grabPadding,
          },
        ]}
      >
        <EclipseCoronaGlow
          active={coronaActive}
          color={coronaColor}
          diameter={diameter}
          strokeWidth={strokeWidth}
        />

        <TempoRingProgress bpm={displayBpm} diameter={diameter} strokeWidth={strokeWidth} />

        <View
          style={[
            styles.thumb,
            {
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              left: thumbLeft,
              top: thumbTop,
              backgroundColor: thumbColor,
              borderColor: thumbColor,
            },
          ]}
        />
      </View>

      {onAccentPatternChange ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.beatOverlay,
            {
              width: diameter,
              height: diameter,
              top: grabPadding,
              left: grabPadding,
            },
          ]}
        >
          <ClockBeatIndicators
            diameter={diameter}
            strokeWidth={strokeWidth}
            onAccentPatternChange={onAccentPatternChange}
          />
        </View>
      ) : null}

      <View
        pointerEvents="box-none"
        style={[
          styles.centerOverlay,
          {
            width: diameter,
            height: diameter,
            top: grabPadding,
            left: grabPadding,
          },
        ]}
      >
        {onCenterPress ? (
          <Pressable
            onPressIn={() => {
              centerActionHandledOnPressInRef.current = true;
              onCenterPressIn?.();
              // iOS: let the corona state commit/paint before sync playback work.
              if (Platform.OS === 'ios') {
                requestAnimationFrame(() => {
                  onCenterPress();
                });
                return;
              }
              onCenterPress();
            }}
            onPressOut={onCenterPressOut}
            onPress={() => {
              if (centerActionHandledOnPressInRef.current) {
                centerActionHandledOnPressInRef.current = false;
                return;
              }
              // Accessibility / non-touch activation (no prior press-in).
              onCenterPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={centerAccessibilityLabel}
            style={[
              styles.centerPressable,
              {
                width: centerPressDiameter,
                height: centerPressDiameter,
                borderRadius: centerPressDiameter / 2,
              },
            ]}
          >
            {children}
          </Pressable>
        ) : (
          <View style={styles.centerPressable}>{children}</View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  touchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  visualContainer: {
    position: 'absolute',
  },
  beatOverlay: {
    position: 'absolute',
    overflow: 'visible',
  },
  thumb: {
    position: 'absolute',
    borderWidth: 1,
  },
  centerOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPressable: {
    alignItems: 'stretch',
    justifyContent: 'center',
  },
});
