/**
 * Shared song/segment BPM bounds — same integers as Quick Metronome.
 * Keep domain-side (no React imports) so mutations and serialization can reuse them.
 */
export const DEFAULT_SONG_BPM = 120;
export const MIN_SONG_BPM = 30;
export const MAX_SONG_BPM = 600;

export function clampSongBpm(value: number): number {
  const rounded = Math.round(value);
  return Math.min(MAX_SONG_BPM, Math.max(MIN_SONG_BPM, rounded));
}

/**
 * Digits-only draft text while typing. Caps above MAX only — does not lift below MIN
 * so values like "9" can become "95".
 */
export function sanitizeSongBpmInput(text: string): string {
  const digitsOnly = text.replace(/[^\d]/g, '').slice(0, 3);
  if (digitsOnly.length === 0) {
    return '';
  }

  const asNumber = Number(digitsOnly);
  if (!Number.isInteger(asNumber)) {
    return '';
  }

  if (asNumber > MAX_SONG_BPM) {
    return String(MAX_SONG_BPM);
  }

  return digitsOnly;
}

/** Parsed BPM in [MIN, MAX], or null if empty / not a complete in-range integer. */
export function parseSongBpmText(text: string): number | null {
  if (!/^\d+$/.test(text)) {
    return null;
  }
  const value = Number(text);
  if (!Number.isInteger(value) || value < MIN_SONG_BPM || value > MAX_SONG_BPM) {
    return null;
  }
  return value;
}

/** Commit helper: empty/invalid → null; out-of-range integers are clamped. */
export function parseSongBpmTextLenient(text: string): number | null {
  if (!/^\d+$/.test(text)) {
    return null;
  }
  const value = Number(text);
  if (!Number.isInteger(value)) {
    return null;
  }
  return clampSongBpm(value);
}
