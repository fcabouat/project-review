/**
 * History — a bounded, PURE register of domain events: what was applied
 * (`past`), what was undone (`future`), and the three moves between them.
 * It records and hands events back, nothing more: no `apply`, no `invert`,
 * no portfolio — interpreting an event is its consumer's job (the abstract
 * runtime, `runtime/editing.ts`).
 */

import { MAX_STORED_CHARS } from '../model/budget'
import type { DomainEvent } from './index'

/**
 * Upper bound of the register IN EVENTS, in RAM and in storage alike (the
 * persistence policy shares this constant): the oldest event is dropped when a
 * record would exceed it. No notification on drop: losing the 501st-oldest
 * undo step is not news.
 */
export const HISTORY_LIMIT = 500

/**
 * Upper bound of the register IN CHARACTERS — the second bound, and the reason
 * there are two. A count of events says nothing about what they WEIGH: five
 * hundred field edits are a few kilobytes, while five hundred
 * `PortfolioReplaced` steps carry a thousand whole portfolios. Bounded by
 * number alone, the trail could outweigh the document many times over, and the
 * only thing that ever noticed was `writeState` — which then threw the WHOLE
 * log away at save time, silently and all at once.
 *
 * With a weight budget the eviction is proportional instead: a big replacement
 * pushes out more history than a small field edit, which is exactly what the
 * two cost. A quarter of what the browser will store
 * ({@link MAX_STORED_CHARS}) is the share the trail gets, so a document of any
 * savable size still travels with a log rather than losing it at the ceiling.
 * That share is a policy, not a measurement, and it is stated here rather than
 * buried in an eviction rule.
 */
export const HISTORY_MAX_CHARS = MAX_STORED_CHARS / 4

/** The undo/redo trail — what persistence saves and hydration restores. */
export interface History {
  /** Applied events, from oldest to most recent (at most {@link HISTORY_LIMIT}). */
  readonly past: readonly DomainEvent[]
  /** Undone events, in the order in which they would be redone. */
  readonly future: readonly DomainEvent[]
}

/** Nothing to undo, nothing to redo. */
export const emptyHistory: History = { past: [], future: [] }

/* ------------------------------ the weight ------------------------------- */

/**
 * A value's share of the budget, in characters — the SHAPE of the
 * serialisation without the serialisation. Strings dominate a portfolio by
 * orders of magnitude, so they are counted exactly (plus their two quotes) and
 * everything else takes a flat constant: a number, a boolean and a `null` all
 * write a handful of characters, and no plausible trail is decided by which.
 *
 * IT STOPS AS SOON AS THE ANSWER STOPS MATTERING. `cap` is the budget still
 * unspent; past it the walk returns immediately, so weighing a hundred-megabyte
 * replacement costs the first megabyte of it and nothing more. That is the
 * whole reason this is not `JSON.stringify(event).length`: building the string
 * to discover it is too big is the allocation the budget exists to refuse.
 *
 * A key whose value is `undefined` is an ABSENT key — `JSON.stringify` drops
 * it, and so does this.
 */
const SCALAR_CHARS = 6

const weighValue = (value: unknown, spent: number, cap: number): number => {
  if (spent > cap) return spent
  if (typeof value === 'string') return spent + value.length + 2
  if (value === null || typeof value !== 'object') return spent + SCALAR_CHARS
  if (Array.isArray(value)) {
    let total = spent + 2
    for (const item of value) {
      if (total > cap) return total
      total = weighValue(item, total, cap) + 1
    }
    return total
  }
  let total = spent + 2
  for (const [key, nested] of Object.entries(value)) {
    if (total > cap) return total
    if (nested === undefined) continue
    total = weighValue(nested, total + key.length + 4, cap)
  }
  return total
}

/**
 * What one event costs the budget, MEMOISED on the event itself. Events are
 * immutable and travel by reference through the register — the same object is
 * weighed on every later record — so the cache turns an O(document) walk into
 * one lookup after the first. It is a memo and nothing else: the answer for a
 * given event never changes, and an event the register drops is collected with
 * its entry.
 *
 * The number is ACCURATE while it is under the budget and merely "at least
 * this much" above it, which is all any caller here asks of it.
 */
const weights = new WeakMap<DomainEvent, number>()

const weightOf = (event: DomainEvent): number => {
  const known = weights.get(event)
  if (known !== undefined) return known
  const weight = weighValue(event, 0, HISTORY_MAX_CHARS)
  weights.set(event, weight)
  return weight
}

/**
 * The most recent events of `past` that fit BOTH bounds — the count first
 * (cheap), then the weight, dropping from the OLDEST end.
 *
 * THE NEWEST STEP IS NEVER THE ONE DROPPED, however heavy it is. A trail is
 * replayed backwards: an event missing from the head would leave `undo`
 * inverting the step before it against a document that step never described.
 * So a single replacement past the whole budget is kept, alone — the honest
 * minimum — and `writeState` is the backstop that keeps such a log out of the
 * storage.
 */
const fit = (past: readonly DomainEvent[]): readonly DomainEvent[] => {
  const counted = past.length > HISTORY_LIMIT ? past.slice(-HISTORY_LIMIT) : past
  const newest = counted.length - 1
  let total = 0
  let first = counted.length
  for (let i = newest; i >= 0; i -= 1) {
    const next = total + weightOf(counted[i]!)
    if (i < newest && next > HISTORY_MAX_CHARS) break
    total = next
    first = i
  }
  return first === 0 ? counted : counted.slice(first)
}

/* ------------------------------- the moves ------------------------------- */

/**
 * A restored trail, with both caps re-applied: storage is trusted for content
 * (same schema version, checked by the persistence policy) but never for
 * size — an oversized past is trimmed to its most recent events.
 */
export const hydrate = (trail: History): History => ({
  past: fit(trail.past),
  future: trail.future,
})

/**
 * Records one applied event: pushed onto `past` (dropping the oldest beyond
 * either bound — {@link HISTORY_LIMIT} events, {@link HISTORY_MAX_CHARS}
 * characters), `future` cleared — a new edit is a new branch, what was undone
 * can no longer be redone.
 */
export const record = (history: History, event: DomainEvent): History => ({
  past: fit([...history.past, event]),
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
 * Same caps as {@link record}: a hydrated trail could otherwise overflow them.
 */
export const stepForward = (history: History): Step | undefined => {
  const event = history.future[0]
  if (event === undefined) return undefined
  return {
    event,
    history: {
      past: fit([...history.past, event]),
      future: history.future.slice(1),
    },
  }
}
