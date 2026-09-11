/**
 * Persistence policy — the stored ENVELOPE (format stamp, revision, portfolio,
 * undo/redo log), the guard that stands before every write, the debounce the
 * automatic saves ride on, and the opt-out preference.
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
 * WRITING IS GUARDED, AND THE GUARD IS NOT A LOCK. Every write names the
 * {@link StateStamp} it believes the storage holds; {@link writeState}
 * re-reads the stored bytes and answers `conflict` the moment their stamp
 * differs. Two tabs of the same browser share one storage — one origin under
 * `file://`, whatever the folder each copy was opened from — so without the
 * check whichever saves second wins, in silence.
 *
 * WHAT THE GUARD DOES NOT DO, SAID BEFORE ANYONE RELIES ON IT. `localStorage`
 * offers no mutual exclusion: the storage mutex left the standard, and nothing
 * makes the re-read and the `setItem` below one indivisible step. Two
 * documents can therefore both pass the check and both write; the second bytes
 * win. That window cannot be closed from here and is NOT claimed shut.
 *
 * WHAT IS GUARANTEED INSTEAD IS THAT THE LOSER FINDS OUT. A {@link StateStamp}
 * is the IDENTITY of a stored text — its revision, its length and a digest of
 * it — and not a position in a sequence. The tab whose bytes were overwritten
 * therefore no longer recognises what the storage holds: its next write is a
 * `conflict`, and the `storage` event ({@link WatchStored}) raises that same
 * conflict as soon as the other tab writes, long before the next deadline.
 * Both paths are pinned — the core's «two documents interleaved on one
 * storage», the app's «a conflict over a document of the SAME revision
 * number». A counter could not do this much: two tabs starting from revision 1
 * both write revision 2, and revision 2 looks exactly like what either of them
 * believes it stored.
 *
 * SO THE OVERWRITE IS ANNOUNCED — at the next signal or the next write — and
 * the two places where it would not be are named rather than hidden: a tab
 * that never writes again and hears no event has nobody left to tell, and the
 * stamp's digest is a digest (two documents of the same LENGTH whose 32 bits
 * collide would pass for one). Neither is a silence this module chooses.
 *
 * WHY NOT `navigator.locks`, WHICH WOULD REALLY CLOSE THE WINDOW. Two reasons,
 * and only the second is about the browser. It is ASYNCHRONOUS, while the last
 * save of a page's life is fired from `pagehide`, where an awaited lock is a
 * save that does not happen — the write path would have to become async down
 * to that one caller, which is the caller that cannot afford it. And a lock is
 * a browser API: this module names no global (see the three injected
 * interfaces below), so it would arrive as a fourth port and a second, async
 * write path beside this one. Measured, for the record, rather than assumed:
 * under `file://` in Chromium the API IS there, shared between documents. The
 * trade is therefore open, and it is the owner's to make; what is written here
 * promises only what it does.
 *
 * NOTHING IS MERGED — merging two documents nobody compared would be a guess
 * dressed up as a fact; the caller shows the conflict and a person decides.
 *
 * Every write is TOTAL: a storage that throws (quota, private browsing) yields
 * `refused`, never an exception — losing a save must not take the editor down
 * with it.
 *
 * SO IS EVERY READ, and for a blunter reason: in a browser where storage is
 * blocked outright (third-party cookies off, restricted contexts) it is the
 * `getItem` ITSELF that raises `SecurityError`, not just the write. Unguarded,
 * that exception travels up through the boot and the editor never mounts —
 * the application dies of a feature it can perfectly well live without. Every
 * touch of the storage below therefore goes through {@link readKey} or
 * {@link dropKey}, and a storage that refuses to be read yields the explicit
 * `unavailable` verdict the interface can say out loud.
 */

import type { Portfolio } from '../model/portfolio'
import { HISTORY_LIMIT, emptyHistory, type History } from '../events/history'
import { MAX_CHARS } from '../model/budget'
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

