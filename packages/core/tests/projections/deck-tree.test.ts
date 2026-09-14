/**
 * Pins `deckTree` (`src/projections/deck-tree.ts`) — the flat deck folded
 * into slideshow drawers: EXACT values on both sample data sets, plus the one
 * invariant everything else rests on — flattening the groups gives `deck(p)`
 * back, slide for slide, SAME references.
 */
import { describe, expect, it } from 'vitest'
import { parsePortfolio } from '../../src/services/parse/index'
import { deck, deckTree, groupDeck, type DeckGroup } from '../../src/projections/index'
import { rawPortfolio, rawProject } from '../fixtures/raw-portfolios'
import { SAMPLE_SETS } from '../fixtures/sample-sets'

function flatten(groups: readonly DeckGroup[]) {
  return groups.flatMap((g) => (g.kind === 'single' ? [g.slide] : [...g.slides]))
}

describe.each(SAMPLE_SETS)('deckTree — %s data set', (_name, p) => {
  const groups = deckTree(p)
  const flat = deck(p)

  it('linear navigation preserves every slide and page number without vertical stacks', () => {
    const linear = deckTree({ ...p, settings: { ...p.settings, navigation: 'linear' } })
    expect(linear).toEqual(flat.map((slide) => ({ kind: 'single', slide })))
    expect(deckTree({ ...p, settings: { ...p.settings, navigation: 'sections' } })).toEqual(groups)
  })

  it('invariant: concatenated groups are deck(p), same references, same order', () => {
    // Reference identity over ONE flat deck (deck() builds fresh objects on
    // every call, so identity is only observable through `groupDeck`)…
    const flattened = flatten(groupDeck(flat))
    expect(flattened).toHaveLength(flat.length)
    flattened.forEach((slide, i) => expect(slide).toBe(flat[i]))
    // …and structural identity for the portfolio-level entry point.
    expect(flatten(groups)).toEqual(flat)
  })

  it('14 groups: 5 singles, the overview stack, 8 category stacks', () => {
    expect(groups).toHaveLength(14)
    expect(groups.map((g) => g.kind)).toEqual([
      'single',
      'single',
      'stack',
      'stack',
      'stack',
      'stack',
      'stack',
      'stack',
      'stack',
      'stack',
      'stack',
      'single',
      'single',
      'single',
    ])
  })

  it('singles: title, opening free slide, decisions, archives, previous decisions', () => {
    const singles = groups.filter((g) => g.kind === 'single')
    expect(singles.map((g) => g.slide.type)).toEqual([
      'title',
      'freeform',
      'decisions',
      'archives',
      'previousDecisions',
    ])
  })

  it('overview stack: D1, D2, recap page 1 (11 rows), recap page 2 (6 rows)', () => {
    const overview = groups[2]!
    expect(overview.kind).toBe('stack')
    if (overview.kind !== 'stack') return
    expect(overview.slides.map((s) => s.type)).toEqual([
      'portfolioDashboard',
      'healthDashboard',
      'recap',
      'recap',
    ])
    expect(overview.slides[2]).toMatchObject({ type: 'recap', page: 1, totalPages: 2 })
    expect(overview.slides[3]).toMatchObject({ type: 'recap', page: 2, totalPages: 2 })
  })

  it('each category stack is one divider followed by its sheets only', () => {
    const categoryStacks = groups.slice(3, 11)
    for (const g of categoryStacks) {
      expect(g.kind).toBe('stack')
      if (g.kind !== 'stack') continue
      expect(g.slides[0]!.type).toBe('divider')
      expect(g.slides.slice(1).every((s) => s.type === 'sheet')).toBe(true)
    }
  })

  it('category stacks: 8 drawers, sizes 4/4/3/3/2/2/2/5, 17 sheets in all', () => {
    const categoryStacks = groups.filter(
      (g): g is Extract<DeckGroup, { kind: 'stack' }> =>
        g.kind === 'stack' && g.slides[0]!.type === 'divider',
    )
    expect(categoryStacks).toHaveLength(8)
    expect(categoryStacks.map((g) => g.slides.length)).toEqual([4, 4, 3, 3, 2, 2, 2, 5])
    expect(
      categoryStacks.reduce((n, g) => n + g.slides.filter((s) => s.type === 'sheet').length, 0),
    ).toBe(17)
    const first = categoryStacks[0]!
    expect(first.slides[0]).toMatchObject({ type: 'divider', number: 1 })
    expect(first.slides.slice(1)).toEqual([
      { type: 'sheet', projectId: 'P-01' },
      { type: 'sheet', projectId: 'P-02' },
      { type: 'sheet', projectId: 'P-03' },
    ])
  })
})

describe('deckTree — degenerate blocks collapse to singles', () => {
  it('a divider whose category shows no sheet is a single, not a one-slide drawer', () => {
    const r = parsePortfolio(
      rawPortfolio({
        categories: [{ id: 'c1', name: 'C1', color: 'blue' }],
        // Tracked (still to scope) but sheet forced off: divider without sheets.
        projects: [rawProject({ categoryId: 'c1', sheet: 'never' })],
      }),
    )
    if (!r.ok) throw new Error(JSON.stringify(r.errors))
    const groups = deckTree(r.portfolio)
    const divider = groups.find((g) =>
      g.kind === 'single' ? g.slide.type === 'divider' : g.slides[0]!.type === 'divider',
    )
    expect(divider).toBeDefined()
    expect(divider!.kind).toBe('single')
  })

  it('an overview reduced to the portfolio dashboard alone is a single', () => {
    const r = parsePortfolio(
      rawPortfolio({
        settings: {
          identity: { org: 'a', unit: 'b' },
          show: { healthDashboard: false, recap: false, archives: false, decisions: false },
          recapRows: 11,
        },
      }),
    )
    if (!r.ok) throw new Error(JSON.stringify(r.errors))
    const groups = deckTree(r.portfolio)
    expect(groups.map((g) => g.kind)).toEqual(['single', 'single'])
    expect(flatten(groups).map((s) => s.type)).toEqual(['title', 'portfolioDashboard'])
  })
})
