/**
 * The bundled texture tiles.
 *
 * Purpose
 *   The one place a texture PNG is named. Separated from `./texture.ts` because an asset
 *   import only resolves inside Metro: keeping the asset table here leaves the token table
 *   next door pure, and therefore unit-testable under Node.
 *
 * The files
 *   Baked by `tools/textures/build-textures.mjs`, six seamless white-on-transparent tiles
 *   totalling about a kilobyte. Regenerate rather than edit: the script is deterministic,
 *   so a diff in `apps/mobile/assets/textures/` means a motif changed.
 *
 * Dependencies
 *   React Native's `ImageSourcePropType` (via `types/assets.d.ts`), and `./texture` for the
 *   motif names.
 */

import type { ImageSourcePropType } from 'react-native';

import crossTile from '../../assets/textures/cross.png';
import dotsTile from '../../assets/textures/dots.png';
import gridTile from '../../assets/textures/grid.png';
import hatchTile from '../../assets/textures/hatch.png';
import ringsTile from '../../assets/textures/rings.png';
import wavesTile from '../../assets/textures/waves.png';

import type { TextureName } from './texture';

/** Every baked tile, by motif name. */
export const textureSource = {
  cross: crossTile,
  hatch: hatchTile,
  grid: gridTile,
  dots: dotsTile,
  waves: wavesTile,
  rings: ringsTile,
} as const satisfies Record<TextureName, ImageSourcePropType>;
