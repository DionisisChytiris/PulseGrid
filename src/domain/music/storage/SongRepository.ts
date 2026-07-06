import type { Song } from '../Song';

export type CreateStoredSongInput = {
  readonly name: string;
};

export interface SongRepository {
  createSong(input: CreateStoredSongInput): Promise<Song>;
  updateSong(song: Song): Promise<Song>;
  deleteSong(id: string): Promise<void>;
  getSongById(id: string): Promise<Song | null>;
  getAllSongs(): Promise<Song[]>;
}
