/**
 * Shared song-name rules for create / rename / edit.
 * Keep domain-side (no React) so mutations, repository, and UI share one path.
 */

export const MAX_SONG_NAME_LENGTH = 18;
export const DEFAULT_SONG_NAME = 'New Song';

const INVALID_SONG_NAME_CHARS = /[^A-Za-z0-9 ]/g;

/**
 * Live typing / paste filter: strip invalid characters, collapse spaces,
 * cap length. Allows an empty draft and a single trailing space so the user
 * can type the next word. Does not substitute {@link DEFAULT_SONG_NAME}.
 */
export function sanitizeSongNameInput(text: string): string {
  const withoutInvalid = text.replace(INVALID_SONG_NAME_CHARS, '');
  const collapsed = withoutInvalid.replace(/ {2,}/g, ' ').replace(/^ +/, '');
  return collapsed.slice(0, MAX_SONG_NAME_LENGTH);
}

/**
 * Canonical song-name sanitizer for create / rename / save.
 * - Removes invalid characters (letters, digits, spaces only)
 * - Collapses consecutive spaces
 * - Trims ends
 * - Caps at {@link MAX_SONG_NAME_LENGTH}
 * - Returns {@link DEFAULT_SONG_NAME} when empty or whitespace-only
 */
export function sanitizeSongName(text: string): string {
  const cleaned = text
    .replace(INVALID_SONG_NAME_CHARS, '')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, MAX_SONG_NAME_LENGTH);

  if (cleaned.length === 0 || !/[A-Za-z0-9]/.test(cleaned)) {
    return DEFAULT_SONG_NAME;
  }

  return cleaned;
}
