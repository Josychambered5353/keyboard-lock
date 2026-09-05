import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/constants.js';
import type {
  AppSettings,
  EnvironmentInfo,
  LockStatus,
  LockSummary,
  ShortcutCheckResult,
  StartLockResult,
} from '../shared/types.js';

type Unsubscribe = () => void;

function subscribe<T>(channel: string, listener: (payload: T) => void): Unsubscribe {
  const handler = (_event: Electron.IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.off(channel, handler);
}

/**
 * The only surface the renderers get. Everything is an explicit, typed call —
 * no `ipcRenderer`, no Node, no dynamic channel names.
 */
const api = {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.getSettings),
  setSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.setSettings, patch),
  resetSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.resetSettings),
  getEnvironment: (): Promise<EnvironmentInfo> => ipcRenderer.invoke(IPC.getEnvironment),

  startLock: (durationMs: number): Promise<StartLockResult> =>
    ipcRenderer.invoke(IPC.startLock, { durationMs }),
  stopLock: (source: 'mouse' | 'cancelled'): Promise<boolean> =>
    ipcRenderer.invoke(IPC.stopLock, source),
  getLockStatus: (): Promise<LockStatus> => ipcRenderer.invoke(IPC.getLockStatus),

  checkShortcut: (accelerator: string): Promise<ShortcutCheckResult> =>
    ipcRenderer.invoke(IPC.checkShortcut, accelerator),

  minimizeWindow: (): Promise<void> => ipcRenderer.invoke(IPC.minimizeWindow),
  closeWindow: (): Promise<void> => ipcRenderer.invoke(IPC.closeWindow),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke(IPC.openExternal, url),

  onLockTick: (listener: (status: LockStatus) => void): Unsubscribe =>
    subscribe(IPC.onLockTick, listener),
  onLockStarted: (listener: (status: LockStatus) => void): Unsubscribe =>
    subscribe(IPC.onLockStarted, listener),
  onLockEnded: (listener: (summary: LockSummary) => void): Unsubscribe =>
    subscribe(IPC.onLockEnded, listener),
  onSettingsChanged: (listener: (settings: AppSettings) => void): Unsubscribe =>
    subscribe(IPC.onSettingsChanged, listener),
} as const;

export type KeyboardLockApi = typeof api;

contextBridge.exposeInMainWorld('keyboardLock', api);
