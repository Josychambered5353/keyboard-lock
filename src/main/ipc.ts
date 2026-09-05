import { BrowserWindow, app, globalShortcut, ipcMain, screen, shell } from 'electron';
import { isUsableUnlockShortcut } from '../shared/accelerator.js';
import { APP_HOMEPAGE, IPC } from '../shared/constants.js';
import type {
  AppSettings,
  EnvironmentInfo,
  ShortcutCheckResult,
  StartLockRequest,
} from '../shared/types.js';
import type { LockController } from './lock-controller.js';
import type { SettingsStore } from './settings-store.js';

export interface IpcContext {
  settings: SettingsStore;
  lock: LockController;
  getMainWindow(): BrowserWindow | null;
}

/** Push a settings change to every live renderer so all windows stay in sync. */
function broadcastSettings(settings: AppSettings): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(IPC.onSettingsChanged, settings);
  }
}

export function registerIpcHandlers({ settings, lock, getMainWindow }: IpcContext): void {
  ipcMain.handle(IPC.getSettings, () => settings.get());

  ipcMain.handle(IPC.setSettings, (_event, patch: Partial<AppSettings>) => {
    const next = settings.update(patch ?? {});
    broadcastSettings(next);
    return next;
  });

  ipcMain.handle(IPC.resetSettings, () => {
    const next = settings.reset();
    broadcastSettings(next);
    return next;
  });

  ipcMain.handle(IPC.getEnvironment, (): EnvironmentInfo => ({
    platform: process.platform,
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    systemLocale: app.getSystemLocale() || app.getLocale() || 'en',
    displayCount: screen.getAllDisplays().length,
    homepage: APP_HOMEPAGE,
  }));

  ipcMain.handle(IPC.startLock, (_event, request: StartLockRequest) => {
    const result = lock.start(request?.durationMs ?? 0);
    if (result.ok) getMainWindow()?.hide();
    return result;
  });

  ipcMain.handle(IPC.stopLock, (_event, source: 'mouse' | 'cancelled' = 'cancelled') => {
    if (source === 'mouse') return lock.requestMouseUnlock();
    lock.stop('cancelled');
    return true;
  });

  ipcMain.handle(IPC.getLockStatus, () => lock.status());

  ipcMain.handle(IPC.checkShortcut, (_event, accelerator: string): ShortcutCheckResult => {
    if (typeof accelerator !== 'string' || !isUsableUnlockShortcut(accelerator, process.platform)) {
      return { valid: false, available: false, reason: 'invalid' };
    }
    if (globalShortcut.isRegistered(accelerator)) {
      return { valid: true, available: false, reason: 'reserved' };
    }
    // The only reliable availability test is asking the OS for the grab.
    try {
      const registered = globalShortcut.register(accelerator, () => undefined);
      if (!registered) return { valid: true, available: false, reason: 'taken' };
      globalShortcut.unregister(accelerator);
      return { valid: true, available: true };
    } catch {
      return { valid: true, available: false, reason: 'taken' };
    }
  });

  ipcMain.handle(IPC.minimizeWindow, () => getMainWindow()?.minimize());

  ipcMain.handle(IPC.closeWindow, () => {
    if (lock.isActive()) return;
    getMainWindow()?.close();
  });

  ipcMain.handle(IPC.openExternal, (_event, url: string) => {
    if (typeof url === 'string' && url.startsWith('https://')) void shell.openExternal(url);
  });
}
