/**
 * Bake the surface textures into seamless PNG tiles.
 *
 * Purpose
 *   Port-map risk #6: React Native has no `CustomPainter`, and `react-native-svg`
 *   `<Pattern>` is slow at full-screen size. The mitigation the map names is pre-baked
 *   seamless tiles, repeated by the platform's own image compositor — O(1) per frame, no
 *   vector work at runtime. This script is the "pre-baked" half.
 *
 * Output
 *   `apps/mobile/assets/textures/<name>.png`, one per motif in `motifs.mjs`. Each is white
 *   with a varying alpha, so the app tints it per theme rather than shipping two sets.
 *
 * Run
 *   `node tools/textures/build-textures.mjs`
 *   Deterministic: the same input always writes the same bytes, so a re-run that changes a
 *   file means a motif changed.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MOTIFS } from './motifs.mjs';
import { encodePng } from './png.mjs';

/** Where the tiles are written, relative to the repository root. */
const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'apps', 'mobile', 'assets', 'textures');

/** The tile's ink. White, so `Image` `tintColor` can repaint it for either theme. */
const INK = 255;

/**
 * Render one motif into an RGBA raster.
 *
 * @param {{ period: number, paint: (x: number, y: number, period: number) => number }} motif
 * @returns {{ width: number, height: number, pixels: Uint8Array }} The raster.
 */
function render(motif) {
  const size = motif.period;
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const alpha = Math.round(255 * Math.min(1, Math.max(0, motif.paint(x, y, size))));
      const at = (y * size + x) * 4;
      pixels[at] = INK;
      pixels[at + 1] = INK;
      pixels[at + 2] = INK;
      pixels[at + 3] = alpha;
    }
  }

  return { width: size, height: size, pixels };
}

mkdirSync(OUTPUT_DIR, { recursive: true });

for (const [name, motif] of Object.entries(MOTIFS)) {
  const file = join(OUTPUT_DIR, `${name}.png`);
  const png = encodePng(render(motif));
  writeFileSync(file, png);
  console.log(`${name.padEnd(6)} ${String(motif.period).padStart(2)}px  ${String(png.length).padStart(4)} B  ${file}`);
}
