/** Archived projects, in declaration order, fitted to the archive template. */
import type { Portfolio } from '../model/portfolio'
import type { Project } from '../model/project'
import { isArchived } from './projects'
import { paginate } from './paginate'

/** Leaves room for the header, closing note and footer on screen and A4. */
export const ARCHIVES_PER_PAGE = 8

export function archivePages(p: Portfolio): readonly (readonly Project[])[] {
  return paginate(p.projects.filter(isArchived), ARCHIVES_PER_PAGE)
}
