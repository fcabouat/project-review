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

/** `null` outside a browser: it is up to the caller to decide whether to persist. */
export const defaultStorage = (): KeyValueStorage | null =>
  typeof localStorage === 'undefined' ? null : localStorage

/**
 * The browser's own cross-tab signal: `storage` fires on every OTHER document
 * of the same origin, never on the one that wrote. Narrowed to the saved
 * document — a `null` key means the whole storage was cleared, which concerns
 * it too. Nothing is read here: the caller compares revisions and decides.
 */
export const watchStored: WatchStored = (onChange): Cancel => {
  const listener = (event: StorageEvent): void => {
    if (event.key === null || event.key === STATE_KEY) onChange()
  }
  window.addEventListener('storage', listener)
  return () => window.removeEventListener('storage', listener)
}
