/**
 * Pins the deck derivation (`src/projections/deck.ts`) — exact slide sequence
 * on the sample sets, composition under settings and sheet modes, and the
 * degradation rules (empty categories, orphaned anchors and projects).
 */
import { describe, expect, it } from 'vitest'
import { parsePortfolio } from '../../src/services/parse/index'
import type { Portfolio } from '../../src/model/portfolio'
import type { Slide } from '../../src/projections/slide'
import { UNSORTED_CATEGORY } from '../../src/model/category'
import { deck, dividerMode } from '../../src/projections/index'
import { rawPortfolio, rawProject } from '../fixtures/raw-portfolios'
import { SAMPLE_SETS, load } from '../fixtures/sample-sets'

describe.each(SAMPLE_SETS)('exact deck — %s data set', (_name, p) => {
  it('deck: 34 slides, imposed sequence and positions', () => {
    const d = deck(p)
    expect(d.length).toBe(34)
    expect(d.slice(0, 6).map((s) => s.type)).toEqual([
      'title',
      'freeform',
      'portfolioDashboard',
      'healthDashboard',
      'recap',
      'recap',
    ])
    expect(d[4]).toMatchObject({ type: 'recap', page: 1, totalPages: 2 })
    expect(d[11]).toMatchObject({ type: 'sheet', projectId: 'P-04' })
    expect(d[31]).toMatchObject({ type: 'decisions', page: 1, totalPages: 1 })
    expect((d[31] as { entries: readonly unknown[] }).entries).toHaveLength(7)
    expect(d[32]).toMatchObject({ type: 'archives' })
    expect(d[33]).toMatchObject({ type: 'previousDecisions' })
    expect(d.filter((s) => s.type === 'divider')).toHaveLength(8)
    expect(d.filter((s) => s.type === 'sheet')).toHaveLength(17)
  })
})

describe('unit functions', () => {
  it('dividerMode: normal ≤ 5, compact 6-10, truncated beyond', () => {
    expect(dividerMode(5)).toBe('normal')
    expect(dividerMode(6)).toBe('compact')
    expect(dividerMode(10)).toBe('compact')
    expect(dividerMode(11)).toBe('truncated')
  })

  it('beforeCategory free slides are emitted even for an empty category', () => {
    const r = parsePortfolio(
      rawPortfolio({
        categories: [{ id: 'vide', name: 'Vide', color: 'blue' }],
        freeSlides: [
          {
            id: 'sl-1',
            anchor: { type: 'beforeCategory', categoryId: 'vide' },
            title: 'X',
            blocks: [['l']],
          },
        ],
      }),
    )
    if (!r.ok) throw new Error(JSON.stringify(r.errors))
    const d = deck(r.portfolio)
    expect(d.some((s) => s.type === 'freeform' && s.slideId === 'sl-1')).toBe(true)
    expect(d.some((s) => s.type === 'divider')).toBe(false)
  })
})

describe('deck composition — settings and sheet modes', () => {
  it("sheet:'always' forces the sheet of a project the auto mode would hide", () => {
    const raw = {
      categories: [{ id: 'c1', name: 'C1', color: 'blue' }],
      projects: [rawProject({ categoryId: 'c1', sheet: 'always' })],
    }
    const forced = load(rawPortfolio(raw))
    expect(deck(forced).some((s) => s.type === 'sheet' && s.projectId === 'P-01')).toBe(true)

    // Control: in auto mode the same scoping-stage project shows no sheet.
    const auto = load(rawPortfolio({ ...raw, projects: [rawProject({ categoryId: 'c1' })] }))
    expect(deck(auto).some((s) => s.type === 'sheet')).toBe(false)
  })

  it('no previous-review date → no previousDecisions slide, even with taken decisions', () => {
    const p = load(
      rawPortfolio({
        review: { title: 't', reviewDate: '2026-09-01' }, // no previousReviewDate
        categories: [{ id: 'c1', name: 'C1', color: 'blue' }],
        projects: [
          rawProject({
            categoryId: 'c1',
            stage: 'inProgress',
            decisions: [{ question: 'Q ?', taken: { text: 'ok', when: '2026-08-01' } }],
          }),
        ],
      }),
    )
    expect(deck(p).some((s) => s.type === 'previousDecisions')).toBe(false)
  })
})

describe('orphans in the deck — the implicit "À classer" group', () => {
  function loadOrphaned(): Portfolio {
    return load(
      rawPortfolio({
        categories: [{ id: 'c1', name: 'C1', color: 'blue' }],
        projects: [
          rawProject({ id: 'P-01', categoryId: 'c1', stage: 'inProgress' }),
          rawProject({ id: 'P-02', categoryId: 'ghost', stage: 'inProgress' }),
          rawProject({ id: 'P-03', categoryId: '', stage: 'ready' }),
          rawProject({ id: 'P-04', categoryId: 'c1', stage: 'closed' }),
        ],
      }),
    )
  }

  it('a free slide anchored on an unknown category joins the closing group instead of vanishing', () => {
    const r = parsePortfolio(
      rawPortfolio({
        freeSlides: [
          {
            id: 'sl-ghost',
            anchor: { type: 'beforeCategory', categoryId: 'ghost' },
            title: 'X',
            blocks: [['l']],
          },
          { id: 'sl-end', anchor: { type: 'closing' }, title: 'Y', blocks: [['l']] },
        ],
      }),
    )
    if (!r.ok) throw new Error(JSON.stringify(r.errors))
    const d = deck(r.portfolio)
    expect(d.slice(-2)).toEqual([
      { type: 'freeform', slideId: 'sl-ghost' },
      { type: 'freeform', slideId: 'sl-end' },
    ])
  })

  it('tracked orphans get an unsorted divider and their sheets, after the real categories', () => {
    const d = deck(loadOrphaned())
    const dividers = d.filter((s): s is Extract<Slide, { type: 'divider' }> => s.type === 'divider')
    expect(dividers.map((s) => s.categoryId)).toEqual(['c1', UNSORTED_CATEGORY.id])
    expect(dividers[1]).toMatchObject({ number: 2 })
    const at = d.findIndex((s) => s.type === 'divider' && s.categoryId === UNSORTED_CATEGORY.id)
    expect(d[at + 1]).toEqual({ type: 'sheet', projectId: 'P-02' })
    expect(d[at + 2]).toEqual({ type: 'sheet', projectId: 'P-03' })
    // …but still before the closing sections of the deck.
    expect(d.findIndex((s) => s.type === 'archives')).toBeGreaterThan(at + 2)
  })
})
