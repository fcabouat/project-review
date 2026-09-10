/**
 * Wiring of the live font verdict (Settings ▸ Appearance): watches the
 * portfolio's font family and answers with its SOURCE — and every possible
 * source is local, because the app fetches no font (infrastructure's
 * `fonts.ts`). In order of strength:
 *  - covered by the portfolio's own embedded faces → `embedded`, no probe:
 *    the faces travel in the file, nothing can be missing;
 *  - one of the families bundled in this build → `bundled`, no probe either:
 *    a fact of the build, not of the deployment;
 *  - ANY other family → the injected probe runs, because only the deployment
 *    knows whether `fonts/<family>/` actually holds the files: `served` when
 *    they arrived, `missing` when nothing did and the system stack takes over.
 *    The infrastructure's `document.fonts` sounding in production, a
 *    controllable fake in tests.
 * No family is named here: the probe takes whichever one the portfolio
 * carries. Between two answers the status is `unknown` — the card must never
 * flash «not found» while the browser is still looking, and a STALE answer
 * (the user already switched families again) is dropped by the epoch guard
 * rather than overwriting the fresh probe.
 */

import { BUNDLED_FAMILIES } from '@project-review/infrastructure/fonts'
import type { FontStatus } from '@project-review/components/screens/contracts'

export interface FontStatusWiring {
  /** Current verdict — `unknown` only while a probe is in flight. */
  readonly status: FontStatus
  /** Feed it from an effect reading `settings.theme.font` AND the embedded
   * families (`embeddedFamilies(settings.theme.fontFaces)`). */
  readonly watch: (family: string, embedded?: readonly string[]) => void
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
    watch(family: string, embedded: readonly string[] = []) {
      epoch += 1
      const mine = epoch
      const clean = family.trim()
      if (embedded.includes(clean)) {
        status = 'embedded'
        return
      }
      if (BUNDLED_FAMILIES.includes(clean)) {
        status = 'bundled'
        return
      }
      status = 'unknown'
      void probe(clean).then((verdict) => {
        if (mine === epoch) status = verdict
      })
    },
  }
}
