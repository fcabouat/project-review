/**
 * Wiring between the store and the persistence policy: the local-save switch
 * (Settings ▸ Data), the debounced save of the whole envelope, the live save
 * state the shell shows, and the two questions only a person can answer. The
 * policy itself is the core's (`services/persistence`); the storage and the
 * scheduler are whatever the caller injects — the browser adapters in
 * production, in-memory doubles in tests. Extracted from `App.svelte` so the
 * shell only mounts views; the `$effect` that feeds `scheduleSave` stays in
 * the component that owns the store.
 *
 * THE FIRST INVARIANT, AND IT HAS NO EXCEPTION — the persistence NEVER writes
 * over a document it has not read back. Every write path is covered by it, the
 * switch included:
 *  - built on an `unreadable` envelope, the wiring starts BLOCKED: the
 *    debounced save, the pagehide flush and the switch itself are all
 *    disarmed, and only an explicit human decision —
 *    {@link PersistenceWiring.discard}, the recovery screen's «start empty» —
 *    lifts it;
 *  - turning the save back ON is itself a write over whatever the storage
 *    holds, so it READS FIRST ({@link PersistenceControl.toggle}): an
 *    unreadable envelope blocks the wiring there and then (the recovery
 *    screen takes over, exactly as at boot), a readable one is offered for
 *    restoration and nothing is written until a person answers.
 * The rule lives here, in the control, rather than in a branch of the mounting
 * component, because a branch protects one call site while the invariant must
 * hold for every one of them.
 *
 * THE SECOND INVARIANT — no write outcome is ever lost, and none speaks for
 * another. The document carries a REVISION (`edit`, bumped by every change);
 * a save attempt names the revision it is writing, and its verdict is filed
 * against THAT revision ({@link SaveState}). A success therefore acknowledges
 * only the state it actually wrote: it cannot clear the failure of a state it
 * never carried, and a later edit cannot inherit an earlier success.
 *
 * THE THIRD INVARIANT — two tabs share one storage, so every write is a
 * compare-and-swap on the stored revision (`writeState`). A `conflict` writes
 * nothing, says so, and waits: {@link PersistenceControl.takeStored} loads the
 * other tab's document (undoable), {@link PersistenceControl.keepMine}
 * replaces it with this one. Nothing merges by itself. The host's `storage`
 * subscription feeds {@link PersistenceWiring.noticeStoredChange}, which
 * raises the same conflict as soon as the other tab writes, rather than at the
 * next deadline.
 *
 * THE FOURTH INVARIANT — a browser that offers NO storage is a state, not an
 * absence. `storage === null` (the access throws, or there is none) makes the
 * control answer the `unavailable` phase for good: the switch is inert, the
 * strip says so permanently and offers the one thing that still saves the work
 * — a downloaded copy. The editor mounts and works exactly as it otherwise
 * would; only the saving does not happen, and it says so instead of miming it.
 */

import type { Portfolio } from '@project-review/core/model/portfolio'
import type { History } from '@project-review/core/events/history'
import {
  SAVE_DELAY_MS,
  clearStored,
  debounce,
  readStored,
  storedRevision,
  writeState,
  savePersistEnabled,
  type KeyValueStorage,
  type Revision,
  type Scheduler,
  type StateRefusal,
  type StoredState,
} from '@project-review/core/services/persistence'
import type { PersistenceControl, SaveState } from '@project-review/components/screens/contracts'
import type { Store } from './runtime.svelte'

/** The verdict of a browser with no storage — a constant, because it never
 * moves: no revision advances something that is never written. */
const UNAVAILABLE: SaveState = { revision: 0, phase: 'unavailable' }

/** A stored document the format refuses, with the bytes the recovery screen hands back. */
export interface UnreadableState {
  readonly raw: string
  readonly refusal: StateRefusal
}

export interface PersistenceWiring {
  /** The Settings switch, the save state and the decisions — the UI contract. */
  readonly control: PersistenceControl
  /** Debounced save of the whole envelope — feed it from an effect reading
   * `store.present` and the two stacks. */
  readonly scheduleSave: (portfolio: Portfolio, history: History) => void
  /** 'pagehide' hook: fires anything still pending, now. */
  readonly flush: () => void
  /** The host's `storage` subscription calls this when ANOTHER document wrote:
   * the pending save is disarmed and a conflict raised, before this tab has
   * had the chance to overwrite anything. */
  readonly noticeStoredChange: () => void
  /** `true` while a stored document the app could not read is still there and
   * no one has decided its fate: not one byte is written in this state. */
  readonly blocked: boolean
  /** The unreadable envelope itself while {@link blocked} — what the recovery
   * screen renders. Found at boot, or later by a path that read the storage. */
  readonly unreadable: UnreadableState | undefined
  /**
   * The one way out of `blocked`, and it is a PERSON's decision: abandon the
   * unreadable envelope (erased) and let the saves resume. Called by the
   * recovery screen's « start empty », never automatically.
   */
  readonly discard: () => void
}

