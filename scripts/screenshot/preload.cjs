/**
 * Stand-in for the real preload bridge.
 *
 * The screenshot harness renders the actual built renderer bundle, so the
 * images in the README are the real UI — only the data behind it is seeded, so
 * every capture shows the same clock and the same counters.
 */
const { contextBridge } = require('electron');

const argument = process.argv.find((value) => value.startsWith('--kl-scenario='));
const scenario = argument
  ? JSON.parse(Buffer.from(argument.replace('--kl-scenario=', ''), 'base64').toString('utf8'))
  : {};

const noop = async () => undefined;
const noSubscription = () => () => undefined;

contextBridge.exposeInMainWorld('keyboardLock', {
  getSettings: async () => scenario.settings,
  getEnvironment: async () => scenario.environment,
  getLockStatus: async () => scenario.status,
  startLock: async () => ({ ok: true }),
  stopLock: async () => true,
  checkShortcut: async () => ({ valid: true, available: true }),
  minimizeWindow: noop,
  closeWindow: noop,
  openExternal: noop,
  onLockTick: noSubscription,
  onLockStarted: noSubscription,
  onLockEnded: noSubscription,
  onSettingsChanged: noSubscription,
});
