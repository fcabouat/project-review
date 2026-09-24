/**
 * Recap pages — tracked projects in portfolio order, cut into
 * pages of `settings.recapRows`.
 */
import type { Portfolio } from '../model/portfolio'
import type { Project } from '../model/project'
import { isTracked, orderedProjects } from './projects'
import { paginate } from './paginate'

/**
 * Tracked projects in portfolio order, cut into recap pages of
 * `settings.recapRows`. The `>= 1` guard is belt-and-braces for hand-built
 * portfolios (the parse already confines the setting to 6–16) — a zero or
 * negative value would loop forever. No page is ever empty: an empty portfolio
 * yields NO page, and the deck emits no recap slide at all.
 */
export function recapPages(p: Portfolio): readonly (readonly Project[])[] {
  const requested = p.settings.recapRows >= 1 ? p.settings.recapRows : 11
  // Owner lines need enough height on both the 16:9 and A4 canvases.
  const hasTags = p.projects.some((project) => isTracked(project) && project.scopeTags?.length)
  const perPage = hasTags
    ? Math.min(requested, 6)
    : p.projects.some((project) => isTracked(project) && project.lead)
      ? Math.min(requested, 10)
      : requested
  return paginate(orderedProjects(p).filter(isTracked), perPage)
}
