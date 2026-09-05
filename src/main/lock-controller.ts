import { Menu, globalShortcut, powerSaveBlocker, screen } from 'electron';
import type { BrowserWindow, Input } from 'electron';
import { matchesAcceleratorLoose } from '../shared/accelerator.js';
import { IPC, SWALLOWED_SHORTCUTS, TICK_INTERVAL_MS } from '../shared/constants.js';
import { clampDuration } from '../shared/duration.js';
import type { LockEndReason, LockStatus, LockSummary, StartLockResult } from '../shared/types.js';
import { buildAppMenu } from './menu.js';
import type { SettingsStore } from './settings-store.js';
import { createLockWindows, type LockWindow } from './windows.js';

/** How long the "unlocked" outro stays on screen before the overlay disappears. */
const OUTRO_MS = 900;

/** Ignore refocus attempts fired closer together than this, so we never fight another app. */
const REFOCUS_THROTTLE_MS = 250;

export interface LockControllerHooks {
  onStarted(status: LockStatus): void;
  onEnded(summary: LockSummary): void;
}

/**
 * Owns everything that happens while the keyboard is locked: the overlay
 * windows, the key swallowing, the reserved system shortcuts and the countdown.
 *
 * The lock is deliberately built from reversible, user-space pieces — a focused
 * overlay plus temporary shortcut grabs. Nothing is written to the OS input
 * stack, so killing the process, logging out or a crash always leaves the
 * keyboard working.
 */
export class LockController {
  private lockWindows: LockWindow[] = [];
  private timer: NodeJS.Timeout | null = null;
  private deadline = 0;
  private durationMs = 0;
  private startedAt = 0;
  private blockedKeys = 0;
  private powerSaveId: number | null = null;
  private grabbedShortcuts: string[] = [];
  private degradedShortcuts: string[] = [];
  private active = false;
  private ending = false;
  private lastRefocusAt = 0;

  constructor(
    private readonly settings: SettingsStore,
    private readonly hooks: LockControllerHooks,
  ) {
    // A monitor appearing or moving mid-lock would leave a live, uncovered screen.
    screen.on('display-added', () => this.rebuildWindows());
    screen.on('display-removed', () => this.rebuildWindows());
    screen.on('display-metrics-changed', () => this.rebuildWindows());
  }

  isActive(): boolean {
    return this.active;
  }

  status(): LockStatus {
    return {
      active: this.active,
      durationMs: this.durationMs,
      remainingMs: this.active ? Math.max(0, this.deadline - Date.now()) : 0,
      endsAt: this.deadline,
      blockedKeys: this.blockedKeys,
      shortcutsDegraded: this.degradedShortcuts.length > 0,
    };
  }

  start(requestedMs: number): StartLockResult {
    if (this.active) return { ok: false, error: 'already-active' };
    if (!Number.isFinite(requestedMs) || requestedMs <= 0) {
      return { ok: false, error: 'invalid-duration' };
    }

    this.durationMs = clampDuration(requestedMs);
    this.startedAt = Date.now();
    this.deadline = this.startedAt + this.durationMs;
    this.blockedKeys = 0;
    this.active = true;
    this.ending = false;

    Menu.setApplicationMenu(null);
    this.openWindows();
    this.reserveShortcuts();
    this.startPowerSaveBlocker();

    this.timer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
    this.hooks.onStarted(this.status());
    return { ok: true };
  }

  /** End a running lock. Safe to call repeatedly and from any code path. */
  stop(reason: LockEndReason): void {
    if (!this.active || this.ending) return;
    this.ending = true;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.releaseShortcuts();
    this.stopPowerSaveBlocker();

    const summary: LockSummary = {
      reason,
      durationMs: this.durationMs,
      elapsedMs: Math.min(this.durationMs, Date.now() - this.startedAt),
      blockedKeys: this.blockedKeys,
    };

    this.broadcast(IPC.onLockEnded, summary);

    setTimeout(() => {
      this.closeWindows();
      this.active = false;
      this.ending = false;
      Menu.setApplicationMenu(buildAppMenu());
      this.hooks.onEnded(summary);
    }, OUTRO_MS);
  }

  /** Called by the overlay when the on-screen unlock button was held long enough. */
  requestMouseUnlock(): boolean {
    if (!this.active || !this.settings.get().allowMouseUnlock) return false;
    this.stop('mouse');
    return true;
  }

