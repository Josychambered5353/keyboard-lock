import { BrowserWindow, Menu, app, globalShortcut } from 'electron';
import { IPC } from '../shared/constants.js';
import { registerIpcHandlers } from './ipc.js';
import { LockController } from './lock-controller.js';
import { buildAppMenu } from './menu.js';
import { SettingsStore } from './settings-store.js';
import { createMainWindow } from './windows.js';

app.setAppUserModelId('com.keyboardlock.app');

// The unlock chime is played from the overlay, which never receives a click first.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let mainWindow: BrowserWindow | null = null;
let lock: LockController | null = null;

/**
 * A second instance would open a second overlay and fight the first one for
 * focus, so the running instance simply takes the foreground instead.
 */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (lock?.isActive()) return;
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  void app.whenReady().then(() => {
    const settings = new SettingsStore();

    lock = new LockController(settings, {
      onStarted: (status) => mainWindow?.webContents.send(IPC.onLockStarted, status),
      onEnded: (summary) => {
        mainWindow?.webContents.send(IPC.onLockEnded, summary);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    });

    registerIpcHandlers({ settings, lock, getMainWindow: () => mainWindow });

    Menu.setApplicationMenu(buildAppMenu());
    mainWindow = createMainWindow();
    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    app.on('activate', () => {
      if (lock?.isActive()) return;
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
        mainWindow.on('closed', () => {
          mainWindow = null;
        });
      } else {
        mainWindow?.show();
      }
    });
  });
}

// Whatever tears the app down, the keyboard has to come back first.
app.on('before-quit', () => lock?.stop('interrupted'));
app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('window-all-closed', () => {
  if (!lock?.isActive()) app.quit();
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    lock?.stop('interrupted');
    globalShortcut.unregisterAll();
    app.quit();
  });
}
