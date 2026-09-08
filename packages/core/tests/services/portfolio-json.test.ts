/**
 * Pins `src/services/portfolio-json.ts` — the portfolio as a file: the export
 * payload is the exact inverse of the strict parse, and the download name
 * stamps the review date.
 */

import { describe, expect, it } from 'vitest'
import { parsePortfolio } from '../../src/services/parse'
import {
  partialPortfolio,
  portfolioFileName,
  serializePortfolio,
} from '../../src/services/portfolio-json'
import { testPortfolio } from '../fixtures/hand-built-portfolios'

describe('serializePortfolio', () => {
  it('round-trips through the strict parse without losing anything', () => {
    const p = testPortfolio()
    const parsed = parsePortfolio(JSON.parse(serializePortfolio(p)))
    expect(parsed.ok).toBe(true)
    // `toEqual`, not `toStrictEqual`: JSON drops the keys the fixture spells
    // out as explicitly `undefined` — same value, different key census.
    if (parsed.ok) expect(parsed.portfolio).toEqual(p)
  })

  it('is pretty-printed for hand editing', () => {
    expect(serializePortfolio(testPortfolio())).toContain('\n  "')
  })
})

describe('portfolioFileName', () => {
  it('carries the review date as the natural version stamp', () => {
    expect(portfolioFileName('2026-09-03')).toBe('project-review-2026-09-03.json')
  })

  it('marks a partial export in its name', () => {
    expect(portfolioFileName('2026-09-03', true)).toBe('project-review-2026-09-03-partial.json')
  })
})

describe('partialPortfolio', () => {
  const p = testPortfolio()

  it('keeps the selected projects, THEIR categories, and the current frame', () => {
    const part = partialPortfolio(p, new Set(['P-02']))
    expect(part.projects.map((x) => x.id)).toEqual(['P-02'])
    // P-02 lives in 'poste': 'infra' is not its business.
    expect(part.categories.map((x) => x.id)).toEqual(['poste'])
    expect(part.review).toBe(p.review)
    expect(part.settings).toBe(p.settings)
    expect(part.freeSlides).toEqual([])
  })

  it('stays a valid stand-alone file: the strict parse takes it whole', () => {
    // The whole point of a partial export — the colleague opens it ALONE in
    // the app. A partial file the parse refuses would strand them.
    const part = partialPortfolio(p, new Set(['P-01', 'P-02']))
    const parsed = parsePortfolio(JSON.parse(serializePortfolio(part)))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.portfolio).toEqual(part)
  })
})
