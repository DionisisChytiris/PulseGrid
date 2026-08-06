import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import type {
  TempoIncreaseMode,
  TempoTrainerSettings,
} from '../../../application/services/TempoTrainerService';
import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { studioColors } from '../../theme';

const MIN_BARS = 1;
const MAX_BARS = 64;
const MIN_SECONDS = 1;
const MAX_SECONDS = 3600;
const MIN_DELTA = 1;
const MAX_DELTA = 50;
const MINUTE_PRESETS = [1, 2, 3, 4, 5] as const;

type SetupStep = 'MAIN' | 'TIME_SETTINGS' | 'BAR_SETTINGS';

type TimeSettings = {
  bpmIncrease: number;
  seconds: number;
  minutesPreset: number | null;
};

type BarSettings = {
  bpmIncrease: number;
  bars: number;
};

type PracticeTrainerPopupProps = {
  visible: boolean;
  bpm: number;
  settings: TempoTrainerSettings;
  onSettingsChange: (settings: TempoTrainerSettings) => void;
};

function minutePresetFromSeconds(seconds: number): number | null {
  if (seconds % 60 !== 0) {
    return null;
  }
  const minutes = seconds / 60;
  return MINUTE_PRESETS.includes(minutes as (typeof MINUTE_PRESETS)[number])
    ? minutes
    : null;
}

function StepperRow({
  label,
  value,
  onDecrement,
  onIncrement,
  decrementDisabled,
  incrementDisabled,
  valueLabel,
  unitLabel,
  accessibilityValueLabel,
}: {
  label: string;
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementDisabled: boolean;
  incrementDisabled: boolean;
  valueLabel?: string;
  unitLabel?: string;
  accessibilityValueLabel: string;
}) {
  const layout = useResponsiveLayout();

  return (
    <View style={styles.controlBlock}>
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
      {unitLabel ? (
        <Text style={[styles.unitLabel, { fontSize: layout.scale(12) }]}>{unitLabel}</Text>
      ) : null}
    </View>
  );
}

function ModeChoiceButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const layout = useResponsiveLayout();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.modeChoiceButton,
        selected && styles.modeChoiceSelected,
        pressed && styles.modeChoicePressed,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.modeChoiceLabel,
          { fontSize: layout.scale(14) },
          selected && styles.modeChoiceLabelSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function EnableToggleRow({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  const layout = useResponsiveLayout();

  return (
    <Pressable
      style={styles.enableRow}
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      accessibilityLabel="Enable practice trainer"
    >
      <Text style={[styles.controlLabel, { fontSize: layout.scale(13) }]}>Enable</Text>
      <View style={styles.switchHitArea}>
        <Switch
          pointerEvents="none"
          value={enabled}
          onValueChange={() => {
            /* Visual only — row / switch hit area own the toggle. */
          }}
          trackColor={{
            false: studioColors.border,
            true: studioColors.accentMutedBg,
          }}
          thumbColor={enabled ? studioColors.accent : studioColors.textMuted}
          importantForAccessibility="no"
        />
        <View
          style={styles.switchHitOverlay}
          onStartShouldSetResponder={() => true}
          onResponderRelease={onToggle}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </View>
    </Pressable>
  );
}

function SettingsScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const layout = useResponsiveLayout();

  return (
    <Pressable
      onPress={onBack}
      accessibilityRole="button"
      accessibilityLabel={`Back to Practice Trainer`}
      style={({ pressed }) => [styles.backHeader, pressed && styles.backButtonPressed]}
    >
      <Ionicons
        name="chevron-back"
        size={layout.scale(18)}
        color={studioColors.textPrimary}
      />
      <Text style={[styles.backTitle, { fontSize: layout.scale(15) }]}>{title}</Text>
    </Pressable>
  );
}

