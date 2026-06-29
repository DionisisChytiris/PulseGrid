import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useQuickMetronome } from '../hooks/useQuickMetronome';
import { useResponsiveLayout } from '../layout/useResponsiveLayout';
import { BeatIndicators } from '../components/metronome/BeatIndicators';
import { BpmControl } from '../components/metronome/BpmControl';
import { QuickMetronomeTopBar } from '../components/metronome/QuickMetronomeTopBar';
import { SubdivisionCycleButton } from '../components/metronome/SubdivisionCycleButton';
import { TapTempoButton } from '../components/metronome/TapTempoButton';
import { TapTempoHintModal } from '../components/metronome/TapTempoHintModal';
import { TimeSignaturePicker } from '../components/metronome/TimeSignaturePicker';

export default function QuickMetronomeScreen() {
  const {
    bpm,
    isPlaying,
    timeSignature,
    accentPattern,
    subdivision,
    currentBeat,
    currentSubdivisionIndex,
    isAccent,
    minBpm,
    maxBpm,
    onStart,
    onStop,
    onBpmChange,
    onTimeSignatureChange,
    onAccentPatternChange,
    onSubdivisionChange,
    onTapTempo,
    onTapTempoHelp,
    tapTempoHintVisible,
    tapTempoHintMessage,
    onDismissTapTempoHint,
  } = useQuickMetronome();

  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + (layout.isCompact ? 4 : 8) + layout.tabletTopInset,
          paddingHorizontal: layout.horizontalPadding,
        },
      ]}
    >
      <View style={[styles.inner, { maxWidth: layout.contentMaxWidth }]}>
        <QuickMetronomeTopBar isPlaying={isPlaying} />

        <View style={[styles.content, { gap: layout.sectionGap }]}>
          <Text style={[styles.title, { fontSize: layout.scale(24) }]}>Quick Metronome</Text>

          <BeatIndicators
            beatCount={timeSignature.numerator}
            accentPattern={accentPattern}
            currentBeat={currentBeat}
            currentSubdivisionIndex={currentSubdivisionIndex}
            isAccent={isAccent}
            isPlaying={isPlaying}
            onAccentPatternChange={onAccentPatternChange}
          />

          <BpmControl
            value={bpm}
            minimumValue={minBpm}
            maximumValue={maxBpm}
            onValueChange={onBpmChange}
          />
        </View>

        <View
          style={{
            paddingBottom: layout.isShort ? 12 : layout.isTablet ? 24 : 20,
          }}
        >
          <View style={styles.playSection}>
            <View style={styles.tapTempoSlot} pointerEvents="box-none">
              <TapTempoButton onPress={onTapTempo} onLongPress={onTapTempoHelp} />
            </View>

            <Pressable
              style={[
                styles.playButton,
                isPlaying ? styles.stopButton : styles.startButton,
                {
                  minWidth: layout.scale(160),
                  paddingVertical: layout.scale(14, 0.1, 0.05),
                  paddingHorizontal: layout.scale(48, 0.1, 0.05),
                },
              ]}
              onPress={isPlaying ? onStop : onStart}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Stop metronome' : 'Start metronome'}
            >
              <Text style={[styles.buttonText, { fontSize: layout.scale(17) }]}>
                {isPlaying ? 'Stop' : 'Start'}
              </Text>
            </Pressable>

            <View style={styles.subdivisionSlot} pointerEvents="box-none">
              <SubdivisionCycleButton
                subdivision={subdivision}
                onSubdivisionChange={onSubdivisionChange}
                disabled={isPlaying}
              />
            </View>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.footer,
          layout.isTablet ? styles.footerTablet : styles.footerPhone,
          layout.isTablet && {
            maxWidth: layout.contentMaxWidth,
            marginBottom: layout.tabletBottomLift,
          },
          !layout.isTablet && {
            // marginHorizontal: -layout.horizontalPadding,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        <TimeSignaturePicker
          value={timeSignature}
          onValueChange={onTimeSignatureChange}
          bottomInset={insets.bottom}
        />
      </View>

      <TapTempoHintModal
        visible={tapTempoHintVisible}
        message={tapTempoHintMessage}
        onDismiss={onDismissTapTempoHint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
  },
  content: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 16,
  },
  playSection: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
  },
  tapTempoSlot: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  subdivisionSlot: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  title: {
    fontWeight: '600',
    textAlign: 'center',
  },
  playButton: {
    borderRadius: 10,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#34C759',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  footer: {
    width: '100%',
    alignSelf: 'stretch',
  },
  footerPhone: {
    alignSelf: 'stretch',
  },
  footerTablet: {
    alignSelf: 'center',
  },
});
