/**
 * Mini-store for the screen stories: the core's abstract runtime bound to one
 * `$state.raw` cell — the same loop the app binds to its runes, without
 * persistence or router. The screens stay pure; the story supplies the state
 * they play against, so every screen is fully USABLE inside Storybook (edit,
 * undo, redo — in memory, thrown away with the story).
 */

import type { Portfolio } from '@project-review/core/model/portfolio'
import type { DomainEvent } from '@project-review/core/events'
import type { Command } from '@project-review/core/commands'
import { execute, hydrate, redo, undo } from '@project-review/core/runtime/editing'

export interface ScreenStore {
  readonly present: Portfolio
  readonly past: readonly DomainEvent[]
  readonly future: readonly DomainEvent[]
  readonly dispatch: (command: Command) => DomainEvent | undefined
  readonly undo: () => void
  readonly redo: () => void
}

export const createScreenStore = (initial: Portfolio): ScreenStore => {
  let state = $state.raw(hydrate(initial))

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
    dispatch: (command) => {
      const result = execute(state, command)
      state = result.state
      return result.event
    },
    undo: () => {
      state = undo(state)
    },
    redo: () => {
      state = redo(state)
    },
  }
}
