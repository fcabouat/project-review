/**
 * Stored envelope and synchronous access policy. Portfolio/history travel in
 * one write; reads distinguish absent, restored, unreadable and unavailable.
 * Writes compare revision + length + 32-bit digest and return explicit verdicts.
 * This is optimistic conflict detection, not an atomic lock or security checksum:
 * interleaved writes and digest collisions remain possible. Storage scope and
 * cross-document notifications depend on the host. No automatic merging.
 * Storage, scheduler and notifications are injected; session decisions live in
 * persistence-session.ts. Synchronous writes support the pagehide flush.
 */

import type { Portfolio } from '../model/portfolio'
import { HISTORY_LIMIT, emptyHistory, type History } from '../events/history'
import { MAX_CHARS, MAX_STORED_CHARS } from '../model/budget'
import { parsePortfolio, type ReadOutcome } from './parse'
import { decodeHistory } from './stored-events'

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

/** Cross-document storage subscription; a later write still detects conflicts if no signal arrives. */
export type WatchStored = (onChange: () => void) => Cancel

/* ----------------------------- total access ----------------------------- */

/**
 * What reading one key yielded: its value (`null` for an absent key), or
 * NOTHING AT ALL because the storage refused the call. The second case is not
 * "the key is absent" and must never be mistaken for it — an absent key is a
 * licence to write, a storage that will not answer is not.
 */
type KeyRead = { readonly ok: true; readonly value: string | null } | { readonly ok: false }

/** The one read of this module — total over a storage that throws. */
const readKey = (storage: KeyValueStorage, key: string): KeyRead => {
  try {
    return { ok: true, value: storage.getItem(key) }
  } catch {
    return { ok: false }
  }
}

/** Confirm erasure by read-back: silent no-op removal and unreadable storage both return false. */
const dropKey = (storage: KeyValueStorage, key: string): boolean => {
  try {
    storage.removeItem(key)
  } catch {
    return false
  }
  const after = readKey(storage, key)
  return after.ok && after.value === null
}

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

/** On unless explicitly switched off — the historic behaviour is the default,
 * and a storage that will not even be read keeps it: whether saving is WANTED
 * is a preference, whether it is POSSIBLE is `readStored`'s verdict. */
export const loadPersistEnabled = (storage: KeyValueStorage): boolean => {
  const read = readKey(storage, PREF_KEY)
  return !read.ok || read.value !== 'off'
}

/** `false` when the storage refuses the write. */
export const savePersistEnabled = (storage: KeyValueStorage, enabled: boolean): boolean => {
  try {
    storage.setItem(PREF_KEY, enabled ? 'on' : 'off')
    return true
  } catch {
    return false
  }
}

/* -------------------------------- stamps -------------------------------- */

/** Opaque revision/length/digest identity, compared only for equality — not a sequence number. */
export type StateStamp = string

/** Absent storage is writable; unreadable bytes must never match an expected stamp. */
export type StoredStamp = StateStamp | null | 'unreadable'

/** The monotone number the envelope carries — written first so the head
 * usually answers it, and never on its own the answer to "is this still my
 * document?". */
type Revision = number

const isRevision = (value: unknown): value is Revision =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

/**
 * The head of the texts this module writes: `format` and `revision` come
 * first, on purpose and as a contract with the guard below, which runs before
 * EVERY save and must not allocate the whole object graph of a
 * hundred-kilobyte document to learn one integer.
 */
