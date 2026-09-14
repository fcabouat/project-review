/**
 * Read-only demo inputs, fetched next to the app and strictly parsed.
 * `main.ts` resolves both language variants before mounting. The demo never
 * reads/writes an existing portfolio; failures produce an explicit error
 * screen, never a silently editable empty document. No fetch from file://.
 */
import type { Language } from '@project-review/core/model/theme'
import type { Portfolio } from '@project-review/core/model/portfolio'
import { MAX_IMPORT_BYTES } from '@project-review/core/model/budget'
import { readPortfolioJson } from '@project-review/core/services/parse'

/** Initial language for a localized link, falling back to the browser. */
export const detectLanguage = (candidate: string, search = ''): Language => {
  const requested = new URLSearchParams(search).get('lang')
  return requested === 'fr' || requested === 'en'
    ? requested
    : candidate.toLowerCase().startsWith('fr')
      ? 'fr'
      : 'en'
}

/** The sample file served NEXT TO the app — one per language. */
export const sampleFileName = (language: Language): string => `sample-portfolio.${language}.json`

export interface DemoBoot {
  readonly portfolios: Readonly<Partial<Record<Language, Portfolio>>>
  readonly error?: string
}

/**
 * At most `limit` bytes of a response body, or `undefined` — REFUSED past the
 * bound, never truncated: half a JSON document is not a smaller JSON document.
 *
 * WHY THE BODY IS NOT SIMPLY READ. `response.json()` parses whatever arrives,
 * of whatever size: the boot would allocate a served file of any length before
 * anything got the chance to refuse it, and the ceiling the import path states
 * would apply to a string that had already cost the tab its memory. So the
 * DECLARED length is checked first — one header, no read — and the body is
 * then consumed chunk by chunk with a running count that abandons the stream
 * the moment it passes the bound.
 *
 * A body the runtime does not stream falls back to the whole read; the length
 * check above still stands in front of it, and past that this is a file served
 * from beside the application itself.
 */
const boundedText = async (response: Response, limit: number): Promise<string | undefined> => {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > limit) return undefined
  const body = response.body
  if (body === null) return response.text()
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let read = 0
  let text = ''
  for (;;) {
    const chunk = await reader.read()
    if (chunk.done) break
    read += chunk.value.byteLength
    if (read > limit) {
      await reader.cancel()
      return undefined
    }
    text += decoder.decode(chunk.value, { stream: true })
  }
  return text + decoder.decode()
}

/**
 * Fetches the neighbour sample set of the given language, through the VERY
 * path an imported file takes — bounded read, size cap, `JSON.parse`, strict
 * parse (`readPortfolioJson`). TOTAL AND SILENT: `undefined` on any refusal —
 * and from `file://` (or any non-http base) the fetch is never even attempted,
 * because the Fetch API logs a console error there that no try/catch can
 * silence (same guard as the export's `fetchAsDataUri`).
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
    const text = await boundedText(response, MAX_IMPORT_BYTES)
    if (text === undefined) return undefined
    const parsed = readPortfolioJson(text)
    return parsed.ok && parsed.portfolio.settings.language === language
      ? parsed.portfolio
      : undefined
  } catch {
    return undefined
  }
}
