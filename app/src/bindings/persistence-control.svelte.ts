/**
 * Wiring between the store and the persistence policy: the local-save switch
 * (Settings ▸ Data), the debounced snapshot/history saves and their failure
 * funnel. The policy itself is the core's (`services/persistence`); the
 * storage and the scheduler are whatever the caller injects — the browser
 * adapters in production, in-memory doubles in tests. Extracted from
 * `App.svelte` so the shell only mounts views; the `$effect`s that feed
 * `schedule*` stay in the component that owns the store.
 *
 * THE INVARIANT THIS MODULE OWNS — the persistence NEVER writes over data it
 * failed to read back. Built with `unreadableSnapshot`, the wiring starts
 * BLOCKED: every write path (the two debounced saves, the pagehide flush, the
 * switch itself) is disarmed, and only an explicit human decision —
 * {@link PersistenceWiring.discard} — lifts it. It lives here, in the control,
 * rather than in a branch of the mounting component, because a branch protects
 * one call site while the invariant must hold for every one of them: the cause
 * of an unreadable snapshot (a value the format refuses, a truncating quota, a
 * hand-edited store, a format that moves on) is irrelevant to the rule.
 */

import type { Portfolio } from '@project-review/core/model/portfolio'
import type { History } from '@project-review/core/events/history'
import {
  SAVE_DELAY_MS,
  clearStored,
  debounce,
  save as saveNow,
  saveHistory,
  savePersistEnabled,
  type KeyValueStorage,
  type Scheduler,
} from '@project-review/core/services/persistence'
import type { PersistenceControl } from '@project-review/components/screens/contracts'
import type { Store } from './runtime.svelte'

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
 * since it decides whether the snapshot is even loaded.
 */
export const createPersistenceControl = (
  store: Store,
  storage: KeyValueStorage | null,
  initiallyEnabled: boolean,
  schedule: Scheduler,
  /** `true` when `readSnapshot` came back `unreadable`: the wiring starts
   * blocked and stays that way until {@link PersistenceWiring.discard}. */
  unreadableSnapshot = false,
): PersistenceWiring => {
  let enabled = $state(initiallyEnabled)
  let blocked = $state(unreadableSnapshot)
  let saveError = $state<string | null>(null)

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
          if (enabled && !blocked) report(saveNow(storage, p))
        },
        SAVE_DELAY_MS,
        schedule,
      )
    : undefined
  const historySave = storage
    ? debounce(
        (h: History) => {
          if (enabled && !blocked) report(saveHistory(storage, h))
        },
        SAVE_DELAY_MS,
        schedule,
      )
    : undefined

  const control: PersistenceControl = {
    get enabled() {
      return enabled
    },
    get lastError() {
      return saveError
    },
    toggle(next: boolean) {
      // Blocked: neither branch may run — `true` would write over the
      // unreadable snapshot, `false` would erase it. Both are the recovery
      // screen's decision to take, not a switch's.
      if (blocked) return
      enabled = next
      if (!storage) return
      savePersistEnabled(storage, next)
      if (next) {
        report(
          saveNow(storage, store.present) &&
            saveHistory(storage, { past: store.past, future: store.future }),
        )
      } else {
        // Disarm the pending debounces BEFORE erasing: belt (cancel here) and
        // braces (the fire-time check above) against a posthumous rewrite.
        snapshotSave?.cancel()
        historySave?.cancel()
        clearStored(storage)
      }
    },
  }

  return {
    control,
    scheduleSnapshot: (portfolio) => {
      if (enabled && !blocked) snapshotSave?.run(portfolio)
    },
    scheduleHistory: (history) => {
      if (enabled && !blocked) historySave?.run(history)
    },
    // A save still pending when the page goes away would be lost: 'pagehide'
    // is the last reliable signal (close, reload and bfcache entry alike).
    // Blocked, there is nothing to lose and everything to protect.
    flush: () => {
      if (blocked) return
      snapshotSave?.flush()
      historySave?.flush()
    },
    get blocked() {
      return blocked
    },
    discard: () => {
      if (!blocked) return
      // Erase FIRST, unblock second: the next reload must find nothing rather
      // than the blob the user just abandoned.
      if (storage) clearStored(storage)
      blocked = false
    },
  }
}
