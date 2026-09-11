/**
 * Persistence policy — the stored ENVELOPE (format stamp, revision, portfolio,
 * undo/redo log), the compare-and-swap that guards every write, the debounce
 * the automatic saves ride on, and the opt-out preference.
 *
 * The three interfaces below are declared HERE, at the consumer: the core says
 * what it needs — a key/value store, a way to defer a call, a way to hear
 * another document touch that store — and the infrastructure provides all
 * three (`local-storage.ts`, `scheduler.ts`); tests plug in-memory fakes into
 * the very same seams.
 *
 * ONE KEY, ONE WRITE. The portfolio and the undo/redo log describe the SAME
 * document. Written apart, they drift — and a log whose events invert a
 * portfolio that is no longer there rewrites the wrong document on Undo. They
 * travel in a single envelope under a single key, written in one `setItem`,
 * and they are read back together or not at all.
 *
 * READING IS A VERDICT, NEVER A GUESS. {@link readStored} is the one way in:
 * it says `absent`, `restored` or `unreadable`, and in the last case it hands
 * back the STORED BYTES together with the exhaustive report. There is no
 * outcome that quietly means "start over" — because the caller that cannot
 * tell "nothing stored" from "stored, unreadable" is one debounce away from
 * writing an empty document over the only copy of the data.
 *
 * WRITING IS A COMPARE-AND-SWAP, NEVER A BLIND OVERWRITE. Every write names
 * the {@link Revision} it believes the storage holds; {@link writeState}
 * re-reads that revision and answers `conflict` the moment it differs. Two
 * tabs of the same browser share one storage: without the check, whichever
 * saves second wins, in silence. NOTHING IS MERGED — merging two documents
 * nobody compared would be a guess dressed up as a fact; the caller shows the
 * conflict and a person decides.
 *
 * Every write is TOTAL: a storage that throws (quota, private browsing) yields
 * `refused`, never an exception — losing a save must not take the editor down
 * with it.
 */

import type { Portfolio } from '../model/portfolio'
import type { DomainEvent } from '../events'
import { HISTORY_LIMIT, emptyHistory, type History } from '../events/history'
import { IMPORT_MAX_CHARS, parsePortfolio, type ReadOutcome } from './parse'

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

/** Disarms a scheduled action or a subscription; calling it twice is a no-op. */
export type Cancel = () => void

/**
 * Deferred execution for the debounce: `setTimeout` in production
 * (`timeoutScheduler` in the infrastructure package), a manual fake in tests.
 */
export type Scheduler = (action: () => void, delayMs: number) => Cancel

/**
 * Subscription to the stored state being changed by ANOTHER DOCUMENT — the
 * other tab, in practice. The browser's `storage` event in production
 * (`watchStored` in the infrastructure package), a hand-fired callback in
 * tests. It is a courtesy, not the guard: the compare-and-swap holds even
 * where no such event exists, this only lets the caller warn BEFORE the user
 * has typed another word.
 */
export type WatchStored = (onChange: () => void) => Cancel

/* ----------------------------- keys & flags ----------------------------- */

/** localStorage key of the opt-out preference — NOT erased by `clearStored`:
 * "off" must survive the very cleanup it triggers. */
export const PREF_KEY = 'project-review/local-save'

/** Debounce of the automatic save. */
export const SAVE_DELAY_MS = 500

/** The one key the saved document lives under — envelope and all. */
export const STATE_KEY = 'project-review/state'

/**
 * Format of the stored envelope. Events serialised under one schema are NOT
 * replayable under another (`invert` would corrupt the portfolio) and the
 * portfolio inside answers to the published data contract, so an envelope
 * stamped otherwise is refused rather than half-read: bump this whenever the
 * event union or the portfolio contract changes shape.
 */
export const STATE_FORMAT = 1

/** On unless explicitly switched off — the historic behaviour is the default. */
export const loadPersistEnabled = (storage: KeyValueStorage): boolean =>
  storage.getItem(PREF_KEY) !== 'off'

