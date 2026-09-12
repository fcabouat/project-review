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
  categoryBars,
  categoryOf,
  categoryOfGroup,
  deck,
  displayedStatus,
  groupKey,
  isArchived,
  projectById,
  projectsOfCategory,
  projectsOfGroup,
} from '../../src/projections/index'
import { rawPortfolio, rawProject } from '../fixtures/raw-portfolios'
import { SAMPLE_SETS, fr, load } from '../fixtures/sample-sets'
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
  // A REAL orphan carries a ghost id ('ghost'), never the sentinel's own id.
  // If this breaks, the "À classer" divider and bar have stopped matching the
  // sheets the deck emits for the orphan group.
  const ghost = (): Portfolio => {
    const p = testPortfolio()
    const first = p.projects[0]!
    return { ...p, projects: [{ ...first, categoryId: 'ghost' as CategoryId }] }
  }

  it('the orphan group yields the orphans, whatever their ghost id', () => {
    const p = ghost()
    expect(projectsOfGroup(p, { kind: 'orphans' }).map((pr) => pr.id)).toEqual([p.projects[0]!.id])
  })

  it('a category group keeps its own list — the orphan residue never shadows it', () => {
    expect(projectsOfGroup(fr, { kind: 'category', id: 'poste' })).toEqual(
      projectsOfCategory(fr, 'poste'),
    )
    expect(projectsOfGroup(fr, { kind: 'orphans' })).toEqual([])
  })
})

/**
 * THE SENTINEL'S ID IS NOT RESERVED, and nothing in the format says it is: a
 * portfolio may carry a category whose id is exactly `unsorted`. With an
 * orphan beside it, an id-keyed group reference named both groups at once —
 * two dividers claiming the same reference, both resolving to both projects,
 * one render key for the two rows of the dashboard. The discriminated
 * reference makes that unrepresentable; this is the case that proves it.
 */
describe('a category REALLY named unsorted, next to an orphan', () => {
  const both = (): Portfolio =>
    load(
      rawPortfolio({
        categories: [{ id: UNSORTED_CATEGORY.id, name: 'Divers', color: 'blue' }],
        projects: [
          rawProject({ id: 'P-01', categoryId: UNSORTED_CATEGORY.id, stage: 'inProgress' }),
          rawProject({ id: 'P-02', categoryId: 'ghost', stage: 'inProgress' }),
        ],
      }),
    )

  it('the two groups list their own project and nothing else', () => {
    const p = both()
    expect(
      projectsOfGroup(p, { kind: 'category', id: UNSORTED_CATEGORY.id }).map((pr) => pr.id),
    ).toEqual(['P-01'])
    expect(projectsOfGroup(p, { kind: 'orphans' }).map((pr) => pr.id)).toEqual(['P-02'])
  })

  it('their keys differ, and only the orphan one displays the sentinel', () => {
    const p = both()
    const category = { kind: 'category', id: UNSORTED_CATEGORY.id } as const
    expect(groupKey(category)).not.toBe(groupKey({ kind: 'orphans' }))
    expect(categoryOfGroup(p, category).name).toBe('Divers')
    expect(categoryOfGroup(p, { kind: 'orphans' })).toBe(UNSORTED_CATEGORY)
  })

  it('the deck emits two dividers, each with its own sheet and count', () => {
    const p = both()
    const d = deck(p)
    const dividers = d.filter((s) => s.type === 'divider')
    expect(dividers.map((s) => groupKey(s.group))).toEqual([
      `category:${UNSORTED_CATEGORY.id}`,
      'orphans',
    ])
    // …and each divider is followed by the sheet of ITS project, not the other's.
    expect(d.slice(d.indexOf(dividers[0]!), d.indexOf(dividers[1]!) + 2)).toEqual([
      dividers[0],
      { type: 'sheet', projectId: 'P-01' },
      dividers[1],
      { type: 'sheet', projectId: 'P-02' },
    ])
    // The dashboard counts them apart too, with two distinct render keys.
    const bars = categoryBars(p)
    expect(bars.map((b) => groupKey(b.group))).toEqual([
      `category:${UNSORTED_CATEGORY.id}`,
      'orphans',
    ])
    expect(bars.map((b) => b.inProgress)).toEqual([1, 1])
  })
})
