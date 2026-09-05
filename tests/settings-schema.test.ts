import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, MAX_DURATION_MS, MIN_DURATION_MS } from '@shared/constants.js';
import { sanitizeSettings } from '@shared/settings-schema.js';
import { isUsableUnlockShortcut } from '@shared/accelerator.js';

describe('sanitizeSettings', () => {
  it('returns the defaults for missing input', () => {
    expect(sanitizeSettings(undefined, 'darwin')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values', () => {
    const result = sanitizeSettings(
      { locale: 'ja', accent: 'teal', playSound: false, defaultDurationMs: 120_000 },
      'darwin',
    );
    expect(result.locale).toBe('ja');
    expect(result.accent).toBe('teal');
    expect(result.playSound).toBe(false);
    expect(result.defaultDurationMs).toBe(120_000);
  });

  it('replaces an unusable unlock shortcut, which could otherwise strand a user', () => {
    for (const shortcut of ['U', 'Control+U', 'Control+Alt', 'nonsense', '']) {
      const result = sanitizeSettings({ unlockShortcut: shortcut }, 'linux');
      expect(result.unlockShortcut).toBe(DEFAULT_SETTINGS.unlockShortcut);
      expect(isUsableUnlockShortcut(result.unlockShortcut, 'linux')).toBe(true);
    }
  });

  it('clamps durations into the supported range', () => {
    expect(sanitizeSettings({ defaultDurationMs: 0 }, 'linux').defaultDurationMs).toBe(
      MIN_DURATION_MS,
    );
    expect(sanitizeSettings({ defaultDurationMs: 1e9 }, 'linux').defaultDurationMs).toBe(
      MAX_DURATION_MS,
    );
  });

  it('clamps the confirmation threshold but allows zero to disable it', () => {
    expect(sanitizeSettings({ confirmThresholdMs: 0 }, 'linux').confirmThresholdMs).toBe(0);
    expect(sanitizeSettings({ confirmThresholdMs: -1 }, 'linux').confirmThresholdMs).toBe(0);
    expect(sanitizeSettings({ confirmThresholdMs: 1e9 }, 'linux').confirmThresholdMs).toBe(
      MAX_DURATION_MS,
    );
  });

  it('keeps the mouse hold long enough to be deliberate', () => {
    expect(sanitizeSettings({ mouseUnlockHoldMs: 10 }, 'linux').mouseUnlockHoldMs).toBe(500);
    expect(sanitizeSettings({ mouseUnlockHoldMs: 60_000 }, 'linux').mouseUnlockHoldMs).toBe(5_000);
  });

  it('ignores values of the wrong type instead of trusting them', () => {
    const result = sanitizeSettings(
      {
        locale: 42,
        accent: 'chartreuse',
        playSound: 'yes',
        allowMouseUnlock: null,
      } as never,
      'linux',
    );
    expect(result).toEqual(DEFAULT_SETTINGS);
  });
});

describe('default settings', () => {
  it('ship an unlock shortcut that is actually usable on every platform', () => {
    for (const platform of ['darwin', 'win32', 'linux'] as const) {
      expect(isUsableUnlockShortcut(DEFAULT_SETTINGS.unlockShortcut, platform)).toBe(true);
    }
  });
});
