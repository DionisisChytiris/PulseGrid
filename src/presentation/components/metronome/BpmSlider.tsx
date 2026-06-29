import { useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';

import { useResponsiveLayout } from '../../layout/useResponsiveLayout';

type BpmSliderProps = {
  value: number;
  minimumValue: number;
  maximumValue: number;
  onValueChange: (value: number) => void;
};

function clamp(value: number, minimumValue: number, maximumValue: number): number {
  return Math.min(maximumValue, Math.max(minimumValue, Math.round(value)));
}

export function BpmSlider({
  value,
  minimumValue,
  maximumValue,
  onValueChange,
}: BpmSliderProps) {
  const layout = useResponsiveLayout();
  const thumbSize = useMemo(() => layout.scale(28, 0.1, 0.05), [layout]);

  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const trackPageXRef = useRef(0);
  const valueRef = useRef(value);
  const onValueChangeRef = useRef(onValueChange);
  const trackRef = useRef<View>(null);

  valueRef.current = value;
  onValueChangeRef.current = onValueChange;

  const valueFromPageX = (pageX: number) => {
    const width = trackWidthRef.current;
    if (width <= 0) {
      return valueRef.current;
    }

    const x = pageX - trackPageXRef.current;
    const ratio = Math.max(0, Math.min(1, x / width));
    return clamp(
      minimumValue + ratio * (maximumValue - minimumValue),
      minimumValue,
      maximumValue,
    );
  };

  const measureTrack = () => {
    trackRef.current?.measureInWindow((x, _y, width) => {
      trackPageXRef.current = x;
      if (width > 0) {
        trackWidthRef.current = width;
        setTrackWidth(width);
      }
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        measureTrack();
        onValueChangeRef.current(valueFromPageX(event.nativeEvent.pageX));
      },
      onPanResponderMove: (event) => {
        onValueChangeRef.current(valueFromPageX(event.nativeEvent.pageX));
      },
    }),
  ).current;

  const handleLayout = (event: LayoutChangeEvent) => {
    trackWidthRef.current = event.nativeEvent.layout.width;
    setTrackWidth(event.nativeEvent.layout.width);
    measureTrack();
  };

  const range = maximumValue - minimumValue;
  const fillRatio = range > 0 ? (value - minimumValue) / range : 0;
  const thumbLeft = trackWidth > 0 ? fillRatio * (trackWidth - thumbSize) : 0;
  const fillWidth = trackWidth > 0 ? fillRatio * trackWidth : 0;
  const trackHeight = layout.isTablet ? 5 : 4;

  return (
    <View
      ref={trackRef}
      style={[styles.container, { marginTop: layout.isShort ? 10 : 16 }]}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      <View style={[styles.track, { height: trackHeight, borderRadius: trackHeight / 2 }]}>
        <View
          style={[
            styles.fill,
            { width: fillWidth, height: trackHeight, borderRadius: trackHeight / 2 },
          ]}
        />
        <View
          style={[
            styles.thumb,
            {
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              left: thumbLeft,
              top: -(thumbSize - trackHeight) / 2,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 16,
    justifyContent: 'center',
  },
  track: {
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    backgroundColor: '#007AFF',
  },
  thumb: {
    position: 'absolute',
    backgroundColor: '#007AFF',
  },
});
