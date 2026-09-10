/**
 * Pins the persistence wiring (`src/bindings/persistence-control.svelte.ts`)
 * — the local-save switch and debounced saves, on an in-memory storage
 * (`../fixtures/failing-storage.ts`) and fake timers: the debounce rides the
 * real `SAVE_DELAY_MS` through the infrastructure's `timeoutScheduler`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Portfolio } from '@project-review/core/model/portfolio'
import { testPortfolio } from '../../../packages/core/tests/fixtures/hand-built-portfolios'
import { createStore } from '../../src/bindings/runtime.svelte'
import { createPersistenceControl } from '../../src/bindings/persistence-control.svelte'
import {
  HISTORY_KEY,
  PREF_KEY,
  SAVE_DELAY_MS,
  STORAGE_KEY,
  loadHistory,
  readSnapshot,
  type KeyValueStorage,
} from '@project-review/core/services/persistence'
import { timeoutScheduler } from '@project-review/infrastructure/scheduler'
import { createMemoryStorage } from '../fixtures/failing-storage'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

/** The stored portfolio, or `null` when nothing readable is there. */
const stored = (storage: KeyValueStorage): unknown => {
  const back = readSnapshot(storage)
  return back.state === 'restored' ? back.portfolio : null
}

describe('createPersistenceControl', () => {
  it('toggle(on) on an empty storage writes snapshot AND history right away', () => {
    const storage = createMemoryStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, false, timeoutScheduler)

    expect(wiring.control.enabled).toBe(false)
    wiring.control.toggle(true)
    expect(wiring.control.enabled).toBe(true)
    expect(storage.getItem(PREF_KEY)).toBe('on')
    expect(stored(storage)).toEqual(testPortfolio())
    expect(loadHistory(storage)).toEqual({ past: [], future: [] })
  })

  it('toggle(off) erases the stored data, keeps the preference, disarms pending saves', () => {
    const storage = createMemoryStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, true, timeoutScheduler)

    wiring.control.toggle(true)
    wiring.scheduleSnapshot(store.present) // armed…
    wiring.control.toggle(false) // …and must die with the toggle
    vi.advanceTimersByTime(SAVE_DELAY_MS)

    expect(storage.getItem(PREF_KEY)).toBe('off')
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    expect(storage.getItem(HISTORY_KEY)).toBeNull()
  })

  it('debounces the scheduled saves to one write, at the shared deadline', () => {
    const storage = createMemoryStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, true, timeoutScheduler)

    wiring.scheduleSnapshot(store.present)
    wiring.scheduleSnapshot(store.present)
    wiring.scheduleHistory({ past: store.past, future: store.future })
    expect(storage.content.size).toBe(0)

    vi.advanceTimersByTime(SAVE_DELAY_MS)
    expect(stored(storage)).toEqual(testPortfolio())
    expect(loadHistory(storage)).toEqual({ past: [], future: [] })
  })

  it('flush fires what is pending NOW (the pagehide path)', () => {
    const storage = createMemoryStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, true, timeoutScheduler)

    wiring.scheduleSnapshot(store.present)
    wiring.flush()
    expect(stored(storage)).toEqual(testPortfolio())
  })

  it('schedules nothing while disabled', () => {
    const storage = createMemoryStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, false, timeoutScheduler)

    wiring.scheduleSnapshot(store.present)
    wiring.scheduleHistory({ past: [], future: [] })
    vi.advanceTimersByTime(SAVE_DELAY_MS)
    expect(storage.content.size).toBe(0)
  })

  it('funnels write failures into lastError, cleared by the next success', () => {
    const storage = createMemoryStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, true, timeoutScheduler)

    storage.failing = true
    wiring.scheduleSnapshot(store.present)
    vi.advanceTimersByTime(SAVE_DELAY_MS)
    expect(wiring.control.lastError).toBe('localStorage')

    storage.failing = false
    wiring.scheduleSnapshot(store.present)
    vi.advanceTimersByTime(SAVE_DELAY_MS)
    expect(wiring.control.lastError).toBeNull()
  })

  it('tolerates the no-storage environment: everything is a safe no-op', () => {
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, null, false, timeoutScheduler)

    expect(() => {
      wiring.control.toggle(true)
      wiring.scheduleSnapshot(store.present)
      wiring.scheduleHistory({ past: [], future: [] })
      wiring.flush()
      vi.advanceTimersByTime(SAVE_DELAY_MS)
    }).not.toThrow()
    expect(wiring.control.lastError).toBeNull()
  })
})

