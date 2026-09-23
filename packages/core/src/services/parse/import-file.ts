import type { ImportSource } from '../../model/appearance-profile'
import { MAX_CHARS } from '../../model/budget'
import { parsePortfolio, readPortfolioJson, type ReadOutcome } from './index'
import { checkKeys, fail, isRecord, type Errors } from './json'

export type ImportReading =
  { readonly ok: true; readonly source: ImportSource } | Exclude<ReadOutcome, { readonly ok: true }>

/** Strict profile envelope; nested values follow the ordinary portfolio contract. */
export function readImportJson(text: string): ImportReading {
  if (text.length > MAX_CHARS) return { ok: false, refusal: 'tooLarge' }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, refusal: 'badJson' }
  }
  if (!isRecord(raw) || raw['format'] !== 'project-review-appearance') {
    const result = readPortfolioJson(text)
    return result.ok
      ? { ok: true, source: { kind: 'portfolio', portfolio: result.portfolio } }
      : result
  }
  const errors: Errors = []
  checkKeys(
    raw,
    '',
    { required: ['format', 'version', 'settings', 'categories'], optional: [] },
    errors,
  )
  if (raw['version'] !== undefined && raw['version'] !== 1) {
    fail(errors, 'version', 'invalidEnum', { allowed: '1' })
  }
  const result = parsePortfolio({
    version: 4,
    review: { title: '', reviewDate: '2000-01-01' },
    settings: raw['settings'],
    categories: raw['categories'],
    projects: [],
    freeSlides: [],
  })
  if (!result.ok) errors.push(...result.errors)
  if (errors.length > 0 || !result.ok) return { ok: false, errors }
  // Apply the serialized-memory budget too, including the normalized defaults.
  const bounded = readPortfolioJson(JSON.stringify(result.portfolio))
  return bounded.ok
    ? { ok: true, source: { kind: 'appearance', portfolio: bounded.portfolio } }
    : bounded
}
