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
import { MAX_CHARS, MAX_ENTITIES, offeredEntities, withinMemoryBudget } from '../../model/budget'
import { PORTFOLIO_KEYS } from '../../model/contract'
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
 *
 * THE CAP IS WEIGHED TWICE, ON TWO DIFFERENT TEXTS, AND BOTH MATTER. The
 * incoming bytes come first, because a refusal that costs a `length` must run
 * before a `JSON.parse` that costs hundreds of megabytes. But the text the
 * application will hold is its OWN serialisation, and that one is longer: the
 * document travels indented (`SERIALIZED_INDENT`) whatever shape it arrived
 * in, so a compact file just under the ceiling becomes a document just over
 * it — accepted by the reader, then refused by the command gate, which leaves
 * the import dialog closing on a portfolio that has not changed.
 * `withinMemoryBudget` is the very rule that gate applies, and it is asked
 * here, of the parsed document, so the reader's verdict IS the gate's.
 */
export function readPortfolioJson(text: string): ReadOutcome {
  if (text.length > MAX_CHARS) return { ok: false, refusal: 'tooLarge' }
  let outcome: ParseResult
  try {
    outcome = parsePortfolio(JSON.parse(text))
  } catch {
    return { ok: false, refusal: 'badJson' }
  }
  if (outcome.ok && !withinMemoryBudget(outcome.portfolio)) {
    return { ok: false, refusal: 'tooLarge' }
  }
  return outcome
}

/**
 * All-or-nothing: success hands over a valid portfolio; refusal hands over the
 * COMPLETE error list and NOTHING partial — the caller keeps its current state
 * (the import dialog shows the report, the app keeps running).
 */
export type ParseResult =
  | { readonly ok: true; readonly portfolio: Portfolio }
  | { readonly ok: false; readonly errors: readonly ParseError[] }

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
  // element by element — that walk is the very cost being refused. The figure
  // is the memory-safety budget's, stated once (model/budget.ts).
  const offered = offeredEntities(root)
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

  checkKeys(root, '', PORTFOLIO_KEYS, errors)
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
