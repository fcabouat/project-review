/**
 * Pins the three port adapters (`src/local-storage.ts`, `src/scheduler.ts`):
 * `defaultStorage` is never a prerequisite, `watchStored` narrows the
 * browser's cross-tab signal to the one key that matters, and
 * `timeoutScheduler` drives the core debounce on real `setTimeout` (under fake
 * timers here).
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { SAVE_DELAY_MS, STATE_KEY, debounce } from '@project-review/core/services/persistence'
import { defaultStorage, watchStored } from '../src/local-storage'
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

  it('answers null when the ACCESS ITSELF throws — the boot must survive it', () => {
    // Third-party storage blocked, restricted contexts: the property getter
    // raises `SecurityError`, which is why a `typeof` guard is not enough —
    // `typeof localStorage` evaluates that very getter. Unguarded, the
    // exception lands in the app's startup and no editor is ever drawn.
    const host = globalThis as { localStorage?: unknown }
    Object.defineProperty(host, 'localStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('access denied', 'SecurityError')
      },
    })
    try {
      expect(() => defaultStorage()).not.toThrow()
      expect(defaultStorage()).toBeNull()
    } finally {
      delete host.localStorage
    }
  })

  it('answers null when the object is there but reading it throws', () => {
    const host = globalThis as { localStorage?: unknown }
    host.localStorage = {
      getItem: () => {
        throw new DOMException('access denied', 'SecurityError')
      },
      setItem: () => {},
      removeItem: () => {},
    }
    try {
      expect(defaultStorage()).toBeNull()
    } finally {
      delete host.localStorage
    }
  })

  it('hands back a storage that READS but refuses to WRITE — its document is still worth restoring', () => {
    // A quota-full or private-browsing storage answers every read. Declaring
    // it unavailable would throw away a perfectly restorable document; the
    // refused write already has a verdict of its own.
    const stub = {
      getItem: () => '{"format":1,"revision":3,',
      setItem: () => {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      },
      removeItem: () => {},
    }
    const host = globalThis as { localStorage?: unknown }
    host.localStorage = stub
    try {
      expect(defaultStorage()).toBe(stub)
    } finally {
      delete host.localStorage
    }
  })
})

describe('watchStored', () => {
  /** A window stub that hands its `storage` listener back to the test — the
   * node suite has none, and the adapter's whole job is what it does with the
   * event it receives. */
  const stubWindow = () => {
    const listeners = new Set<(event: StorageEvent) => void>()
    const stub = {
      addEventListener: (_type: string, fn: (event: StorageEvent) => void) =>
        void listeners.add(fn),
      removeEventListener: (_type: string, fn: (event: StorageEvent) => void) =>
        void listeners.delete(fn),
    }
    ;(globalThis as { window?: unknown }).window = stub
    return {
      listeners,
      fire: (key: string | null) => {
        for (const fn of listeners) fn({ key } as StorageEvent)
      },
      restore: () => {
        delete (globalThis as { window?: unknown }).window
      },
    }
  }

  it('fires on the saved document, and on a storage cleared wholesale', () => {
    const host = stubWindow()
    let calls = 0
    try {
      const stop = watchStored(() => {
        calls += 1
      })
      host.fire(STATE_KEY)
      // `null` is how the browser announces a `clear()`: it concerns the
      // document too, so the caller must hear about it.
      host.fire(null)
      expect(calls).toBe(2)

      // Any other key is somebody else's business — the scheme preference,
      // an unrelated app on the same origin.
      host.fire('project-review/scheme')
      host.fire('something-else')
      expect(calls).toBe(2)

      stop()
      expect(host.listeners.size).toBe(0)
      host.fire(STATE_KEY)
      expect(calls).toBe(2)
    } finally {
      host.restore()
    }
  })

  it('a host that refuses the subscription simply never signals', () => {
    // There is no `window` at all in a worker, and a restricted context can
    // throw on the very `addEventListener`. Neither may reach the boot: the
    // courtesy is lost, the editor is not — the write's own guard is what
    // protects the document (see the core's `WatchStored`).
    ;(globalThis as { window?: unknown }).window = {
      addEventListener: () => {
        throw new DOMException('denied', 'SecurityError')
      },
      removeEventListener: () => {},
    }
    try {
      let calls = 0
      const stop = watchStored(() => {
        calls += 1
      })
      // The cancel handed back is inert, and calling it is safe: there is
      // nothing to disarm, and a caller must not have to know that.
      expect(() => stop()).not.toThrow()
      expect(calls).toBe(0)
    } finally {
      delete (globalThis as { window?: unknown }).window
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
