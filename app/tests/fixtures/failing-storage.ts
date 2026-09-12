/**
 * WHY THIS FIXTURE. An in-memory `KeyValueStorage` that can refuse writes PER
 * KEY. A browser storage does not fail as a whole: a quota is reached by one
 * value, private browsing refuses some origins, an extension blocks one key —
 * so the interesting failure is always PARTIAL. `refuse` is the switch: the
 * wiring promises that a refused write surfaces as a visible save state, never
 * throws, and is NEVER acknowledged by the success of some other key.
 *
 * `writes` counts the writes that LANDED: comparing stored values proves the
 * content is intact, the counter proves nothing was written at all — which is
 * the stronger claim the blocked-persistence invariant needs.
 */
import type { KeyValueStorage } from '@project-review/core/services/persistence'

export interface MemoryStorage extends KeyValueStorage {
  readonly content: Map<string, string>
  /** Which keys the storage says no to. Nothing, by default. */
  refuse: (key: string) => boolean
  /**
   * Which keys the storage will not GIVE UP — the other half of a partial
   * failure, and the one a caller is most tempted to assume away. Two shapes,
   * both real: `'throw'` is the storage that raises on `removeItem`, `'keep'`
   * is the one that returns as if it had obeyed and leaves the value in place.
   * Only a read-back tells the second from a success.
   */
  refuseRemoval: (key: string) => false | 'throw' | 'keep'
  /** Successful `setItem` calls since creation. */
  writes: number
}

export const createMemoryStorage = (): MemoryStorage => {
  const content = new Map<string, string>()
  const self: MemoryStorage = {
    content,
    refuse: () => false,
    refuseRemoval: () => false,
    writes: 0,
    getItem: (k) => content.get(k) ?? null,
    setItem: (k, v) => {
      if (self.refuse(k)) throw new Error('quota')
      content.set(k, v)
      self.writes += 1
    },
    removeItem: (k) => {
      const refusal = self.refuseRemoval(k)
      if (refusal === 'throw') throw new Error('removal refused')
      if (refusal === 'keep') return
      content.delete(k)
    },
  }
  return self
}

/**
 * The other failure, and the blunter one: a storage whose every call throws
 * `SecurityError` — what a browser with third-party storage blocked actually
 * does. It is not a storage that fails to KEEP things, it is one that refuses
 * to be spoken to at all, READS INCLUDED, and unguarded that exception takes
 * the whole boot down before a screen is drawn.
 */
export const createHostileStorage = (): KeyValueStorage => {
  const refuse = (): never => {
    throw new DOMException('access denied', 'SecurityError')
  }
  return { getItem: refuse, setItem: refuse, removeItem: refuse }
}

/**
 * A view of one storage that runs `watch` just before each write lands — the
 * only way to observe what the wiring looks like DURING a save (the `saving`
 * phase), and to make a change arrive mid-write.
 */
export const observeWrites = (inner: MemoryStorage, watch: () => void): KeyValueStorage => ({
  getItem: (key) => inner.getItem(key),
  setItem: (key, value) => {
    watch()
    inner.setItem(key, value)
  },
  removeItem: (key) => inner.removeItem(key),
})
