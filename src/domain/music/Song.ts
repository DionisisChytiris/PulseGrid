import { createSection, type Section } from './Section';

export interface Song {
  readonly id: string;
  readonly name: string;
  readonly sections: readonly Section[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

export type CreateSongInput = {
  id: string;
  name: string;
  sections?: readonly Section[];
  createdAt?: number;
  updatedAt?: number;
};

export function createSong(input: CreateSongInput): Song {
  const now = Date.now();

  return {
    id: input.id,
    name: input.name,
    sections: input.sections ?? [],
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}
