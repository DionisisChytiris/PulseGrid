/**
 * Approximate height reserved for a bottom-docked CustomKeyboard (numbers layout).
 * Used by editors that shrink their sheet above the keyboard.
 */
export function estimateCustomKeyboardBottomHeight(bottomInset: number): number {
  const keyRows = 4;
  const keyHeight = 56;
  const rowGaps = 5 * (keyRows - 1);
  const paddingTop = 8;
  const paddingBottom = Math.max(bottomInset, 8);
  return paddingTop + keyRows * keyHeight + rowGaps + paddingBottom;
}

/** Landscape side-dock width (matches CustomKeyboard). */
export function estimateCustomKeyboardRightWidth(screenWidth: number): number {
  return Math.min(560, Math.max(300, Math.round(screenWidth * 0.45)));
}
