/**
 * WHY THIS FIXTURE. An in-memory `KeyValueStorage` with a failure switch: the
 * persistence wiring promises that a full or refusing localStorage surfaces
 * as `lastError` and never throws — flipping `failing` mid-test is how that
 * funnel (and its clearing on the next success) is exercised without a real
 * browser quota.
 *
 * `writes` counts the writes that LANDED: comparing stored values proves the
 * content is intact, the counter proves nothing was written at all — which is
 * the stronger claim the blocked-persistence invariant needs.
 */
import type { KeyValueStorage } from '@project-review/core/services/persistence'

export interface MemoryStorage extends KeyValueStorage {
  readonly content: Map<string, string>
  failing: boolean
  /** Successful `setItem` calls since creation. */
  writes: number
}

export const createMemoryStorage = (): MemoryStorage => {
  const content = new Map<string, string>()
  return {
    content,
    failing: false,
    writes: 0,
    getItem: (k) => content.get(k) ?? null,
    setItem(k, v) {
      if (this.failing) throw new Error('quota')
      content.set(k, v)
      this.writes += 1
    },
    removeItem: (k) => void content.delete(k),
  }
}
