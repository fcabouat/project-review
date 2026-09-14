/**
 * Reader-side appearance preference — Système / Clair / Sombre. Deliberately
 * NOT a domain event: the scheme belongs to the reader's screen, not to the
 * portfolio, so it must never travel with the file nor land in the undo
 * history. Stored app-side like the local-save flag, and INDEPENDENTLY of the
 * local-save opt-out: the key holds a UI preference, never portfolio data.
 *
 * The control only keeps the CHOICE; turning `system` into an actual light or
 * dark rendering (prefers-color-scheme, the `dark` class on <html>) is the
 * mounting component's affair — this module stays DOM-free and node-testable.
 */

import type { KeyValueStorage } from '@project-review/core/services/persistence'
import type { AppearanceControl, ColorScheme } from '@project-review/components/screens/contracts'

/** localStorage key of the scheme preference — a sibling of the core's keys. */
export const SCHEME_KEY = 'project-review/scheme'

const isScheme = (value: unknown): value is ColorScheme =>
  value === 'system' || value === 'light' || value === 'dark'

/** Stored choice, `system` when nothing (or garbage) is stored. */
export const loadScheme = (storage: KeyValueStorage | null): ColorScheme => {
  const raw = storage?.getItem(SCHEME_KEY)
  return isScheme(raw) ? raw : 'system'
}

/**
 * Builds the control around one storage: `scheme` is reactive state, every
 * change is written through (total — a refusing storage keeps the in-memory
 * choice for the session, same contract as the persistence saves).
 */
export const createAppearance = (storage: KeyValueStorage | null): AppearanceControl => {
  let scheme = $state(loadScheme(storage))

  return {
    get scheme() {
      return scheme
    },
    setScheme(next: ColorScheme) {
      scheme = next
      try {
        storage?.setItem(SCHEME_KEY, next)
      } catch {
        // Quota or private browsing: the choice still applies until reload.
      }
    },
  }
}
