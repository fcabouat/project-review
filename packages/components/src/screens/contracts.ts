/**
 * Props vocabulary of the pure screens — the shapes a host must provide.
 *
 * The screens import no store, no router, no infrastructure: whoever mounts
 * them (the app's wiring, a story's mini-store) speaks these types through
 * props. `Route` is structurally the same union the infrastructure's hash
 * router parses — declared here too because neither package may import the
 * other; TypeScript's structural typing makes the two interchangeable at the
 * app's seam.
 */

import type { Command } from '@project-review/core/commands'
import type { DomainEvent } from '@project-review/core/events'

/** One screen address. `sheet` carries the project id read from the hash. */
export type Route =
  | { readonly name: 'review' }
  | { readonly name: 'projects' }
  | { readonly name: 'settings' }
  | { readonly name: 'history' }
  | { readonly name: 'sheet'; readonly id: string }

/**
 * The one edit channel of every screen: a command in, the recorded event out —
 * or `undefined` for a refused/trivial command (see `decide`'s contract),
 * which is exactly what a view needs to react to (e.g. a refused renumbering).
 */
export type Dispatch = (command: Command) => DomainEvent | undefined

/** UI contract of the local-save switch, however the host wires it. */
export interface PersistenceControl {
  readonly enabled: boolean
  /** Last write failure, `null` while writes land — cleared by the next success. */
  readonly lastError: string | null
  readonly toggle: (enabled: boolean) => void
}
