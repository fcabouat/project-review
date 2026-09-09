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
