/**
 * The theme provider and its hooks.
 *
 * Purpose
 *   Delivers decision `D-01`: a real light theme, a three-position switcher, and the
 *   choice remembered across launches. Mounted once in `app/_layout.tsx`; every component
 *   reads it through {@link useTheme}, never through a module constant.
 *
 * Key responsibilities
 *   - Hold the reader's preference and resolve it, on every render, against the platform's
 *     current colour scheme. "System" therefore keeps following the OS rather than
 *     freezing whatever it said at launch.
 *   - Load the stored preference once on mount, and persist every change.
 *   - Expose the resolved `Theme` separately from the controller, so a component that only
 *     paints does not re-render when the switcher's own state changes shape.
 *
 * Why the preference loads asynchronously and the app paints anyway
 *   The key/value store is a promise on every platform. Blocking the first paint on it
 *   would cost a frame on the web for a value that is dark by default anyway, so the tree
 *   renders in {@link DEFAULT_THEME_NAME} and swaps once the read resolves. `isHydrated`
 *   is published for anyone who needs to wait — the splash screen does.
 *
 * Dependencies
 *   `@/api/storage` for persistence (cross-platform by construction — decision `T-01`
 *   forbids a native-only store here), and the pure resolution logic in
 *   `./theme-preference`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import {
  deviceKeyValueStore,
  THEME_PREFERENCE_STORAGE_KEY,
  type KeyValueStore,
} from '@/api/storage';

import type { Theme, ThemeName } from './theme-contract';
import {
  DEFAULT_THEME_PREFERENCE,
  parseThemePreference,
  resolveThemeName,
  type ThemePreference,
} from './theme-preference';
import { themeFor } from './themes';

/** What {@link useThemeController} hands back. */
export interface ThemeController {
  /** What the reader picked: `'system' | 'light' | 'dark'`. */
  readonly preference: ThemePreference;
  /** Which palette that resolves to right now. */
  readonly themeName: ThemeName;
  /** What the platform reports, or `null` when it reports nothing. */
  readonly systemScheme: ThemeName | null;
  /** False until the stored preference has been read back. */
  readonly isHydrated: boolean;
  /** Change the preference and persist it. */
  setPreference: (preference: ThemePreference) => void;
}

/** Inputs to {@link ThemeProvider}. */
export interface ThemeProviderProps {
  readonly children: ReactNode;
  /**
   * Where the preference is persisted. Defaults to the platform's device store; tests and
   * Storybook-style harnesses pass an in-memory one.
   */
  readonly store?: KeyValueStore | undefined;
  /**
   * Skip the asynchronous load and start here. Only for tests and for the Playwright
   * walkthrough, which needs a deterministic theme without racing a storage read.
   */
  readonly initialPreference?: ThemePreference | undefined;
}

const ThemeValueContext = createContext<Theme | null>(null);
const ThemeControllerContext = createContext<ThemeController | null>(null);

/**
 * Normalise React Native's colour scheme into a `ThemeName`.
 *
 * @param scheme - `'light' | 'dark' | null | undefined`, per `useColorScheme()`.
 * @returns The matching theme name, or `null` when the platform reports nothing.
 */
function toThemeName(scheme: string | null | undefined): ThemeName | null {
  return scheme === 'light' || scheme === 'dark' ? scheme : null;
}

/** What {@link useStoredPreference} needs. */
interface StoredPreferenceOptions {
  readonly store: KeyValueStore;
  readonly initialPreference: ThemePreference | undefined;
  readonly setPreferenceState: (preference: ThemePreference) => void;
  readonly setIsHydrated: (isHydrated: boolean) => void;
}

/**
 * Read the persisted preference once, on mount.
 *
 * `store` is a dependency rather than a ref because the default is a module singleton and a
 * test passes one object for the life of the test. A caller that built a new store on every
 * render would re-read the preference on every render — a bug in the caller, and one this
 * dependency list makes visible rather than hides.
 *
 * @param options - See {@link StoredPreferenceOptions}.
 *
 * Side effects: one read from the key/value store, cancelled on unmount.
 */
function useStoredPreference({
  store,
  initialPreference,
  setPreferenceState,
  setIsHydrated,
}: StoredPreferenceOptions): void {
  useEffect(() => {
    if (initialPreference !== undefined) return;

    let isCurrent = true;
    void store.getString(THEME_PREFERENCE_STORAGE_KEY).then((stored) => {
      if (!isCurrent) return;
      setPreferenceState(parseThemePreference(stored));
      setIsHydrated(true);
    });

    return (): void => {
      isCurrent = false;
    };
    // `setPreferenceState` and `setIsHydrated` are `useState` setters, which React
    // guarantees are stable; listing them would be noise, not safety.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPreference, store]);
}

/**
 * Provide the active theme to the tree.
 *
 * @param props - See {@link ThemeProviderProps}.
 * @returns The tree, wrapped in both theme contexts.
 *
 * Side effects: reads the stored preference once on mount; writes it on every change.
 */
export function ThemeProvider({
  children,
  store = deviceKeyValueStore,
  initialPreference,
}: ThemeProviderProps): JSX.Element {
  const [preference, setPreferenceState] = useState<ThemePreference>(
    initialPreference ?? DEFAULT_THEME_PREFERENCE,
  );
  const [isHydrated, setIsHydrated] = useState(initialPreference !== undefined);
  const systemScheme = toThemeName(useColorScheme());

  useStoredPreference({ store, initialPreference, setPreferenceState, setIsHydrated });

  const setPreference = useCallback(
    (next: ThemePreference): void => {
      setPreferenceState(next);
      void store.setString(THEME_PREFERENCE_STORAGE_KEY, next);
    },
    [store],
  );

  const themeName = resolveThemeName(preference, systemScheme);
  const theme = themeFor(themeName);

  const controller = useMemo<ThemeController>(
    () => ({ preference, themeName, systemScheme, isHydrated, setPreference }),
    [preference, themeName, systemScheme, isHydrated, setPreference],
  );

  return (
    <ThemeControllerContext.Provider value={controller}>
      <ThemeValueContext.Provider value={theme}>{children}</ThemeValueContext.Provider>
    </ThemeControllerContext.Provider>
  );
}

/**
 * The palette currently rendering.
 *
 * @returns The active {@link Theme}.
 * @throws Error when called outside a {@link ThemeProvider}. Loud on purpose: silently
 *   falling back to dark would ship a component that is invisible in light mode and looks
 *   fine to whoever wrote it (rule 6 — no silent failures).
 */
export function useTheme(): Theme {
  const theme = useContext(ThemeValueContext);
  if (theme === null) {
    throw new Error('useTheme() requires a <ThemeProvider>. Mount one in app/_layout.tsx.');
  }
  return theme;
}

/**
 * The switcher's state and its setter.
 *
 * @returns The {@link ThemeController}.
 * @throws Error when called outside a {@link ThemeProvider}.
 */
export function useThemeController(): ThemeController {
  const controller = useContext(ThemeControllerContext);
  if (controller === null) {
    throw new Error(
      'useThemeController() requires a <ThemeProvider>. Mount one in app/_layout.tsx.',
    );
  }
  return controller;
}