/**
 * Builds the wiring around one store and one storage. `initiallyEnabled` comes
 * from `loadPersistEnabled` — read by the caller BEFORE building the store,
 * since it decides whether the stored document is even loaded — and `stored`
 * is the verdict `readStored` gave on that same boot, so the wiring starts in
 * the state the storage is actually in, revision included.
 */
export const createPersistenceControl = (
  store: Store,
  storage: KeyValueStorage | null,
  initiallyEnabled: boolean,
  schedule: Scheduler,
  /** What the storage held at boot. `unreadable` starts the wiring blocked
   * and stays that way until {@link PersistenceWiring.discard}. */
  stored: StoredState = { state: 'absent' },
): PersistenceWiring => {
  let enabled = $state(initiallyEnabled)
  let unreadable = $state<UnreadableState | undefined>(
    stored.state === 'unreadable' ? { raw: stored.raw, refusal: stored.refusal } : undefined,
  )
  /** The readable document the switch found on its way ON — a decision is
   * pending and NOTHING has been written yet. */
  let offered = $state<Portfolio | undefined>(undefined)

  /** The revision this tab believes the storage holds — the COMPARE half of
   * every compare-and-swap. `null` means "nothing was there". */
  let base: Revision | null = stored.state === 'restored' ? stored.revision : null
  /**
   * The revision of the document IN THIS TAB: one per recorded change.
   * Deliberately NOT reactive. It is bumped by `scheduleSave`, which the host
   * calls from an effect — and `edit += 1` READS it, so a rune here would make
   * that effect depend on the very value it writes (an update loop Svelte
   * rightly refuses). What the screen reads is `status`, which carries the
   * revision the verdict is about; this counter is bookkeeping.
   */
  let edit = 0
  /** The verdict, and the revision it is about. Boot is honest about both: a
   * document that came out of the storage is already saved, anything else is
   * not stored yet. */
  let status = $state<SaveState>({
    revision: 0,
    phase: stored.state === 'restored' ? 'saved' : 'dirty',
  })
  /**
   * True until the mounting effect's FIRST, echoing call has been swallowed.
   * That call carries the document the storage just handed over, so writing it
   * back would store nothing new — and would announce to every other tab that
   * this one changed something. Opening a second tab must not put the first
   * one in conflict over a document the two agree on.
   */
  let bootEcho = stored.state === 'restored'

  const blocked = (): boolean => unreadable !== undefined

  /**
   * One write attempt, start to finish. The verdict is filed against the
   * revision that was actually attempted — never against a later one.
   */
  const write = (portfolio: Portfolio, history: History): void => {
    if (!storage || !enabled || blocked()) return
    const attempt = edit
    status = { revision: attempt, phase: 'saving' }
    const outcome = writeState(storage, base, portfolio, history)
    if (outcome.outcome === 'written') {
      base = outcome.revision
      // Acknowledge THIS revision only: a change recorded while the write was
      // running is still unsaved, and keeps saying so.
      status =
        attempt === edit
          ? { revision: attempt, phase: 'saved' }
          : { revision: edit, phase: 'dirty' }
      return
    }
    status = { revision: attempt, phase: outcome.outcome === 'conflict' ? 'conflict' : 'error' }
  }

  // The save re-checks `enabled` AND `blocked` AT FIRE TIME: a debounce armed
  // just before toggle(false) must never resurrect what clearStored() erased,
  // and one armed before the verdict must never land on an unread document.
  const saver = storage ? debounce(write, SAVE_DELAY_MS, schedule) : undefined

  /** The current document as one envelope's worth of arguments. */
  const current = (): [Portfolio, History] => [
    store.present,
    { past: store.past, future: store.future },
  ]

  /**
   * Re-reads the storage and re-bases this tab on what it finds — the first
   * half of every path that is about to write after someone else may have.
   * `undefined` when the bytes are UNREADABLE: the wiring blocks instead, and
   * the caller must write nothing.
   */
  const rebase = (storageNow: KeyValueStorage): StoredState | undefined => {
    const found = readStored(storageNow)
    if (found.state === 'unreadable') {
      unreadable = { raw: found.raw, refusal: found.refusal }
      return undefined
    }
    if (found.state === 'unavailable') {
      // The storage answered at boot and refuses now. There are no bytes to
      // show and no revision to write against — the save simply failed, and
      // the strip's «download a copy» is the one thing still worth offering.
      status = { revision: edit, phase: 'error' }
      return undefined
    }
    base = found.state === 'restored' ? found.revision : null
    return found
  }

  /** Arms the saves and writes the current state — the tail of every path that
   * has EARNED the right to write (nothing stored, or a settled decision). */
  const armAndWrite = (storageNow: KeyValueStorage): void => {
    enabled = true
    offered = undefined
    savePersistEnabled(storageNow, true)
    write(...current())
  }

  const control: PersistenceControl = {
    get enabled() {
      return enabled
    },
    get save() {
      // No storage at all: say it, permanently and whatever the switch reads.
      // A switch that is off is a CHOICE and needs no strip; a browser that
      // refuses to store is a surprise, and finding out at the next reload is
      // exactly the failure this strip exists to prevent.
      if (!storage) return UNAVAILABLE
      // The switch is off: an indicator on a document nobody is saving would
      // be a lie.
      return enabled ? status : undefined
    },
    get pendingRestore() {
      return offered !== undefined
    },
    get available() {
      return storage !== null
    },
    toggle(next: boolean) {
      // Blocked: neither branch may run — `true` would write over the
      // unreadable envelope, `false` would erase it. Both are the recovery
      // screen's decision to take, not a switch's.
      if (blocked()) return
      // No storage: the switch governs nothing, so it moves nothing. Flipping
      // a flag that can never reach a write would only make the interface
      // claim a choice the browser has already taken away.
      if (!storage) return
      if (!next) {
        enabled = false
        offered = undefined
        savePersistEnabled(storage, false)
        // Disarm the pending debounce BEFORE erasing: belt (cancel here) and
        // braces (the fire-time check above) against a posthumous rewrite.
        saver?.cancel()
        clearStored(storage)
        base = null
        return
      }
      // ON is a write path: read the storage BEFORE touching it. The save may
      // have been off for a while — long enough for a document to be sitting
      // there — and the open one is not automatically the right one.
      const found = rebase(storage)
      if (found === undefined) return
      if (found.state === 'restored') {
        offered = found.portfolio
        return
      }
      armAndWrite(storage)
    },
    restore() {
      const portfolio = offered
      if (portfolio === undefined || !storage) return
      // An ordinary, UNDOABLE replacement — the same command an import emits:
      // choosing the stored copy must not cost the open one irreversibly.
      store.dispatch({ type: 'ReplacePortfolio', portfolio })
      armAndWrite(storage)
    },
    keepOpen() {
      if (offered === undefined || !storage) return
      armAndWrite(storage)
    },
    dismissRestore() {
      offered = undefined
    },
    takeStored() {
      if (status.phase !== 'conflict' || !storage) return
      const found = rebase(storage)
      if (found === undefined) return
      // Undoable, like every other whole-document replacement: taking the
      // other tab's copy must not cost this one irreversibly.
      if (found.state === 'restored') {
        store.dispatch({ type: 'ReplacePortfolio', portfolio: found.portfolio })
      }
      write(...current())
    },
    keepMine() {
      if (status.phase !== 'conflict' || !storage) return
      if (rebase(storage) === undefined) return
      write(...current())
    },
  }

  return {
    control,
    scheduleSave: (portfolio, history) => {
      if (!enabled || blocked()) return
      if (bootEcho) {
        bootEcho = false
        return
      }
      edit += 1
      status = { revision: edit, phase: 'dirty' }
      saver?.run(portfolio, history)
    },
    // A save still pending when the page goes away would be lost: 'pagehide'
    // is the last reliable signal (close, reload and bfcache entry alike).
    // Blocked, there is nothing to lose and everything to protect.
    flush: () => {
      if (blocked()) return
      saver?.flush()
    },
    noticeStoredChange: () => {
      if (!storage || !enabled || blocked()) return
      if (storedRevision(storage) === base) return
      // Someone else's bytes are in there. Disarm first — the pending save
      // still names the old revision and would be refused anyway, but a
      // conflict that waits for a deadline to be announced is a conflict the
      // user meets too late.
      saver?.cancel()
      status = { revision: edit, phase: 'conflict' }
    },
    get blocked() {
      return blocked()
    },
    get unreadable() {
      return unreadable
    },
    discard: () => {
      if (!blocked()) return
      // Erase FIRST, unblock second: the next reload must find nothing rather
      // than the blob the user just abandoned.
      if (storage) clearStored(storage)
      base = null
      unreadable = undefined
      status = { revision: edit, phase: 'dirty' }
    },
  }
}
