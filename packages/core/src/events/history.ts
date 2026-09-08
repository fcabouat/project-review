/**
 * History — a bounded, PURE register of domain events: what was applied
 * (`past`), what was undone (`future`), and the three moves between them.
 * It records and hands events back, nothing more: no `apply`, no `invert`,
 * no portfolio — interpreting an event is its consumer's job (the abstract
 * runtime, `runtime/editing.ts`).
 */

import type { DomainEvent } from './index'

/**
 * Upper bound of the register, IN RAM AND IN STORAGE alike (the persistence
 * policy shares this constant): the oldest event is dropped when a record
 * would exceed it. The unit is EVENTS, not bytes — 500 field edits are tiny,
 * while a single `PortfolioReplaced` carries two full portfolios. No
 * notification on drop: losing the 501st-oldest undo step is not news.
 */
export const HISTORY_LIMIT = 500

/** The undo/redo trail — what persistence saves and hydration restores. */
export interface History {
  /** Applied events, from oldest to most recent (at most {@link HISTORY_LIMIT}). */
  readonly past: readonly DomainEvent[]
  /** Undone events, in the order in which they would be redone. */
  readonly future: readonly DomainEvent[]
}

/** Nothing to undo, nothing to redo. */
export const emptyHistory: History = { past: [], future: [] }

/**
 * A restored trail, with the cap re-applied: storage is trusted for content
 * (same schema version, checked by the persistence policy) but never for
 * size — an oversized past is trimmed to its most recent events.
 */
export const hydrate = (trail: History): History => ({
  past: trail.past.slice(-HISTORY_LIMIT),
  future: trail.future,
})

/**
 * Records one applied event: pushed onto `past` (dropping the oldest beyond
 * {@link HISTORY_LIMIT}), `future` cleared — a new edit is a new branch, what
 * was undone can no longer be redone.
 */
export const record = (history: History, event: DomainEvent): History => ({
  past: [...history.past, event].slice(-HISTORY_LIMIT),
  future: [],
})

/** One move of the cursor: the event that crossed it, and the trail after. */
export interface Step {
  readonly event: DomainEvent
  readonly history: History
}

/**
 * Steps one event back: the most recent of `past` is handed to the caller
 * (to be inverted and applied by whoever understands it) and moved to the
 * head of `future`. `undefined` on an empty `past` — nothing can be undone
 * that never happened.
 */
export const stepBack = (history: History): Step | undefined => {
  const event = history.past.at(-1)
  if (event === undefined) return undefined
  return {
    event,
    history: {
      past: history.past.slice(0, -1),
      future: [event, ...history.future],
    },
  }
}

/**
 * Steps one undone event forward again. `undefined` on an empty `future`.
 * Same cap as {@link record}: a hydrated trail could otherwise overflow it.
 */
export const stepForward = (history: History): Step | undefined => {
  const event = history.future[0]
  if (event === undefined) return undefined
  return {
    event,
    history: {
      past: [...history.past, event].slice(-HISTORY_LIMIT),
      future: history.future.slice(1),
    },
  }
}
