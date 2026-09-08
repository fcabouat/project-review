/**
 * Persistence policy — keys, serialisation of the snapshot and the undo/redo
 * log (version stamp, shallow rejection), the debounce the automatic saves
 * ride on, and the opt-out preference.
 *
 * The two interfaces below are declared HERE, at the consumer: the core says
 * what it needs — a key/value store, a way to defer a call — and the
 * infrastructure provides both (`local-storage.ts`, `scheduler.ts`); tests
 * plug in-memory fakes into the very same seams.
 *
 * Decoupled from the parse: we write an already valid `Portfolio` and read
 * back `unknown`. Replaying through the strict parse belongs to application
 * startup, not here.
 *
 * Every write is TOTAL: a storage that throws (quota, private browsing) makes
 * the write functions return `false`, never propagate — losing a save must not
 * take the editor down with it.
 */

import type { Portfolio } from '../model/portfolio'
import type { DomainEvent } from '../events'
import { HISTORY_LIMIT, type History } from '../events/history'

/* ------------------------------ interfaces ------------------------------ */

/**
 * The bare minimum of a key/value store the policy needs —
 * `window.localStorage` conforms to it, and so does a plain `Map` wrapper in
 * tests.
 */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Disarms a scheduled action; calling it after the action fired is a no-op. */
export type Cancel = () => void

/**
 * Deferred execution for the debounce: `setTimeout` in production
 * (`timeoutScheduler` in the infrastructure package), a manual fake in tests.
 */
export type Scheduler = (action: () => void, delayMs: number) => Cancel

/* ----------------------------- keys & flags ----------------------------- */

/** localStorage key of the opt-out preference — NOT erased by `clearStored`:
 * "off" must survive the very cleanup it triggers. */
export const PREF_KEY = 'project-review/local-save'

/** Debounce of the automatic save. */
export const SAVE_DELAY_MS = 500

/** localStorage key of the snapshot — the bare `Portfolio` as JSON, exactly
 * what an exported .json file contains: the two stay interchangeable. */
export const STORAGE_KEY = 'project-review/portfolio'

/** localStorage key of the history — separate from the snapshot so a corrupt
 * or oversized history can be discarded without losing the data. */
export const HISTORY_KEY = 'project-review/history'

/** On unless explicitly switched off — the historic behaviour is the default. */
export const loadPersistEnabled = (storage: KeyValueStorage): boolean =>
  storage.getItem(PREF_KEY) !== 'off'

/** `false` when the storage refuses the write — same contract as `save`. */
export const savePersistEnabled = (storage: KeyValueStorage, enabled: boolean): boolean => {
  try {
    storage.setItem(PREF_KEY, enabled ? 'on' : 'off')
    return true
  } catch {
    return false
  }
}

/* ------------------------- snapshot and history ------------------------- */

/**
 * Writes the snapshot. `false` when the storage refuses the write (quota
 * exceeded, private browsing, …): persistence failures must never break the
 * app — the caller decides how to surface them (the app's persistence switch).
 */
export const save = (storage: KeyValueStorage, portfolio: Portfolio): boolean => {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(portfolio))
    return true
  } catch {
    return false
  }
}

/**
 * Reads the snapshot back without validating anything. `null` = nothing stored,
 * or unreadable JSON (corrupted storage must not prevent the application from
 * starting). The result is meant for the total parse.
 */
export const loadRaw = (storage: KeyValueStorage): unknown => {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Version stamped into the stored history payload (`{ v, past, future }`).
 * Follows the data-contract version: events serialised under one schema are
 * NOT replayable under another (`invert` would corrupt the portfolio), so
 * `loadHistory` discards any payload whose stamp differs. The snapshot needs
 * no such stamp — it goes back through the total parse at startup.
 */
export const HISTORY_VERSION = 3

/**
 * `false` when the storage refuses the write — same contract as `save`.
 * The register already caps its in-memory `past` at `HISTORY_LIMIT`; the
 * slice here is the belt to that brace, so a hydrated oversize history can
 * never be written back whole. The quota safety net stays the `false` return.
 */
export const saveHistory = (storage: KeyValueStorage, history: History): boolean => {
  const payload = {
    v: HISTORY_VERSION,
    past: history.past.slice(-HISTORY_LIMIT),
    future: history.future,
  }
  try {
    storage.setItem(HISTORY_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

const isEventList = (x: unknown): x is readonly DomainEvent[] =>
  Array.isArray(x) &&
  x.every(
    (e) =>
      typeof e === 'object' && e !== null && typeof (e as { type?: unknown }).type === 'string',
  )

/**
 * Stored history, or `null` when absent, corrupted or stamped with another
 * schema version — a broken history must never keep the application from
 * starting (same rule as the snapshot), and events from another schema must
 * never reach `apply`/`invert`. The shape check stays shallow on purpose: a
 * matching stamp means we are reading back our own writes, and `apply` is
 * total anyway.
 */
export const loadHistory = (storage: KeyValueStorage): History | null => {
  const raw = storage.getItem(HISTORY_KEY)
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { v, past, future } = parsed as { v?: unknown; past?: unknown; future?: unknown }
    if (v !== HISTORY_VERSION) return null
    if (!isEventList(past) || !isEventList(future)) return null
    return { past, future }
  } catch {
    return null
  }
}

/** Erases the saved data (snapshot + history); the preference itself stays. */
export const clearStored = (storage: KeyValueStorage): void => {
  storage.removeItem(STORAGE_KEY)
  storage.removeItem(HISTORY_KEY)
}

/* -------------------------------- debounce ------------------------------- */

/** A debounced function, plus control over its pending call. */
export interface Debounced<A extends readonly unknown[]> {
  /** Schedules (or reschedules) the call with these arguments. */
  readonly run: (...args: A) => void
  /** Drops the pending call, arguments included — nothing will fire. */
  readonly cancel: () => void
  /** Fires the pending call NOW (last arguments); no-op when nothing is pending. */
  readonly flush: () => void
}

/**
 * Lets only the last call of a burst through: each `run` cancels the pending
 * deadline and schedules a new one, with the most recent arguments. The
 * policy decides WHEN a burst condenses into one call; the injected
 * {@link Scheduler} decides HOW time passes. The handle exists because a bare
 * debounced function cannot be disarmed: an opt-out (`cancel`) or a closing
 * page (`flush`) must be able to reach the timer.
 */
export const debounce = <A extends readonly unknown[]>(
  fn: (...args: A) => void,
  delayMs: number,
  schedule: Scheduler,
): Debounced<A> => {
  let cancelPending: Cancel | null = null
  let pendingArgs: A | null = null

  const cancel = (): void => {
    cancelPending?.()
    cancelPending = null
    pendingArgs = null
  }

  return {
    run: (...args: A): void => {
      cancelPending?.()
      pendingArgs = args
      cancelPending = schedule(() => {
        cancelPending = null
        pendingArgs = null
        fn(...args)
      }, delayMs)
    },
    cancel,
    flush: (): void => {
      const args = pendingArgs
      if (args === null) return
      cancel()
      fn(...args)
    },
  }
}
