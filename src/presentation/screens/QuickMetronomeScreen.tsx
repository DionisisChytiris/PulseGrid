import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuickMetronome } from '../hooks/useQuickMetronome';
import { useResponsiveLayout } from '../layout/useResponsiveLayout';
import { MetronomeDialSection } from '../components/metronome/MetronomeDialSection';
import { QuickMetronomeTopBar } from '../components/metronome/QuickMetronomeTopBar';
import { TapTempoHintModal } from '../components/metronome/TapTempoHintModal';
import { TempoAdjustedSnackbar } from '../components/metronome/TempoAdjustedSnackbar';
import { TimeSignaturePicker } from '../components/metronome/TimeSignaturePicker';
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
    tempoClampMessage,
    onDismissTempoClampMessage,
    trainerPopupVisible,
    trainerSettings,
    onTrainerPress,
    onTrainerPopupClose,
    onTrainerSettingsChange,
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
      {/* Backdrop must be a sibling under the top bar host (not an ancestor overlay). */}
      {trainerPopupVisible ? (
        <Pressable
          style={styles.trainerBackdrop}
          onPress={onTrainerPopupClose}
          accessibilityRole="button"
          accessibilityLabel="Close practice trainer"
        />
      ) : null}

      {/* Raised above backdrop so Trainer button + popup receive touches. */}
      <View
        style={[
          styles.topBarHost,
          { maxWidth: layout.contentMaxWidth },
          trainerPopupVisible && styles.topBarHostRaised,
        ]}
        pointerEvents="box-none"
      >
        <QuickMetronomeTopBar
          isPlaying={isPlaying}
          bpm={bpm}
          trainerSettings={trainerSettings}
          trainerPopupVisible={trainerPopupVisible}
          onTrainerPress={onTrainerPress}
          onTrainerSettingsChange={onTrainerSettingsChange}
        />
      </View>

      <View style={[styles.inner, { maxWidth: layout.contentMaxWidth }]}>
        <View style={[styles.content, { gap: layout.sectionGap }]}>
          <Text style={[styles.title, { fontSize: layout.scale(24) }]}>Pulse Grid</Text>

          <MetronomeDialSection
            bpm={bpm}
            minimumValue={minBpm}
            maximumValue={maxBpm}
            isPlaying={isPlaying}
            denominator={timeSignature.denominator}
            finerSubdivision={finerSubdivision}
            subdivisionAvailability={subdivisionAvailability}
            onBpmChange={onBpmChange}
            onStart={onStart}
            onStop={onStop}
            onTapTempo={onTapTempo}
            onTapTempoHelp={onTapTempoHelp}
            onSubdivisionChange={onSubdivisionChange}
            onAccentPatternChange={onAccentPatternChange}
          />
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

      <TempoAdjustedSnackbar
        visible={tempoClampMessage !== null}
        message={tempoClampMessage ?? ''}
        onHide={onDismissTempoClampMessage}
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
  trainerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
  },
  topBarHost: {
    width: '100%',
    zIndex: 1,
  },
  topBarHostRaised: {
    zIndex: 30,
    elevation: 30,
  },
  inner: {
    flex: 1,
    width: '100%',
  },
  content: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    minHeight: 0,
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
