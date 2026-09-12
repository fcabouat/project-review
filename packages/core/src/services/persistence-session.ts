/**
 * One editing session's persistence policy, independent of its host.
 * Stamps detect conflicts, not an atomic lock. Unreadable stored bytes stay
 * protected until discard succeeds. The host supplies model access, pending
 * input and change notification; there is no framework, DOM or clock here.
 */
import type { Portfolio } from '../model/portfolio'
import { hydrate as hydrateHistory, type History } from '../events/history'
import {
  SAVE_DELAY_MS,
  clearStored,
  debounce,
  loadPersistEnabled,
  readStored,
  storedStamp,
  writeState,
  savePersistEnabled,
  type KeyValueStorage,
  type StateStamp,
  type Scheduler,
  type StateRefusal,
  type StoredState,
} from './persistence'

/** A complete snapshot and an undoable replacement supplied by the host. */
export interface PersistenceDocument {
  readonly present: Portfolio
  readonly past: History['past']
  readonly future: History['future']
  readonly replace: (portfolio: Portfolio) => void
}

/** Pending input is outside the stored model until the host commits it. */
export interface PendingInput {
  readonly pending: boolean
  readonly commitAll: () => void
}

export type SavePhase =
  'dirty' | 'saving' | 'saved' | 'pending' | 'error' | 'conflict' | 'off' | 'unavailable'
export interface SaveState {
  readonly revision: number
  readonly phase: SavePhase
}
export interface UnreadableState {
  readonly raw: string
  readonly refusal: StateRefusal
}
export interface PersistenceActions {
  readonly enabled: boolean
  readonly available: boolean
  readonly save: SaveState | undefined
  readonly pendingRestore: boolean
  readonly toggle: (enabled: boolean) => void
  readonly restore: () => void
  readonly keepOpen: () => void
  readonly dismissRestore: () => void
  readonly takeStored: () => void
  readonly keepMine: () => void
}
export interface PersistenceSession {
  readonly control: PersistenceActions
  readonly scheduleSave: (portfolio: Portfolio, history: History) => void
  /** Commit input, reread the model and write in one synchronous turn. */
  readonly flush: () => void
  readonly noticeStoredChange: () => void
  readonly blocked: boolean
  readonly unreadable: UnreadableState | undefined
  readonly discard: () => void
  readonly discardRefused: boolean
}
interface HeldState {
  readonly portfolio: Portfolio
  readonly past: History['past']
  readonly future: History['future']
}
const UNAVAILABLE: SaveState = { revision: 0, phase: 'unavailable' }
const sameState = (one: HeldState | undefined, portfolio: Portfolio, history: History): boolean =>
  one !== undefined &&
  one.portfolio === portfolio &&
  one.past === history.past &&
  one.future === history.future
const sameEvents = (one: History['past'], other: History['past']): boolean =>
  one.length === other.length && one.every((event, index) => event === other[index])

