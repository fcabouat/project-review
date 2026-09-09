/**
 * Pins the project predicates and lookups (`src/projections/projects.ts`) —
 * displayed status, archived population and the unsorted fallback, on both
 * sample sets.
 */
import { describe, expect, it } from 'vitest'
import type { Portfolio } from '../../src/model/portfolio'
import type { CategoryId } from '../../src/values/ids'
import { UNSORTED_CATEGORY } from '../../src/model/category'
import {
  categoryOf,
  displayedStatus,
  isArchived,
  projectById,
  projectsOfCategory,
  projectsOfGroup,
} from '../../src/projections/index'
import { SAMPLE_SETS, fr } from '../fixtures/sample-sets'
import { testPortfolio } from '../fixtures/hand-built-portfolios'

describe.each(SAMPLE_SETS)('exact statuses — %s data set', (_name, p) => {
  it('archived: P-14, P-15, P-16', () => {
    // Through the predicate itself, not a re-spelled stage filter: the test
    // pins isArchived's population, the very one every KPI excludes.
    const archived = p.projects.filter(isArchived)
    expect(archived.map((pr) => pr.id).sort()).toEqual(['P-14', 'P-15', 'P-16'])
  })

  it('displayed status carries the on-hold suffix on a tracked project', () => {
    expect(displayedStatus(projectById(p, 'P-06')!, 'fr')).toBe('En cours · en attente')
  })

  it('drops the on-hold suffix on an archived project — "Clos · en attente" would lie', () => {
    const closed = p.projects.find((pr) => pr.stage === 'closed')!
    expect(displayedStatus({ ...closed, onHold: true }, 'fr')).toBe('Clos')
  })
})

describe('categoryOf', () => {
  it('resolves a known id, falls back to the unsorted sentinel', () => {
    expect(categoryOf(fr, 'poste').id).toBe('poste')
    expect(categoryOf(fr, 'ghost')).toBe(UNSORTED_CATEGORY)
  })
})

describe('projectsOfGroup — what the unsorted divider actually lists', () => {
  // A REAL orphan carries a ghost id ('ghost'), never the sentinel's own id:
  // matching on `categoryId === 'unsorted'` would list nothing. If this
  // breaks, the "À classer" divider and bar have stopped matching the sheets
  // the deck emits for the orphan group.
  const ghost = (): Portfolio => {
    const p = testPortfolio()
    const first = p.projects[0]!
    return { ...p, projects: [{ ...first, categoryId: 'ghost' as CategoryId }] }
  }

  it('the unsorted sentinel id yields the orphans, whatever their ghost id', () => {
    const p = ghost()
    expect(projectsOfGroup(p, UNSORTED_CATEGORY.id).map((pr) => pr.id)).toEqual([p.projects[0]!.id])
  })

  it('a real category id keeps its own list — the sentinel never shadows it', () => {
    expect(projectsOfGroup(fr, 'poste')).toEqual(projectsOfCategory(fr, 'poste'))
    expect(projectsOfGroup(fr, UNSORTED_CATEGORY.id)).toEqual([])
  })
})
