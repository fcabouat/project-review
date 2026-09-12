/**
 * Pins the decision derivations (`src/projections/decisions.ts`) — pending
 * pages, the N−1 record and reference dereferencing, on the sample sets and
 * on focused portfolios.
 */
import { describe, expect, it } from 'vitest'
import {
  decisionByRef,
  decisionPages,
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

  it('no previous-review date → empty record, even with taken decisions', () => {
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
    expect(takenDecisionsSinceLastReview(p)).toEqual([])
  })
})
