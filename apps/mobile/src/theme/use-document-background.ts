/**
 * Paint the browser's own document, not just the app's canvas.
 *
 * Purpose
 *   React Native Web mounts the app inside `#root`, and every view in it is transparent by
 *   default. `AppBackground` paints the canvas on a view *inside* that root, so `html`,
 *   `body` and `#root` themselves stay unpainted — and the browser shows its own white
 *   behind and around the app. Three places that is visible: the moment before the bundle
 *   hydrates, the overscroll rubber-band, and any area a screen does not cover.
 *
 * Why it is a hook and not `+html.tsx` alone
 *   `app/+html.tsx` paints the *initial* colour, before any JavaScript runs, which is what
 *   removes the flash of white. It cannot follow the theme, because it is rendered once at
 *   export time. This hook is the other half: it re-paints the document whenever the active
 *   theme changes, so a reader who chooses light does not keep a near-black overscroll.
 *
 * No-op off the web
 *   On a device there is no document, and the native root view is already opaque.
 *
 * Dependencies
 *   React and React Native's `Platform`. No theme import — the caller passes the colour, so
 *   this module has no opinion about which one.
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';

/** The parts of the DOM this hook touches, named so no `any` is needed. */
interface StyledElement {
  readonly style: { backgroundColor: string };
}

/** The subset of `document` used here. */
interface DocumentLike {
  readonly documentElement: StyledElement | null;
  readonly body: StyledElement | null;
}

/**
 * Keep the document's background in step with the active theme.
 *
 * @param color - The canvas colour to paint, from the active theme.
 *
 * Side effects: on the web, writes `background-color` on `<html>` and `<body>`.
 */
export function useDocumentBackground(color: string): void {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const doc = (globalThis as { document?: DocumentLike }).document;
    if (doc === undefined) return;

    for (const element of [doc.documentElement, doc.body]) {
      if (element !== null) element.style.backgroundColor = color;
    }
  }, [color]);
}
