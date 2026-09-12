/**
 * The text-line micro-format — WHAT IT IS: the one enrichment syntax of every
 * rendered line of entered text. WHERE IT SHOWS: each bullet of the three
 * review-narrative lists (done / ongoing / next), of the sheet's objectives
 * and of the free-slide blocks is one line in this format. THE FORMAT, by
 * example:
 *
 *     Câblage **site B** terminé — 60 k€
 *
 * renders "site B" bold and dims the trailing "60 k€" (the suffix starts at
 * the LAST " — ", em dash surrounded by spaces). Those are the only two
 * enrichments — no links, no nesting.
 *
 * TOTAL parse: this runs on ENTERED text, so no input ever fails — at worst
 * the line renders as-is.
 *
 * PURE module: no import at all.
 */

/** One run of the line body — consecutive segments alternate in boldness, they
 * never carry the `**` markers themselves. */
export interface LineSegment {
  readonly bold: boolean
  readonly text: string
}

/**
 * A parsed line: the body as ordered segments (never empty — a blank line
 * yields one empty segment, so renderers need no special case), plus the
 * optional dimmed suffix. Concatenating the segments and re-adding " — " +
 * suffix does NOT always rebuild the input: the `**` markers are consumed.
 */
export interface ParsedLine {
  readonly segments: readonly LineSegment[]
  readonly suffix?: string
}

const SUFFIX_SEPARATOR = ' — ' // "—" surrounded by spaces — "k€" or a glued dash trigger nothing
/** Above this many chunks, preserve the literal text rather than amplify the DOM. */
export const MAX_LINE_CHUNKS = 129

/**
 * Parses one bullet line. Totality is the whole point — every malformed input
 * has a defined, unsurprising rendering:
 * - an odd number of `**` markers cannot pair up → the body stays literal,
 *   markers visible (nothing is guessed);
 * - a " — " at position 0, or with nothing after it, is NOT a suffix — the
 *   dash stays in the body;
 * - only the LAST " — " splits, so a body may itself contain em dashes.
 * The suffix is extracted BEFORE bold parsing: `**` inside a suffix is literal.
 */
export function parseLine(raw: string): ParsedLine {
  let body = raw
  let suffix: string | undefined

  const i = raw.lastIndexOf(SUFFIX_SEPARATOR)
  // i > 0: a separator at the start of the line is not a suffix; same if nothing follows it.
  if (i > 0 && i + SUFFIX_SEPARATOR.length < raw.length) {
    body = raw.slice(0, i)
    suffix = raw.slice(i + SUFFIX_SEPARATOR.length)
  }

  const chunks = body.split('**', MAX_LINE_CHUNKS + 1)
  // An even number of chunks = an odd number of "**": pairing impossible → literal.
  if (chunks.length > MAX_LINE_CHUNKS || chunks.length % 2 === 0) {
    return { segments: [{ bold: false, text: body }], suffix }
  }

  const segments: LineSegment[] = []
  chunks.forEach((text, idx) => {
    if (text !== '') segments.push({ bold: idx % 2 === 1, text })
  })
  if (segments.length === 0) segments.push({ bold: false, text: '' })

  return { segments, suffix }
}
