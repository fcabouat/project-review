/**
 * Dashboard figures — the portfolio-dashboard tiles and bars and the
 * health-dashboard counters.
 * Every figure counts TRACKED projects only; archived ones are invisible here.
 */
import type { HealthLevel, Project } from '../model/project'
import type { Portfolio } from '../model/portfolio'
import type { GroupRef } from './projects'
import { isPreProject, isTracked, orphanProjects, projectsOfCategory } from './projects'
import { milestoneState } from './milestones'
import { pendingDecisions } from './decisions'

/** The six figures of the portfolio-dashboard tiles — every one counts TRACKED projects
 * only; archived ones are invisible to all of them. */
export interface Kpis {
  readonly tracked: number
  /** 'inProgress' AND not on hold — a paused project is not "active". */
  readonly active: number
  /**
   * Health 'alert' or 'critical', or on hold. 'watch' is deliberately NOT
   * counted — both catalog labels ('en alerte ou bloqués' / 'at risk or on
   * hold') name exactly these three, never 'watch'.
   */
  readonly atRiskOrBlocked: number
  /** Counts MILESTONES, not projects: one late project with three late
   * milestones weighs three. */
  readonly overdueMilestones: number
  readonly pendingDecisions: number
  /** Stage 'residuals' — done, but leftovers keep it on the radar. */
  readonly doneWithResiduals: number
}

/** Computes the {@link Kpis} in one pass over the portfolio — recomputed on
 * every render (law 3: nothing derived is ever stored). */
export function kpis(p: Portfolio): Kpis {
  const tracked = p.projects.filter(isTracked)
  return {
    tracked: tracked.length,
    active: tracked.filter((pr) => pr.stage === 'inProgress' && !pr.onHold).length,
    atRiskOrBlocked: tracked.filter(
      (pr) => pr.health === 'alert' || pr.health === 'critical' || pr.onHold,
    ).length,
    overdueMilestones: tracked.reduce(
      (n, pr) =>
        n +
        pr.milestones.filter((m) => milestoneState(m, p.review.reviewDate) === 'overdue').length,
      0,
    ),
    pendingDecisions: pendingDecisions(p).length,
    doneWithResiduals: tracked.filter((pr) => pr.stage === 'residuals').length,
  }
}

/** `notAssessed` mirrors the i18n key `level.notAssessed`: it is a catalog key, not a code name. */
export type HealthBreakdown = Readonly<Record<HealthLevel | 'notAssessed', number>>

/** The health dashboard's five counters, over tracked projects only; a project without a health
 * lands in `notAssessed`, so the five always sum to the tracked KPI. */
export function healthBreakdown(p: Portfolio): HealthBreakdown {
  const r = { onTrack: 0, watch: 0, alert: 0, critical: 0, notAssessed: 0 }
  for (const pr of p.projects) {
    if (!isTracked(pr)) continue
    r[pr.health ?? 'notAssessed'] += 1
  }
  return r
}

/** One portfolio-dashboard bar — tracked projects of one deck group, split by stage group ('done'
 * here = 'residuals': the only tracked "done" there is). */
export interface CategoryBar {
  /** Which group the bar counts — the same discriminated reference the deck's
   * dividers carry, so the bar of a category named `unsorted` and the bar of
   * the orphan residue are two bars with two keys (projections/projects.ts). */
  readonly group: GroupRef
  readonly preProject: number
  readonly inProgress: number
  readonly done: number
}

/**
 * Counts per stage group, non-empty categories only, in order; tracked
 * orphans close the march under the implicit "À classer" bar, so the bars
 * always sum to the tracked KPI.
 */
export function categoryBars(p: Portfolio): readonly CategoryBar[] {
  const bars: CategoryBar[] = []
  const push = (group: GroupRef, tracked: readonly Project[]): void => {
    if (tracked.length === 0) return
    bars.push({
      group,
      preProject: tracked.filter(isPreProject).length,
      inProgress: tracked.filter((pr) => pr.stage === 'inProgress').length,
      done: tracked.filter((pr) => pr.stage === 'residuals').length,
    })
  }
  for (const c of p.categories) {
    push({ kind: 'category', id: c.id }, projectsOfCategory(p, c.id).filter(isTracked))
  }
  push({ kind: 'orphans' }, orphanProjects(p).filter(isTracked))
  return bars
}
