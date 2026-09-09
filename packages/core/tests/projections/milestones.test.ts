/**
 * Pins the milestone derivations (`src/projections/milestones.ts`) — state
 * relative to the review date (the only reference date the domain uses) and
 * the next unfinished milestone, on both sample sets.
 */
import { describe, expect, it } from 'vitest'
import { isoDate } from '../../src/values/date'
import { milestoneState, nextMilestone, projectById } from '../../src/projections/index'
import { SAMPLE_SETS, fr } from '../fixtures/sample-sets'

const d = (x: string) => isoDate(x)!

describe.each(SAMPLE_SETS)('exact milestones — %s data set', (_name, p) => {
  it('milestone state and next milestone', () => {
    const p06 = projectById(p, 'P-06')!
    const answer = p06.milestones.find((m) => m.date === '2026-08-31')!
    expect(milestoneState(answer, p.review.reviewDate)).toBe('overdue')
    expect(nextMilestone(p06)?.date).toBe('2026-08-31')
    expect(nextMilestone(projectById(p, 'P-01')!)).toMatchObject({ date: '2026-09-20' })
    expect(nextMilestone(projectById(p, 'P-08')!)).toBeUndefined()
  })
})

describe('nextMilestone — entry order carries no meaning', () => {
  it('finds the earliest unfinished milestone even when entered in DECREASING date order', () => {
    // The editor promises "shown by ascending date — entry order does not fix
    // them": the projection must sort, not trust the array.
    const decreasing = {
      ...projectById(fr, 'P-01')!,
      milestones: [
        { label: 'Tard', date: d('2026-12-01'), done: false },
        { label: 'Milieu', date: d('2026-10-01'), done: false },
        { label: 'Fait avant tout', date: d('2026-01-01'), done: true },
        { label: 'Tôt', date: d('2026-09-20'), done: false },
      ],
    }
    expect(nextMilestone(decreasing)?.label).toBe('Tôt')
  })
})
