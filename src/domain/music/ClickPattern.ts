import type { Meter } from './Meter';
import { resolveAccentFlags, defaultAccentPatternFromMeter } from './AccentPattern';

/** Accent weight for an enabled click step. */
export enum ClickAccent {
  Normal = 'normal',
  Accent = 'accent',
}

export interface ClickStep {
  readonly enabled: boolean;
  readonly accent: ClickAccent;
}

export interface ClickPattern {
  readonly steps: readonly ClickStep[];
}

export function createClickStep(
  enabled: boolean,
  accent: ClickAccent = ClickAccent.Normal,
): ClickStep {
  return { enabled, accent };
}

export function createClickPattern(steps: readonly ClickStep[]): ClickPattern {
  if (steps.length === 0) {
    throw new RangeError('ClickPattern must contain at least one step');
  }

  return { steps: [...steps] };
}

export function cloneClickPattern(pattern: ClickPattern): ClickPattern {
  return createClickPattern(pattern.steps.map((step) => createClickStep(step.enabled, step.accent)));
}

/** Validates step count; throws if [pattern] does not match [meter.numerator]. */
export function validateClickPattern(meter: Meter, pattern: ClickPattern): void {
  if (pattern.steps.length !== meter.numerator) {
    throw new RangeError(
      `ClickPattern length must equal meter numerator (got ${pattern.steps.length}, expected ${meter.numerator})`,
    );
  }
}

/**
 * Resolves the click pattern for a bar, generating defaults when absent.
 * ClickPattern describes WHERE clicks occur; beat spacing comes from BeatUnit.
 */
export function resolveClickPattern(
  meter: Meter,
  clickPattern: ClickPattern | undefined,
): ClickPattern {
  if (clickPattern === undefined) {
    return createDefaultClickPattern(meter);
  }

  validateClickPattern(meter, clickPattern);
  return clickPattern;
}

function clickAccentFromFlag(isAccent: boolean): ClickAccent {
  return isAccent ? ClickAccent.Accent : ClickAccent.Normal;
}

/**
 * Default: one enabled click per numerator step (WHERE).
 * Accents follow [meter.grouping]; grouping never removes pulse cells.
 */
export function createDefaultClickPattern(meter: Meter): ClickPattern {
  const accentFlags = resolveAccentFlags(defaultAccentPatternFromMeter(meter), meter.numerator);
  const steps = accentFlags.map((isAccent) => createClickStep(true, clickAccentFromFlag(isAccent)));

  return createClickPattern(steps);
}

/** Returns enabled state per beat index (for tests and future UI). */
export function clickPatternEnabledFlags(pattern: ClickPattern): boolean[] {
  return pattern.steps.map((step) => step.enabled);
}

/** Count of enabled clicks in a pattern. */
export function countEnabledClicks(pattern: ClickPattern): number {
  return pattern.steps.filter((step) => step.enabled).length;
}
