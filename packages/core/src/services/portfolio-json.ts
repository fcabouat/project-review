/**
 * The portfolio as a FILE — name and payload of the .json export, the exact
 * inverse of the strict parse (`parse/`): what `serializePortfolio` writes,
 * `readPortfolioJson` (services/parse) accepts whole. The saved state is NOT
 * this file: persistence wraps the same portfolio in an envelope carrying its
 * revision and its undo/redo log (`services/persistence.ts`). The download
 * trigger itself (DOM) stays with the caller.
 */

import type { Portfolio } from '../model/portfolio'

/**
 * Download name of the exported portfolio. The review date (already
 * `YYYY-MM-DD`, filesystem-safe and sortable) is the natural version stamp —
 * successive reviews saved to one folder line up chronologically instead of
 * overwriting each other. A partial export (selected projects only) says so
 * in its name, so a contribution file never masquerades as the full base.
 */
export const portfolioFileName = (reviewDate: string, partial = false): string =>
  `project-review-${reviewDate}${partial ? '-partial' : ''}.json`

/**
 * Name under which the recovery screen hands back a stored envelope the strict
 * parse refused. No review date: reading the bytes is exactly what failed, so
 * there is no date to trust — and the name says what they are, an unreadable
 * saved state, rather than promising a portfolio.
 */
export const UNREADABLE_STATE_FILE_NAME = 'project-review-unreadable-state.json'

/** The exported payload: the bare portfolio, indented for hand editing. */
export const serializePortfolio = (portfolio: Portfolio): string =>
  JSON.stringify(portfolio, null, 2)

/**
 * The partial export: a VALID stand-alone v4 portfolio carrying the selected
 * projects, THEIR categories (present order and content), and the CURRENT
 * review, settings and identity — so the recipient opens the file alone in
 * the app and works in the owner's frame. Free slides stay home: they are the
 * owner's narrative, not content a colleague contributes back (and one could
 * anchor on a category the selection leaves out).
 */
export const partialPortfolio = (p: Portfolio, selected: ReadonlySet<string>): Portfolio => {
  const projects = p.projects.filter((x) => selected.has(x.id))
  const used = new Set(projects.map((x) => x.categoryId))
  return {
    version: 4,
    review: p.review,
    settings: p.settings,
    categories: p.categories.filter((c) => used.has(c.id)),
    projects,
    freeSlides: [],
  }
}
