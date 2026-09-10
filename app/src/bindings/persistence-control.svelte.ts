/**
 * Wiring between the store and the persistence policy: the local-save switch
 * (Settings ▸ Data), the debounced snapshot/history saves and their failure
 * funnel. The policy itself is the core's (`services/persistence`); the
 * storage and the scheduler are whatever the caller injects — the browser
 * adapters in production, in-memory doubles in tests. Extracted from
 * `App.svelte` so the shell only mounts views; the `$effect`s that feed
 * `schedule*` stay in the component that owns the store.
 *
 * THE INVARIANT THIS MODULE OWNS, AND IT HAS NO EXCEPTION — the persistence
 * NEVER writes over a snapshot it has not read back. Every write path is
 * covered by it, the switch included:
 *  - built on an `unreadable` snapshot, the wiring starts BLOCKED: the two
 *    debounced saves, the pagehide flush and the switch itself are all
 *    disarmed, and only an explicit human decision —
 *    {@link PersistenceWiring.discard}, the recovery screen's «start empty» —
 *    lifts it;
 *  - turning the save back ON is itself a write over whatever the storage
 *    holds, so it READS FIRST ({@link PersistenceControl.toggle}): an
 *    unreadable snapshot blocks the wiring there and then (the recovery
 *    screen takes over, exactly as at boot), a readable one is offered for
 *    restoration and nothing is written until a person answers.
 * The rule lives here, in the control, rather than in a branch of the mounting
 * component, because a branch protects one call site while the invariant must
 * hold for every one of them: the cause of the state found in the storage (a
 * value the format refuses, a truncating quota, a hand-edited store, a save
 * switched off for a while, a format that moves on) is irrelevant to it.
 */

import type { Portfolio } from '@project-review/core/model/portfolio'
import type { History } from '@project-review/core/events/history'
import {
  SAVE_DELAY_MS,
  clearStored,
  debounce,
  readSnapshot,
  save as saveNow,
  saveHistory,
  savePersistEnabled,
  type KeyValueStorage,
  type Scheduler,
  type SnapshotRefusal,
  type StoredSnapshot,
} from '@project-review/core/services/persistence'
import type { PersistenceControl } from '@project-review/components/screens/contracts'
import type { Store } from './runtime.svelte'

/** A snapshot the format refuses, with the bytes the recovery screen hands back. */
export interface UnreadableSnapshot {
  readonly raw: string
  readonly refusal: SnapshotRefusal
}

export interface PersistenceWiring {
  /** The Settings switch: off erases the stored keys, on writes right away. */
  readonly control: PersistenceControl
  /** Debounced snapshot save — feed it from an effect reading `store.present`. */
  readonly scheduleSnapshot: (portfolio: Portfolio) => void
  /** Same cadence for the history: past and future are plain event arrays. */
  readonly scheduleHistory: (history: History) => void
  /** 'pagehide' hook: fires anything still pending, now. */
  readonly flush: () => void
  /** `true` while a stored snapshot the app could not read is still there and
   * no one has decided its fate: not one byte is written in this state. */
  readonly blocked: boolean
  /** The unreadable snapshot itself while {@link blocked} — what the recovery
   * screen renders. Found at boot, or by the switch when it read the storage. */
  readonly unreadable: UnreadableSnapshot | undefined
  /**
   * The one way out of `blocked`, and it is a PERSON's decision: abandon the
   * unreadable snapshot (erased, history included — it described a document
   * that was never loaded) and let the saves resume. Called by the recovery
   * screen's « start empty », never automatically.
   */
  readonly discard: () => void
}

/**
 * Builds the wiring around one store and one storage. `initiallyEnabled` comes
 * from `loadPersistEnabled` — read by the caller BEFORE building the store,
 * since it decides whether the snapshot is even loaded — and `stored` is the
 * verdict `readSnapshot` gave on that same boot, so the wiring starts in the
 * state the storage is actually in.
 */
