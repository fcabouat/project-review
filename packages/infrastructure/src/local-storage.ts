/**
 * Browser adapter for the persistence policy's {@link KeyValueStorage} and
 * {@link WatchStored}: `window.localStorage`, when it exists, and the
 * `storage` event that tells one tab another has written. The core's policy
 * never names either — the app wires them in at startup.
 */

import {
  STATE_KEY,
  type Cancel,
  type KeyValueStorage,
  type WatchStored,
} from '@project-review/core/services/persistence'

/**
 * The page storage, or `null` when this browser has none TO OFFER — and the
 * three ways it can have none are all reached the same way, by trying:
 *  - there is no `localStorage` binding at all (node, a worker);
 *  - NAMING it raises. Under blocked third-party storage and in restricted
 *    contexts the property access itself throws `SecurityError`, which is why
 *    a `typeof` guard is not enough: `typeof localStorage` evaluates the very
 *    getter that throws, and the exception lands in the app's boot;
 *  - it exists, and reading a key throws anyway.
 * The read probe is the last step and it reads THE key the policy uses, not a
 * key of its own: it must not write. A storage that reads but refuses to WRITE
 * (quota full, private browsing) is deliberately handed back — the document in
 * it is still worth restoring, and a refused write already has a verdict of its
 * own (`refused`, and the save strip's «download a copy»).
 *
 * `null` is not a failure the caller has to interpret: `readStored(null)`
 * answers `unavailable`, the one verdict that says "nothing will ever be
 * saved here" out loud.
 */
export const defaultStorage = (): KeyValueStorage | null => {
  try {
    const storage = localStorage
    storage.getItem(STATE_KEY)
    return storage
  } catch {
    return null
  }
}

/**
 * The browser's own cross-tab signal: `storage` fires on every OTHER document
 * of the same origin, never on the one that wrote. Narrowed to the saved
 * document — a `null` key means the whole storage was cleared, which concerns
 * it too. Nothing is read here: the caller compares revisions and decides.
 *
 * Total like its neighbour: a host with no `window`, or one that refuses the
 * subscription, simply never signals — the compare-and-swap is the guard, this
 * is the courtesy (see the core's `WatchStored`).
 */
export const watchStored: WatchStored = (onChange): Cancel => {
  const listener = (event: StorageEvent): void => {
    if (event.key === null || event.key === STATE_KEY) onChange()
  }
  try {
    window.addEventListener('storage', listener)
  } catch {
    return () => {}
  }
  return () => window.removeEventListener('storage', listener)
}
