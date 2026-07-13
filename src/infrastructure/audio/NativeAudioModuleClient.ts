import { Platform } from 'react-native';

import type { NativeAudioStartOptions } from 'native-audio';

export type MetronomeStartOptions = NativeAudioStartOptions;

export type NativeTickEvent = {
  sequence: number;
  beatIndex: number;
  beatNumber: number;
  beatsPerMeasure: number;
  subdivisionIndex: number;
  isAccent: boolean;
  timestamp: number;
};

export type NativeAudioModuleSpec = {
  initialize?(): void;
  whenReady?(): Promise<void>;
  areSoundsReady?(): boolean;
  start(options: MetronomeStartOptions): void;
  stop(): void;
  setTempo(bpm: number): void;
  setAccentPattern(accentPattern: boolean[]): void;
  setSubdivision(subdivision: string): void;
  setNormalClickSound?(soundId: string): void;
  setAccentClickSound?(soundId: string): void;
  setSubdivisionClickSound?(soundId: string): void;
  setSubdivisionAccentMode?(mode: string): void;
  setSubdivisionAccentEveryNth?(value: number): void;
  setSubdivisionAccentPattern?(pattern: boolean[]): void;
  previewNormalClick?(): void;
  previewAccentClick?(): void;
  previewSubdivisionClick?(): void;
  addListener?(
    eventName: 'onTick',
    listener: (event: NativeTickEvent) => void,
  ): { remove: () => void };
};

let cachedModule: NativeAudioModuleSpec | null | undefined;

/** Exactly one native onTick subscription; fan-out to JS listeners. */
let nativeTickSubscription: { remove: () => void } | null = null;
const tickListeners = new Set<(event: NativeTickEvent) => void>();

const noopModule: NativeAudioModuleSpec = {
  start() {},
  stop() {},
  setTempo() {},
  setAccentPattern() {},
  setSubdivision() {},
  setNormalClickSound() {},
  setAccentClickSound() {},
  setSubdivisionClickSound() {},
  setSubdivisionAccentMode() {},
  setSubdivisionAccentEveryNth() {},
  setSubdivisionAccentPattern() {},
  previewNormalClick() {},
  previewAccentClick() {},
  previewSubdivisionClick() {},
};

export function isNativeAudioModuleAvailable(): boolean {
  return loadNativeAudioModule() !== null;
}

function loadNativeAudioModule(): NativeAudioModuleSpec | null {
  if (cachedModule !== undefined) {
    return cachedModule;
  }

  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    cachedModule = null;
    return cachedModule;
  }

  try {
    const { requireNativeModule } = require('expo') as typeof import('expo');
    cachedModule = requireNativeModule<NativeAudioModuleSpec>('NativeAudioModule');
    return cachedModule;
  } catch (error) {
    console.warn(
      'NativeAudioModule is not linked in this build. Run `npx expo prebuild` then `npx expo run:android` or `npx expo run:ios`. Falling back to JS scheduler.',
      error,
    );
    cachedModule = null;
    return cachedModule;
  }
}

function getModule(): NativeAudioModuleSpec {
  return loadNativeAudioModule() ?? noopModule;
}

function ensureNativeTickSubscription(): void {
  if (nativeTickSubscription) {
    return;
  }

  const module = getModule();
  if (!module.addListener) {
    return;
  }

  nativeTickSubscription = module.addListener('onTick', (event) => {
    for (const listener of tickListeners) {
      listener(event);
    }
  });
}

function releaseNativeTickSubscriptionIfIdle(): void {
  if (tickListeners.size > 0 || !nativeTickSubscription) {
    return;
  }

  nativeTickSubscription.remove();
  nativeTickSubscription = null;
}

const SOUND_READY_TIMEOUT_MS = 3000;
const SOUND_READY_POLL_MS = 10;

async function waitForSoundsReady(): Promise<void> {
  const module = getModule();
  module.initialize?.();

  if (!module.areSoundsReady) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 150);
    });
    return;
  }

  const deadline = Date.now() + SOUND_READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (module.areSoundsReady()) {
      return;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, SOUND_READY_POLL_MS);
    });
  }

  console.warn('[PulseGrid-Audio] whenReady() timed out waiting for click samples');
}

const NativeAudioModuleClient: NativeAudioModuleSpec = {
  initialize: () => {
    getModule().initialize?.();
  },
  whenReady: async () => {
    await waitForSoundsReady();
  },
  start: (options) => {
    getModule().start(options);
  },
  stop: () => {
    getModule().stop();
  },
  setTempo: (bpm) => {
    getModule().setTempo(bpm);
  },
  setAccentPattern: (accentPattern) => {
    getModule().setAccentPattern(accentPattern);
  },
  setSubdivision: (subdivision) => {
    getModule().setSubdivision(subdivision);
  },
  setNormalClickSound: (soundId) => {
    getModule().setNormalClickSound?.(soundId);
  },
  setAccentClickSound: (soundId) => {
    getModule().setAccentClickSound?.(soundId);
  },
  setSubdivisionClickSound: (soundId) => {
    getModule().setSubdivisionClickSound?.(soundId);
  },
  setSubdivisionAccentMode: (mode) => {
    getModule().setSubdivisionAccentMode?.(mode);
  },
  setSubdivisionAccentEveryNth: (value) => {
    getModule().setSubdivisionAccentEveryNth?.(value);
  },
  setSubdivisionAccentPattern: (pattern) => {
    getModule().setSubdivisionAccentPattern?.(pattern);
  },
  previewNormalClick: () => {
    getModule().previewNormalClick?.();
  },
  previewAccentClick: () => {
    getModule().previewAccentClick?.();
  },
  previewSubdivisionClick: () => {
    getModule().previewSubdivisionClick?.();
  },
  addListener: (eventName, listener) => {
    if (eventName === 'onTick') {
      ensureNativeTickSubscription();
      tickListeners.add(listener as (event: NativeTickEvent) => void);

      return {
        remove: () => {
          tickListeners.delete(listener as (event: NativeTickEvent) => void);
          releaseNativeTickSubscriptionIfIdle();
        },
      };
    }

    return { remove: () => undefined };
  },
};

export default NativeAudioModuleClient;
