import { useMemo, useRef, type ReactNode } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import {
  angleToArcRatio,
  arcRatioFromBpm,
  bpmFromArcRatio,
} from './bpmCircularSliderMapping';

type BpmCircularSliderProps = {
  value: number;
  minimumValue: number;
  maximumValue: number;
  onValueChange: (value: number) => void;
  children: ReactNode;
  style?: ViewStyle;
};

export function BpmCircularSlider({
  value,
  minimumValue,
  maximumValue,
  onValueChange,
  children,
  style,
}: BpmCircularSliderProps) {
  const layout = useResponsiveLayout();
  const diameter = useMemo(
    () => layout.scale(layout.isTablet ? 220 : layout.isCompact ? 176 : 196, 0.05, 0.05),
    [layout],
  );
  const strokeWidth = layout.scale(10, 0.05, 0.05);
  const thumbSize = layout.scale(12, 0.05, 0.05);
  const grabPadding = layout.scale(18, 0.05, 0.05);
  const touchDiameter = diameter + grabPadding * 2;

  const centerRef = useRef({ x: 0, y: 0 });
  const radiusRef = useRef(0);
  const strokeWidthRef = useRef(strokeWidth);
  const grabPaddingRef = useRef(grabPadding);
  const minimumValueRef = useRef(minimumValue);
  const maximumValueRef = useRef(maximumValue);
  const currentValueRef = useRef(value);
  const previousArcRatioRef = useRef<number | null>(null);
  const onValueChangeRef = useRef(onValueChange);
  const containerRef = useRef<View>(null);

  strokeWidthRef.current = strokeWidth;
  grabPaddingRef.current = grabPadding;
  minimumValueRef.current = minimumValue;
  maximumValueRef.current = maximumValue;
  currentValueRef.current = value;
  onValueChangeRef.current = onValueChange;

  const measureCenter = () => {
    containerRef.current?.measureInWindow((x, y, width, height) => {
      centerRef.current = {
        x: x + width / 2,
        y: y + height / 2,
      };
    });
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
    const innerTorus = ringRadius - halfStroke - grabPad;
    const outerTorus = ringRadius + halfStroke + grabPad;
    const centerExclusion = ringRadius - stroke - grabPad * 0.35;

    if (distance < centerExclusion) {
      return false;
    }

    return distance >= innerTorus && distance <= outerTorus;
  };

  const updateFromTouch = (pageX: number, pageY: number) => {
    const { x, y } = centerRef.current;
    const dx = pageX - x;
    const dy = pageY - y;
    const angle = Math.atan2(dy, dx);
    const ratio = angleToArcRatio(angle);
    const nextBpm = bpmFromArcRatio(
      ratio,
      minimumValueRef.current,
      maximumValueRef.current,
      currentValueRef.current,
      previousArcRatioRef.current,
    );

    previousArcRatioRef.current = ratio;
    currentValueRef.current = nextBpm;
    onValueChangeRef.current(nextBpm);
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
        previousArcRatioRef.current = arcRatioFromBpm(
          currentValueRef.current,
          minimumValueRef.current,
          maximumValueRef.current,
        );
        updateFromTouch(event.nativeEvent.pageX, event.nativeEvent.pageY);
      },
      onPanResponderMove: (event) => {
        updateFromTouch(event.nativeEvent.pageX, event.nativeEvent.pageY);
      },
      onPanResponderRelease: () => {
        previousArcRatioRef.current = null;
      },
      onPanResponderTerminate: () => {
        previousArcRatioRef.current = null;
      },
    }),
  ).current;

  const handleLayout = (_event: LayoutChangeEvent) => {
    measureCenter();
  };

  const radius = (diameter - strokeWidth) / 2;
  radiusRef.current = radius;
  const center = diameter / 2;
  const ratio = arcRatioFromBpm(value, minimumValue, maximumValue);
  const thumbAngle = -Math.PI / 2 + ratio * Math.PI * 2;
  const thumbLeft = center + radius * Math.cos(thumbAngle) - thumbSize / 2;
  const thumbTop = center + radius * Math.sin(thumbAngle) - thumbSize / 2;
  const progressDotCount = 36;
  const activeDots = Math.round(ratio * progressDotCount);
  const progressDotSize = Math.max(3, strokeWidth * 0.28);

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
        <View
          style={[
            styles.trackRing,
            {
              width: diameter,
              height: diameter,
              borderRadius: diameter / 2,
              borderWidth: strokeWidth,
            },
          ]}
        />

        {Array.from({ length: progressDotCount }, (_, index) => {
          const dotRatio = index / progressDotCount;
          const angle = -Math.PI / 2 + dotRatio * Math.PI * 2;
          const dotSize = progressDotSize;
          const dotRadius = radius;
          const isActive = index < activeDots;

          return (
            <View
              key={index}
              style={[
                styles.progressDot,
                {
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  left: center + dotRadius * Math.cos(angle) - dotSize / 2,
                  top: center + dotRadius * Math.sin(angle) - dotSize / 2,
                  backgroundColor: isActive ? '#C7C7CC' : 'transparent',
                },
              ]}
            />
          );
        })}

        <View
          style={[
            styles.thumb,
            {
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              left: thumbLeft,
              top: thumbTop,
            },
          ]}
        />
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.centerContent,
          {
            width: diameter,
            height: diameter,
            top: grabPadding,
            left: grabPadding,
          },
        ]}
      >
        {children}
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
  trackRing: {
    position: 'absolute',
    borderColor: '#E5E5EA',
    backgroundColor: 'transparent',
  },
  progressDot: {
    position: 'absolute',
  },
  thumb: {
    position: 'absolute',
    backgroundColor: '#AEAEB2',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
