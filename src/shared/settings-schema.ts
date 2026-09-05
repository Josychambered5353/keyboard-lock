import { isUsableUnlockShortcut } from './accelerator.js';
import { DEFAULT_SETTINGS, MAX_DURATION_MS } from './constants.js';
import { clampDuration } from './duration.js';
import { SUPPORTED_LOCALES } from './i18n/index.js';
import type { AccentId, AppSettings, LocaleSetting } from './types.js';

const ACCENTS: AccentId[] = ['indigo', 'teal', 'violet', 'amber', 'rose'];

const MIN_MOUSE_HOLD_MS = 500;
const MAX_MOUSE_HOLD_MS = 5_000;

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asLocale(value: unknown): LocaleSetting {
  if (value === 'system') return 'system';
  return SUPPORTED_LOCALES.includes(value as never)
    ? (value as LocaleSetting)
    : DEFAULT_SETTINGS.locale;
}

function asAccent(value: unknown): AccentId {
  return ACCENTS.includes(value as AccentId) ? (value as AccentId) : DEFAULT_SETTINGS.accent;
}

function asNumberInRange(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Coerce anything that was on disk into a valid settings object.
 *
 * A hand-edited or half-written file must never produce an unusable unlock
 * shortcut — that is the one setting that could strand someone behind the
 * overlay, so an unusable value falls back to the default rather than being
 * kept.
 */
export function sanitizeSettings(
  input: Partial<AppSettings> | undefined,
  platform: NodeJS.Platform,
): AppSettings {
  const raw = input ?? {};
  const shortcut =
    typeof raw.unlockShortcut === 'string' && isUsableUnlockShortcut(raw.unlockShortcut, platform)
      ? raw.unlockShortcut
      : DEFAULT_SETTINGS.unlockShortcut;

  return {
    locale: asLocale(raw.locale),
    accent: asAccent(raw.accent),
    defaultDurationMs: clampDuration(
      typeof raw.defaultDurationMs === 'number'
        ? raw.defaultDurationMs
        : DEFAULT_SETTINGS.defaultDurationMs,
    ),
    unlockShortcut: shortcut,
    confirmThresholdMs: asNumberInRange(
      raw.confirmThresholdMs,
      0,
      MAX_DURATION_MS,
      DEFAULT_SETTINGS.confirmThresholdMs,
    ),
    allowMouseUnlock: asBoolean(raw.allowMouseUnlock, DEFAULT_SETTINGS.allowMouseUnlock),
    mouseUnlockHoldMs: asNumberInRange(
      raw.mouseUnlockHoldMs,
      MIN_MOUSE_HOLD_MS,
      MAX_MOUSE_HOLD_MS,
      DEFAULT_SETTINGS.mouseUnlockHoldMs,
    ),
    blockSystemShortcuts: asBoolean(
      raw.blockSystemShortcuts,
      DEFAULT_SETTINGS.blockSystemShortcuts,
    ),
    playSound: asBoolean(raw.playSound, DEFAULT_SETTINGS.playSound),
    keepDisplayAwake: asBoolean(raw.keepDisplayAwake, DEFAULT_SETTINGS.keepDisplayAwake),
  };
}