/**
 * THE INVARIANT: data the application failed to read back is never written
 * over. Every write path of the wiring is tried here against a storage holding
 * an unreadable snapshot — the point is not that one path is guarded but that
 * NONE of them is open.
 */
describe('blocked on an unreadable snapshot', () => {
  const CORRUPT = '{"version":1,"was":"a portfolio, once"}'

  /** A storage holding data the parse refuses, and a wiring born blocked. */
  const blockedSetup = (enabled: boolean) => {
    const storage = createMemoryStorage()
    storage.setItem(STORAGE_KEY, CORRUPT)
    storage.setItem(HISTORY_KEY, '{"v":3,"past":[],"future":[]}')
    storage.writes = 0 // the seeding is not the wiring's doing
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(
      store,
      storage,
      enabled,
      timeoutScheduler,
      readSnapshot(storage),
    )
    return { storage, store, wiring }
  }

  it('starts blocked, and says so', () => {
    expect(blockedSetup(true).wiring.blocked).toBe(true)
  })

  it('writes nothing through the debounced saves, deadline or no deadline', () => {
    const { storage, store, wiring } = blockedSetup(true)

    wiring.scheduleSnapshot(store.present)
    wiring.scheduleHistory({ past: store.past, future: store.future })
    vi.advanceTimersByTime(SAVE_DELAY_MS * 10)

    expect(storage.getItem(STORAGE_KEY)).toBe(CORRUPT)
    expect(storage.writes).toBe(0)
  })

  it('writes nothing through the pagehide flush', () => {
    const { storage, store, wiring } = blockedSetup(true)

    wiring.scheduleSnapshot(store.present)
    wiring.flush()

    expect(storage.getItem(STORAGE_KEY)).toBe(CORRUPT)
    expect(storage.writes).toBe(0)
  })

  /* The switch is the one path that writes WITHOUT a debounce, and the one
     that erases: both directions are the recovery screen's call, not its. */
  it('ignores the local-save switch, in both directions', () => {
    const { storage, wiring } = blockedSetup(false)

    wiring.control.toggle(true)
    expect(wiring.control.enabled).toBe(false)
    expect(storage.getItem(STORAGE_KEY)).toBe(CORRUPT)

    const armed = blockedSetup(true)
    armed.wiring.control.toggle(false)
    expect(armed.wiring.control.enabled).toBe(true)
    expect(armed.storage.getItem(STORAGE_KEY)).toBe(CORRUPT)
    expect(armed.storage.getItem(HISTORY_KEY)).not.toBeNull()
    expect(armed.storage.writes).toBe(0)
  })

  it('discard() — the explicit decision — erases snapshot AND history, then lets writes resume', () => {
    const { storage, store, wiring } = blockedSetup(true)

    wiring.discard()

    expect(wiring.blocked).toBe(false)
    // Erased, not overwritten: the next boot finds nothing rather than the
    // blob the user just abandoned.
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    expect(storage.getItem(HISTORY_KEY)).toBeNull()

    wiring.scheduleSnapshot(store.present)
    vi.advanceTimersByTime(SAVE_DELAY_MS)
    expect(stored(storage)).toEqual(testPortfolio())
  })

  it('discard() is not a general erase: on a wiring that was never blocked it does nothing', () => {
    const storage = createMemoryStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, true, timeoutScheduler)

    wiring.control.toggle(true)
    wiring.discard()

    expect(stored(storage)).toEqual(testPortfolio())
  })
})

/**
 * THE SAME INVARIANT AT THE SWITCH — the path a boot cannot see. Local save
 * OFF, a snapshot sitting in the storage: turning the save back on used to
 * write the open document straight over it. It now READS first, and the three
 * outcomes below are the whole of the rule.
 */
