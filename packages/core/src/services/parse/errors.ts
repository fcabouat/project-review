/**
 * Parse errors — the closed list of everything the strict import can refuse,
 * one code per contract violation. The parse names what happened in a
 * STRUCTURED way (`{ path, code, params }`); the editor renders it through its
 * catalog (`editor.error.{code}`), localized — no display string is baked here.
 */

/** Closed list of the strict-parse error codes — one code, one wording
 * (`editor.error.{code}` in the editor catalog renders it, localized). */
export const PARSE_ERROR_CODES = [
  /** The root of the file is not a JSON object at all. */
  'notAnObject',
  /** A required key is absent — `path` points at the missing key. */
  'missingKey',
  /** A key the contract does not know — `path` points at the intruder. */
  'unknownKey',
  /** A value of the wrong JSON type — `params.expected` names the right one. */
  'wrongType',
  /** `version` present but not the literal 3. */
  'invalidVersion',
  /** A date that is not a calendar-valid YYYY-MM-DD string. */
  'invalidDate',
  /** A value outside its closed enumeration — `params.allowed` lists it. */
  'invalidEnum',
  /** An id equal to the empty string. */
  'emptyId',
  /** An id already used in the same collection. */
  'duplicateId',
  /** `progress` present but not an integer in 0–100. */
  'invalidProgress',
  /** `recapRows` not an integer in 6–16. */
  'invalidRecapRows',
  /** A font family outside the letters/digits/space/`_`/`-` charset (max 64) —
   * the name is emitted into the exported deck's stylesheet, so the charset is
   * the contract. */
  'invalidFont',
  /** A logo that is not a `data:image/…` URI. */
  'invalidLogo',
  /** A logo data URI beyond the size guard — `params.max` gives the bound. */
  'oversizedLogo',
  /** An embedded face whose `dataUri` is not `data:font/woff2;base64,` plus
   * clean base64 — the exact string the deck's stylesheet will carry. */
  'invalidFontFace',
  /** An embedded face `weight` that is not an integer in 400–800 nor an
   * ascending "min max" pair of such integers. */
  'invalidFontWeight',
  /** A color of the portfolio's own palette that is not an exact `#rrggbb` —
   * the twelve values land verbatim in the exported deck's stylesheet, so the
   * shape is the contract (`params.value` shows what was offered). */
  'invalidPaletteColor',
  /** One embedded face beyond the per-face size guard — `params.max`. */
  'oversizedFontFace',
  /** All embedded faces together beyond the total size guard — `params.max`. */
  'oversizedFontFaces',
  /** A free slide with zero blocks. */
  'emptyBlocks',
  /** More entities than the application can carry — `params.max` gives the
   * bound and `params.count` what was offered. One code for one budget, said
   * of the whole document (`MAX_ENTITIES`) or of one nested collection
   * (`MAX_ROWS`); `path` tells the two apart. See model/budget.ts. */
  'tooManyEntities',
] as const

/** One of the closed {@link PARSE_ERROR_CODES} — also the tail of its catalog key. */
export type ParseErrorCode = (typeof PARSE_ERROR_CODES)[number]

/**
 * One contract violation. `path` points into the INPUT as read
 * ("projects[3].health" — index, not id: the id may itself be the problem;
 * empty for the root); `params` feeds the slots of the `editor.error.{code}`
 * catalog entry, values already stringified.
 */
export interface ParseError {
  readonly path: string
  readonly code: ParseErrorCode
  readonly params?: Readonly<Record<string, string>>
}
