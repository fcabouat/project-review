/**
 * Pins the persistence wiring (`src/bindings/persistence-control.svelte.ts`)
 * — the local-save switch and debounced saves, on an in-memory storage
 * (`../fixtures/failing-storage.ts`) and fake timers: the debounce rides the
 * real `SAVE_DELAY_MS` through the infrastructure's `timeoutScheduler`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testPortfolio } from '../../../packages/core/tests/fixtures/hand-built-portfolios'
import { createStore } from '../../src/bindings/runtime.svelte'
import { createPersistenceControl } from '../../src/bindings/persistence-control.svelte'
import {
  HISTORY_KEY,
  PREF_KEY,
  SAVE_DELAY_MS,
  STORAGE_KEY,
  loadHistory,
  loadRaw,
} from '@project-review/core/services/persistence'
import { timeoutScheduler } from '@project-review/infrastructure/scheduler'
import { createMemoryStorage } from '../fixtures/failing-storage'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('createPersistenceControl', () => {
  it('toggle(on) writes snapshot AND history right away', () => {
    const storage = createMemoryStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, false, timeoutScheduler)

    expect(wiring.control.enabled).toBe(false)
    wiring.control.toggle(true)
    expect(wiring.control.enabled).toBe(true)
    expect(storage.getItem(PREF_KEY)).toBe('on')
    expect(loadRaw(storage)).toStrictEqual(testPortfolio())
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
    expect(loadRaw(storage)).toStrictEqual(testPortfolio())
    expect(loadHistory(storage)).toEqual({ past: [], future: [] })
  })

  it('flush fires what is pending NOW (the pagehide path)', () => {
    const storage = createMemoryStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, true, timeoutScheduler)

    wiring.scheduleSnapshot(store.present)
    wiring.flush()
    expect(loadRaw(storage)).toStrictEqual(testPortfolio())
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
