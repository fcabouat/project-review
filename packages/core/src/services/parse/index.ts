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
export { FONT_FACE_MAX_CHARS, FONT_FACES_TOTAL_MAX_CHARS, LOGO_MAX_CHARS } from './settings'

/**
 * Ceiling of an imported payload, in characters: ~10 MB. Orders of magnitude
 * above any real portfolio (the samples weigh ~50 kB, an inline logo caps at
 * `LOGO_MAX_CHARS`), and low enough that a mispasted archive never reaches
 * `JSON.parse` — the length check costs nothing and runs FIRST.
 */
export const IMPORT_MAX_CHARS = 10_000_000

/**
 * Ceiling on the NUMBER of entities a portfolio may carry — projects,
 * categories and free slides together. The byte cap above does not bound this:
 * measured on the built application, 10 MB of JSON holds ~9 800 realistic
 * projects (and ~56 000 minimal ones), and every one of them derives a slide.
 *
 * Where the figure comes from — measured, not chosen. On the built app, with
 * the portfolio restored from storage, the Projects screen renders in 0.4 s at
 * 500 projects, 1.0 s at 1 000, 1.9 s at 2 000 and 9.9 s at 5 000, where a
 * click also takes 0.7 s and the heap reaches 352 MB for 109 000 DOM nodes.
 * 2 000 is the last size that still answers: twice the comfortable one, a
 * hundred times any real portfolio (the samples carry 20), and — the other
 * reason — it stays well under what `localStorage` will actually accept, since
 * a 9 MB document is REFUSED by the browser quota and could never be saved.
 *
 * Counted BEFORE the elements are read, so an absurd payload is refused
 * without ever being built into objects.
 */
export const MAX_ENTITIES = 2_000

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
 * pasted JSON, the portfolio inside the stored envelope. STRICT — see the module header; the
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

  // The entity ceiling comes FIRST and alone: counting three array lengths
  // costs nothing, and a payload beyond the bound must never be walked
  // element by element — that walk is the very cost being refused.
  const offered = ['projects', 'categories', 'freeSlides'].reduce(
    (sum, key) => sum + (Array.isArray(root[key]) ? (root[key] as unknown[]).length : 0),
    0,
  )
  if (offered > MAX_ENTITIES) {
    return {
      ok: false,
      errors: [
        {
          path: '',
          code: 'tooManyEntities',
          params: { max: String(MAX_ENTITIES), count: String(offered) },
        },
      ],
    }
  }

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
