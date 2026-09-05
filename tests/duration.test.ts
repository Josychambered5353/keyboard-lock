import { describe, expect, it } from 'vitest';
import { MAX_DURATION_MS, MIN_DURATION_MS } from '@shared/constants.js';
import {
  DURATION_STEPS_MS,
  clampDuration,
  durationToStepIndex,
  formatClock,
  stepIndexToDuration,
  toDurationParts,
} from '@shared/duration.js';

describe('clampDuration', () => {
  it('keeps values inside the supported range', () => {
    expect(clampDuration(60_000)).toBe(60_000);
    expect(clampDuration(1)).toBe(MIN_DURATION_MS);
    expect(clampDuration(10 * MAX_DURATION_MS)).toBe(MAX_DURATION_MS);
  });

  it('falls back to the shortest lock for values that are not finite', () => {
    // Erring towards the minimum keeps a corrupt value from locking someone out for an hour.
    expect(clampDuration(Number.NaN)).toBe(MIN_DURATION_MS);
    expect(clampDuration(Number.POSITIVE_INFINITY)).toBe(MIN_DURATION_MS);
  });
});

describe('formatClock', () => {
  it('formats minutes and seconds', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(9_000)).toBe('00:09');
    expect(formatClock(125_000)).toBe('02:05');
  });

  it('adds an hour segment only when needed', () => {
    expect(formatClock(3_600_000)).toBe('1:00:00');
    expect(formatClock(3_725_000)).toBe('1:02:05');
  });

  it('rounds up so a running countdown never reads zero', () => {
    expect(formatClock(1)).toBe('00:01');
    expect(formatClock(999)).toBe('00:01');
  });

  it('never renders a negative clock', () => {
    expect(formatClock(-5_000)).toBe('00:00');
  });
});

describe('toDurationParts', () => {
  it('splits into whole minutes and seconds', () => {
    expect(toDurationParts(90_000)).toEqual({ minutes: 1, seconds: 30 });
    expect(toDurationParts(300_000)).toEqual({ minutes: 5, seconds: 0 });
  });
});

describe('slider steps', () => {
  it('is sorted and inside the allowed range', () => {
    const sorted = [...DURATION_STEPS_MS].sort((a, b) => a - b);
    expect(DURATION_STEPS_MS).toEqual(sorted);
    expect(DURATION_STEPS_MS[0]).toBe(MIN_DURATION_MS);
    expect(DURATION_STEPS_MS.at(-1)).toBe(MAX_DURATION_MS);
  });

  it('round-trips every step', () => {
    for (const [index, ms] of DURATION_STEPS_MS.entries()) {
      expect(durationToStepIndex(ms)).toBe(index);
      expect(stepIndexToDuration(index)).toBe(ms);
    }
  });

  it('snaps arbitrary durations to the nearest step', () => {
    expect(stepIndexToDuration(durationToStepIndex(61_000))).toBe(60_000);
    expect(stepIndexToDuration(durationToStepIndex(290_000))).toBe(300_000);
  });

  it('clamps out-of-range indices', () => {
    expect(stepIndexToDuration(-5)).toBe(MIN_DURATION_MS);
    expect(stepIndexToDuration(999)).toBe(MAX_DURATION_MS);
  });
});