const REVISION_HEAD = /^\{"format":(\d+),"revision":(\d+),/

/** The revision an envelope announces when the whole text is read. */
const revisionByParse = (raw: string): Revision | undefined => {
  // Same order as `readStored`: the length is what keeps a mispasted archive
  // away from `JSON.parse` in the first place.
  if (raw.length > MAX_CHARS) return undefined
  let envelope: unknown
  try {
    envelope = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (typeof envelope !== 'object' || envelope === null) return undefined
  const { format, revision } = envelope as { format?: unknown; revision?: unknown }
  return format === STATE_FORMAT && isRevision(revision) ? revision : undefined
}

/** Fast header read with full-JSON fallback: valid envelopes may use any key order. */
const revisionOf = (raw: string): Revision | undefined => {
  const head = REVISION_HEAD.exec(raw)
  if (head === null) return revisionByParse(raw)
  // The head WAS recognised: it names the format and the revision outright,
  // and reading the same two values again through the parse cannot change
  // them. An envelope stamped for another build is refused here.
  const revision = Number(head[2])
  return Number(head[1]) === STATE_FORMAT && isRevision(revision) ? revision : undefined
}

/** FNV-1a change detector, not a security checksum; length and revision also contribute to the stamp. */
const digestOf = (text: string): string => {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/** The stamp of a text whose revision is already established. */
const stampWith = (revision: Revision, raw: string): StateStamp =>
  `${revision}.${raw.length}.${digestOf(raw)}`

/** The stamp of one stored text. */
const stampOf = (raw: string | null): StoredStamp => {
  if (raw === null) return null
  const revision = revisionOf(raw)
  return revision === undefined ? 'unreadable' : stampWith(revision, raw)
}

/** What the storage holds, as a stamp — the COMPARE half of the guarded
 * write. A storage that refuses to be read is `'unreadable'`: not knowing what
 * is in there is exactly the state in which nothing may be written over it. */
export const storedStamp = (storage: KeyValueStorage): StoredStamp => {
  const read = readKey(storage, STATE_KEY)
  return read.ok ? stampOf(read.value) : 'unreadable'
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
 * A restored envelope carries the stamp to compare on the next write.
 * Unreadable bytes remain available for recovery; unavailable means storage
 * access itself failed. Neither may be treated as an empty first run.
 */
export type StoredState =
  | { readonly state: 'absent' }
  | {
      readonly state: 'restored'
      readonly stamp: StateStamp
      readonly portfolio: Portfolio
      readonly history: History
    }
  | { readonly state: 'unreadable'; readonly raw: string; readonly refusal: StateRefusal }
  | { readonly state: 'unavailable' }

/**
 * Reads the stored envelope: size cap, JSON, format stamp and revision, then
 * the portfolio through the very path an imported file takes (`parsePortfolio`
 * — same strict contract, same exhaustive report). The log rides along in the
 * same bytes, so it can only ever describe the portfolio next to it.
 */
export const readStored = (storage: KeyValueStorage | null): StoredState => {
  if (storage === null) return { state: 'unavailable' }
  const read = readKey(storage, STATE_KEY)
  if (!read.ok) return { state: 'unavailable' }
  const raw = read.value
  if (raw === null) return { state: 'absent' }
  if (raw.length > MAX_CHARS) {
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
  // The stamp is named by the revision THIS read established. Nothing is
  // bought by looking at the same bytes a second time, more shallowly: the
  // text is already parsed here. The guard reaches the same number on its own
  // side — by the head where it can, by the whole text where it cannot — so
  // the stamp handed out here is the one the next write will compare against.
  const stamp = stampWith(revision, raw)
  const parsed = parsePortfolio(portfolio)
  if (!parsed.ok) return { state: 'unreadable', raw, refusal: parsed }
  return {
    state: 'restored',
    stamp,
    portfolio: parsed.portfolio,
    // The log is decoded variant by variant (`stored-events.ts`) and dropped
    // whole if any part of it fails: stored events are ordinary text, and one
    // that reached `invert` misshapen would crash the first Undo.
    history: decodeHistory(history),
  }
}

/* ------------------------- writing the envelope ------------------------- */

/**
 * Written: new stamp and the history actually stored (possibly reduced).
 * Conflict: expected bytes changed. Refused: storage or size budget rejected the write.
 */
export type WriteOutcome =
  | {
      readonly outcome: 'written'
      readonly stamp: StateStamp
      /** The log inside the bytes just written — `emptyHistory` when the
       * envelope only fitted without it. */
      readonly history: History
    }
  | { readonly outcome: 'conflict' }
  | { readonly outcome: 'refused' }

/** Compare expected stored bytes, then write a bounded envelope. These are separate, non-atomic steps. */
export const writeState = (
  storage: KeyValueStorage,
  expected: StateStamp | null,
  portfolio: Portfolio,
  history: History,
): WriteOutcome => {
  const read = readKey(storage, STATE_KEY)
  // A storage that will not be READ cannot be compared against, and a write
  // that skips the comparison is the blind overwrite this module exists to
  // prevent. `refused`, not `conflict`: no other document is involved — this
  // storage simply does not answer, and the caller must say so, not blame a
  // second tab that does not exist.
  if (!read.ok) return { outcome: 'refused' }
  if (stampOf(read.value) !== expected) return { outcome: 'conflict' }
  // The number comes from the bytes just compared, never from the caller: the
  // stamp is opaque, and the envelope is where the count lives.
  const revision = (read.value === null ? 0 : (revisionOf(read.value) ?? 0)) + 1
  // `format` and `revision` first: `storedStamp` reads them off the head of
  // this very text without parsing the document that follows.
  const envelope = (log: History): string =>
    JSON.stringify({ format: STATE_FORMAT, revision, portfolio, history: log })

  /** Keep references when under the cap, so an unchanged state does not look dirty. */
  const capped = (log: History): History =>
    log.past.length <= HISTORY_LIMIT
      ? log
      : { past: log.past.slice(-HISTORY_LIMIT), future: log.future }

  // Preserve the portfolio first: if envelope+history exceeds the storage budget,
  // retry without undo history. Refuse if the portfolio alone still cannot fit.
  let stored = capped(history)
  let text = envelope(stored)
  if (text.length > MAX_STORED_CHARS) {
    stored = emptyHistory
    text = envelope(stored)
  }
  if (text.length > MAX_STORED_CHARS) return { outcome: 'refused' }
  try {
    storage.setItem(STATE_KEY, text)
    // The stamp of the bytes just written — computed on the text, so the
    // caller holds the identity of what is in there and not a number that
    // another document could be carrying too. `history` is the log those
    // bytes carry, so no caller has to guess which of the two attempts landed.
    return { outcome: 'written', stamp: stampOf(text) as StateStamp, history: stored }
  } catch {
    return { outcome: 'refused' }
  }
}

/** Erase only the document, not the opt-out preference; false means erasure is unconfirmed. */
export const clearStored = (storage: KeyValueStorage): boolean => dropKey(storage, STATE_KEY)

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
