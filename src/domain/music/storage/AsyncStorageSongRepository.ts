import AsyncStorage from '@react-native-async-storage/async-storage';

import { downbeatAccentPattern } from '../AccentPattern';
import { createBar } from '../Bar';
import { createDemoTimelineSong } from '../fixtures/demoTimelineSong';
import { createMeter } from '../Meter';
import { createSectionWithBars } from '../Section';
import { createSong, type Song } from '../Song';
import { cloneSong } from '../SongUtils';

import { generateEntityId } from './generateEntityId';
import { parseStoredSongs, serializeStoredSongs } from './songSerialization';
import type { CreateStoredSongInput, SongRepository } from './SongRepository';

const STORAGE_KEY = 'pulsegrid:songs:v1';

export class AsyncStorageSongRepository implements SongRepository {
  private seeded = false;

  private async readAll(): Promise<Song[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    if (raw === null || raw === '') {
      return [];
    }

    return parseStoredSongs(raw);
  }

  private async writeAll(songs: readonly Song[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, serializeStoredSongs(songs));
  }

  /** Seeds the demo song once when storage is empty (fallback starter content). */
  async ensureDemoFallback(): Promise<void> {
    if (this.seeded) {
      return;
    }

    const existing = await this.readAll();
    if (existing.length > 0) {
      this.seeded = true;
      return;
    }

    const demo = createDemoTimelineSong();
    await this.writeAll([demo]);
    this.seeded = true;
  }

  async createSong(input: CreateStoredSongInput): Promise<Song> {
    const name = input.name.trim() || 'Untitled Song';
    const song = createSong({
      id: generateEntityId('song'),
      name,
      sections: [
        createSectionWithBars('main', 'Main', [
          {
            id: generateEntityId('bar'),
            meter: createMeter(4, 4),
            accentPattern: downbeatAccentPattern(4),
          },
        ]),
      ],
    });

    const songs = await this.readAll();
    songs.push(song);
    await this.writeAll(songs);
    return cloneSong(song);
  }

  async updateSong(song: Song): Promise<Song> {
    const songs = await this.readAll();
    const index = songs.findIndex((candidate) => candidate.id === song.id);

    if (index < 0) {
      throw new Error(`Song not found: ${song.id}`);
    }

    const updated: Song = {
      ...cloneSong(song),
      updatedAt: Date.now(),
    };

    songs[index] = updated;
    await this.writeAll(songs);
    return cloneSong(updated);
  }

  async deleteSong(id: string): Promise<void> {
    const songs = await this.readAll();
    const next = songs.filter((song) => song.id !== id);
    await this.writeAll(next);
  }

  async getSongById(id: string): Promise<Song | null> {
    const songs = await this.readAll();
    const found = songs.find((song) => song.id === id);
    return found === undefined ? null : cloneSong(found);
  }

  async getAllSongs(): Promise<Song[]> {
    await this.ensureDemoFallback();
    const songs = await this.readAll();
    return songs
      .map(cloneSong)
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }
}

export const songRepository: SongRepository = new AsyncStorageSongRepository();
