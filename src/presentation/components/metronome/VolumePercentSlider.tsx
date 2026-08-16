import { useCallback, useId, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { studioColors } from '../../theme';

type VolumePercentSliderProps = {
  value: number;
  onValueChange: (value: number) => void;
  accessibilityLabel: string;
};

const THUMB_SIZE = 18;
const THUMB_RADIUS = THUMB_SIZE / 2;
/** Large enough that ~30–50% stays visible around a typical fingertip. */
const HALO_SIZE = 96;
const HALO_RADIUS = HALO_SIZE / 2;
const HALO_FADE_MS = 90;
/** Soft off-white that sits on studio slate without reading as pure white. */
const HALO_COLOR = studioColors.textPrimary;

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function VolumePercentSlider({
  value,
  onValueChange,
  accessibilityLabel,
}: VolumePercentSliderProps) {
  const gradientId = useId().replace(/:/g, '');
  const trackWidthRef = useRef(0);
  const trackPageXRef = useRef(0);
  const trackRef = useRef<View>(null);
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;
  const [hitWidth, setHitWidth] = useState(0);
  const haloOpacity = useRef(new Animated.Value(0)).current;

  const applyFromPageX = useCallback((pageX: number) => {
    const width = trackWidthRef.current;
    if (width <= 0) {
      return;
    }
    const ratio = (pageX - trackPageXRef.current) / width;
    onValueChangeRef.current(clampPercent(ratio * 100));
  }, []);

  const measureTrack = useCallback(() => {
    trackRef.current?.measureInWindow((x, _y, width) => {
      trackPageXRef.current = x;
      trackWidthRef.current = width;
    });
  }, []);

  const beginDrag = useCallback(
    (pageX: number) => {
      haloOpacity.stopAnimation();
      haloOpacity.setValue(1);
      trackRef.current?.measureInWindow((x, _y, width) => {
        trackPageXRef.current = x;
        trackWidthRef.current = width;
        applyFromPageX(pageX);
      });
    },
    [applyFromPageX, haloOpacity],
  );

  const endDrag = useCallback(() => {
    Animated.timing(haloOpacity, {
      toValue: 0,
      duration: HALO_FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [haloOpacity]);

  const beginDragRef = useRef(beginDrag);
  beginDragRef.current = beginDrag;
  const endDragRef = useRef(endDrag);
  endDragRef.current = endDrag;
  const applyFromPageXRef = useRef(applyFromPageX);
  applyFromPageXRef.current = applyFromPageX;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (event: GestureResponderEvent) => {
        beginDragRef.current(event.nativeEvent.pageX);
      },
      onPanResponderMove: (event: GestureResponderEvent) => {
        applyFromPageXRef.current(event.nativeEvent.pageX);
      },
      onPanResponderRelease: () => {
        endDragRef.current();
      },
      onPanResponderTerminate: () => {
        endDragRef.current();
      },
    }),
  ).current;

  const handleHitLayout = (event: LayoutChangeEvent) => {
    setHitWidth(event.nativeEvent.layout.width);
  };

  const fillPercent = clampPercent(value);
  const thumbTravel = Math.max(0, hitWidth - THUMB_SIZE);
  const thumbLeft = (fillPercent / 100) * thumbTravel;
  const haloLeft = thumbLeft + THUMB_RADIUS - HALO_RADIUS;

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: fillPercent, text: `${fillPercent}%` }}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') {
          onValueChange(clampPercent(fillPercent + 5));
        } else if (event.nativeEvent.actionName === 'decrement') {
          onValueChange(clampPercent(fillPercent - 5));
        }
      }}
      accessibilityActions={[
        { name: 'increment', label: 'Increase volume' },
        { name: 'decrement', label: 'Decrease volume' },
      ]}
      onLayout={handleHitLayout}
      style={styles.hit}
      {...panResponder.panHandlers}
    >
      <View
        ref={trackRef}
        onLayout={measureTrack}
        style={styles.track}
      >
        <View style={[styles.fill, { width: `${fillPercent}%` }]} />
      </View>
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, { left: haloLeft, opacity: haloOpacity }]}
      >
        <Svg width={HALO_SIZE} height={HALO_SIZE}>
          <Defs>
            <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={HALO_COLOR} stopOpacity="0.20" />
              <Stop offset="28%" stopColor={HALO_COLOR} stopOpacity="0.11" />
              <Stop offset="58%" stopColor={HALO_COLOR} stopOpacity="0.05" />
              <Stop offset="82%" stopColor={HALO_COLOR} stopOpacity="0.018" />
              <Stop offset="100%" stopColor={HALO_COLOR} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width={HALO_SIZE} height={HALO_SIZE} fill={`url(#${gradientId})`} />
        </Svg>
      </Animated.View>
      <View pointerEvents="none" style={[styles.thumb, { left: thumbLeft }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: THUMB_RADIUS,
    overflow: 'visible',
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: studioColors.border,
    justifyContent: 'center',
  },
  fill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: studioColors.accent,
  },
  halo: {
    position: 'absolute',
    top: '50%',
    marginTop: -HALO_RADIUS,
    width: HALO_SIZE,
    height: HALO_SIZE,
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    marginTop: -THUMB_RADIUS,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_RADIUS,
    backgroundColor: studioColors.textPrimary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
  },
});
