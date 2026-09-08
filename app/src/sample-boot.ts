/**
 * `?sample` boot policy — a full demo on the very first click: the landing's
 * « Try it » link opens `project-review.html?sample` and the app boots straight
 * into the bundled Déjà Vu Ltd. sample set instead of an empty portfolio.
 *
 * Two rules, both pinned by `tests/sample-boot.test.ts`:
 * - an existing base ALWAYS wins: the sample loads only when no snapshot is
 *   stored (the persistence effect would otherwise save the sample over it);
 * - the set is picked in the CURRENT language and goes through the same strict
 *   parse as any import — a sample that violated the contract loads nothing.
 *
 * PURE module (strings in, decision out): reading `location.search` and the
 * stored snapshot stays in `App.svelte`, next to the other startup reads.
 */
import type { Language } from '@project-review/core/model/theme'
import type { Portfolio } from '@project-review/core/model/portfolio'
import { parsePortfolio } from '@project-review/core/services/parse'
import sampleFr from '@project-review/core/samples/sample-portfolio.fr.json'
import sampleEn from '@project-review/core/samples/sample-portfolio.en.json'

/** `true` when the URL asks for the demo AND nothing is stored locally. */
export const shouldBootSample = (search: string, storedSnapshot: string | null): boolean =>
  new URLSearchParams(search).has('sample') && storedSnapshot === null

/** The bundled sample set of the given language, through the strict parse. */
export const bundledSample = (language: Language): Portfolio | undefined => {
  const parsed = parsePortfolio(language === 'en' ? sampleEn : sampleFr)
  return parsed.ok ? parsed.portfolio : undefined
}