describe('turning the save back on reads the storage first', () => {
  /** A storage already holding `seeded`, and a wiring on ANOTHER document. */
  const seededSetup = (seeded: Portfolio) => {
    const storage = createMemoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify(seeded))
    storage.writes = 0
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(
      store,
      storage,
      false,
      timeoutScheduler,
      readSnapshot(storage),
    )
    return { storage, store, wiring }
  }

  /** The stored document, told apart from the open one by its title. */
  const otherPortfolio = (): Portfolio => ({
    ...testPortfolio(),
    review: { ...testPortfolio().review, title: 'The stored one' },
  })

  it('a readable snapshot suspends the switch: nothing written, nothing enabled', () => {
    const { storage, wiring } = seededSetup(otherPortfolio())

    wiring.control.toggle(true)

    expect(wiring.control.pendingRestore).toBe(true)
    expect(wiring.control.enabled).toBe(false)
    expect(storage.writes).toBe(0)
    expect(storage.getItem(PREF_KEY)).toBeNull()
    expect(stored(storage)).toEqual(otherPortfolio())
  })

  it('restore() loads the stored copy — undoably — and then saves', () => {
    const { storage, store, wiring } = seededSetup(otherPortfolio())

    wiring.control.toggle(true)
    wiring.control.restore()

    expect(store.present).toEqual(otherPortfolio())
    expect(store.canUndo).toBe(true) // an ordinary replacement, Ctrl+Z away
    expect(wiring.control.enabled).toBe(true)
    expect(wiring.control.pendingRestore).toBe(false)
    expect(stored(storage)).toEqual(otherPortfolio())
  })

  it('keepOpen() is the deliberate overwrite: the open document wins, once asked', () => {
    const { storage, store, wiring } = seededSetup(otherPortfolio())

    wiring.control.toggle(true)
    wiring.control.keepOpen()

    expect(store.present).toEqual(testPortfolio())
    expect(wiring.control.enabled).toBe(true)
    expect(stored(storage)).toEqual(testPortfolio())
  })

  it('dismissRestore() steps back: the stored copy is intact and the save stays off', () => {
    const { storage, wiring } = seededSetup(otherPortfolio())

    wiring.control.toggle(true)
    wiring.control.dismissRestore()

    expect(wiring.control.pendingRestore).toBe(false)
    expect(wiring.control.enabled).toBe(false)
    expect(storage.writes).toBe(0)
    expect(stored(storage)).toEqual(otherPortfolio())
  })

  it('an UNREADABLE snapshot met at the switch blocks the wiring, exactly as at boot', () => {
    const storage = createMemoryStorage()
    storage.setItem(STORAGE_KEY, '{"version":1,"was":"a portfolio, once"}')
    storage.writes = 0
    const store = createStore(testPortfolio())
    // Nothing was stored when this wiring was built: the storage was written
    // to behind its back, which is exactly how this case happens.
    const wiring = createPersistenceControl(store, storage, false, timeoutScheduler)

    wiring.control.toggle(true)

    expect(wiring.blocked).toBe(true)
    expect(wiring.unreadable?.raw).toBe('{"version":1,"was":"a portfolio, once"}')
    expect(wiring.control.enabled).toBe(false)
    expect(storage.writes).toBe(0)
  })

  it('the decision hooks are inert when nothing is pending', () => {
    const storage = createMemoryStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, false, timeoutScheduler)

    wiring.control.restore()
    wiring.control.keepOpen()
    wiring.control.dismissRestore()

    expect(wiring.control.enabled).toBe(false)
    expect(storage.writes).toBe(0)
  })

  it('with no storage at all the switch just flips — there is nothing to read', () => {
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, null, false, timeoutScheduler)

    wiring.control.toggle(true)
    expect(wiring.control.enabled).toBe(true)
    expect(wiring.control.pendingRestore).toBe(false)
    wiring.control.toggle(false)
    expect(wiring.control.enabled).toBe(false)
  })
})
