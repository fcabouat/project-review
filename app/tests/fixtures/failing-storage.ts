/**
 * WHY THIS FIXTURE. An in-memory `KeyValueStorage` with a failure switch: the
 * persistence wiring promises that a full or refusing localStorage surfaces
 * as `lastError` and never throws — flipping `failing` mid-test is how that
 * funnel (and its clearing on the next success) is exercised without a real
 * browser quota.
 */
import type { KeyValueStorage } from '@project-review/core/services/persistence'

export interface MemoryStorage extends KeyValueStorage {
  readonly content: Map<string, string>
  failing: boolean
}

export const createMemoryStorage = (): MemoryStorage => {
  const content = new Map<string, string>()
  return {
    content,
    failing: false,
    getItem: (k) => content.get(k) ?? null,
    setItem(k, v) {
      if (this.failing) throw new Error('quota')
      content.set(k, v)
    },
    removeItem: (k) => void content.delete(k),
  }
}