/** Notify the host after a transition, including a deferred write. */
export function createPersistenceSession(
  document: PersistenceDocument,
  storage: KeyValueStorage | null,
  initiallyEnabled: boolean,
  schedule: Scheduler,
  stored: StoredState,
  input: PendingInput,
  changed: () => void,
): PersistenceSession {
  let enabled = initiallyEnabled
  let unreadable: UnreadableState | undefined =
    stored.state === 'unreadable' ? { raw: stored.raw, refusal: stored.refusal } : undefined
  let offered: Portfolio | undefined
  let discardRefused = false
  let base: StateStamp | null = stored.state === 'restored' ? stored.stamp : null
  let edit = 0
  let status: SaveState = {
    revision: 0,
    phase: stored.state === 'restored' ? 'saved' : 'dirty',
  }
  // Undo can restore a portfolio reference while changing both history stacks.
  let held: HeldState | undefined =
    stored.state === 'restored'
      ? { portfolio: stored.portfolio, past: stored.history.past, future: stored.history.future }
      : undefined
  if (held !== undefined) {
    // Hydration may re-cap a restored log into new arrays. Recognise those
    // references without assuming the host will send an initial save echo.
    const hydrated = hydrateHistory({ past: held.past, future: held.future })
    if (sameEvents(hydrated.past, document.past) && sameEvents(hydrated.future, document.future)) {
      held = { portfolio: held.portfolio, past: document.past, future: document.future }
    }
  }

  const transition =
    <A extends readonly unknown[]>(action: (...args: A) => void) =>
    (...args: A): void => {
      try {
        action(...args)
      } finally {
        changed()
      }
    }
  const blocked = (): boolean => unreadable !== undefined
  const isStored = (portfolio: Portfolio, history: History): boolean =>
    sameState(held, portfolio, history)
  const current = (): [Portfolio, History] => [
    document.present,
    { past: document.past, future: document.future },
  ]
  const refuse = (): void => {
    status = { revision: edit, phase: 'error' }
  }

  // A browser-wide opt-out stops this tab and attempts the erasure gesture.
  // Repeated storage signals are harmless; only toggle(on) re-enables saving.
  const standDown = (): void => {
    if (status.phase === 'off') return
    saver?.cancel()
    enabled = false
    offered = undefined
    held = undefined
    status = { revision: edit, phase: 'off' }
    if (storage) clearStored(storage)
  }

  const write = (portfolio: Portfolio, history: History): void => {
    if (!storage || !enabled || blocked()) return
    if (!loadPersistEnabled(storage)) return standDown()
    const attempt = edit
    status = { revision: attempt, phase: 'saving' }
    const outcome = writeState(storage, base, portfolio, history)
    if (outcome.outcome === 'written') {
      base = outcome.stamp
      held = { portfolio, past: outcome.history.past, future: outcome.history.future }
      status =
        attempt === edit
          ? { revision: attempt, phase: 'saved' }
          : { revision: edit, phase: 'dirty' }
    } else if (outcome.outcome === 'conflict') {
      held = undefined
      status = { revision: attempt, phase: 'conflict' }
    } else {
      status = { revision: attempt, phase: 'error' }
    }
  }
  // Fire-time guards also protect timers armed before an opt-out.
  const saver = storage ? debounce(transition(write), SAVE_DELAY_MS, schedule) : undefined

  const rebase = (storageNow: KeyValueStorage): StoredState | undefined => {
    const found = readStored(storageNow)
    if (found.state === 'unreadable') {
      unreadable = { raw: found.raw, refusal: found.refusal }
      return undefined
    }
    if (found.state === 'unavailable') {
      refuse()
      return undefined
    }
    base = found.state === 'restored' ? found.stamp : null
    return found
  }
  const armAndWrite = (storageNow: KeyValueStorage): void => {
    offered = undefined
    if (!savePersistEnabled(storageNow, true)) return refuse()
    enabled = true
    write(...current())
  }

  const control: PersistenceActions = {
    get enabled() {
      return enabled
    },
    get available() {
      return storage !== null
    },
    get pendingRestore() {
      return offered !== undefined
    },
    get save(): SaveState | undefined {
      if (!storage) return UNAVAILABLE
      if (!enabled && status.phase !== 'error' && status.phase !== 'off') return undefined
      // Input must not hide an error or conflict that requires a choice.
      return status.phase === 'saved' && input.pending
        ? { revision: status.revision, phase: 'pending' }
        : status
    },
    toggle: transition((next: boolean) => {
      if (blocked() || !storage) return
      if (!next) {
        // Preference first; roll it back if erasing the document fails.
        if (!savePersistEnabled(storage, false)) return refuse()
        saver?.cancel()
        if (!clearStored(storage)) {
          if (!savePersistEnabled(storage, true)) enabled = false
          return refuse()
        }
        enabled = false
        offered = undefined
        base = null
        held = undefined
        status = { revision: edit, phase: 'dirty' }
        return
      }
      const found = rebase(storage)
      if (found === undefined) return
      if (found.state === 'restored') offered = found.portfolio
      else armAndWrite(storage)
    }),
    restore: transition(() => {
      const portfolio = offered
      if (portfolio === undefined || !storage) return
      document.replace(portfolio)
      armAndWrite(storage)
    }),
    keepOpen: transition(() => {
      if (offered === undefined || !storage) return
      armAndWrite(storage)
    }),
    dismissRestore: transition(() => {
      offered = undefined
    }),
    takeStored: transition(() => {
      if (status.phase !== 'conflict' || !storage) return
      const found = rebase(storage)
      if (found === undefined) return
      if (found.state === 'restored') document.replace(found.portfolio)
      write(...current())
    }),
    keepMine: transition(() => {
      if (status.phase !== 'conflict' || !storage) return
      if (rebase(storage) !== undefined) write(...current())
    }),
  }

  return {
    control,
    scheduleSave: transition((portfolio: Portfolio, history: History) => {
      if (!enabled || blocked()) return
      if (isStored(portfolio, history)) {
        saver?.cancel()
        return
      }
      edit += 1
      status = { revision: edit, phase: 'dirty' }
      saver?.run(portfolio, history)
    }),
    flush: transition(() => {
      if (blocked()) return
      const [wasPortfolio, wasHistory] = current()
      const before = { portfolio: wasPortfolio, past: wasHistory.past, future: wasHistory.future }
      input.commitAll()
      const [portfolio, history] = current()
      saver?.cancel()
      if (isStored(portfolio, history)) return
      if (!sameState(before, portfolio, history)) edit += 1
      write(portfolio, history)
    }),
    noticeStoredChange: transition(() => {
      if (!storage || !enabled || blocked()) return
      if (!loadPersistEnabled(storage)) return standDown()
      if (storedStamp(storage) === base) return
      held = undefined
      saver?.cancel()
      status = { revision: edit, phase: 'conflict' }
    }),
    get blocked() {
      return blocked()
    },
    get unreadable() {
      return unreadable
    },
    get discardRefused() {
      return discardRefused
    },
    discard: transition(() => {
      if (!blocked()) return
      if (storage && !clearStored(storage)) {
        discardRefused = true
        return
      }
      discardRefused = false
      base = null
      held = undefined
      unreadable = undefined
      status = { revision: edit, phase: 'dirty' }
    }),
  }
}
