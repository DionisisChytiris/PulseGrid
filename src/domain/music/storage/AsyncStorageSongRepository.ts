import AsyncStorage from '@react-native-async-storage/async-storage';

import { downbeatAccentPattern } from '../AccentPattern';
import { createDemoTimelineSong } from '../fixtures/demoTimelineSong';
import { createMeter } from '../Meter';
import { createSectionWithBars } from '../Section';
import { createSong, type Song } from '../Song';
import { cloneSong } from '../SongUtils';

import { generateEntityId } from './generateEntityId';
import { parseStoredSongs, serializeStoredSongs } from './songSerialization';
import type { CreateStoredSongInput, SongRepository } from './SongRepository';

const STORAGE_KEY = 'pulsegrid:songs:v1';
/** Last-resort copy of a payload that was not valid JSON / not an array. */
const UNREADABLE_BACKUP_KEY = 'pulsegrid:songs:v1:unreadable';

export class AsyncStorageSongRepository implements SongRepository {
  private seeded = false;
  /**
   * Unparseable JSON entries from the last read. Re-appended on write so a
   * later create/update/delete cannot permanently drop a timeline the current
   * parser could not recover.
   */
  private skippedEntries: unknown[] = [];
  /** True when the stored blob is invalid JSON or not an array. */
  private payloadUnreadable = false;
  private unreadableRaw: string | null = null;
  /**
   * Serializes all storage operations (including reads that participate in
   * read-modify-write) so overlapping create/update/delete cannot apply stale
   * snapshots. Continues after a failed task so one error does not stall the queue.
   */
  private chain: Promise<void> = Promise.resolve();

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.chain.then(operation, operation);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async readAll(): Promise<Song[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    this.skippedEntries = [];
    this.payloadUnreadable = false;
    this.unreadableRaw = null;

    if (raw === null || raw === '') {
      return [];
    }

    const parsed = parseStoredSongs(raw);
    this.skippedEntries = [...parsed.skipped];
    this.payloadUnreadable = parsed.unreadable;
    this.unreadableRaw = parsed.unreadable ? raw : null;
    return parsed.songs;
  }

  private async writeAll(songs: readonly Song[]): Promise<void> {
    if (this.unreadableRaw !== null) {
      await AsyncStorage.setItem(UNREADABLE_BACKUP_KEY, this.unreadableRaw);
      this.unreadableRaw = null;
      this.payloadUnreadable = false;
    }

    await AsyncStorage.setItem(
      STORAGE_KEY,
      serializeStoredSongs(songs, this.skippedEntries),
    );
  }

  private async ensureDemoFallbackLocked(): Promise<void> {
    if (this.seeded) {
      return;
    }

    const existing = await this.readAll();
    // Corrupt or partially unreadable payloads are not "empty storage".
    if (
      existing.length > 0 ||
      this.payloadUnreadable ||
      this.skippedEntries.length > 0
    ) {
      this.seeded = true;
      return;
    }

    const demo = createDemoTimelineSong();
    await this.writeAll([demo]);
    this.seeded = true;
  }

  /** Seeds the demo song once when storage is empty (fallback starter content). */
  async ensureDemoFallback(): Promise<void> {
    return this.enqueue(() => this.ensureDemoFallbackLocked());
  }

  async createSong(input: CreateStoredSongInput): Promise<Song> {
    return this.enqueue(() => this.createSongLocked(input));
  }

  async updateSong(song: Song): Promise<Song> {
    return this.enqueue(() => this.updateSongLocked(song));
  }

  async deleteSong(id: string): Promise<void> {
    return this.enqueue(() => this.deleteSongLocked(id));
  }

  async getSongById(id: string): Promise<Song | null> {
    return this.enqueue(() => this.getSongByIdLocked(id));
  }

  async getAllSongs(): Promise<Song[]> {
    return this.enqueue(() => this.getAllSongsLocked());
  }

  private async createSongLocked(input: CreateStoredSongInput): Promise<Song> {
    const song = createSong({
      id: generateEntityId('song'),
      name: input.name,
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

  private async updateSongLocked(song: Song): Promise<Song> {
    const songs = await this.readAll();
    const index = songs.findIndex((candidate) => candidate.id === song.id);

    if (index < 0) {
      throw new Error(`Timeline not found: ${song.id}`);
    }

    const updated: Song = {
      ...cloneSong(song),
      updatedAt: Date.now(),
    };

    songs[index] = updated;
    await this.writeAll(songs);
    return cloneSong(updated);
  }

  private async deleteSongLocked(id: string): Promise<void> {
    const songs = await this.readAll();
    const next = songs.filter((song) => song.id !== id);
    await this.writeAll(next);
  }

  private async getSongByIdLocked(id: string): Promise<Song | null> {
    const songs = await this.readAll();
    const found = songs.find((song) => song.id === id);
    return found === undefined ? null : cloneSong(found);
  }

  private async getAllSongsLocked(): Promise<Song[]> {
    await this.ensureDemoFallbackLocked();
    const songs = await this.readAll();
    return songs
      .map(cloneSong)
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }
}

export const songRepository: SongRepository = new AsyncStorageSongRepository();
