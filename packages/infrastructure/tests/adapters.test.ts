/**
 * Pins the two port adapters (`src/local-storage.ts`, `src/scheduler.ts`):
 * `defaultStorage` is never a prerequisite, and `timeoutScheduler` drives the
 * core debounce on real `setTimeout` (under fake timers here).
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { SAVE_DELAY_MS, debounce } from '@project-review/core/services/persistence'
import { defaultStorage } from '../src/local-storage'
import { timeoutScheduler } from '../src/scheduler'

afterEach(() => {
  vi.useRealTimers()
})

describe('defaultStorage', () => {
  it('returns null outside a browser (never required)', () => {
    expect(defaultStorage()).toBeNull()
  })

  it('hands back the page localStorage when one exists (globalThis stub)', () => {
    // The node suite has no window: a stub on globalThis stands in for the
    // browser, proving the adapter returns THE ambient object, not a copy.
    const stub = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
    const host = globalThis as { localStorage?: unknown }
    host.localStorage = stub
    try {
      expect(defaultStorage()).toBe(stub)
    } finally {
      delete host.localStorage
    }
  })
})

describe('timeoutScheduler', () => {
  it('drives the core debounce on real timeouts', () => {
    vi.useFakeTimers()
    let calls = 0
    const f = debounce(
      () => {
        calls += 1
      },
      SAVE_DELAY_MS,
      timeoutScheduler,
    )

    f.run()
    f.run()
    f.run()
    vi.advanceTimersByTime(SAVE_DELAY_MS - 1)
    expect(calls).toBe(0)
    vi.advanceTimersByTime(1)
    expect(calls).toBe(1)
  })

  it('cancel maps to clearTimeout: a disarmed action never fires', () => {
    vi.useFakeTimers()
    let calls = 0
    const cancel = timeoutScheduler(() => {
      calls += 1
    }, 100)
    cancel()
    vi.advanceTimersByTime(1000)
    expect(calls).toBe(0)
  })
})
