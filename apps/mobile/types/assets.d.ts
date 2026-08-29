/**
 * Ambient declarations for the asset types Metro bundles.
 *
 * Purpose
 *   Metro turns `import tile from './tile.png'` into a module whose default export is an
 *   image source. TypeScript has no idea, and `expo/types` declares only the CSS family, so
 *   without this file an asset import is an error and the alternative — `require()` — is
 *   forbidden by the workspace lint contract (`@typescript-eslint/no-require-imports`).
 *
 * Scope
 *   Only the formats actually committed under `apps/mobile/assets`. Adding a format here is
 *   a deliberate act: it should follow a real asset, not anticipate one.
 */

declare module '*.png' {
  const source: import('react-native').ImageSourcePropType;
  export default source;
}
