/**
 * Client-side fuzzy search — hand-made, no library (plan § 0).
 *
 * The rule is a SUBSEQUENCE over accent-folded, case-folded text: every
 * character of the query must appear in the haystack, in order, but not
 * necessarily side by side. "reseau" therefore finds "Renforcement du lien
 * réseau…" — the missing accent costs nothing, and so does a missing letter.
 *
 * PURE module: no Svelte, no DOM, no clock.
 */

/**
 * Accent and case folding. NFD splits "é" into "e" + combining acute, which the
 * range U+0300–U+036F then removes; the typographic apostrophe is folded onto
 * the typewriter one so "l'accueil" and "l’accueil" are the same needle.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .toLowerCase()
}

/**
 * Match score, or `undefined` when the query is not a subsequence of the text.
 * LOWER IS BETTER. Three penalties, in decreasing weight:
 *  - the gap left before the first matched character (a prefix wins);
 *  - the gaps between matched characters (a contiguous run wins);
 *  - the length of the haystack (the shortest of two equal matches wins).
 * An empty query matches everything with the perfect score 0.
 */
export function fuzzyScore(query: string, text: string): number | undefined {
  const needle = normalize(query)
  const haystack = normalize(text)
  if (needle === '') return 0

  let at = 0
  let start = -1
  let gaps = 0

  for (const char of needle) {
    const found = haystack.indexOf(char, at)
    if (found < 0) return undefined
    if (start < 0) start = found
    else gaps += found - at
    at = found + 1
  }

  return start * 4 + gaps * 2 + haystack.length / 1000
}

/** Does `text` match `query`? Sugar over `fuzzyScore`. */
export function fuzzyMatches(query: string, text: string): boolean {
  return fuzzyScore(query, text) !== undefined
}

/**
 * Best score over several fields (id, name, lead…): an item matches as soon as
 * ONE of its fields does. `undefined` = no field matches.
 */
export function fuzzyScoreOf(
  query: string,
  fields: readonly (string | undefined)[],
): number | undefined {
  let best: number | undefined
  for (const field of fields) {
    if (field === undefined) continue
    const score = fuzzyScore(query, field)
    if (score !== undefined && (best === undefined || score < best)) best = score
  }
  return best
}

/**
 * Filter keeping the ORIGINAL order of `items` (the portfolio order carries
 * meaning — and a search must not silently reshuffle it).
 */
export function fuzzyFilter<T>(
  items: readonly T[],
  query: string,
  fieldsOf: (item: T) => readonly (string | undefined)[],
): readonly T[] {
  if (normalize(query) === '') return items
  return items.filter((item) => fuzzyScoreOf(query, fieldsOf(item)) !== undefined)
}
