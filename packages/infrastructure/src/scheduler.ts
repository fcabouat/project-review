/**
 * Browser adapter for the persistence policy's {@link Scheduler}: real time,
 * as `setTimeout`/`clearTimeout`. The core's debounce decides WHEN a burst
 * condenses; this is the HOW of time passing in production.
 */

import type { Scheduler } from '@project-review/core/services/persistence'

/** The production scheduler: one `setTimeout`, cancelled by `clearTimeout`. */
export const timeoutScheduler: Scheduler = (action, delayMs) => {
  const id = setTimeout(action, delayMs)
  return () => clearTimeout(id)
}
