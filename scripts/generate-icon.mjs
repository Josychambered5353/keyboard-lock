#!/usr/bin/env node
/**
 * Renders the app icon to `build/icon.png`.
 *
 * electron-builder derives the .icns and .ico from this single 1024px source,
 * so the repository carries one generated asset instead of three binaries.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createCanvas,
  paint,
  roundedRectSdf,
  solid,
  topArcSdf,
  verticalGradient,
} from './lib/canvas.mjs';
import { encodePng } from './lib/png.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIZE = 1024;

const INK_TOP = [26, 30, 46];
const INK_BOTTOM = [9, 10, 16];
const KEY_HOLE = [12, 14, 22];
const ACCENT_TOP = [140, 163, 255];
const ACCENT_BOTTOM = [88, 116, 240];

const canvas = createCanvas(SIZE, SIZE);

// 1. Rounded app tile.
paint(
  canvas,
  (x, y) => roundedRectSdf(x, y, SIZE / 2, SIZE / 2, SIZE / 2, SIZE / 2, 232),
  verticalGradient(0, SIZE, INK_TOP, INK_BOTTOM),
);

// The glyph is drawn around its own centre, then lifted so shackle and body
// together sit optically centred in the tile.
const LIFT = 150;

// 2. Padlock shackle rising out of the keyboard.
const KEYBOARD_TOP = 566 - LIFT;
paint(
  canvas,
  (x, y) => topArcSdf(x, y, SIZE / 2, KEYBOARD_TOP, 106, 46),
  verticalGradient(KEYBOARD_TOP - 160, KEYBOARD_TOP, ACCENT_TOP, ACCENT_BOTTOM),
);

// 3. Keyboard body.
const BODY = { cx: SIZE / 2, cy: 716 - LIFT, halfWidth: 284, halfHeight: 150, radius: 52 };
paint(
  canvas,
  (x, y) => roundedRectSdf(x, y, BODY.cx, BODY.cy, BODY.halfWidth, BODY.halfHeight, BODY.radius),
  verticalGradient(BODY.cy - BODY.halfHeight, BODY.cy + BODY.halfHeight, ACCENT_TOP, ACCENT_BOTTOM),
);

// 4. Keys, punched out of the body in the tile's own ink.
const key = (cx, cy, halfWidth, halfHeight, radius) =>
  paint(
    canvas,
    (x, y) => roundedRectSdf(x, y, cx, cy, halfWidth, halfHeight, radius),
    solid(KEY_HOLE),
  );

const KEY_HALF_WIDTH = 46;
const KEY_HALF_HEIGHT = 28;
const COLUMN_GAP = 130;
for (const row of [630 - LIFT, 706 - LIFT]) {
  for (let column = 0; column < 4; column += 1) {
    const cx = SIZE / 2 - 1.5 * COLUMN_GAP + column * COLUMN_GAP;
    key(cx, row, KEY_HALF_WIDTH, KEY_HALF_HEIGHT, 16);
  }
}
key(SIZE / 2, 786 - LIFT, 176, 24, 16);

mkdirSync(join(root, 'build'), { recursive: true });
const file = join(root, 'build/icon.png');
writeFileSync(file, encodePng(SIZE, SIZE, canvas.data));
console.log(`icon written: ${file} (${SIZE}x${SIZE})`);