  private tick(): void {
    const remaining = this.deadline - Date.now();
    if (remaining <= 0) {
      this.stop('completed');
      return;
    }
    this.broadcast(IPC.onLockTick, this.status());
  }

  private openWindows(): void {
    this.lockWindows = createLockWindows();
    for (const entry of this.lockWindows) {
      this.attachGuards(entry);
    }
  }

  private closeWindows(): void {
    for (const { window } of this.lockWindows) {
      if (!window.isDestroyed()) window.destroy();
    }
    this.lockWindows = [];
  }

  /** Re-create the overlay when displays are plugged in, unplugged or rearranged. */
  private rebuildWindows(): void {
    if (!this.active || this.ending) return;
    this.closeWindows();
    this.openWindows();
    this.broadcast(IPC.onLockTick, this.status());
  }

  private attachGuards({ window, isPrimary }: LockWindow): void {
    window.webContents.on('before-input-event', (event, input) => {
      if (!this.active) return;
      event.preventDefault();
      if (input.type !== 'keyDown' || input.isAutoRepeat) return;
      this.blockedKeys += 1;
      if (this.isUnlockCombo(input)) this.stop('shortcut');
    });

    // If anything steals focus (a notification, another app's alert), take it back
    // so the next keystroke still lands in the overlay rather than in a document.
    window.on('blur', () => {
      if (!this.active || this.ending || !isPrimary) return;
      const now = Date.now();
      if (now - this.lastRefocusAt < REFOCUS_THROTTLE_MS) return;
      this.lastRefocusAt = now;
      if (!window.isDestroyed()) window.focus();
    });

    window.on('close', (event) => {
      if (this.active) event.preventDefault();
    });
  }

  private isUnlockCombo(input: Input): boolean {
    return matchesAcceleratorLoose(
      {
        key: input.key,
        code: input.code,
        control: input.control,
        alt: input.alt,
        shift: input.shift,
        meta: input.meta,
      },
      this.settings.get().unlockShortcut,
      process.platform,
    );
  }

  private reserveShortcuts(): void {
    const { unlockShortcut, blockSystemShortcuts } = this.settings.get();
    this.grabbedShortcuts = [];
    this.degradedShortcuts = [];

    // The unlock combo is reserved first: it must work even if the overlay
    // somehow loses focus, and it must never be shadowed by a swallowed key.
    this.tryRegister(unlockShortcut, () => this.stop('shortcut'));

    if (!blockSystemShortcuts) return;
    for (const accelerator of SWALLOWED_SHORTCUTS) {
      if (accelerator === unlockShortcut) continue;
      this.tryRegister(accelerator, () => {
        this.blockedKeys += 1;
      });
    }
  }

  private tryRegister(accelerator: string, handler: () => void): void {
    try {
      if (globalShortcut.register(accelerator, handler)) {
        this.grabbedShortcuts.push(accelerator);
      } else {
        this.degradedShortcuts.push(accelerator);
      }
    } catch {
      // Some accelerators are simply not registrable on some systems.
      this.degradedShortcuts.push(accelerator);
    }
  }

  private releaseShortcuts(): void {
    for (const accelerator of this.grabbedShortcuts) {
      try {
        globalShortcut.unregister(accelerator);
      } catch {
        // Nothing useful to do; the process is about to drop the grab anyway.
      }
    }
    this.grabbedShortcuts = [];
  }

  private startPowerSaveBlocker(): void {
    if (!this.settings.get().keepDisplayAwake) return;
    try {
      this.powerSaveId = powerSaveBlocker.start('prevent-display-sleep');
    } catch {
      this.powerSaveId = null;
    }
  }

  private stopPowerSaveBlocker(): void {
    if (this.powerSaveId === null) return;
    try {
      if (powerSaveBlocker.isStarted(this.powerSaveId)) powerSaveBlocker.stop(this.powerSaveId);
    } catch {
      // Ignore: the blocker is released with the process at the latest.
    }
    this.powerSaveId = null;
  }

  private broadcast(channel: string, payload: unknown): void {
    for (const { window } of this.lockWindows) {
      if (!window.isDestroyed()) window.webContents.send(channel, payload);
    }
  }

  /** Windows the overlay currently owns, for callers that need to talk to them. */
  get windows(): BrowserWindow[] {
    return this.lockWindows.map((entry) => entry.window);
  }
}
