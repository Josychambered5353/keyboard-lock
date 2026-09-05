#!/usr/bin/env node
/** Runs the Electron screenshot harness against the current build in `out/`. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

if (!existsSync(join(root, 'out/renderer/index.html'))) {
  console.error('No build found. Run `npm run build` first.');
  process.exit(1);
}

// Some shells export ELECTRON_RUN_AS_NODE for tooling; it would start the
// binary as a bare Node runtime with no `app` and no window to capture.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const result = spawnSync(electron, [join(root, 'scripts/screenshot/main.cjs')], {
  stdio: 'inherit',
  cwd: root,
  env,
});

process.exit(result.status ?? 1);