/** `false` when the storage refuses the write. */
export const savePersistEnabled = (storage: KeyValueStorage, enabled: boolean): boolean => {
  try {
    storage.setItem(PREF_KEY, enabled ? 'on' : 'off')
    return true
  } catch {
    return false
  }
}

/* ------------------------------- revisions ------------------------------ */

/**
 * Names one stored state. MONOTONE: every write takes the next number, so a
 * reader can tell — with one comparison, and without reading the document —
 * whether the storage still holds the state it last saw.
 */
export type Revision = number

/**
 * What the storage announces right now: a revision, `null` when the key is
 * absent, `'unreadable'` when something IS there whose revision cannot be
 * read. The three are kept apart because only the first two can ever be
 * matched by a caller: writing over bytes nobody could read is the one thing
 * the compare-and-swap exists to prevent.
 */
export type StoredRevision = Revision | null | 'unreadable'

const isRevision = (value: unknown): value is Revision =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

/**
 * Reads the announced revision from the HEAD of the stored text. `format` and
 * `revision` are written first, on purpose and as a contract with this guard:
 * it runs before EVERY save, and no save should cost a full parse of the
 * document to learn one number. A head this does not recognise is
 * `'unreadable'` — never a licence to write.
 */
const REVISION_HEAD = /^\{"format":(\d+),"revision":(\d+),/

/** What the storage holds, as a revision — the compare half of the swap. */
export const storedRevision = (storage: KeyValueStorage): StoredRevision => {
  const raw = storage.getItem(STATE_KEY)
  if (raw === null) return null
  const head = REVISION_HEAD.exec(raw)
  if (head === null || Number(head[1]) !== STATE_FORMAT) return 'unreadable'
  const revision = Number(head[2])
  return isRevision(revision) ? revision : 'unreadable'
}

/* ------------------------- reading the envelope ------------------------- */

/**
 * Why a stored envelope was refused: the strict parse's exhaustive error list,
 * or one of the pre-parse refusals — text too large, text that is not JSON,
 * or an envelope this version does not know how to open.
 */
export type StateRefusal =
  Extract<ReadOutcome, { ok: false }> | { readonly ok: false; readonly refusal: 'unknownFormat' }

/**
 * What the storage holds, as a VERDICT — the three cases a startup must tell
 * apart, and the reason there is no fourth "just start empty" one:
 *  - `absent` — nothing stored; a first run, or a cleared one;
 *  - `restored` — an envelope that honors the contract, with the revision it
 *    carries: the caller writes against THAT revision from then on;
 *  - `unreadable` — an envelope IS there and cannot be opened: the caller gets
 *    the stored bytes back (`raw`, offered to the user as-is) and the
 *    exhaustive `refusal`, and must NOT write anything over it until a person
 *    has decided (see the app's persistence control).
 */
export type StoredState =
  | { readonly state: 'absent' }
  | {
      readonly state: 'restored'
      readonly revision: Revision
      readonly portfolio: Portfolio
      readonly history: History
    }
  | { readonly state: 'unreadable'; readonly raw: string; readonly refusal: StateRefusal }

const isEventList = (x: unknown): x is readonly DomainEvent[] =>
  Array.isArray(x) &&
  x.every(
    (e) =>
      typeof e === 'object' && e !== null && typeof (e as { type?: unknown }).type === 'string',
  )

/**
 * Per-variant shape guard, on top of the shallow `type` check: a
 * `PortfolioReplaced` carries two WHOLE portfolios that `apply`/`invert` will
 * install verbatim, so both sides must still satisfy the data contract —
 * anyone can hand-edit localStorage. Replayed through the same strict parse an
 * imported file goes through; the other variants stay under the format stamp
 * plus `apply`'s totality (they touch one aggregate at a time, never install
 * a whole portfolio).
 */
const isSoundEvent = (e: DomainEvent): boolean =>
  e.type !== 'PortfolioReplaced' || (parsePortfolio(e.before).ok && parsePortfolio(e.after).ok)

/**
 * The undo/redo log an envelope carries, or `emptyHistory` when it is
 * misshapen or carries an event that fails its variant guard. DROPPED IN
 * SILENCE, and only it: the portfolio in the same envelope has just passed the
 * strict parse and is perfectly good — losing undo steps is not losing the
 * document, and refusing the whole envelope over them would cost the user far
 * more than it protects.
 */
const readHistory = (value: unknown): History => {
  if (typeof value !== 'object' || value === null) return emptyHistory
  const { past, future } = value as { past?: unknown; future?: unknown }
  if (!isEventList(past) || !isEventList(future)) return emptyHistory
  if (![...past, ...future].every(isSoundEvent)) return emptyHistory
  return { past, future }
}

/**
 * Reads the stored envelope: size cap, JSON, format stamp and revision, then
 * the portfolio through the very path an imported file takes (`parsePortfolio`
 * — same strict contract, same exhaustive report). The log rides along in the
 * same bytes, so it can only ever describe the portfolio next to it.
 */
export const readStored = (storage: KeyValueStorage): StoredState => {
  const raw = storage.getItem(STATE_KEY)
  if (raw === null) return { state: 'absent' }
  if (raw.length > IMPORT_MAX_CHARS) {
    return { state: 'unreadable', raw, refusal: { ok: false, refusal: 'tooLarge' } }
  }
  let envelope: unknown
  try {
    envelope = JSON.parse(raw)
  } catch {
    return { state: 'unreadable', raw, refusal: { ok: false, refusal: 'badJson' } }
  }
  if (typeof envelope !== 'object' || envelope === null) {
    return { state: 'unreadable', raw, refusal: { ok: false, refusal: 'unknownFormat' } }
  }
  const { format, revision, portfolio, history } = envelope as {
    format?: unknown
    revision?: unknown
    portfolio?: unknown
    history?: unknown
  }
  if (format !== STATE_FORMAT || !isRevision(revision)) {
    return { state: 'unreadable', raw, refusal: { ok: false, refusal: 'unknownFormat' } }
  }
  const parsed = parsePortfolio(portfolio)
  if (!parsed.ok) return { state: 'unreadable', raw, refusal: parsed }
  return {
    state: 'restored',
    revision,
    portfolio: parsed.portfolio,
    history: readHistory(history),
  }
}

/* ------------------------- writing the envelope ------------------------- */

/**
 * What one save attempt did — three outcomes, and they are NOT
 * interchangeable:
 *  - `written` — the bytes are in, under the revision handed back: the caller
 *    writes against THAT revision from now on;
 *  - `conflict` — the storage no longer holds the revision the caller named.
 *    Another document wrote in between; nothing was touched;
 *  - `refused` — the storage itself said no (quota, private browsing). Nothing
 *    was written, and the document in memory is the only copy left.
 */
export type WriteOutcome =
  | { readonly outcome: 'written'; readonly revision: Revision }
  | { readonly outcome: 'conflict' }
  | { readonly outcome: 'refused' }

/**
 * The one write path. `expected` is the revision the caller believes is
 * stored — `null` for "nothing was there". The stored revision is re-read
 * first and must match EXACTLY: anything else, an unreadable envelope
 * included, is a `conflict` and not one byte moves.
 *
 * The register already caps its in-memory `past` at `HISTORY_LIMIT`; the slice
 * here is the belt to that brace, so a hydrated oversize log can never be
 * written back whole.
 */
export const writeState = (
  storage: KeyValueStorage,
  expected: Revision | null,
  portfolio: Portfolio,
  history: History,
): WriteOutcome => {
  if (storedRevision(storage) !== expected) return { outcome: 'conflict' }
  const revision = (expected ?? 0) + 1
  // `format` and `revision` first: `storedRevision` reads them off the head of
  // this very text without parsing the document that follows.
  const envelope = {
    format: STATE_FORMAT,
    revision,
    portfolio,
    history: { past: history.past.slice(-HISTORY_LIMIT), future: history.future },
  }
  try {
    storage.setItem(STATE_KEY, JSON.stringify(envelope))
    return { outcome: 'written', revision }
  } catch {
    return { outcome: 'refused' }
  }
}

/** Erases the saved document; the opt-out preference itself stays. */
export const clearStored = (storage: KeyValueStorage): void => {
  storage.removeItem(STATE_KEY)
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
