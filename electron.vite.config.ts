import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

const root = __dirname;

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(root, 'src/main/index.ts') },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(root, 'src/preload/index.ts') },
      },
    },
  },
  renderer: {
    root: resolve(root, 'src/renderer'),
    resolve: {
      alias: {
        '@shared': resolve(root, 'src/shared'),
      },
    },
    server: {
      fs: { allow: [root] },
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(root, 'src/renderer/index.html'),
          lock: resolve(root, 'src/renderer/lock.html'),
        },
      },
    },
  },
});
