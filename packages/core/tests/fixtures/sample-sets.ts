/**
 * WHY THIS FIXTURE. The two bundled sample data sets, parsed once and shared
 * by every derivation test: the acceptance figures (34 slides, KPIs 17/11/2…)
 * are asserted on BOTH sets because they are translations of the SAME
 * portfolio — a figure that diverges between them means a sample was edited
 * on one side only, and the fixture catches it before any projection test
 * reads a number.
 */
import rawFr from '../../samples/sample-portfolio.fr.json'
import rawEn from '../../samples/sample-portfolio.en.json'
import { parsePortfolio } from '../../src/services/parse/index'
import type { Portfolio } from '../../src/model/portfolio'

/** Parse-or-throw: a sample set that stops parsing must fail the suite loudly. */
export function load(raw: unknown): Portfolio {
  const r = parsePortfolio(raw)
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.portfolio
}

export const fr = load(rawFr)
export const en = load(rawEn)

/** `[name, portfolio]` pairs for `describe.each` over the two translations. */
export const SAMPLE_SETS: readonly (readonly [string, Portfolio])[] = [
  ['french', fr],
  ['english', en],
]
