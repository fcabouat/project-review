/**
 * `?sample` boot policy — a full demo on the very first click: the landing's
 * « Try it » link opens `project-review.html?sample` and the app boots into
 * the Déjà Vu Ltd. sample set FETCHED FROM NEXT DOOR instead of an empty
 * portfolio. The deliverable itself carries no content (the samples ship
 * alongside it — `dist/sample-portfolio.{en,fr}.json` — and on the project
 * site): one ingestion path, the import contract, whether a person or this
 * boot does the importing.
 *
 * Three rules, all pinned by `tests/sample-boot.test.ts`:
 * - an existing base ALWAYS wins: the sample loads only when no snapshot is
 *   stored (the persistence effect would otherwise save the sample over it);
 * - the set is picked in the CURRENT language and goes through the same
 *   strict parse as any import — a sample that violated the contract loads
 *   nothing;
 * - every refusal is SILENT and total: `file://` (where `fetch` would litter
 *   the console, so it is never attempted), a missing file, bad JSON or a
 *   contract violation all boot the ordinary empty portfolio.
 *
 * The fetch happens BEFORE the app mounts (`main.ts` awaits it): reading
 * `location.search` and the stored snapshot stays with the callers.
 */
import type { Language } from '@project-review/core/model/theme'
import type { Portfolio } from '@project-review/core/model/portfolio'
import { parsePortfolio } from '@project-review/core/services/parse'

/** `true` when the URL asks for the demo AND nothing is stored locally. */
export const shouldBootSample = (search: string, storedSnapshot: string | null): boolean =>
  new URLSearchParams(search).has('sample') && storedSnapshot === null

/** First-boot language: a browser announcing French gets fr, the rest en. */
export const detectLanguage = (candidate: string): Language =>
  candidate.toLowerCase().startsWith('fr') ? 'fr' : 'en'

/** The sample file served NEXT TO the app — one per language. */
export const sampleFileName = (language: Language): string => `sample-portfolio.${language}.json`

/**
 * Fetches the neighbour sample set of the given language, through the strict
 * parse. TOTAL AND SILENT: `undefined` on any refusal — and from `file://`
 * (or any non-http base) the fetch is never even attempted, because the Fetch
 * API logs a console error there that no try/catch can silence (same guard as
 * the export's `fetchAsDataUri`).
 */
export const fetchSample = async (
  language: Language,
  baseUri: string = typeof document === 'undefined' ? '' : document.baseURI,
): Promise<Portfolio | undefined> => {
  try {
    const url = new URL(sampleFileName(language), baseUri)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    const response = await fetch(url)
    if (!response.ok) return undefined
    const parsed = parsePortfolio(await response.json())
    return parsed.ok ? parsed.portfolio : undefined
  } catch {
    return undefined
  }
}
