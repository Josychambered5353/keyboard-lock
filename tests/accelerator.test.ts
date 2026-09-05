import { describe, expect, it } from 'vitest';
import {
  acceleratorFromEvent,
  formatAcceleratorForDisplay,
  isUsableUnlockShortcut,
  keyFromCode,
  matchesAccelerator,
  matchesAcceleratorLoose,
  parseAccelerator,
} from '@shared/accelerator.js';

const chord = (
  over: Partial<Record<'control' | 'alt' | 'shift' | 'meta', boolean>> & {
    key: string;
    code?: string;
  },
) => ({
  control: false,
  alt: false,
  shift: false,
  meta: false,
  ...over,
});

describe('parseAccelerator', () => {
  it('maps CommandOrControl per platform', () => {
    expect(parseAccelerator('CommandOrControl+U', 'darwin')).toMatchObject({
      meta: true,
      control: false,
    });
    expect(parseAccelerator('CommandOrControl+U', 'win32')).toMatchObject({
      meta: false,
      control: true,
    });
  });

  it('rejects accelerators with no key or two keys', () => {
    expect(parseAccelerator('Control+Alt', 'darwin')).toBeNull();
    expect(parseAccelerator('Control+U+I', 'darwin')).toBeNull();
    expect(parseAccelerator('', 'darwin')).toBeNull();
  });
});

describe('matchesAccelerator', () => {
  it('requires the exact modifier set', () => {
    expect(
      matchesAccelerator(chord({ key: 'u', control: true, alt: true }), 'Control+Alt+U', 'linux'),
    ).toBe(true);
    expect(matchesAccelerator(chord({ key: 'u', control: true }), 'Control+Alt+U', 'linux')).toBe(
      false,
    );
    // An extra modifier must not satisfy the combo, or Ctrl+Alt+Shift+U would unlock too.
    expect(
      matchesAccelerator(
        chord({ key: 'u', control: true, alt: true, shift: true }),
        'Control+Alt+U',
        'linux',
      ),
    ).toBe(false);
  });

  it('is case insensitive and understands aliases', () => {
    expect(
      matchesAccelerator(chord({ key: 'U', control: true, alt: true }), 'Control+Alt+U', 'linux'),
    ).toBe(true);
    expect(
      matchesAccelerator(
        chord({ key: 'esc', control: true, alt: true }),
        'Control+Alt+Escape',
        'linux',
      ),
    ).toBe(true);
  });
});

describe('matchesAcceleratorLoose', () => {
  it('matches on the physical key when the layout produces another character', () => {
    // AZERTY: the key at the QWERTY "U" position still reports code KeyU.
    const event = chord({ key: 'µ', code: 'KeyU', control: true, alt: true });
    expect(matchesAccelerator(event, 'Control+Alt+U', 'linux')).toBe(false);
    expect(matchesAcceleratorLoose(event, 'Control+Alt+U', 'linux')).toBe(true);
  });
});

describe('keyFromCode', () => {
  it('translates the codes an unlock combo can use', () => {
    expect(keyFromCode('KeyU')).toBe('U');
    expect(keyFromCode('Digit4')).toBe('4');
    expect(keyFromCode('F9')).toBe('F9');
    expect(keyFromCode('Space')).toBe('Space');
    expect(keyFromCode('ShiftLeft')).toBeNull();
  });
});

describe('acceleratorFromEvent', () => {
  it('builds an accelerator in a stable modifier order', () => {
    expect(acceleratorFromEvent(chord({ key: 'l', meta: true, alt: true }))).toBe('Alt+Super+L');
  });

  it('refuses modifier-only and bare keys', () => {
    expect(acceleratorFromEvent(chord({ key: 'Shift', shift: true }))).toBeNull();
    expect(acceleratorFromEvent(chord({ key: 'u' }))).toBeNull();
  });

  it('refuses Tab and Enter, which every OS already owns', () => {
    expect(acceleratorFromEvent(chord({ key: 'Tab', control: true, alt: true }))).toBeNull();
    expect(acceleratorFromEvent(chord({ key: 'Enter', control: true, alt: true }))).toBeNull();
  });
});

describe('isUsableUnlockShortcut', () => {
  it('demands at least two modifiers so a cloth cannot trigger it', () => {
    expect(isUsableUnlockShortcut('Control+Alt+U', 'linux')).toBe(true);
    expect(isUsableUnlockShortcut('Control+U', 'linux')).toBe(false);
    expect(isUsableUnlockShortcut('U', 'linux')).toBe(false);
    expect(isUsableUnlockShortcut('Control+Alt', 'linux')).toBe(false);
  });
});

describe('formatAcceleratorForDisplay', () => {
  it('uses macOS glyphs on darwin and words elsewhere', () => {
    expect(formatAcceleratorForDisplay('Control+Alt+U', 'darwin')).toBe('⌃⌥U');
    expect(formatAcceleratorForDisplay('Control+Alt+U', 'win32')).toBe('Control + Alt + U');
    expect(formatAcceleratorForDisplay('Super+Alt+L', 'win32')).toBe('Win + Alt + L');
  });
});
