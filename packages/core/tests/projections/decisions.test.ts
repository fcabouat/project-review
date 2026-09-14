/**
 * Pins the decision derivations (`src/projections/decisions.ts`) — pending
 * pages, the N−1 record and reference dereferencing, on the sample sets and
 * on focused portfolios.
 */
import { describe, expect, it } from 'vitest'
import {
  decisionByRef,
  decisionPages,
  mostRecentTakenDecision,
  takenDecisionsSinceLastReview,
} from '../../src/projections/index'
import { rawPortfolio, rawProject } from '../fixtures/raw-portfolios'
import { SAMPLE_SETS, load } from '../fixtures/sample-sets'

describe.each(SAMPLE_SETS)('exact decisions — %s data set', (_name, p) => {
  it('pending decisions paginate as [7]', () => {
    expect(decisionPages(p).map((page) => page.length)).toEqual([7])
  })

  it('record of the previous review: P-01 and P-13', () => {
    const taken = takenDecisionsSinceLastReview(p)
    expect(taken.map((r) => r.projectId)).toEqual(['P-01', 'P-13'])
    expect(decisionByRef(p, taken[0]!)?.taken?.when).toBe('2026-07-02')
  })
})

describe('decision pages and the N−1 bound', () => {
  it('selects the latest settled outcome and handles none', () => {
    const p = load(
      rawPortfolio({
        projects: [
          rawProject({
            decisions: [
              { question: 'old', taken: { text: 'old', when: '2026-01-01' } },
              { question: 'new', taken: { text: 'new', when: '2026-09-01' } },
            ],
          }),
        ],
      }),
    )
    expect(mostRecentTakenDecision(p.projects[0]!)?.question).toBe('new')
    expect(mostRecentTakenDecision({ ...p.projects[0]!, decisions: [] })).toBeUndefined()
  })

  it('8 pending decisions paginate as [7, 1]', () => {
    const p = load(
      rawPortfolio({
        review: { title: 't', reviewDate: '2026-09-01' },
        categories: [{ id: 'c1', name: 'C1', color: 'blue' }],
        projects: [
          rawProject({
            categoryId: 'c1',
            stage: 'inProgress',
            decisions: Array.from({ length: 8 }, (_, i) => ({ question: `Q${i + 1} ?` })),
          }),
        ],
      }),
    )
    expect(decisionPages(p).map((page) => page.length)).toEqual([7, 1])
  })

  it('no previous-review date → settled decisions through the review date', () => {
    const p = load(
      rawPortfolio({
        review: { title: 't', reviewDate: '2026-09-01' },
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
    expect(takenDecisionsSinceLastReview(p).map((r) => r.projectId)).toEqual(['P-01'])
  })
})
