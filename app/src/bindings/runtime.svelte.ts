/**
 * I bind the core's editing runtime (`RuntimeState`, from
 * `@project-review/core/runtime/editing`) to runes — reactivity is all this
 * module owns; decide, apply and the bounded register live in the core.
 */

import type { IsoDate } from '@project-review/core/values/date'
import type { Portfolio } from '@project-review/core/model/portfolio'
import type { DomainEvent } from '@project-review/core/events'
import type { History } from '@project-review/core/events/history'
import type { Command } from '@project-review/core/commands'
import { execute, hydrate, redo, undo } from '@project-review/core/runtime/editing'

export interface Store {
  /** Current portfolio — the single source of truth. */
  readonly present: Portfolio
  /** Applied events, oldest first — the core register's `past`, verbatim. */
  readonly past: readonly DomainEvent[]
  /** Undone events, in the order in which they would be redone. */
  readonly future: readonly DomainEvent[]
  readonly canUndo: boolean
  readonly canRedo: boolean
  /**
   * Runs the command through the runtime and rebinds the state.
   * The recorded event — or `undefined` for a refused/trivial command — is
   * returned so a view can react (e.g. a command targeting a missing project).
   */
  readonly dispatch: (command: Command) => DomainEvent | undefined
  readonly undo: () => void
  readonly redo: () => void
}

/**
 * Builds a store (`App.svelte` owns the app's single instance). `log`
 * rehydrates undo/redo across reloads — consistency contract and re-capping
 * are the runtime's (`hydrate`).
 */
export const createStore = (initial: Portfolio, log?: History, today?: () => IsoDate): Store => {
  // `$state.raw`, not `$state`: the runtime replaces its state wholesale on
  // every event and never mutates it, so no deep proxy is needed and the data
  // stays plain objects (serializable, comparable). The `.svelte.ts` extension
  // is what lets the runes compile outside a component context.
  let state = $state.raw(hydrate(initial, log))

  const dispatch = (command: Command): DomainEvent | undefined => {
    const result = execute(state, command, today?.())
    state = result.state
    return result.event
  }

  return {
    get present() {
      return state.present
    },
    get past() {
      return state.log.past
    },
    get future() {
      return state.log.future
    },
    get canUndo() {
      return state.log.past.length > 0
    },
    get canRedo() {
      return state.log.future.length > 0
    },
    dispatch,
    undo: () => {
      state = undo(state)
    },
    redo: () => {
      state = redo(state)
    },
  }
}
