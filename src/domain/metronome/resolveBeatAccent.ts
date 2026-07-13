export function resolveBeatAccent(
  beatIndexInBar: number,
  accentPattern: readonly boolean[],
): boolean {
  if (accentPattern.length === 0) {
    return false;
  }

  return accentPattern[beatIndexInBar % accentPattern.length] ?? false;
}
