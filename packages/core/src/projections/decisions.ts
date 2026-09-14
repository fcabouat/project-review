/**
 * Decision derivations — pending filters, reference dereferencing
 * and the D2bis pages.
 */
import type { Decision, Project } from '../model/project'
import type { Portfolio } from '../model/portfolio'
import type { DecisionRef } from './slide'
import { isTracked, orderedProjects, projectById } from './projects'
import { paginate } from './paginate'

/** Decisions of ONE project still awaiting an outcome, in the project's order — the filter the UI must not recode. */
export function pendingDecisionsOf(pr: Project): readonly Decision[] {
  return pr.decisions.filter((d) => d.taken === undefined)
}

/** Most recently settled decision for the project, for a sheet with no pending item. */
export function mostRecentTakenDecision(pr: Project): Decision | undefined {
  let latest: Decision | undefined
  for (const decision of pr.decisions) {
    if (
      decision.taken !== undefined &&
      (latest === undefined ||
        latest.taken === undefined ||
        decision.taken.when > latest.taken.when)
    )
      latest = decision
  }
  return latest
}

/**
 * Dereferences a {@link DecisionRef}. `undefined` covers both failure modes —
 * vanished project and out-of-range index — which can only bite a STALE ref:
 * refs are recomputed with the deck, so templates may treat this as
 * near-infallible, but must still render the miss as absence, not crash.
 */
export function decisionByRef(p: Portfolio, ref: DecisionRef): Decision | undefined {
  return projectById(p, ref.projectId)?.decisions[ref.index]
}

/** Pending decisions of tracked projects, in portfolio order. */
export function pendingDecisions(p: Portfolio): readonly DecisionRef[] {
  const refs: DecisionRef[] = []
  for (const pr of orderedProjects(p)) {
    if (!isTracked(pr)) continue
    pr.decisions.forEach((d, index) => {
      if (d.taken === undefined) refs.push({ projectId: pr.id, index })
    })
  }
  return refs
}

/** Settled decisions in the review window, inclusive at both ends. */
export function takenDecisionsSinceLastReview(p: Portfolio): readonly DecisionRef[] {
  const lower = p.review.previousReviewDate
  const upper = p.review.reviewDate
  const refs: DecisionRef[] = []
  for (const pr of orderedProjects(p)) {
    if (!isTracked(pr)) continue
    pr.decisions.forEach((d, index) => {
      if (d.taken && d.taken.when <= upper && (lower === undefined || d.taken.when >= lower))
        refs.push({ projectId: pr.id, index })
    })
  }
  return refs
}

/** Rows per D2bis page — fixed by the template's layout, unlike the
 * user-tunable `recapRows`. */
export const DECISIONS_PER_PAGE = 7

/** Pending decisions cut into pages of {@link DECISIONS_PER_PAGE} — same
 * no-empty-page property as `recapPages`. */
export function decisionPages(p: Portfolio): readonly (readonly DecisionRef[])[] {
  return paginate(pendingDecisions(p), DECISIONS_PER_PAGE)
}

/** The settled-decision table uses the same row capacity as pending decisions. */
export function previousDecisionPages(p: Portfolio): readonly (readonly DecisionRef[])[] {
  return paginate(takenDecisionsSinceLastReview(p), DECISIONS_PER_PAGE)
}
