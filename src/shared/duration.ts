import { MAX_DURATION_MS, MIN_DURATION_MS } from './constants.js';

/** Clamp an arbitrary duration into the range the app is willing to lock for. */
export function clampDuration(ms: number): number {
  if (!Number.isFinite(ms)) return MIN_DURATION_MS;
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, Math.round(ms)));
}

/** `125_000` -> `"02:05"`, `3_725_000` -> `"1:02:05"`. Always rounds up so a countdown never shows 00:00 while still running. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export interface DurationParts {
  minutes: number;
  seconds: number;
}

/** Split a duration into whole minutes and remaining seconds for localized labels. */
export function toDurationParts(ms: number): DurationParts {
  const total = Math.max(0, Math.round(ms / 1000));
  return { minutes: Math.floor(total / 60), seconds: total % 60 };
}

/**
 * The duration slider is non-linear: fine-grained where people actually pick
 * (seconds to a few minutes) and coarse towards the one hour ceiling.
 * Steps are the source of truth for both the slider and keyboard nudges.
 */
export const DURATION_STEPS_MS: readonly number[] = Object.freeze([
  10_000, 15_000, 20_000, 30_000, 45_000, 60_000, 90_000, 120_000, 150_000, 180_000, 240_000,
  300_000, 420_000, 600_000, 900_000, 1_200_000, 1_800_000, 2_700_000, 3_600_000,
]);

/** Nearest slider index for a duration. Used when restoring a saved default. */
export function durationToStepIndex(ms: number): number {
  const target = clampDuration(ms);
  let bestIndex = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < DURATION_STEPS_MS.length; i += 1) {
    const delta = Math.abs((DURATION_STEPS_MS[i] as number) - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = i;
    }
  }
  return bestIndex;
}

export function stepIndexToDuration(index: number): number {
  const clamped = Math.min(DURATION_STEPS_MS.length - 1, Math.max(0, Math.round(index)));
  return DURATION_STEPS_MS[clamped] as number;
}
