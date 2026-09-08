/**
 * Wiring between the store and the persistence policy: the local-save switch
 * (Settings ▸ Data), the debounced snapshot/history saves and their failure
 * funnel. The policy itself is the core's (`services/persistence`); the
 * storage and the scheduler are whatever the caller injects — the browser
 * adapters in production, in-memory doubles in tests. Extracted from
 * `App.svelte` so the shell only mounts views; the `$effect`s that feed
 * `schedule*` stay in the component that owns the store.
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
): PersistenceWiring => {
  let enabled = $state(initiallyEnabled)
  let saveError = $state<string | null>(null)

  /** Funnel of every write outcome: last failure wins, next success clears it. */
  const report = (ok: boolean): void => {
    saveError = ok ? null : 'localStorage'
  }

  // Both saves re-check `enabled` AT FIRE TIME: a debounce armed just before
  // toggle(false) must never resurrect what clearStored() erased.
  const snapshotSave = storage
    ? debounce(
        (p: Portfolio) => {
          if (enabled) report(saveNow(storage, p))
        },
        SAVE_DELAY_MS,
        schedule,
      )
    : undefined
  const historySave = storage
    ? debounce(
        (h: History) => {
          if (enabled) report(saveHistory(storage, h))
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
      if (enabled) snapshotSave?.run(portfolio)
    },
    scheduleHistory: (history) => {
      if (enabled) historySave?.run(history)
    },
    // A save still pending when the page goes away would be lost: 'pagehide'
    // is the last reliable signal (close, reload and bfcache entry alike).
    flush: () => {
      snapshotSave?.flush()
      historySave?.flush()
    },
  }
}
