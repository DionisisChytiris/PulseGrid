import { StyleSheet, Text, View } from 'react-native';
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
import { TransportPlayButton } from '../components/metronome/TransportPlayButton';
import { studioColors } from '../theme';

export default function QuickMetronomeScreen() {
  const {
    bpm,
    isPlaying,
    timeSignature,
    finerSubdivision,
    subdivisionAvailability,
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
          <Text style={[styles.title, { fontSize: layout.scale(24) }]}>Pulse Grid</Text>

          <BeatIndicators onAccentPatternChange={onAccentPatternChange} />

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

            <TransportPlayButton
              isPlaying={isPlaying}
              onPress={isPlaying ? onStop : onStart}
            />

            <View style={styles.subdivisionSlot} pointerEvents="box-none">
              <SubdivisionCycleButton
                denominator={timeSignature.denominator}
                finerSubdivision={finerSubdivision}
                availability={subdivisionAvailability}
                onSubdivisionChange={onSubdivisionChange}
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
    backgroundColor: studioColors.background,
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
    color: studioColors.textPrimary,
  },
  footer: {
    width: '100%',
    alignSelf: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: studioColors.borderSubtle,
    paddingTop: 8,
  },
  footerPhone: {
    alignSelf: 'stretch',
  },
  footerTablet: {
    alignSelf: 'center',
  },
});
