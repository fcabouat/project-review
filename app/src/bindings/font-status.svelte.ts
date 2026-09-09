/**
 * Wiring of the live font verdict (Settings ▸ Appearance): watches the
 * portfolio's font family and, for the ONE locally served family (Marianne),
 * runs the injected probe — the infrastructure's `document.fonts` sounding in
 * production, a controllable fake in tests. Between two answers the status is
 * `unknown`: the card must never flash «not found» while the browser is still
 * looking, and a STALE answer (the user already switched families again) is
 * dropped by the epoch guard rather than overwriting the fresh probe.
 */

import type { FontStatus } from '@project-review/components/screens/contracts'

/** The one family whose files are deployed alongside the app (fonts.ts). */
const LOCAL_FAMILY = 'Marianne'

export interface FontStatusWiring {
  /** Current verdict — `unknown` for every family but the local one. */
  readonly status: FontStatus
  /** Feed it from an effect reading `settings.theme.font`. */
  readonly watch: (family: string) => void
}

export const createFontStatus = (
  probe: (family: string) => Promise<FontStatus>,
): FontStatusWiring => {
  let status = $state<FontStatus>('unknown')
  let epoch = 0

  return {
    get status() {
      return status
    },
    watch(family: string) {
      epoch += 1
      const mine = epoch
      status = 'unknown'
      if (family.trim() !== LOCAL_FAMILY) return
      void probe(family.trim()).then((verdict) => {
        if (mine === epoch) status = verdict
      })
    },
  }
}
