import type { KeyboardLockApi } from './index.js';

declare global {
  interface Window {
    keyboardLock: KeyboardLockApi;
  }
}

export {};
