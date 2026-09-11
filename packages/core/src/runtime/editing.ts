/**
 * Editing — THE ABSTRACT RUNTIME: the one front loop (the command bus), the
 * equivalent of a webapp's dispatcher or a CLI's `main(argv)`. It executes
 * any USE-CASE (a `Command` variant — the business intents: rename a project,
 * settle a decision, undo…), orchestrating the domain algebra and the
 * second-rank services — the history register, and an eventual tracer plugs
 * at the seam `execute` exposes — while carrying ZERO business rule of its
 * own: the HANDLERS of the use-cases are the per-aggregate rules in
 * `commands/*.ts` (completion/refusal) plus the event's own `apply`
 * semantics, and the closed union guarantees at compile time that no command
 * is left without a handler. The app does nothing but bind this state to its
 * runes.
 */

import type { Portfolio } from '../model/portfolio'
import { decide, type Command } from '../commands'
import { apply, invert, type DomainEvent } from '../events'
import {
  emptyHistory,
  hydrate as hydrateHistory,
  record,
  stepBack,
  stepForward,
  type History,
} from '../events/history'

/** The whole undoable state: the current portfolio and its event trail. */
export interface RuntimeState {
  /** Current portfolio — the single source of truth. */
  readonly present: Portfolio
  /** The undo/redo register around it. */
  readonly log: History
}

/** What one `execute` yields: the next state, and the seam of observation. */
export interface ExecuteResult {
  readonly state: RuntimeState
  /**
   * The recorded event — or `undefined` for a refused/trivial command (see
   * `decide`'s contract), in which case `state` is the input, unchanged.
   * A tracer or the persistence would branch here.
   */
  readonly event: DomainEvent | undefined
}

/**
 * Builds the editing state: empty log, or a `log` restored from storage
 * (re-capped). CONSISTENCY IS THE CALLER'S JOB: `portfolio` must be the very
 * one those events led to — the persistence policy guarantees it by storing
 * the two in ONE envelope, read back together or not at all. Nothing is
 * replayed here; `portfolio` is trusted as-is.
 */
export const hydrate = (portfolio: Portfolio, log?: History): RuntimeState => ({
  present: portfolio,
  log: log === undefined ? emptyHistory : hydrateHistory(log),
})

/**
 * Decides the command against `present`; when `decide` yields an event,
 * applies it and records it. An INAPPLICABLE or TRIVIAL command is a SILENT
 * no-op: nothing enters the log, nothing can be undone that never happened —
 * the caller reads `event: undefined` to react (e.g. a refused renumbering).
 */
export const execute = (state: RuntimeState, command: Command): ExecuteResult => {
  const event = decide(state.present, command)
  if (event === undefined) return { state, event: undefined }
  return {
    state: {
      present: apply(state.present, event),
      log: record(state.log, event),
    },
    event,
  }
}

/**
 * Steps one event back: the register hands the event over, `invert` turns it
 * into its own antidote, `apply` executes it. Identity on an empty past.
 */
export const undo = (state: RuntimeState): RuntimeState => {
  const step = stepBack(state.log)
  if (step === undefined) return state
  return {
    present: apply(state.present, invert(step.event)),
    log: step.history,
  }
}

/** Steps one undone event forward again. Identity on an empty future. */
export const redo = (state: RuntimeState): RuntimeState => {
  const step = stepForward(state.log)
  if (step === undefined) return state
  return {
    present: apply(state.present, step.event),
    log: step.history,
  }
}