function MinutePresetRow({
  selectedMinutes,
  onSelect,
}: {
  selectedMinutes: number | null;
  onSelect: (minutes: number) => void;
}) {
  const layout = useResponsiveLayout();

  return (
    <View style={styles.controlBlock}>
      <Text style={[styles.controlLabel, { fontSize: layout.scale(13) }]}>
        Every N minutes
      </Text>
      <View style={styles.presetRow}>
        {MINUTE_PRESETS.map((minutes) => {
          const selected = selectedMinutes === minutes;
          return (
            <Pressable
              key={minutes}
              onPress={() => onSelect(minutes)}
              accessibilityRole="button"
              accessibilityLabel={`Every ${minutes} minute${minutes === 1 ? '' : 's'}`}
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.presetButton,
                selected && styles.presetButtonSelected,
                pressed && styles.modeChoicePressed,
              ]}
            >
              <Text
                style={[
                  styles.presetLabel,
                  { fontSize: layout.scale(14) },
                  selected && styles.modeChoiceLabelSelected,
                ]}
              >
                {minutes}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Floating Practice Trainer panel (rendered under the Trainer button). */
export function PracticeTrainerPopup({
  visible,
  bpm: _bpm,
  settings,
  onSettingsChange,
}: PracticeTrainerPopupProps) {
  const layout = useResponsiveLayout();
  const { width: windowWidth } = useWindowDimensions();
  const popupWidth = Math.round(windowWidth * 0.5);
  const [setupStep, setSetupStep] = useState<SetupStep>('MAIN');

  // Independent Time / Bar drafts; synced into TempoTrainerSettings on edit.
  const [timeSettings, setTimeSettings] = useState<TimeSettings>(() => ({
    bpmIncrease: settings.bpmDelta,
    seconds: settings.timeIntervalSeconds,
    minutesPreset: minutePresetFromSeconds(settings.timeIntervalSeconds),
  }));
  const [barSettings, setBarSettings] = useState<BarSettings>(() => ({
    bpmIncrease: settings.bpmDelta,
    bars: settings.barsInterval,
  }));

  useEffect(() => {
    if (!visible) {
      setSetupStep('MAIN');
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  const commit = (
    next: {
      enabled?: boolean;
      increaseMode?: TempoIncreaseMode;
      time?: TimeSettings;
      bar?: BarSettings;
    },
  ) => {
    const time = next.time ?? timeSettings;
    const bar = next.bar ?? barSettings;
    const increaseMode = next.increaseMode ?? settings.increaseMode;
    const bpmDelta =
      increaseMode === 'time' ? time.bpmIncrease : bar.bpmIncrease;

    onSettingsChange({
      ...settings,
      enabled: next.enabled ?? settings.enabled,
      increaseMode,
      bpmDelta,
      timeIntervalSeconds: time.seconds,
      barsInterval: bar.bars,
    });
  };

  const openModeSettings = (increaseMode: TempoIncreaseMode) => {
    commit({ increaseMode });
    setSetupStep(increaseMode === 'time' ? 'TIME_SETTINGS' : 'BAR_SETTINGS');
  };

  const toggleEnabled = () => {
    commit({ enabled: !settings.enabled });
  };

  const updateTime = (partial: Partial<TimeSettings>) => {
    const next: TimeSettings = {
      ...timeSettings,
      ...partial,
      minutesPreset:
        partial.minutesPreset !== undefined
          ? partial.minutesPreset
          : partial.seconds !== undefined
            ? minutePresetFromSeconds(partial.seconds)
            : timeSettings.minutesPreset,
    };
    setTimeSettings(next);
    commit({ increaseMode: 'time', time: next });
  };

  const updateBar = (partial: Partial<BarSettings>) => {
    const next: BarSettings = { ...barSettings, ...partial };
    setBarSettings(next);
    commit({ increaseMode: 'bars', bar: next });
  };

  let body: ReactNode;
  if (setupStep === 'MAIN') {
    body = (
      <>
        <Text style={[styles.title, { fontSize: layout.scale(16) }]}>Practice Trainer</Text>
        <EnableToggleRow enabled={settings.enabled} onToggle={toggleEnabled} />
        <Text style={[styles.sectionLabel, { fontSize: layout.scale(12) }]}>Increase by</Text>
        <View style={styles.modeRow}>
          <ModeChoiceButton
            label="Time"
            selected={settings.increaseMode === 'time'}
            onPress={() => openModeSettings('time')}
          />
          <ModeChoiceButton
            label="Bar"
            selected={settings.increaseMode === 'bars'}
            onPress={() => openModeSettings('bars')}
          />
        </View>
      </>
    );
  } else if (setupStep === 'TIME_SETTINGS') {
    body = (
      <>
        <SettingsScreenHeader
          title="Increase By Time"
          onBack={() => setSetupStep('MAIN')}
        />
        <StepperRow
          label="Increase BPM by"
          value={timeSettings.bpmIncrease}
          accessibilityValueLabel="BPM increase"
          onDecrement={() => updateTime({ bpmIncrease: timeSettings.bpmIncrease - 1 })}
          onIncrement={() => updateTime({ bpmIncrease: timeSettings.bpmIncrease + 1 })}
          decrementDisabled={timeSettings.bpmIncrease <= MIN_DELTA}
          incrementDisabled={timeSettings.bpmIncrease >= MAX_DELTA}
        />
        <StepperRow
          label="Time interval"
          value={timeSettings.seconds}
          unitLabel="seconds"
          accessibilityValueLabel="seconds interval"
          onDecrement={() => updateTime({ seconds: timeSettings.seconds - 1 })}
          onIncrement={() => updateTime({ seconds: timeSettings.seconds + 1 })}
          decrementDisabled={timeSettings.seconds <= MIN_SECONDS}
          incrementDisabled={timeSettings.seconds >= MAX_SECONDS}
        />
        <MinutePresetRow
          selectedMinutes={timeSettings.minutesPreset}
          onSelect={(minutes) =>
            updateTime({ seconds: minutes * 60, minutesPreset: minutes })
          }
        />
      </>
    );
  } else {
    body = (
      <>
        <SettingsScreenHeader
          title="Increase By Bar"
          onBack={() => setSetupStep('MAIN')}
        />
        <StepperRow
          label="Increase BPM by"
          value={barSettings.bpmIncrease}
          accessibilityValueLabel="BPM increase"
          onDecrement={() => updateBar({ bpmIncrease: barSettings.bpmIncrease - 1 })}
          onIncrement={() => updateBar({ bpmIncrease: barSettings.bpmIncrease + 1 })}
          decrementDisabled={barSettings.bpmIncrease <= MIN_DELTA}
          incrementDisabled={barSettings.bpmIncrease >= MAX_DELTA}
        />
        <StepperRow
          label="Every N bars"
          value={barSettings.bars}
          accessibilityValueLabel="bars interval"
          onDecrement={() => updateBar({ bars: barSettings.bars - 1 })}
          onIncrement={() => updateBar({ bars: barSettings.bars + 1 })}
          decrementDisabled={barSettings.bars <= MIN_BARS}
          incrementDisabled={barSettings.bars >= MAX_BARS}
        />
      </>
    );
  }

  return (
    <View style={[styles.popup, { width: popupWidth, top: layout.scale(40) }]}>
      <View style={styles.card}>{body}</View>
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
    gap: 12,
  },
  title: {
    fontWeight: '600',
    color: studioColors.textPrimary,
  },
  sectionLabel: {
    color: studioColors.textMuted,
    fontWeight: '600',
  },
  enableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 36,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    paddingVertical: 2,
    marginLeft: -4,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backTitle: {
    fontWeight: '600',
    color: studioColors.textPrimary,
  },
  modeChoiceButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    backgroundColor: studioColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  modeChoiceSelected: {
    borderColor: studioColors.accent,
    backgroundColor: studioColors.accentMutedBg,
  },
  modeChoicePressed: {
    opacity: 0.8,
  },
  modeChoiceLabel: {
    fontWeight: '600',
    color: studioColors.textPrimary,
    textAlign: 'center',
    flexShrink: 0,
  },
  modeChoiceLabelSelected: {
    color: studioColors.accent,
  },
  controlBlock: {
    gap: 8,
  },
  controlLabel: {
    color: studioColors.textSecondary,
    fontWeight: '600',
  },
  unitLabel: {
    color: studioColors.textMuted,
    fontWeight: '500',
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
    minWidth: 36,
    textAlign: 'center',
    color: studioColors.textPrimary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
  },
  presetButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    backgroundColor: studioColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetButtonSelected: {
    borderColor: studioColors.accent,
    backgroundColor: studioColors.accentMutedBg,
  },
  presetLabel: {
    fontWeight: '600',
    color: studioColors.textPrimary,
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