/**
 * Subscription to the stored state being changed by ANOTHER DOCUMENT — the
 * other tab, in practice. The browser's `storage` event in production
 * (`watchStored` in the infrastructure package), a hand-fired callback in
 * tests. The guard below holds where no such event exists — the next write
 * still compares stamps — and this brings the same verdict forward, BEFORE the
 * user has typed another word. Under `file://` in Chromium the event does
 * fire between two open copies of the deliverable; where it does not, nothing
 * is lost but the warning's promptness.
 */
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

/** The one removal of this module — total, and silent about its own failure:
 * a key that could not be removed could not have been written either. */
const dropKey = (storage: KeyValueStorage, key: string): void => {
  try {
    storage.removeItem(key)
  } catch {
    /* a storage that refuses removal refuses writing too — nothing to undo */
  }
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

/**
 * Names one stored state — not its PLACE in a sequence but its own identity:
 * the revision the envelope announces, the length of the stored text, and a
 * digest of that text. Two tabs that start from the same state and save
 * different documents both write revision 2 and take DIFFERENT stamps, which
 * is the whole reason this is not just a counter (see the module header).
 *
 * Opaque: nothing outside this module reads a stamp, and nothing compares two
 * of them for anything but equality.
 */
export type StateStamp = string

/**
 * What the storage announces right now: a stamp, `null` when the key is
 * absent, `'unreadable'` when something IS there whose head cannot be read.
 * The three are kept apart because only the first two can ever be matched by a
 * caller: writing over bytes nobody could read is the one thing the guard
 * exists to prevent.
 */
export type StoredStamp = StateStamp | null | 'unreadable'

/** The monotone number the envelope carries — written first, read off the
 * head, and never on its own the answer to "is this still my document?". */
type Revision = number

const isRevision = (value: unknown): value is Revision =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

/**
 * Reads the announced revision from the HEAD of the stored text. `format` and
 * `revision` are written first, on purpose and as a contract with this guard:
 * it runs before EVERY save, and no save should cost a full PARSE of the
 * document — the whole object graph allocated to learn one number.
 */
const REVISION_HEAD = /^\{"format":(\d+),"revision":(\d+),/

/** The revision the stored TEXT announces, or `undefined` for a head this
 * version does not recognise — never a licence to write. */
const revisionOf = (raw: string): Revision | undefined => {
  const head = REVISION_HEAD.exec(raw)
  if (head === null || Number(head[1]) !== STATE_FORMAT) return undefined
  const revision = Number(head[2])
  return isRevision(revision) ? revision : undefined
}

/**
 * FNV-1a over the stored text — a CHANGE DETECTOR, not a checksum and not a
 * security claim: it is never inverted, and it is never the whole answer. The
 * stamp carries the text's LENGTH beside it, so two states can be taken for
 * one another only if they agree in size and collide in the digest as well.
 * The cost is one linear pass over a string the caller has already copied out
 * of the storage — still no parse.
 */
const digestOf = (text: string): string => {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/** The stamp of one stored text. */
const stampOf = (raw: string | null): StoredStamp => {
  if (raw === null) return null
  const revision = revisionOf(raw)
  if (revision === undefined) return 'unreadable'
  return `${revision}.${raw.length}.${digestOf(raw)}`
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
 * What the storage holds, as a VERDICT — the four cases a startup must tell
 * apart, and the reason there is no fifth "just start empty" one:
 *  - `absent` — nothing stored; a first run, or a cleared one;
 *  - `restored` — an envelope that honors the contract, with the stamp of the
 *    very bytes it was read from: the caller writes against THAT stamp from
 *    then on;
 *  - `unreadable` — an envelope IS there and cannot be opened: the caller gets
 *    the stored bytes back (`raw`, offered to the user as-is) and the
 *    exhaustive `refusal`, and must NOT write anything over it until a person
 *    has decided (see the app's persistence control);
 *  - `unavailable` — there is no storage to speak of: the browser refuses the
 *    API itself, or the host handed none over. NOTHING will ever be saved
 *    here, which is a fact the interface must state rather than mime a save
 *    state nobody honours. It is kept apart from `absent` because `absent`
 *    invites a write and this one forbids it forever.
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
  // The parsed head and the READ head must agree. They can disagree — an
  // envelope whose keys arrived in another order parses fine and is invisible
  // to the head regex — and a caller holding a stamp the guard can never match
  // would be refused every write it ever tried. Better said now, on the
  // recovery screen, than as a save that silently stops working.
  const stamp = stampOf(raw)
  if (
    format !== STATE_FORMAT ||
    !isRevision(revision) ||
    stamp === 'unreadable' ||
    stamp === null
  ) {
    return { state: 'unreadable', raw, refusal: { ok: false, refusal: 'unknownFormat' } }
  }
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
 * What one save attempt did — three outcomes, and they are NOT
 * interchangeable:
 *  - `written` — the bytes are in, under the stamp handed back: the caller
 *    writes against THAT stamp from now on;
 *  - `conflict` — the storage no longer holds the state the caller named.
 *    Another document wrote in between; nothing was touched;
 *  - `refused` — the storage itself said no (quota, private browsing). Nothing
 *    was written, and the document in memory is the only copy left.
 */
export type WriteOutcome =
  | { readonly outcome: 'written'; readonly stamp: StateStamp }
  | { readonly outcome: 'conflict' }
  | { readonly outcome: 'refused' }

/**
 * The one write path. `expected` is the stamp the caller believes is stored —
 * `null` for "nothing was there". The stored bytes are re-read first and their
 * stamp must match: anything else, an unreadable envelope included, is a
 * `conflict` and not one byte moves.
 *
 * THE CHECK AND THE WRITE ARE TWO STEPS, not one — see the module header for
 * what that costs and for what is guaranteed in its place.
 *
 * The register already caps its in-memory `past` at `HISTORY_LIMIT`; the slice
 * here is the belt to that brace, so a hydrated oversize log can never be
 * written back whole.
 */
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
  // stamp is opaque, and the head is where the count has always lived.
  const revision = (read.value === null ? 0 : (revisionOf(read.value) ?? 0)) + 1
  // `format` and `revision` first: `storedStamp` reads them off the head of
  // this very text without parsing the document that follows.
  const envelope = (log: History): string =>
    JSON.stringify({
      format: STATE_FORMAT,
      revision,
      portfolio,
      history: { past: log.past.slice(-HISTORY_LIMIT), future: log.future },
    })

  // NOTHING IS WRITTEN THAT THE NEXT BOOT WOULD REFUSE TO READ. The portfolio
  // is inside the memory budget by the time it gets here (the command gate
  // weighs every growing command on the projected state) — the LOG is not:
  // five hundred `PortfolioReplaced` steps carry a thousand whole portfolios,
  // and the envelope can pass the ceiling on its own. So the document is tried
  // WITHOUT its log rather than not at all: losing undo steps is not losing
  // the document, and the same trade is already the one `decodeHistory` makes
  // on the way in.
  let text = envelope(history)
  if (text.length > MAX_CHARS) text = envelope(emptyHistory)
  if (text.length > MAX_CHARS) return { outcome: 'refused' }
  try {
    storage.setItem(STATE_KEY, text)
    // The stamp of the bytes just written — computed on the text, so the
    // caller holds the identity of what is in there and not a number that
    // another document could be carrying too.
    return { outcome: 'written', stamp: stampOf(text) as StateStamp }
  } catch {
    return { outcome: 'refused' }
  }
}

/** Erases the saved document; the opt-out preference itself stays. Total: a
 * storage that refuses the removal refuses the write that put it there. */
export const clearStored = (storage: KeyValueStorage): void => {
  dropKey(storage, STATE_KEY)
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
