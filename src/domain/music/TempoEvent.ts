/** How tempo changes at a bar boundary. Playback interprets curves later. */
export type TempoTransitionType = 'instant' | 'linear';

/**
 * Optional per-bar tempo override.
 * Metadata is opaque to the domain layer (e.g. curve label, editor hints).
 */
export interface TempoEvent {
  readonly bpm: number;
  readonly type: TempoTransitionType;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export function createTempoEvent(
  bpm: number,
  type: TempoTransitionType = 'instant',
  metadata?: Readonly<Record<string, string | number | boolean>>,
): TempoEvent {
  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new RangeError('TempoEvent bpm must be a positive number');
  }

  return metadata === undefined ? { bpm, type } : { bpm, type, metadata };
}

export function cloneTempoEvent(event: TempoEvent): TempoEvent {
  return event.metadata === undefined
    ? createTempoEvent(event.bpm, event.type)
    : createTempoEvent(event.bpm, event.type, { ...event.metadata });
}
