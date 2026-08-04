import { useMemo, useSyncExternalStore } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { TempoTrainerSettings } from '../../../application/services/TempoTrainerService';
import { tempoTrainerService } from '../../../application/services/tempoTrainerServiceInstance';
import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { studioColors } from '../../theme';

const MIN_BARS = 1;
const MAX_BARS = 64;
const MIN_DELTA = 1;
const MAX_DELTA = 50;
const MIN_MAX_BPM = 40;
const MAX_MAX_BPM = 600;

type PracticeTrainerPopupProps = {
  visible: boolean;
  bpm: number;
  settings: TempoTrainerSettings;
  onSettingsChange: (settings: TempoTrainerSettings) => void;
};

function StepperRow({
  label,
  value,
  onDecrement,
  onIncrement,
  decrementDisabled,
  incrementDisabled,
  valueLabel,
  accessibilityValueLabel,
}: {
  label: string;
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementDisabled: boolean;
  incrementDisabled: boolean;
  valueLabel?: string;
  accessibilityValueLabel: string;
}) {
  const layout = useResponsiveLayout();

  return (
    <View style={styles.controlRow}>
      <Text style={[styles.controlLabel, { fontSize: layout.scale(13) }]}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable
          onPress={onDecrement}
          disabled={decrementDisabled}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${accessibilityValueLabel}`}
          style={({ pressed }) => [
            styles.stepperButton,
            pressed && styles.stepperPressed,
            decrementDisabled && styles.stepperDisabled,
          ]}
        >
          <Ionicons name="remove" size={layout.scale(16)} color={studioColors.textPrimary} />
        </Pressable>
        <Text style={[styles.stepperValue, { fontSize: layout.scale(15) }]}>
          {valueLabel ?? String(value)}
        </Text>
        <Pressable
          onPress={onIncrement}
          disabled={incrementDisabled}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${accessibilityValueLabel}`}
          style={({ pressed }) => [
            styles.stepperButton,
            pressed && styles.stepperPressed,
            incrementDisabled && styles.stepperDisabled,
          ]}
        >
          <Ionicons name="add" size={layout.scale(16)} color={studioColors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

/** Floating Practice Trainer panel (rendered under the Trainer button). */
export function PracticeTrainerPopup({
  visible,
  bpm,
  settings,
  onSettingsChange,
}: PracticeTrainerPopupProps) {
  const layout = useResponsiveLayout();
  const { width: windowWidth } = useWindowDimensions();
  const popupWidth = Math.round(windowWidth * 0.5);

  const status = useSyncExternalStore(
    (listener) => tempoTrainerService.subscribe(listener),
    () => tempoTrainerService.getStatus(),
    () => tempoTrainerService.getStatus(),
  );

  if (!visible) {
    return null;
  }

  const update = (partial: Partial<TempoTrainerSettings>) => {
    onSettingsChange({ ...settings, ...partial });
  };

  const toggleEnabled = () => {
    update({ enabled: !settings.enabled });
  };

  return (
    <View style={[styles.popup, { width: popupWidth, top: layout.scale(40) }]}>
      <View style={styles.card}>
        <Text style={[styles.title, { fontSize: layout.scale(16) }]}>Practice Trainer</Text>

        <Pressable
          style={styles.controlRow}
          onPress={toggleEnabled}
          accessibilityRole="switch"
          accessibilityState={{ checked: settings.enabled }}
          accessibilityLabel="Enable practice trainer"
        >
          <Text style={[styles.controlLabel, { fontSize: layout.scale(13) }]}>Enable</Text>
          {/* Overlay captures Switch thumb taps; native Switch still swallows hits despite pointerEvents="none". */}
          <View style={styles.switchHitArea}>
            <Switch
              pointerEvents="none"
              value={settings.enabled}
              onValueChange={() => {
                /* Visual only — row / switch hit area own the toggle. */
              }}
              trackColor={{
                false: studioColors.border,
                true: studioColors.accentMutedBg,
              }}
              thumbColor={settings.enabled ? studioColors.accent : studioColors.textMuted}
              importantForAccessibility="no"
            />
            <View
              style={styles.switchHitOverlay}
              onStartShouldSetResponder={() => true}
              onResponderRelease={toggleEnabled}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          </View>
        </Pressable>

        <StepperRow
          label="Every N bars"
          value={settings.barsInterval}
          accessibilityValueLabel="bars interval"
          onDecrement={() => update({ barsInterval: settings.barsInterval - 1 })}
          onIncrement={() => update({ barsInterval: settings.barsInterval + 1 })}
          decrementDisabled={settings.barsInterval <= MIN_BARS}
          incrementDisabled={settings.barsInterval >= MAX_BARS}
        />

        <StepperRow
          label="Increase by"
          value={settings.bpmDelta}
          valueLabel={`+${settings.bpmDelta}`}
          accessibilityValueLabel="BPM increase"
          onDecrement={() => update({ bpmDelta: settings.bpmDelta - 1 })}
          onIncrement={() => update({ bpmDelta: settings.bpmDelta + 1 })}
          decrementDisabled={settings.bpmDelta <= MIN_DELTA}
          incrementDisabled={settings.bpmDelta >= MAX_DELTA}
        />

        <StepperRow
          label="Maximum BPM"
          value={settings.maxBpm}
          accessibilityValueLabel="maximum BPM"
          onDecrement={() => update({ maxBpm: settings.maxBpm - 1 })}
          onIncrement={() => update({ maxBpm: settings.maxBpm + 1 })}
          decrementDisabled={settings.maxBpm <= MIN_MAX_BPM}
          incrementDisabled={settings.maxBpm >= MAX_MAX_BPM}
        />

        <View style={styles.statusBlock}>
          <Text style={[styles.statusLine, { fontSize: layout.scale(12) }]}>
            Current BPM: {Math.round(bpm)}
          </Text>
          <Text style={[styles.statusLine, { fontSize: layout.scale(12) }]}>
            Next increase: {status.barsTowardNext} / {status.barsInterval} bars
          </Text>
        </View>
      </View>
    </View>
  );
}

type PracticeTrainerButtonProps = {
  isActive: boolean;
  trainerEnabled: boolean;
  onPress: () => void;
};

export function PracticeTrainerButton({
  isActive,
  trainerEnabled,
  onPress,
}: PracticeTrainerButtonProps) {
  const layout = useResponsiveLayout();
  const metrics = useMemo(
    () => ({
      fontSize: layout.scale(16),
      iconSize: layout.scale(18, 0.05, 0.05),
    }),
    [layout],
  );

  return (
    <Pressable
      style={[styles.button, (isActive || trainerEnabled) && styles.buttonArmed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Practice trainer"
      accessibilityState={{ expanded: isActive, selected: trainerEnabled }}
    >
      <Ionicons
        name="trending-up"
        size={metrics.iconSize}
        color={trainerEnabled ? studioColors.accent : studioColors.textMuted}
      />
      <Text
        style={[
          styles.buttonLabel,
          { fontSize: metrics.fontSize },
          trainerEnabled && styles.buttonLabelActive,
        ]}
      >
        Trainer
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  popup: {
    position: 'absolute',
    left: 0,
    alignSelf: 'flex-start',
    zIndex: 31,
    elevation: 31,
  },
  card: {
    backgroundColor: studioColors.surfaceElevated,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 10,
  },
  title: {
    fontWeight: '600',
    color: studioColors.textPrimary,
    marginBottom: 2,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 36,
  },
  controlLabel: {
    flexShrink: 1,
    color: studioColors.textSecondary,
    fontWeight: '600',
  },
  switchHitArea: {
    position: 'relative',
    justifyContent: 'center',
  },
  switchHitOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: studioColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
  },
  stepperPressed: {
    opacity: 0.75,
  },
  stepperDisabled: {
    opacity: 0.4,
  },
  stepperValue: {
    minWidth: 28,
    textAlign: 'center',
    color: studioColors.textPrimary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  statusBlock: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: studioColors.borderSubtle,
    gap: 4,
  },
  statusLine: {
    color: studioColors.textMuted,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  buttonArmed: {
    backgroundColor: studioColors.surfaceElevated,
  },
  buttonLabel: {
    fontWeight: '600',
    color: studioColors.textMuted,
  },
  buttonLabelActive: {
    color: studioColors.accent,
  },
});
