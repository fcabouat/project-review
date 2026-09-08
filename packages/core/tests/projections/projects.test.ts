/**
 * Pins the project predicates and lookups (`src/projections/projects.ts`) —
 * displayed status, archived population and the unsorted fallback, on both
 * sample sets.
 */
import { describe, expect, it } from 'vitest'
import { UNSORTED_CATEGORY } from '../../src/model/category'
import { categoryOf, displayedStatus, projectById } from '../../src/projections/index'
import { SAMPLE_SETS, fr } from '../fixtures/sample-sets'

describe.each(SAMPLE_SETS)('exact statuses — %s data set', (_name, p) => {
  it('archived: P-14, P-15, P-16', () => {
    const archived = p.projects.filter((pr) => pr.stage === 'closed' || pr.stage === 'abandoned')
    expect(archived.map((pr) => pr.id).sort()).toEqual(['P-14', 'P-15', 'P-16'])
  })

  it('displayed status carries the on-hold suffix on a tracked project', () => {
    expect(displayedStatus(projectById(p, 'P-06')!, 'fr')).toBe('En cours · en attente')
  })
})

describe('categoryOf', () => {
  it('resolves a known id, falls back to the unsorted sentinel', () => {
    expect(categoryOf(fr, 'poste').id).toBe('poste')
    expect(categoryOf(fr, 'ghost')).toBe(UNSORTED_CATEGORY)
  })
})
