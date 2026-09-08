/**
 * Browser adapter for the persistence policy's {@link KeyValueStorage}:
 * `window.localStorage`, when it exists. The core's policy never names it —
 * the app wires this in at startup.
 */

import type { KeyValueStorage } from '@project-review/core/services/persistence'

/** `null` outside a browser: it is up to the caller to decide whether to persist. */
export const defaultStorage = (): KeyValueStorage | null =>
  typeof localStorage === 'undefined' ? null : localStorage
