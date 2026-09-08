/**
 * Pins `emptyPortfolio` (`src/data/empty-portfolio.ts`) — the first-launch
 * fallback: theme pre-filled, identity BLANK (Déjà Vu Ltd. lives only in the
 * sample sets), zero content, and the two duties it must honor (a derivable
 * deck, an unchanged strict-parse round trip).
 */
import { describe, expect, it } from 'vitest'
import { emptyPortfolio } from '../../src/data/empty-portfolio'
import { deck } from '../../src/projections/index'
import { parsePortfolio } from '../../src/services/parse/index'
import { isoDate } from '../../src/values/date'

describe('blank portfolio (first launch)', () => {
  it('carries the theme, a blank identity and no content', () => {
    const p = emptyPortfolio('fr', isoDate('2026-09-04')!)
    // If the identity gains content again, a real user's first portfolio
    // starts branded as the fictional publisher — sample-set data only.
    expect(p.settings.identity).toEqual({ org: '', unit: '' })
    expect(p.settings.theme).toEqual({ style: 'flat', palette: 'material', font: 'Roboto' })
    expect(p.projects).toHaveLength(0)
    expect(p.categories).toHaveLength(0)
    expect(p.freeSlides).toHaveLength(0)
    expect(p.review.reviewDate).toBe('2026-09-04')
  })

  it('sets the language and its localized default title, both ways', () => {
    // If this breaks, the single multilingual artifact's first boot has lost
    // its language: the auto-detected `emptyPortfolio(language)` must store it
    // in settings.language and speak it through the default title.
    const fr = emptyPortfolio('fr', isoDate('2026-09-04')!)
    expect(fr.settings.language).toBe('fr')
    expect(fr.review.title).toBe('Revue des projets')
    expect(fr.settings.identity).toEqual({ org: '', unit: '' })
    const en = emptyPortfolio('en', isoDate('2026-09-04')!)
    expect(en.settings.language).toBe('en')
    expect(en.review.title).toBe('Project review')
    expect(en.settings.identity).toEqual({ org: '', unit: '' })
  })

  it('derives a minimal deck without throwing', () => {
    const slides = deck(emptyPortfolio('en', isoDate('2026-09-04')!))
    expect(slides[0]).toEqual({ type: 'title' })
  })

  it('round-trips through the strict parse untouched', () => {
    const p = emptyPortfolio('fr', isoDate('2026-09-04')!)
    const r = parsePortfolio(JSON.parse(JSON.stringify(p)))
    if (!r.ok) throw new Error(JSON.stringify(r.errors))
    expect(r.portfolio).toEqual(p)
  })
})