export const createPersistenceControl = (
  store: Store,
  storage: KeyValueStorage | null,
  initiallyEnabled: boolean,
  schedule: Scheduler,
  /** What the storage held at boot. `unreadable` starts the wiring blocked
   * and stays that way until {@link PersistenceWiring.discard}. */
  stored: StoredSnapshot = { state: 'absent' },
): PersistenceWiring => {
  let enabled = $state(initiallyEnabled)
  let unreadable = $state<UnreadableSnapshot | undefined>(
    stored.state === 'unreadable' ? { raw: stored.raw, refusal: stored.refusal } : undefined,
  )
  /** The readable snapshot the switch found on its way ON — a decision is
   * pending and NOTHING has been written yet. */
  let offered = $state<Portfolio | undefined>(undefined)
  let saveError = $state<string | null>(null)

  const blocked = (): boolean => unreadable !== undefined

  /** Funnel of every write outcome: last failure wins, next success clears it. */
  const report = (ok: boolean): void => {
    saveError = ok ? null : 'localStorage'
  }

  // Both saves re-check `enabled` AND `blocked` AT FIRE TIME: a debounce armed
  // just before toggle(false) must never resurrect what clearStored() erased,
  // and one armed before the verdict must never land on an unread snapshot.
  const snapshotSave = storage
    ? debounce(
        (p: Portfolio) => {
          if (enabled && !blocked()) report(saveNow(storage, p))
        },
        SAVE_DELAY_MS,
        schedule,
      )
    : undefined
  const historySave = storage
    ? debounce(
        (h: History) => {
          if (enabled && !blocked()) report(saveHistory(storage, h))
        },
        SAVE_DELAY_MS,
        schedule,
      )
    : undefined

  /** Arms the saves and writes the current state — the tail of every path that
   * has EARNED the right to write (nothing stored, or a settled decision). */
  const armAndWrite = (): void => {
    enabled = true
    offered = undefined
    if (!storage) return
    savePersistEnabled(storage, true)
    report(
      saveNow(storage, store.present) &&
        saveHistory(storage, { past: store.past, future: store.future }),
    )
  }

  const control: PersistenceControl = {
    get enabled() {
      return enabled
    },
    get lastError() {
      return saveError
    },
    get pendingRestore() {
      return offered !== undefined
    },
    toggle(next: boolean) {
      // Blocked: neither branch may run — `true` would write over the
      // unreadable snapshot, `false` would erase it. Both are the recovery
      // screen's decision to take, not a switch's.
      if (blocked()) return
      if (!next) {
        enabled = false
        offered = undefined
        if (!storage) return
        savePersistEnabled(storage, false)
        // Disarm the pending debounces BEFORE erasing: belt (cancel here) and
        // braces (the fire-time check above) against a posthumous rewrite.
        snapshotSave?.cancel()
        historySave?.cancel()
        clearStored(storage)
        return
      }
      if (!storage) {
        enabled = true
        return
      }
      // ON is a write path: read the storage BEFORE touching it. The save may
      // have been off for a while — long enough for a snapshot to be sitting
      // there — and the open document is not automatically the right one.
      const found = readSnapshot(storage)
      if (found.state === 'unreadable') {
        // The boot-time case, met later: same verdict, same screen, same rule.
        unreadable = { raw: found.raw, refusal: found.refusal }
        return
      }
      if (found.state === 'restored') {
        offered = found.portfolio
        return
      }
      armAndWrite()
    },
    restore() {
      const portfolio = offered
      if (portfolio === undefined) return
      // An ordinary, UNDOABLE replacement — the same command an import emits:
      // choosing the stored copy must not cost the open one irreversibly.
      store.dispatch({ type: 'ReplacePortfolio', portfolio })
      armAndWrite()
    },
    keepOpen() {
      if (offered === undefined) return
      armAndWrite()
    },
    dismissRestore() {
      offered = undefined
    },
  }

  return {
    control,
    scheduleSnapshot: (portfolio) => {
      if (enabled && !blocked()) snapshotSave?.run(portfolio)
    },
    scheduleHistory: (history) => {
      if (enabled && !blocked()) historySave?.run(history)
    },
    // A save still pending when the page goes away would be lost: 'pagehide'
    // is the last reliable signal (close, reload and bfcache entry alike).
    // Blocked, there is nothing to lose and everything to protect.
    flush: () => {
      if (blocked()) return
      snapshotSave?.flush()
      historySave?.flush()
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
      unreadable = undefined
    },
  }
}
