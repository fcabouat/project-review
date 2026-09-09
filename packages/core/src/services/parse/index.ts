/**
 * STRICT portfolio import: the file either honors
 * the published contract byte for byte, or it is refused with the EXHAUSTIVE
 * list of its violations — every fault is collected in one pass ({ path, code,
 * params }), never just the first one, and nothing is ever repaired: no named
 * fallback, no id dedup-suffix, no clamping. Unknown keys refuse too — the
 * contract is closed (`portfolio.schema.json` states the same rules).
 *
 * The parser reads the `version: 3` shape ONLY: a file whose top-level keys
 * are not the schema's is refused with its error list — no repair, no
 * guessing.
 *
 * Errors are STRUCTURED: the domain names what happened, the editor renders it
 * through its catalog (`editor.error.*`), localized. No display string here.
 */
import type { Portfolio } from '../../model/portfolio'
import type { ParseError } from './errors'
import type { Errors } from './json'
import { checkKeys, fail, isRecord } from './json'
import { parseReview } from './review'
import { parseSettings } from './settings'
import { parseCategories } from './categories'
import { parseProjects } from './projects'
import { parseFreeSlides } from './free-slides'

export { PARSE_ERROR_CODES } from './errors'
export type { ParseError, ParseErrorCode } from './errors'
export { LOGO_MAX_CHARS } from './settings'

/**
 * Ceiling of an imported payload, in characters: ~10 MB. Orders of magnitude
 * above any real portfolio (the samples weigh ~50 kB, an inline logo caps at
 * `LOGO_MAX_CHARS`), and low enough that a mispasted archive never reaches
 * `JSON.parse` — the length check costs nothing and runs FIRST.
 */
export const IMPORT_MAX_CHARS = 10_000_000

/**
 * What reading a would-be portfolio text can yield: the strict parse's own
 * result, or one of the two PRE-PARSE refusals — text too large (checked
 * before `JSON.parse`), text that is not JSON at all. Structured like the
 * parse errors: the domain names what happened (`refusal`), the editor
 * renders it through its catalog (`editor.error.*`).
 */
export type ReadOutcome =
  ParseResult | { readonly ok: false; readonly refusal: 'tooLarge' | 'badJson' }

/**
 * The single reading path of an imported TEXT (file drop, pasted JSON): size
 * cap, then `JSON.parse`, then the strict parse — in that order, so an
 * oversized payload is refused without ever being scanned.
 */
export function readPortfolioJson(text: string): ReadOutcome {
  if (text.length > IMPORT_MAX_CHARS) return { ok: false, refusal: 'tooLarge' }
  try {
    return parsePortfolio(JSON.parse(text))
  } catch {
    return { ok: false, refusal: 'badJson' }
  }
}

/**
 * All-or-nothing: success hands over a valid portfolio; refusal hands over the
 * COMPLETE error list and NOTHING partial — the caller keeps its current state
 * (the import dialog shows the report, the app keeps running).
 */
export type ParseResult =
  | { readonly ok: true; readonly portfolio: Portfolio }
  | { readonly ok: false; readonly errors: readonly ParseError[] }

const ROOT_REQUIRED = ['version', 'review', 'settings', 'categories', 'projects', 'freeSlides']

/**
 * The single entry point of every byte that becomes a portfolio: file import,
 * pasted JSON, the localStorage snapshot. STRICT — see the module header; the
 * one refusal shape is `{ ok: false, errors }`, and `errors` is exhaustive.
 *
 * Guarantees on success, which the rest of the app treats as invariants: every
 * key known and required keys present, ids non-empty and unique per
 * collection, enumerations valid, `progress` an integer in 0–100, `recapRows`
 * an integer in 6–16, dates calendar-valid, at least one block per free slide
 * — every refined value (values/) is built here, through its constructor.
 * Element order is preserved — order is data.
 *
 * Deterministic and clockless: same input, same result, whatever the day —
 * `reviewDate` comes from the data, never from `Date`.
 */
export function parsePortfolio(unknownInput: unknown): ParseResult {
  const errors: Errors = []

  if (!isRecord(unknownInput)) {
    return { ok: false, errors: [{ path: '', code: 'notAnObject' }] }
  }
  const root = unknownInput

  checkKeys(root, '', ROOT_REQUIRED, [], errors)
  if (root['version'] !== undefined && root['version'] !== 3) {
    fail(errors, 'version', 'invalidVersion', { value: String(root['version']) })
  }

  const review = parseReview(root['review'], errors)
  const settings = parseSettings(root['settings'], errors)
  const categories = parseCategories(root['categories'], errors)
  const projects = parseProjects(root['projects'], errors)
  const freeSlides = parseFreeSlides(root['freeSlides'], errors)

  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    portfolio: { version: 3, review, settings, categories, projects, freeSlides },
  }
}
