/** Types shared between the main process, the preload bridge and the renderers. */

export type LocaleCode =
  'en' | 'de' | 'fr' | 'es' | 'it' | 'pt-BR' | 'nl' | 'pl' | 'ru' | 'tr' | 'ja' | 'zh-CN';

export type LocaleSetting = LocaleCode | 'system';

export type AccentId = 'indigo' | 'teal' | 'violet' | 'amber' | 'rose';

export interface AppSettings {
  /** UI language, or `system` to follow the OS locale. */
  locale: LocaleSetting;
  /** Accent colour of the dark theme. */
  accent: AccentId;
  /** Duration pre-selected when the app starts, in milliseconds. */
  defaultDurationMs: number;
  /** Electron accelerator that ends a running lock. */
  unlockShortcut: string;
  /**
   * Locks at or above this duration require an explicit confirmation step.
   * `0` disables the confirmation.
   */
  confirmThresholdMs: number;
  /** Allow ending a lock by holding the on-screen button with the mouse. */
  allowMouseUnlock: boolean;
  /** How long the on-screen unlock button has to be held, in milliseconds. */
  mouseUnlockHoldMs: number;
  /** Swallow common system shortcuts (Cmd+Q, media keys, …) while locked. */
  blockSystemShortcuts: boolean;
  /** Play a short chime when a lock ends. */
  playSound: boolean;
  /** Keep the display awake for the duration of the lock. */
  keepDisplayAwake: boolean;
}

export type LockEndReason = 'completed' | 'shortcut' | 'mouse' | 'cancelled' | 'interrupted';

export interface LockStatus {
  active: boolean;
  /** Total duration of the running lock, in milliseconds. */
  durationMs: number;
  /** Remaining time, in milliseconds. Clamped to `>= 0`. */
  remainingMs: number;
  /** Epoch milliseconds at which the lock ends. */
  endsAt: number;
  /** Number of key events swallowed since the lock started. */
  blockedKeys: number;
  /** True when the OS refused to hand over one or more system shortcuts. */
  shortcutsDegraded: boolean;
}

export interface LockSummary {
  reason: LockEndReason;
  durationMs: number;
  elapsedMs: number;
  blockedKeys: number;
}

export interface StartLockRequest {
  durationMs: number;
}

export interface StartLockResult {
  ok: boolean;
  /** Reason the lock could not be started, if any. */
  error?: 'already-active' | 'invalid-duration';
}

export interface EnvironmentInfo {
  platform: NodeJS.Platform;
  appVersion: string;
  electronVersion: string;
  systemLocale: string;
  displayCount: number;
  homepage: string;
}

export interface ShortcutCheckResult {
  valid: boolean;
  available: boolean;
  reason?: 'invalid' | 'taken' | 'reserved';
}
