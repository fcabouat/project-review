/**
 * WHY THIS FIXTURE. In-memory doubles for the persistence policy's two
 * injected interfaces (`services/persistence.ts`) — the very seams the
 * infrastructure fills in production. The storage counts its writes (the
 * debounce tests assert HOW MANY, not just what), and the scheduler is a hand
 * crank: time never passes unless a test turns it, so no business test ever
 * touches a real clock.
 */

import type { KeyValueStorage, Scheduler } from '../../src/services/persistence'

export interface MemoryStorage extends KeyValueStorage {
  readonly writes: number
  readonly content: ReadonlyMap<string, string>
}

export const createMemoryStorage = (): MemoryStorage => {
  const data = new Map<string, string>()
  let writes = 0
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      writes += 1
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
    get writes() {
      return writes
    },
    get content() {
      return data
    },
  }
}

export interface ManualScheduler {
  readonly schedule: Scheduler
  readonly fire: () => void
  readonly scheduled: number
  readonly cancelled: number
  readonly lastDelay: number | null
}

export const createManualScheduler = (): ManualScheduler => {
  let pending: (() => void) | null = null
  let scheduled = 0
  let cancelled = 0
  let lastDelay: number | null = null

  const schedule: Scheduler = (action, delayMs) => {
    scheduled += 1
    lastDelay = delayMs
    pending = action
    return () => {
      cancelled += 1
      if (pending === action) pending = null
    }
  }

  return {
    schedule,
    fire: () => {
      const action = pending
      pending = null
      action?.()
    },
    get scheduled() {
      return scheduled
    },
    get cancelled() {
      return cancelled
    },
    get lastDelay() {
      return lastDelay
    },
  }
}
