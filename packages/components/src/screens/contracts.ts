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

export type { Dispatch } from '../contracts'

/** One screen address. `sheet` carries the project id read from the hash. */
export type Route =
  | { readonly name: 'review' }
  | { readonly name: 'projects' }
  | { readonly name: 'settings' }
  | { readonly name: 'history' }
  | { readonly name: 'sheet'; readonly id: string }

/** UI contract of the local-save switch, however the host wires it. */
export interface PersistenceControl {
  readonly enabled: boolean
  /** Last write failure, `null` while writes land — cleared by the next success. */
  readonly lastError: string | null
  readonly toggle: (enabled: boolean) => void
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
 * Live verdict on the locally served font (today: Marianne, the one family
 * deployed ALONGSIDE the app). Probing is a browser affair — the host wires
 * the infrastructure's `document.fonts` probe in and passes the verdict down;
 * `unknown` covers "still probing" and "no way to ask" alike, so the card
 * never flashes a wrong «not found».
 */
export type FontStatus = 'unknown' | 'served' | 'missing'
