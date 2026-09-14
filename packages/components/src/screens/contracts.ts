/**
 * Props vocabulary of the pure screens — the shapes a host must provide.
 *
 * The screens import no store, no router, no infrastructure: whoever mounts
 * them (the app's wiring, a story's mini-store) speaks these types through
 * props. `Route` is structurally the same union the infrastructure's hash
 * router parses — declared here too because neither package may import the
 * other; TypeScript's structural typing makes the two interchangeable at the
 * app's seam. `Dispatch` is package-wide (`../contracts`), re-exported here
 * so the screens keep a single import site.
 */

export type { Dispatch, SavePhase, SaveState } from '../contracts'
/** The pending-input port the text fields declare (`../editor/drafts`), named
 * here too so a host has ONE import site for everything it must provide. */
export type { DraftRegistry } from '../editor/drafts'

import type { SaveState } from '../contracts'

/** One screen address. `sheet` carries the project id read from the hash. */
export type Route =
  | { readonly name: 'review' }
  | { readonly name: 'projects' }
  | { readonly name: 'settings' }
  | { readonly name: 'history' }
  | { readonly name: 'about' }
  | { readonly name: 'sheet'; readonly id: string }

/**
 * UI contract of the local save, however the host wires it — the switch, the
 * live save state, and the two questions the switch cannot answer on its own.
 *
 * Turning the save back ON writes over whatever the storage holds, so the host
 * reads it first. When it finds a document that is still READABLE — the save
 * was off long enough for one to be sitting there — nothing is written and
 * {@link pendingRestore} goes true: the open document and the stored one are
 * two candidates, and choosing between them is a person's call, not a
 * switch's. The three answers are exhaustive and all reversible: restore the
 * stored copy (an undoable replacement), keep the open one (the stored copy is
 * replaced, deliberately), or step back and leave the save off.
 *
 * A `conflict` asks the same question at the other moment — a second tab wrote
 * while this one was working — and offers the same two real answers,
 * {@link takeStored} and {@link keepMine}. Nothing merges the two: a merge
 * nobody asked for would be a guess presented as a fact.
 */
export interface PersistenceControl {
  readonly enabled: boolean
  /**
   * `false` when this browser offers NO storage at all — the access throws
   * (blocked third-party storage, a restricted context) or there is none. The
   * switch then governs nothing and says so instead of pretending; {@link save}
   * reports the `unavailable` phase for as long as the app runs.
   */
  readonly available: boolean
  /**
   * The live save state, or `undefined` when the switch is off — the one case
   * where nothing is being saved AND nothing needs saying. A host with no
   * storage answers the `unavailable` phase here, permanently.
   */
  readonly save: SaveState | undefined
  readonly toggle: (enabled: boolean) => void
  /** `true` while the switch is waiting on that choice; the save stays off
   * and not one byte has been written. */
  readonly pendingRestore: boolean
  /** Load the stored document into the editor (undoable), then save. */
  readonly restore: () => void
  /** Keep the open document and let it replace the stored copy. */
  readonly keepOpen: () => void
  /** Step back: the stored copy is untouched and the save stays off. */
  readonly dismissRestore: () => void
  /** Conflict, first answer: load what the other tab saved (undoable). */
  readonly takeStored: () => void
  /** Conflict, second answer: the open document wins and replaces it. */
  readonly keepMine: () => void
}

/**
 * Reader-side color scheme of the EDITOR chrome — `system` follows the OS.
 * A reader preference, not a portfolio setting: it never travels with the
 * file, so it is no domain event either (the host keeps it app-side, next to
 * the local-save flag). The slides are an artifact and stay light throughout.
 */
export type ColorScheme = 'system' | 'light' | 'dark'

/** UI contract of the scheme picker (Settings ▸ Appearance), host-wired. */
export interface AppearanceControl {
  readonly scheme: ColorScheme
  readonly setScheme: (next: ColorScheme) => void
}

/**
 * Live verdict on where the theme font comes from — and every answer is a
 * LOCAL one, because the app asks no third party for a font:
 *  - `embedded` — the portfolio's own `fontFaces` cover the family and the
 *    browser successfully loaded the requested face;
 *  - `bundled` — the family's woff2 ship inside this build;
 *  - `served` / `missing` — the probe verdicts for a family DEPLOYED beside
 *    the app (`fonts/<family>/`). Probing is a browser affair: the host wires
 *    the infrastructure's `document.fonts` probe in and passes the verdict
 *    down; `missing` means the text renders on the system stack, said out
 *    loud rather than left to be noticed;
 *  - `unknown` — still probing, or no way to ask. The card never flashes a
 *    wrong «not found».
 */
export type FontStatus = 'unknown' | 'served' | 'missing' | 'embedded' | 'bundled'
