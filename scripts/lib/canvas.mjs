/**
 * A tiny signed-distance-field rasteriser.
 *
 * The app icon is a handful of rounded rectangles and one arc, which is far
 * less code to draw analytically than it is to pull in an image toolchain —
 * and it keeps the icon reproducible with `npm run icons`.
 */
export function createCanvas(width, height) {
  const data = Buffer.alloc(width * height * 4);
  return { width, height, data };
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/** 1px analytic anti-aliasing: coverage falls off across the pixel the edge crosses. */
const coverage = (distance) => clamp01(0.5 - distance);

export function roundedRectSdf(px, py, cx, cy, halfWidth, halfHeight, radius) {
  const qx = Math.abs(px - cx) - (halfWidth - radius);
  const qy = Math.abs(py - cy) - (halfHeight - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius;
}

/** Upper half of a ring — the padlock shackle. */
export function topArcSdf(px, py, cx, cy, midRadius, thickness) {
  const ring = Math.abs(Math.hypot(px - cx, py - cy) - midRadius) - thickness / 2;
  return Math.max(ring, py - cy);
}

export function paint(canvas, sdf, colorAt) {
  const { width, height, data } = canvas;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = coverage(sdf(x + 0.5, y + 0.5));
      if (alpha <= 0) continue;
      const [r, g, b, a = 255] = colorAt(x + 0.5, y + 0.5);
      const srcAlpha = (alpha * a) / 255;
      const index = (y * width + x) * 4;
      const dstAlpha = data[index + 3] / 255;
      const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);
      if (outAlpha <= 0) continue;
      const src = [r, g, b];
      for (let channel = 0; channel < 3; channel += 1) {
        const dst = data[index + channel];
        data[index + channel] = Math.round(
          (src[channel] * srcAlpha + dst * dstAlpha * (1 - srcAlpha)) / outAlpha,
        );
      }
      data[index + 3] = Math.round(outAlpha * 255);
    }
  }
}

export const solid = (rgb) => () => rgb;

/** Vertical gradient between two colours across `[fromY, toY]`. */
export const verticalGradient = (fromY, toY, fromColor, toColor) => (_x, y) => {
  const ratio = clamp01((y - fromY) / (toY - fromY));
  return [
    Math.round(fromColor[0] + (toColor[0] - fromColor[0]) * ratio),
    Math.round(fromColor[1] + (toColor[1] - fromColor[1]) * ratio),
    Math.round(fromColor[2] + (toColor[2] - fromColor[2]) * ratio),
    255,
  ];
};
