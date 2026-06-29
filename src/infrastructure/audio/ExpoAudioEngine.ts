import { Audio, type AVPlaybackSource } from 'expo-av';

import type { IAudioEngine } from './IAudioEngine';

const ACCENT_CLICK = require('../../../assets/audio/click_accent.wav') as AVPlaybackSource;
const NORMAL_CLICK = require('../../../assets/audio/click_normal.wav') as AVPlaybackSource;

/** Two instances per click type so rapid beats can overlap without waiting to stop. */
const POOL_SIZE = 2;

type LoadedSound = Audio.Sound;

/**
 * Temporary Expo-backed audio engine. Plays one preloaded click per call — no scheduling.
 */
export class ExpoAudioEngine implements IAudioEngine {
  private accentPool: LoadedSound[] = [];
  private normalPool: LoadedSound[] = [];
  private accentPoolIndex = 0;
  private normalPoolIndex = 0;
  private loadPromise: Promise<void> | null = null;
  private ready = false;
  private enabled = false;

  /** Preloads click sounds once. Safe to call multiple times; only the first call loads. */
  initialize(): void {
    if (this.loadPromise) {
      return;
    }

    this.loadPromise = this.preloadSounds()
      .then(() => {
        console.log('Audio engine initialized');
      })
      .catch((error) => {
        console.error('ExpoAudioEngine failed to preload click sounds', error);
      });
  }

  start(): void {
    if (this.ready) {
      this.enabled = true;
      return;
    }

    this.initialize();

    void this.loadPromise?.then(() => {
      if (this.ready) {
        this.enabled = true;
      }
    });
  }

  stop(): void {
    this.enabled = false;

    for (const sound of [...this.accentPool, ...this.normalPool]) {
      void sound.stopAsync();
    }
  }

  playAccentClick(): void {
    void this.playFromPool(this.accentPool, () => this.accentPoolIndex, (index) => {
      this.accentPoolIndex = index;
    });
  }

  playNormalClick(): void {
    void this.playFromPool(this.normalPool, () => this.normalPoolIndex, (index) => {
      this.normalPoolIndex = index;
    });
  }

  setTempo(_bpm: number): void {
    // Tempo is driven by RuntimeScheduler; reserved for future native scheduling.
  }

  whenReady(): Promise<void> {
    if (this.ready) {
      return Promise.resolve();
    }

    this.initialize();

    return this.loadPromise ?? Promise.resolve();
  }

  async warmUp(): Promise<void> {
    await this.whenReady();

    if (!this.ready) {
      return;
    }

    const accent = this.accentPool[0];
    const normal = this.normalPool[0];

    if (!accent || !normal) {
      return;
    }

    await this.playSilentOnce(accent);
    await this.playSilentOnce(normal);
  }

  async dispose(): Promise<void> {
    this.enabled = false;
    this.ready = false;

    if (this.loadPromise) {
      await this.loadPromise.catch(() => undefined);
    }

    const sounds = [...this.accentPool, ...this.normalPool];
    this.accentPool = [];
    this.normalPool = [];

    await Promise.all(sounds.map((sound) => sound.unloadAsync()));
    this.loadPromise = null;
  }

  private async preloadSounds(): Promise<void> {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    const [accentSounds, normalSounds] = await Promise.all([
      this.createSoundPool(ACCENT_CLICK),
      this.createSoundPool(NORMAL_CLICK),
    ]);

    this.accentPool = accentSounds;
    this.normalPool = normalSounds;
    this.ready = true;
  }

  private async createSoundPool(source: AVPlaybackSource): Promise<LoadedSound[]> {
    const pool = await Promise.all(
      Array.from({ length: POOL_SIZE }, () =>
        Audio.Sound.createAsync(source, { shouldPlay: false, volume: 1.0 }),
      ),
    );

    return pool.map(({ sound }) => sound);
  }

  private async playSilentOnce(sound: LoadedSound): Promise<void> {
    try {
      await sound.setVolumeAsync(0);
      await sound.setPositionAsync(0);
      await sound.playAsync();
      await sound.stopAsync();
      await sound.setPositionAsync(0);
      await sound.setVolumeAsync(1);
    } catch (error) {
      console.error('ExpoAudioEngine warm-up failed', error);

      try {
        await sound.setVolumeAsync(1);
      } catch {
        // Ignore volume restore failure after warm-up error.
      }
    }
  }

  private async playFromPool(
    pool: LoadedSound[],
    getIndex: () => number,
    setIndex: (index: number) => void,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    if (!this.ready) {
      await this.whenReady();
    }

    if (!this.ready || pool.length === 0) {
      return;
    }

    const index = getIndex();
    const sound = pool[index]!;
    setIndex((index + 1) % pool.length);

    try {
      await sound.replayAsync();
    } catch (error) {
      console.error('ExpoAudioEngine failed to play click', error);
    }
  }
}

export const expoAudioEngine = new ExpoAudioEngine();
