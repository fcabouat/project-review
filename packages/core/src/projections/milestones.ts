/**
 * Milestone derivations — where a step stands relative to THIS
 * review, never to the wall clock.
 */
import type { IsoDate } from '../values/date'
import type { Milestone, Project } from '../model/project'

/** Where a milestone stands relative to THIS review — never to the wall clock. */
export type MilestoneState = 'done' | 'overdue' | 'upcoming'

/**
 * `done` is asserted data and wins unconditionally; only an unfinished
 * milestone can be overdue. A milestone dated ON the review day counts as
 * upcoming (strict `<`): today is not late yet.
 */
export function milestoneState(m: Milestone, reviewDate: IsoDate): MilestoneState {
  if (m.done) return 'done'
  return m.date < reviewDate ? 'overdue' : 'upcoming'
}

/** First unfinished milestone, by ascending date (overdue ones included). */
export function nextMilestone(pr: Project): Milestone | undefined {
  return pr.milestones
    .filter((m) => !m.done)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))[0]
}
