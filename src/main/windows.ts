import { BrowserWindow, app, screen, shell } from 'electron';
import { join } from 'node:path';

const isDev = !app.isPackaged;
const preload = join(__dirname, '../preload/index.js');
const rendererDir = join(__dirname, '../renderer');
const appIcon = join(app.getAppPath(), 'build/icon.png');

/** Resolve a renderer entry for both `electron-vite dev` and the packaged build. */
function rendererTarget(page: 'index' | 'lock', query?: Record<string, string>) {
  const search = query ? `?${new URLSearchParams(query).toString()}` : '';
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (isDev && devUrl) {
    return { kind: 'url' as const, value: `${devUrl}/${page}.html${search}` };
  }
  return { kind: 'file' as const, value: join(rendererDir, `${page}.html`), search };
}

function load(window: BrowserWindow, page: 'index' | 'lock', query?: Record<string, string>) {
  const target = rendererTarget(page, query);
  if (target.kind === 'url') {
    void window.loadURL(target.value);
  } else {
    void window.loadFile(target.value, query ? { query } : undefined);
  }
}

/** Deny in-app navigation and route external links to the system browser. */
function hardenNavigation(window: BrowserWindow) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL'];
    if (isDev && devUrl && url.startsWith(devUrl)) return;
    event.preventDefault();
  });
}

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 440,
    height: 624,
    minWidth: 440,
    minHeight: 624,
    maxWidth: 440,
    maxHeight: 624,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    backgroundColor: '#0b0c10',
    icon: process.platform === 'linux' ? appIcon : undefined,
    autoHideMenuBar: true,
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 16, y: 20 } }
      : { frame: false }),
    webPreferences: {
      preload,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  window.once('ready-to-show', () => window.show());
  hardenNavigation(window);
  load(window, 'index');
  return window;
}

export interface LockWindow {
  window: BrowserWindow;
  isPrimary: boolean;
}

/**
 * One window per display. A single fullscreen window would leave the other
 * screens live, which both looks broken and hides the countdown on a laptop
 * that is docked to an external monitor.
 */
export function createLockWindows(): LockWindow[] {
  const displays = screen.getAllDisplays();
  const primaryId = screen.getPrimaryDisplay().id;

  return displays.map((display) => {
    const isPrimary = display.id === primaryId;
    const window = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      show: false,
      movable: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      fullscreenable: false,
      skipTaskbar: true,
      hasShadow: false,
      enableLargerThanScreen: true,
      backgroundColor: '#05050a',
      icon: process.platform === 'linux' ? appIcon : undefined,
      autoHideMenuBar: true,
      webPreferences: {
        preload,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false,
      },
    });

    // Screen-saver level floats above the macOS menu bar and the Windows taskbar,
    // so the overlay covers the display without a fullscreen space transition.
    window.setAlwaysOnTop(true, 'screen-saver', 1);
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.setMenuBarVisibility(false);
    window.once('ready-to-show', () => {
      window.setBounds(display.bounds);
      window.show();
      if (isPrimary) window.focus();
    });

    hardenNavigation(window);
    load(window, 'lock', { primary: isPrimary ? '1' : '0' });
    return { window, isPrimary };
  });
}
