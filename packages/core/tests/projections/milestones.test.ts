/**
 * Pins the milestone derivations (`src/projections/milestones.ts`) — state
 * relative to the review date (the only reference date the domain uses) and
 * the next unfinished milestone, on both sample sets.
 */
import { describe, expect, it } from 'vitest'
import { milestoneState, nextMilestone, projectById } from '../../src/projections/index'
import { SAMPLE_SETS } from '../fixtures/sample-sets'

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
