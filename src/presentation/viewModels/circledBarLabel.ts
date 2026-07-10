/** Circled digit labels ①–⑳; falls back to plain number for bar 21+. */
export function circledBarLabel(barNumber: number): string {
  if (barNumber >= 1 && barNumber <= 20) {
    return String.fromCharCode(0x2460 + barNumber - 1);
  }

  return String(barNumber);
}
