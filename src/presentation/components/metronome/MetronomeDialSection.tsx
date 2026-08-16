import { StyleSheet, View } from 'react-native';

import type { FinerSubdivisionSelection, SubdivisionAvailability } from '../../../domain/metronome/PulseGridSettings';
import { BpmControl } from './BpmControl';
import { MetronomeToolbar } from './MetronomeToolbar';
import { VolumeButton } from './VolumeButton';
import { VolumePopover } from './VolumePopover';

type MetronomeDialSectionProps = {
  bpm: number;
  minimumValue: number;
  maximumValue: number;
  isPlaying: boolean;
  denominator: number;
  finerSubdivision: FinerSubdivisionSelection;
  subdivisionAvailability: SubdivisionAvailability;
  onBpmChange: (value: number) => void;
  onStart: () => void;
  onStop: () => void;
  onTapTempo: () => void;
  onTapTempoHelp: () => void;
  onSubdivisionChange: (subdivision: FinerSubdivisionSelection) => void;
  onAccentPatternChange: (pattern: boolean[]) => void;
  volumeOpen: boolean;
  onVolumeOpenChange: (open: boolean) => void;
};

export function MetronomeDialSection({
  bpm,
  minimumValue,
  maximumValue,
  isPlaying,
  denominator,
  finerSubdivision,
  subdivisionAvailability,
  onBpmChange,
  onStart,
  onStop,
  onTapTempo,
  onTapTempoHelp,
  onSubdivisionChange,
  onAccentPatternChange,
  volumeOpen,
  onVolumeOpenChange,
}: MetronomeDialSectionProps) {
  return (
    <View style={styles.section} pointerEvents="box-none">
      <View style={styles.dialArea} pointerEvents={volumeOpen ? 'none' : 'auto'}>
        <BpmControl
          value={bpm}
          minimumValue={minimumValue}
          maximumValue={maximumValue}
          onValueChange={onBpmChange}
          isPlaying={isPlaying}
          onTransportPress={isPlaying ? onStop : onStart}
          onAccentPatternChange={onAccentPatternChange}
        />
      </View>

      <View pointerEvents={volumeOpen ? 'none' : 'auto'} style={styles.toolbarHost}>
        <MetronomeToolbar
          bpm={bpm}
          minimumValue={minimumValue}
          maximumValue={maximumValue}
          denominator={denominator}
          finerSubdivision={finerSubdivision}
          subdivisionAvailability={subdivisionAvailability}
          onBpmChange={onBpmChange}
          onTapTempo={onTapTempo}
          onTapTempoHelp={onTapTempoHelp}
          onSubdivisionChange={onSubdivisionChange}
        />
      </View>

      <View style={styles.volumeSlot} pointerEvents="box-none">
        <VolumeButton
          isOpen={volumeOpen}
          onPress={() => onVolumeOpenChange(!volumeOpen)}
        />
        {volumeOpen ? <VolumePopover /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    minHeight: 0,
  },
  dialArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 0,
    overflow: 'visible',
  },
  toolbarHost: {
    width: '100%',
  },
  volumeSlot: {
    position: 'absolute',
    top: -30,
    left: 0,
    zIndex: 4,
    elevation: 24,
    overflow: 'visible',
  },
});
