/**
 * A tiny Electron-accelerator helper.
 *
 * The lock swallows every key before it reaches a window, so the unlock combo
 * has to be matched by hand against raw key events. Keeping that logic here —
 * free of Electron and DOM imports — makes it testable and lets the settings
 * screen render the same combo the main process listens for.
 */

export interface KeyChord {
  control: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  /** Uppercased, normalized key name, e.g. `U`, `F5`, `Space`. */
  key: string;
}

const MODIFIER_KEYS = new Set([
  'CONTROL',
  'ALT',
  'ALTGRAPH',
  'SHIFT',
  'META',
  'OS',
  'COMMAND',
  'CMD',
  'CAPSLOCK',
  'FN',
  'DEAD',
]);

/** Keys that must never become an unlock combo on their own terms. */
const RESERVED_KEYS = new Set(['TAB', 'ENTER', 'RETURN']);

const KEY_ALIASES: Record<string, string> = {
  ESC: 'Escape',
  ESCAPE: 'Escape',
  ' ': 'Space',
  SPACEBAR: 'Space',
  SPACE: 'Space',
  ARROWUP: 'Up',
  ARROWDOWN: 'Down',
  ARROWLEFT: 'Left',
  ARROWRIGHT: 'Right',
  DEL: 'Delete',
  INS: 'Insert',
  PLUS: 'Plus',
};

/** Normalize a key name from either a DOM event or an accelerator token. */
export function normalizeKey(raw: string): string {
  const upper = raw.toUpperCase();
  const alias = KEY_ALIASES[upper];
  if (alias) return alias;
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(upper)) return upper;
  if (upper.length === 1) return upper;
  // Title-case multi-character names so `escape` and `Escape` compare equal.
  return upper.charAt(0) + raw.slice(1).toLowerCase();
}

export function isModifierKey(key: string): boolean {
  return MODIFIER_KEYS.has(key.toUpperCase());
}

/** Parse `"CommandOrControl+Shift+U"` into a chord, or `null` if unusable. */
export function parseAccelerator(accelerator: string, platform: NodeJS.Platform): KeyChord | null {
  const tokens = accelerator
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return null;

  const chord: KeyChord = { control: false, alt: false, shift: false, meta: false, key: '' };
  for (const token of tokens) {
    switch (token.toLowerCase()) {
      case 'commandorcontrol':
      case 'cmdorctrl':
        if (platform === 'darwin') chord.meta = true;
        else chord.control = true;
        break;
      case 'command':
      case 'cmd':
      case 'super':
      case 'meta':
        chord.meta = true;
        break;
      case 'control':
      case 'ctrl':
        chord.control = true;
        break;
      case 'alt':
      case 'option':
      case 'opt':
        chord.alt = true;
        break;
      case 'shift':
        chord.shift = true;
        break;
      default:
        if (chord.key) return null;
        chord.key = normalizeKey(token);
    }
  }
  return chord.key ? chord : null;
}

export interface RawKeyEvent {
  key: string;
  control: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

/** Does a raw key event satisfy the given accelerator? */
export function matchesAccelerator(
  event: RawKeyEvent,
  accelerator: string,
  platform: NodeJS.Platform,
): boolean {
  const chord = parseAccelerator(accelerator, platform);
  if (!chord) return false;
  return (
    chord.control === event.control &&
    chord.alt === event.alt &&
    chord.shift === event.shift &&
    chord.meta === event.meta &&
    chord.key === normalizeKey(event.key)
  );
}

/** Build an accelerator string from a key event captured in the settings screen. */
export function acceleratorFromEvent(event: RawKeyEvent): string | null {
  const key = normalizeKey(event.key);
  if (isModifierKey(key) || RESERVED_KEYS.has(key.toUpperCase())) return null;
  const parts: string[] = [];
  if (event.control) parts.push('Control');
  if (event.alt) parts.push('Alt');
  if (event.shift) parts.push('Shift');
  if (event.meta) parts.push('Super');
  if (parts.length === 0) return null;
  parts.push(key);
  return parts.join('+');
}

/**
 * A usable unlock combo needs at least two modifiers, or one modifier plus a
 * non-trivial key. A cloth dragged across the keys should not be able to hit it.
 */
export function isUsableUnlockShortcut(accelerator: string, platform: NodeJS.Platform): boolean {
  const chord = parseAccelerator(accelerator, platform);
  if (!chord) return false;
  if (isModifierKey(chord.key)) return false;
  if (RESERVED_KEYS.has(chord.key.toUpperCase())) return false;
  const modifiers = [chord.control, chord.alt, chord.shift, chord.meta].filter(Boolean).length;
  return modifiers >= 2;
}

const DISPLAY_SYMBOLS_DARWIN: Record<string, string> = {
  Control: '⌃',
  Alt: '⌥',
  Shift: '⇧',
  Super: '⌘',
  Escape: '⎋',
  Space: '␣',
};

const DISPLAY_NAMES_OTHER: Record<string, string> = {
  Super: 'Win',
  Alt: 'Alt',
};

/** Render an accelerator the way the platform writes it, for UI labels. */
export function formatAcceleratorForDisplay(
  accelerator: string,
  platform: NodeJS.Platform,
): string {
  const tokens = accelerator.split('+').filter(Boolean);
  if (platform === 'darwin') {
    return tokens.map((token) => DISPLAY_SYMBOLS_DARWIN[token] ?? token).join('');
  }
  return tokens.map((token) => DISPLAY_NAMES_OTHER[token] ?? token).join(' + ');
}

/**
 * Derive a key name from a physical `KeyboardEvent.code`.
 *
 * Layout matters: on a French AZERTY keyboard `Control+Alt+U` reports a
 * different `key` than on QWERTY. Matching the physical code as well means the
 * unlock combo sits in the same place on every layout.
 */
export function keyFromCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  if (code === 'Space' || code === 'Escape') return code;
  return null;
}

/** True when either the logical key or the physical key satisfies the accelerator. */
export function matchesAcceleratorLoose(
  event: RawKeyEvent & { code?: string },
  accelerator: string,
  platform: NodeJS.Platform,
): boolean {
  if (matchesAccelerator(event, accelerator, platform)) return true;
  const physical = event.code ? keyFromCode(event.code) : null;
  if (!physical) return false;
  return matchesAccelerator({ ...event, key: physical }, accelerator, platform);
}
