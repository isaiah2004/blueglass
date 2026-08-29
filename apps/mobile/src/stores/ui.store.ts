/**
 * Ephemeral chrome: what is open over the reading canvas right now.
 *
 * Purpose
 *   Port map §4's `ui.store`. The sheets, popovers and overlays the prototype tracked as
 *   `sheetOpen`, `searchOpen`, `menuOpen` and the search box's own state — separated from
 *   the reader's state because they have a different lifetime and a different owner. A
 *   sheet closing must not invalidate anything the reader is looking at.
 *
 * The one thing here that outlives its overlay, and why
 *   `searchQuery` and `searchScopeBook` survive the search popover closing. That is
 *   deliberate and it is behaviour worth preserving from the prototype (port map §7):
 *   search runs *over* the reader so the reader never loses their place, and reopening it
 *   shows what was there. Losing the query on close would make "check one more verse"
 *   cost retyping.
 *
 * Pillar 1 lives here
 *   "No floating menus or dock clutter over scripture." Exactly one overlay may be open
 *   at a time, and that is enforced by the actions rather than left to call sites:
 *   opening the search closes the translation menu, and so on. A rule spread across
 *   twelve `onPress` handlers is a rule that will be broken by the thirteenth.
 *
 * Dependencies
 *   `zustand` only. Nothing here is persisted: an app that reopened with a sheet
 *   half-raised would be a bug, not a convenience.
 */

import { create } from 'zustand';

/** Which single overlay is open over the canvas, if any. */
export type ReaderOverlay = 'none' | 'search' | 'translations' | 'reference-picker' | 'sheet';

/** The chrome's state. */
export interface UiState {
  readonly overlay: ReaderOverlay;
  /** Survives the search overlay closing — see the module header. */
  readonly searchQuery: string;
  /** Restrict search to the open book rather than the whole canon. */
  readonly searchScopeBook: boolean;
}

/** State plus the actions that drive it. */
export interface UiSlice extends UiState {
  /** Open one overlay, closing whatever was open. */
  openOverlay(overlay: Exclude<ReaderOverlay, 'none'>): void;
  /** Close whatever is open. Idempotent. */
  closeOverlay(): void;
  /** Open an overlay, or close it if it is already the open one. */
  toggleOverlay(overlay: Exclude<ReaderOverlay, 'none'>): void;
  setSearchQuery(query: string): void;
  setSearchScopeBook(scopeToBook: boolean): void;
  /** Clear the query and its scope. For an explicit "clear search". */
  clearSearch(): void;
}

/** Nothing open, nothing typed. */
const INITIAL_UI_STATE: UiState = {
  overlay: 'none',
  searchQuery: '',
  searchScopeBook: false,
};

/** The chrome store. */
export const useUi = create<UiSlice>()((set, get) => ({
  ...INITIAL_UI_STATE,

  openOverlay(overlay: Exclude<ReaderOverlay, 'none'>): void {
    set({ overlay });
  },

  closeOverlay(): void {
    set({ overlay: 'none' });
  },

  toggleOverlay(overlay: Exclude<ReaderOverlay, 'none'>): void {
    set({ overlay: get().overlay === overlay ? 'none' : overlay });
  },

  setSearchQuery(searchQuery: string): void {
    set({ searchQuery });
  },

  setSearchScopeBook(searchScopeBook: boolean): void {
    set({ searchScopeBook });
  },

  clearSearch(): void {
    set({ searchQuery: '', searchScopeBook: false });
  },
}));

/** Stable selectors. */
export const selectOverlay = (state: UiState): ReaderOverlay => state.overlay;
export const selectSearchQuery = (state: UiState): string => state.searchQuery;
export const selectSearchScopeBook = (state: UiState): boolean => state.searchScopeBook;
/** Whether anything at all is over the canvas — one boolean for the scrim. */
export const selectHasOverlay = (state: UiState): boolean => state.overlay !== 'none';
