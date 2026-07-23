const MIN_NUMERATOR = 1;
const MAX_NUMERATOR = 19;
export const METER_DENOMINATORS = [2, 4, 8, 16] as const;
export type MeterDenominator = (typeof METER_DENOMINATORS)[number];

export const MIN_SEGMENT_BAR_COUNT = 1;
export const MAX_SEGMENT_BAR_COUNT = 99;

export function normalizeDenominator(value: number): MeterDenominator {
  return (METER_DENOMINATORS as readonly number[]).includes(value)
    ? (value as MeterDenominator)
    : 4;
}

export function clampNumerator(value: number): number {
  return Math.min(MAX_NUMERATOR, Math.max(MIN_NUMERATOR, value));
}

export function sanitizeNumeratorInput(text: string): string {
  const digitsOnly = text.replace(/[^\d]/g, '').slice(0, 2);
  if (digitsOnly.length === 0) {
    return '';
  }

  const asNumber = Number(digitsOnly);
  if (!Number.isInteger(asNumber)) {
    return '';
  }

  return String(clampNumerator(asNumber));
}

export function parseNumeratorText(text: string): number | null {
  if (!/^\d+$/.test(text)) {
    return null;
  }
  const value = Number(text);
  if (!Number.isInteger(value)) {
    return null;
  }
  return clampNumerator(value);
}

export function clampBarCount(value: number): number {
  return Math.min(MAX_SEGMENT_BAR_COUNT, Math.max(MIN_SEGMENT_BAR_COUNT, value));
}

export function sanitizeBarCountInput(text: string): string {
  const digitsOnly = text.replace(/[^\d]/g, '').slice(0, 2);
  if (digitsOnly.length === 0) {
    return '';
  }

  const asNumber = Number(digitsOnly);
  if (!Number.isInteger(asNumber)) {
    return '';
  }

  return String(clampBarCount(asNumber));
}

export function parseBarCountText(text: string): number | null {
  if (!/^\d+$/.test(text)) {
    return null;
  }
  const value = Number(text);
  if (!Number.isInteger(value)) {
    return null;
  }
  return clampBarCount(value);
}
